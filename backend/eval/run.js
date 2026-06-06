#!/usr/bin/env node
// Behavioral eval for the La Feuille bot.
//
//   node backend/eval/run.js [--only=<id|category>]   (or: npm run eval)
//
// Runs OUTSIDE vitest/verify.js — on demand, never a CI gate (it makes real API
// calls). Bot under test = the module's current config (claude-sonnet-4-6,
// MAX_TOKENS 1024, NO thinking) via the REAL startConversation/continueConversation.
// Judge = claude-opus-4-8. Needs ANTHROPIC_API_KEY (e.g. load backend/.env.railway.local).
//
// Scorecard (json + md + latest.md) is written to backend/eval/results/ (gitignored).

const fs = require('fs');
const path = require('path');

const claudeService = require('../src/services/claudeService');
const { startConversation, continueConversation, formatScenarioForClaude, buildSystemPrompt, formatPastAnnotations, MODEL, MAX_TOKENS } = claudeService;
const { loadFeuille, buildConversationHistory, stripCaptureRules } = require('../src/training/conversationContext');
const { caseTypeFor } = require('../src/training/divergence');
const cardFeatures = require('../src/game/cardFeatures');
const { runDeterministic } = require('./lib/assertions');
const { judge, JUDGE_MODEL } = require('./lib/judge');
const CASES = require('./cases/cases');

const SCENARIOS_DIR = path.join(__dirname, '..', 'src', 'training', 'scenarios');
const TRAINING_ROOT = process.env.TRAINING_DATA_DIR || path.join(__dirname, '..', 'data', 'training');
const RESULTS_DIR = path.join(__dirname, 'results');
const CONCURRENCY = 2; // ≤2-3 parallel cases (SDK already retries 429/529)

function loadScenario(id) {
  const p = path.join(SCENARIOS_DIR, `${id}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
function loadAnnotation(rel) {
  const p = path.join(TRAINING_ROOT, rel);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
// Mirrors server.js:403-412 — rehydrate the last card selection so the seed
// matches what production sent.
function rehydrateCardSelection(annotation) {
  const sels = annotation && annotation.claude_conversation && annotation.claude_conversation.card_selections;
  const last = sels && sels.length ? sels[sels.length - 1] : null;
  if (!last) return null;
  return { selectedCards: last.selectedCards, features: cardFeatures.computeFeatures(last.selectedCards, last.trumpSuit ?? null) };
}

async function runCase(c) {
  const scenario = loadScenario(c.scenarioId);
  if (!scenario) return { id: c.id, category: c.category, source: c.source, skipped: true, reason: `scénario introuvable: ${c.scenarioId}` };

  const isSynthetic = !c.annotationFile;
  let annotation, caseType, cardSelection, userId, userName;

  if (isSynthetic) {
    annotation = { username: c.userName, userId: c.userId || null,
      decisions: [{ action: c.inlineAction, note: c.inlineNote || '', divergenceType: null }] };
    caseType = c.caseType;
    cardSelection = null;
    userId = c.userId || null;
    userName = c.userName || 'l\'utilisateur';
  } else {
    annotation = loadAnnotation(c.annotationFile);
    if (!annotation) return { id: c.id, category: c.category, source: c.source, skipped: true, reason: `annotation locale absente (gitignored): ${c.annotationFile}` };
    caseType = caseTypeFor(annotation.decisions?.[0]?.divergenceType);
    cardSelection = rehydrateCardSelection(annotation);
    userId = annotation.userId || null;
    userName = annotation.username || 'l\'utilisateur';
  }

  const feuilleContent = loadFeuille();
  // The EXACT system prompt the bot uses (start/continueConversation build the
  // same internally) — passed to the judge as factual context.
  const botSystemPrompt = buildSystemPrompt({
    feuilleContent, userName, userPastAnnotations: formatPastAnnotations([]),
    caseType, cardSelection, userId,
  });

  // ── Run the bot through the REAL entry points ───────────────────────────────
  let botOutput, botUsage, seedForJudge, frozenForJudge, probeForJudge;
  if (c.mode === 'turn1') {
    const r = await startConversation({ scenario, annotation, userId, userName, pastAnnotations: [], feuilleContent, caseType, cardSelection });
    botOutput = r.text; botUsage = r.usage;
    seedForJudge = formatScenarioForClaude(scenario, annotation, cardSelection);
    frozenForJudge = []; probeForJudge = null;
  } else {
    const prior = isSynthetic
      ? (c.inlineFrozenHistory || [])
      : (annotation.claude_conversation.messages || []).slice(0, c.freezeUpToMessageIndex + 1);
    const conversationHistory = buildConversationHistory(scenario, annotation, cardSelection, prior);
    const r = await continueConversation({
      conversationHistory, userMessage: c.probeUserTurn,
      context: { feuilleContent, userId, userName, pastAnnotations: [], caseType, cardSelection },
    });
    botOutput = r.text; botUsage = r.usage;
    seedForJudge = conversationHistory[0].content; frozenForJudge = prior; probeForJudge = c.probeUserTurn;
  }

  // ── Apply the REAL CAPTURE_RULE strip — assert + judge the USER-VISIBLE text ─
  // server.js strips these silent lines before persistence/FE; the eval judges
  // the same post-strip output. The stripped rules are LOGGED (observed), never
  // scored, so over-capture can be watched separately.
  const botOutputRaw = botOutput;
  const stripped = stripCaptureRules(botOutputRaw);
  const captureRules = stripped.rules;
  botOutput = stripped.cleanText;
  // For the JUDGE, an empty post-strip turn is presented NEUTRALLY: the judge
  // must see only the user-visible text, never that a CAPTURE_RULE was stripped
  // (that observation lives in the scorecard tally, not the judge's input).
  const visible = (botOutput && botOutput.trim())
    ? botOutput
    : '(le bot n\'a produit aucun texte visible à l\'utilisateur ce tour-ci.)';

  // ── Deterministic checks (on the post-strip text) ───────────────────────────
  const det = runDeterministic(botOutput, c, scenario);
  const blocking = det.checks.filter(x => x.blocking);
  const allBlockingPass = blocking.every(x => x.pass);

  // ── Judge (on the post-strip, user-visible text) ────────────────────────────
  let judgeRes = null;
  if (c.judge) {
    judgeRes = await judge(c.judge, { botSystemPrompt, seed: seedForJudge, frozen: frozenForJudge, probe: probeForJudge, botOutput: visible });
  }

  const pass = allBlockingPass && (judgeRes ? judgeRes.verdict === 'PASS' : true);
  const leading = judgeRes
    ? { detected: judgeRes.leading_detected, excerpt: judgeRes.leading_excerpt, by: 'juge' }
    : { detected: det.leadingHint.present, excerpt: det.leadingHint.excerpt, by: 'heuristique' };

  return {
    id: c.id, category: c.category, caseType, source: c.source, expected: c.expected, mode: c.mode,
    botOutput,            // post-strip (user-visible; may be '')
    botOutputRaw,         // raw (pre-strip) for traceability
    captureRules,         // stripped CAPTURE_RULE lines (observed, not scored)
    deterministic: det.checks,
    signals: det.signals,
    judge: judgeRes ? { rubric: c.judge, verdict: judgeRes.verdict, reason: judgeRes.reason,
      leading_detected: judgeRes.leading_detected, leading_excerpt: judgeRes.leading_excerpt } : null,
    leading,
    usage: { bot: botUsage || null, judge: judgeRes ? judgeRes.usage || null : null },
    pass, skipped: false,
  };
}

async function runPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); }
      catch (e) { out[idx] = { id: items[idx].id, category: items[idx].category, source: items[idx].source, error: String(e && e.message || e), pass: false, skipped: false }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

function fmtChecks(checks) {
  return checks.map(c => {
    const tag = c.blocking ? '' : ' _(non-bloquant)_';
    return `  - ${c.pass ? '✅' : '❌'} \`${c.name}\`${tag} — ${c.detail}`;
  }).join('\n');
}

function renderMd(report) {
  const L = [];
  L.push(`# Éval comportementale — La Feuille (baseline)`);
  L.push('');
  L.push(`- **Bot testé** : \`${report.model}\` (MAX_TOKENS ${report.maxTokens}, sans thinking)`);
  L.push(`- **Juge** : \`${report.judgeModel}\``);
  L.push(`- **Lancé** : ${report.startedAt}`);
  const counted = report.cases.filter(c => !c.skipped && !c.error);
  const pass = counted.filter(c => c.pass).length;
  L.push(`- **Total** : ${pass}/${counted.length} PASS  ·  ${report.cases.filter(c => c.skipped).length} skipped  ·  ${report.cases.filter(c => c.error).length} erreur(s)`);
  L.push('');
  L.push('## Totaux par catégorie');
  L.push('');
  L.push('| Catégorie | PASS | FAIL | skipped |');
  L.push('|---|---|---|---|');
  for (const [cat, t] of Object.entries(report.totalsByCategory)) {
    L.push(`| ${cat} | ${t.pass} | ${t.fail} | ${t.skipped || 0} |`);
  }
  L.push('');
  L.push('## Détail par cas');
  for (const c of report.cases) {
    L.push('');
    L.push(`### ${c.id} — ${c.category}${c.skipped ? ' _(SKIPPED)_' : c.error ? ' _(ERREUR)_' : (c.pass ? ' ✅ PASS' : ' ❌ FAIL')}`);
    L.push(`- source : ${c.source || ''}`);
    if (c.expected) L.push(`- attendu : ${c.expected}`);
    if (c.skipped) { L.push(`- **SKIPPED** : ${c.reason}`); continue; }
    if (c.error) { L.push(`- **ERREUR** : ${c.error}`); continue; }
    L.push(`- caseType : \`${c.caseType}\` · mode : \`${c.mode}\``);
    L.push('');
    L.push('**Réponse réelle du bot (post-strip, user-visible) :**');
    L.push('');
    const vis = (c.botOutput && c.botOutput.trim()) ? c.botOutput : '(aucun texte visible — uniquement des lignes CAPTURE_RULE, strippées)';
    L.push('> ' + String(vis).replace(/\n/g, '\n> '));
    if (c.captureRules && c.captureRules.length) {
      L.push('');
      L.push(`**CAPTURE_RULE émis (strippé · observé · n'affecte pas le verdict)** : ${c.captureRules.length}`);
      for (const r of c.captureRules) L.push(`  - « ${r} »`);
    }
    L.push('');
    L.push('**Checks déterministes :**');
    L.push(fmtChecks(c.deterministic));
    if (c.signals && c.signals.length) {
      L.push('**Signaux (observés, non scorés) :**');
      L.push(c.signals.map(s => `  - ${s.present ? '🔹' : '▫️'} \`${s.name}\` — ${s.detail}`).join('\n'));
    }
    if (c.judge) {
      L.push(`**Juge (${c.judge.rubric})** : ${c.judge.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'} — ${c.judge.reason}`);
    } else {
      L.push('**Juge** : (aucun — verdict purement déterministe)');
    }
    L.push(`**Leading/cadrage** : ${c.leading.detected ? `⚠️ détecté (${c.leading.by})` : 'non'}${c.leading.excerpt ? ` — « ${c.leading.excerpt} »` : ''}`);
    const bu = c.usage && c.usage.bot ? `${c.usage.bot.input_tokens || 0}→${c.usage.bot.output_tokens || 0}` : 'n/a';
    const ju = c.usage && c.usage.judge ? `${c.usage.judge.input_tokens || 0}→${c.usage.judge.output_tokens || 0}` : 'n/a';
    L.push(`**Tokens** : bot ${bu} · juge ${ju}`);
  }
  L.push('');
  L.push('## « Leading / cadrage » observé (fréquence, pas un score)');
  const lead = report.leadingObservations;
  L.push(`- ${lead.length} cas sur ${counted.length} évalués présentent une question suggestive de cadrage.`);
  for (const o of lead) L.push(`  - ${o.id} : « ${o.excerpt || '(flag juge sans extrait)'} »`);
  L.push('');
  L.push('## « CAPTURE_RULE » émis (observé — n\'affecte pas les scores)');
  const cap = report.captureRuleObservations;
  const totalLines = cap.reduce((n, o) => n + o.rules.length, 0);
  L.push(`- ${cap.length} cas sur ${counted.length} ont émis ≥ 1 ligne CAPTURE_RULE (total ${totalLines}). En prod ces lignes sont strippées avant l'affichage utilisateur.`);
  for (const o of cap) L.push(`  - ${o.id} : ${o.rules.length} ligne(s)`);
  L.push('');
  return L.join('\n');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERREUR : ANTHROPIC_API_KEY absent. Charge-le, ex :');
    console.error('  cd backend && export $(cat .env.railway.local | xargs) && npm run eval');
    process.exit(1);
  }
  const onlyArg = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
  let cases = CASES;
  if (onlyArg) cases = CASES.filter(c => c.id === onlyArg || c.category === onlyArg);
  if (!cases.length) { console.error(`Aucun cas pour --only=${onlyArg}`); process.exit(1); }

  console.log(`Éval : ${cases.length} cas · bot=${MODEL} · juge=${JUDGE_MODEL} · concurrence=${CONCURRENCY}`);
  const startedAt = new Date().toISOString();
  const results = await runPool(cases, CONCURRENCY, async (c) => {
    const r = await runCase(c);
    const status = r.skipped ? 'SKIP' : r.error ? 'ERR ' : (r.pass ? 'PASS' : 'FAIL');
    console.log(`  [${status}] ${r.id}`);
    return r;
  });

  const totalsByCategory = {};
  for (const r of results) {
    const t = totalsByCategory[r.category] || (totalsByCategory[r.category] = { pass: 0, fail: 0, skipped: 0 });
    if (r.skipped) t.skipped++;
    else if (r.error) t.fail++;
    else if (r.pass) t.pass++;
    else t.fail++;
  }
  const leadingObservations = results.filter(r => r.leading && r.leading.detected).map(r => ({ id: r.id, excerpt: r.leading.excerpt }));
  const captureRuleObservations = results.filter(r => r.captureRules && r.captureRules.length).map(r => ({ id: r.id, rules: r.captureRules }));

  const report = {
    model: MODEL, maxTokens: MAX_TOKENS, judgeModel: JUDGE_MODEL, startedAt,
    totalsByCategory, leadingObservations, captureRuleObservations, cases: results,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(RESULTS_DIR, `eval-${stamp}.json`);
  const mdPath = path.join(RESULTS_DIR, `eval-${stamp}.md`);
  const md = renderMd(report);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(path.join(RESULTS_DIR, 'latest.md'), md);

  const counted = results.filter(c => !c.skipped && !c.error);
  console.log(`\nTotal : ${counted.filter(c => c.pass).length}/${counted.length} PASS · ${results.filter(c => c.skipped).length} skipped`);
  console.log(`Scorecard : ${path.relative(process.cwd(), mdPath)}`);
}

main().catch(e => { console.error(e); process.exit(1); });

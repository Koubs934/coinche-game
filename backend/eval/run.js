#!/usr/bin/env node
// Behavioral eval for the La Feuille bot — MULTI-SAMPLE.
//
//   node backend/eval/run.js [--samples=N] [--only=<id|category>]   (npm run eval)
//
// The bot (claude-sonnet-4-6, default temperature, no thinking) is stochastic, so
// a single run's pass/fail wobbles on borderline cases. We run each case N times
// on the SAME seed/history/probe and report a per-case pass count k/N + a
// stability class. Runs OUTSIDE vitest/verify.js — on demand, never a CI gate.
//
// Bot under test = the module's current config via the REAL start/continueConversation.
// Judge = claude-opus-4-8, once per sample (the bot is the dominant variance).
// Needs ANTHROPIC_API_KEY (e.g. load backend/.env.railway.local).
// Scorecard (json + md + latest.md) → backend/eval/results/ (gitignored).

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
const CONCURRENCY = 2;        // ≤2-3 parallel cases; samples WITHIN a case run sequentially
const DEFAULT_SAMPLES = 3;

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

// Resolve everything static for a case ONCE (scenario, annotation, system prompt,
// seed/history) and return a `callBot()` closure invoked per sample.
function resolveInputs(c) {
  const scenario = loadScenario(c.scenarioId);
  if (!scenario) return { skip: `scénario introuvable: ${c.scenarioId}` };

  const isSynthetic = !c.annotationFile;
  let annotation, caseType, cardSelection, userId, userName;
  if (isSynthetic) {
    annotation = { username: c.userName, userId: c.userId || null,
      decisions: [{ action: c.inlineAction, note: c.inlineNote || '', divergenceType: null }] };
    caseType = c.caseType; cardSelection = null;
    userId = c.userId || null; userName = c.userName || 'l\'utilisateur';
  } else {
    annotation = loadAnnotation(c.annotationFile);
    if (!annotation) return { skip: `annotation locale absente (gitignored): ${c.annotationFile}` };
    caseType = caseTypeFor(annotation.decisions?.[0]?.divergenceType);
    cardSelection = rehydrateCardSelection(annotation);
    userId = annotation.userId || null; userName = annotation.username || 'l\'utilisateur';
  }

  const feuilleContent = loadFeuille();
  const botSystemPrompt = buildSystemPrompt({
    feuilleContent, userName, userPastAnnotations: formatPastAnnotations([]), caseType, cardSelection, userId,
  });

  let callBot, seedForJudge, frozenForJudge, probeForJudge;
  if (c.mode === 'turn1') {
    seedForJudge = formatScenarioForClaude(scenario, annotation, cardSelection);
    frozenForJudge = []; probeForJudge = null;
    callBot = () => startConversation({ scenario, annotation, userId, userName, pastAnnotations: [], feuilleContent, caseType, cardSelection });
  } else {
    const prior = isSynthetic
      ? (c.inlineFrozenHistory || [])
      : (annotation.claude_conversation.messages || []).slice(0, c.freezeUpToMessageIndex + 1);
    const conversationHistory = buildConversationHistory(scenario, annotation, cardSelection, prior);
    seedForJudge = conversationHistory[0].content; frozenForJudge = prior; probeForJudge = c.probeUserTurn;
    callBot = () => continueConversation({ conversationHistory, userMessage: c.probeUserTurn,
      context: { feuilleContent, userId, userName, pastAnnotations: [], caseType, cardSelection } });
  }
  return { scenario, caseType, botSystemPrompt, seedForJudge, frozenForJudge, probeForJudge, callBot };
}

// One sample: call the bot, strip CAPTURE_RULE, run deterministic asserts + judge
// on the user-visible text. Returns the per-sample verdict + detail.
async function scoreSample(c, inputs) {
  const r = await inputs.callBot();
  const botOutputRaw = r.text;
  const stripped = stripCaptureRules(botOutputRaw);
  const captureRules = stripped.rules;
  const botOutput = stripped.cleanText;
  // The JUDGE sees ONLY the user-visible text; an empty post-strip turn is shown
  // neutrally (never reveal a CAPTURE_RULE was stripped — that's our tally).
  const visible = (botOutput && botOutput.trim())
    ? botOutput
    : '(le bot n\'a produit aucun texte visible à l\'utilisateur ce tour-ci.)';

  const det = runDeterministic(botOutput, c, inputs.scenario);
  const blocking = det.checks.filter(x => x.blocking);
  const allBlockingPass = blocking.every(x => x.pass);

  let judgeRes = null;
  if (c.judge) judgeRes = await judge(c.judge, {
    botSystemPrompt: inputs.botSystemPrompt, seed: inputs.seedForJudge,
    frozen: inputs.frozenForJudge, probe: inputs.probeForJudge, botOutput: visible,
  });

  const pass = allBlockingPass && (judgeRes ? judgeRes.verdict === 'PASS' : true);
  const leading = judgeRes
    ? { detected: judgeRes.leading_detected, excerpt: judgeRes.leading_excerpt, by: 'juge' }
    : { detected: det.leadingHint.present, excerpt: det.leadingHint.excerpt, by: 'heuristique' };

  // Reasons this sample failed (for wobble/fail display): blocking det fails + judge.
  const reasons = blocking.filter(x => !x.pass).map(x => `${x.name} (${x.detail})`);
  if (judgeRes && judgeRes.verdict !== 'PASS') reasons.push(`juge:${c.judge} (${judgeRes.reason})`);

  return {
    pass, botOutput, botOutputRaw, captureRules,
    deterministic: det.checks, signals: det.signals,
    judge: judgeRes ? { rubric: c.judge, verdict: judgeRes.verdict, reason: judgeRes.reason,
      leading_detected: judgeRes.leading_detected, leading_excerpt: judgeRes.leading_excerpt } : null,
    leading, reasons,
    usage: { bot: r.usage || null, judge: judgeRes ? judgeRes.usage || null : null },
  };
}

async function runCase(c, samples) {
  const inputs = resolveInputs(c);
  if (inputs.skip) return { id: c.id, category: c.category, source: c.source, skipped: true, reason: inputs.skip };

  const sampleResults = [];
  for (let s = 0; s < samples; s++) sampleResults.push(await scoreSample(c, inputs));

  const passCount = sampleResults.filter(s => s.pass).length;
  const classification = passCount === samples ? 'STABLE-PASS' : passCount === 0 ? 'STABLE-FAIL' : 'WOBBLE';

  // Distinct failure modes across failing samples → { reasonName: count }.
  const failureModes = {};
  for (const s of sampleResults) {
    if (s.pass) continue;
    const seen = new Set();
    for (const reason of s.reasons) {
      const key = reason.split(' (')[0]; // collapse to the check/judge name
      if (seen.has(key)) continue; seen.add(key);
      failureModes[key] = (failureModes[key] || 0) + 1;
    }
  }

  return {
    id: c.id, category: c.category, caseType: inputs.caseType, source: c.source,
    expected: c.expected, mode: c.mode, samples, passCount, classification,
    failureModes, sampleResults, skipped: false,
  };
}

async function runPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); }
      catch (e) { out[idx] = { id: items[idx].id, category: items[idx].category, source: items[idx].source, error: String(e && e.message || e), skipped: false }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

const CLASS_BADGE = { 'STABLE-PASS': '✅ STABLE-PASS', 'WOBBLE': '🟡 WOBBLE', 'STABLE-FAIL': '❌ STABLE-FAIL' };

function fmtChecks(checks) {
  return checks.map(c => `  - ${c.pass ? '✅' : '❌'} \`${c.name}\`${c.blocking ? '' : ' _(non-bloquant)_'} — ${c.detail}`).join('\n');
}

function renderMd(report) {
  const L = [];
  const N = report.samples;
  L.push('# Éval comportementale — La Feuille (multi-échantillon)');
  L.push('');
  L.push(`- **Bot testé** : \`${report.model}\` (MAX_TOKENS ${report.maxTokens}, sans thinking, température par défaut)`);
  L.push(`- **Juge** : \`${report.judgeModel}\` (1× par échantillon)`);
  L.push(`- **Échantillons par cas** : ${N}`);
  L.push(`- **Lancé** : ${report.startedAt}`);
  const a = report.aggregate;
  L.push(`- **Agrégat** : moyenne **${a.meanPass.toFixed(1)}/${a.counted}** PASS par run · STABLE-PASS ${a.stablePass} · 🟡 WOBBLE ${a.wobble} · ❌ STABLE-FAIL ${a.stableFail} · skipped ${a.skipped} · erreurs ${a.errors}`);
  L.push('');

  L.push('## Wobble / fails par catégorie');
  L.push('');
  L.push('| Catégorie | STABLE-PASS | 🟡 WOBBLE | ❌ STABLE-FAIL |');
  L.push('|---|---|---|---|');
  for (const [cat, t] of Object.entries(report.byCategory)) {
    L.push(`| ${cat} | ${t.stablePass} | ${t.wobble.join(', ') || '—'} | ${t.stableFail.join(', ') || '—'} |`);
  }
  L.push('');
  const coreUnstable = report.coreModesUnstable;
  if (coreUnstable.length) {
    L.push(`> ⚠️ **MODES CŒUR INSTABLES** : ${coreUnstable.join(' · ')}. Over-validation (cat 1) et hallucination (cat 2) sont les modes qu'on a le plus besoin de tenir — un wobble/fail ici est prioritaire.`);
  } else {
    L.push('> ✅ Aucun wobble/fail sur les modes cœur (over-validation cat 1, hallucination cat 2) : ils sont STABLE-PASS sur tous les échantillons.');
  }
  L.push('');

  L.push('## Détail par cas');
  for (const c of report.cases) {
    L.push('');
    if (c.skipped) { L.push(`### ${c.id} — ${c.category} _(SKIPPED)_`); L.push(`- ${c.reason}`); continue; }
    if (c.error)  { L.push(`### ${c.id} — ${c.category} _(ERREUR)_`); L.push(`- ${c.error}`); continue; }
    L.push(`### ${c.id} — ${c.category} · ${CLASS_BADGE[c.classification]} **${c.passCount}/${N}**`);
    L.push(`- source : ${c.source || ''}`);
    if (c.expected) L.push(`- attendu : ${c.expected}`);
    L.push(`- caseType : \`${c.caseType}\` · mode : \`${c.mode}\``);
    if (c.classification !== 'STABLE-PASS') {
      const modes = Object.entries(c.failureModes).map(([k, n]) => `${k} ×${n}`).join(', ');
      L.push(`- **modes d'échec (sur les échantillons en échec)** : ${modes}`);
    }
    // Representative sample: a FAILING one if not stable-pass, else the first.
    const rep = c.classification === 'STABLE-PASS' ? c.sampleResults[0] : c.sampleResults.find(s => !s.pass);
    L.push('');
    L.push(`**Échantillon ${c.classification === 'STABLE-PASS' ? 'représentatif (PASS)' : 'en échec'} — réponse réelle du bot (post-strip, user-visible) :**`);
    L.push('');
    const vis = (rep.botOutput && rep.botOutput.trim()) ? rep.botOutput : '(aucun texte visible — uniquement des lignes CAPTURE_RULE, strippées)';
    L.push('> ' + String(vis).replace(/\n/g, '\n> '));
    if (rep.captureRules && rep.captureRules.length) {
      L.push('');
      L.push(`**CAPTURE_RULE émis dans cet échantillon (strippé · observé)** : ${rep.captureRules.length}`);
      for (const r of rep.captureRules) L.push(`  - « ${r} »`);
    }
    L.push('');
    if (c.classification !== 'STABLE-PASS' && rep.reasons.length) {
      L.push(`**Pourquoi cet échantillon échoue** : ${rep.reasons.join(' · ')}`);
    }
    L.push('**Checks déterministes (cet échantillon) :**');
    L.push(fmtChecks(rep.deterministic));
    if (rep.signals && rep.signals.length) {
      L.push('**Signaux (observés, non scorés) :**');
      L.push(rep.signals.map(s => `  - ${s.present ? '🔹' : '▫️'} \`${s.name}\` — ${s.detail}`).join('\n'));
    }
    if (rep.judge) L.push(`**Juge (${rep.judge.rubric})** : ${rep.judge.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'} — ${rep.judge.reason}`);
    else L.push('**Juge** : (aucun — verdict purement déterministe)');
  }
  L.push('');

  L.push('## « Leading / cadrage » observé (agrégé sur les échantillons — n\'affecte pas les scores)');
  if (!report.leadingObservations.length) L.push('- Aucun.');
  for (const o of report.leadingObservations) L.push(`  - ${o.id} : ${o.samples}/${N} échantillon(s) — « ${o.excerpt || '(flag juge sans extrait)'} »`);
  L.push('');
  L.push('## « CAPTURE_RULE » émis (agrégé sur les échantillons — n\'affecte pas les scores)');
  if (!report.captureRuleObservations.length) L.push('- Aucun.');
  for (const o of report.captureRuleObservations) L.push(`  - ${o.id} : ${o.samples}/${N} échantillon(s), ${o.totalLines} ligne(s) au total — ex. « ${o.example} »`);
  L.push('');
  return L.join('\n');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERREUR : ANTHROPIC_API_KEY absent. Charge-le, ex :');
    console.error('  cd backend && export $(cat .env.railway.local | xargs) && npm run eval');
    process.exit(1);
  }
  const samplesArg = (process.argv.find(a => a.startsWith('--samples=')) || '').split('=')[1];
  const samples = Math.max(1, parseInt(samplesArg, 10) || DEFAULT_SAMPLES);
  const onlyArg = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
  let cases = CASES;
  if (onlyArg) cases = CASES.filter(c => c.id === onlyArg || c.category === onlyArg);
  if (!cases.length) { console.error(`Aucun cas pour --only=${onlyArg}`); process.exit(1); }

  console.log(`Éval : ${cases.length} cas × ${samples} échantillons · bot=${MODEL} · juge=${JUDGE_MODEL} · concurrence=${CONCURRENCY}`);
  const startedAt = new Date().toISOString();
  const results = await runPool(cases, CONCURRENCY, async (c) => {
    const r = await runCase(c, samples);
    const status = r.skipped ? 'SKIP' : r.error ? 'ERR ' : `${CLASS_BADGE[r.classification].replace(/^.. /, '')} ${r.passCount}/${samples}`;
    console.log(`  [${status}] ${r.id}`);
    return r;
  });

  const counted = results.filter(r => !r.skipped && !r.error);
  const stablePass = counted.filter(r => r.classification === 'STABLE-PASS');
  const wobble = counted.filter(r => r.classification === 'WOBBLE');
  const stableFail = counted.filter(r => r.classification === 'STABLE-FAIL');
  const meanPass = counted.reduce((n, r) => n + r.passCount, 0) / samples;

  const byCategory = {};
  for (const r of counted) {
    const t = byCategory[r.category] || (byCategory[r.category] = { stablePass: 0, wobble: [], stableFail: [] });
    if (r.classification === 'STABLE-PASS') t.stablePass++;
    else if (r.classification === 'WOBBLE') t.wobble.push(`${r.id} (${r.passCount}/${samples})`);
    else t.stableFail.push(`${r.id} (0/${samples})`);
  }
  // Core modes we most need robust: cat 1 (over-validation), cat 2 (hallucination).
  const coreModesUnstable = [];
  for (const [cat, t] of Object.entries(byCategory)) {
    if (!(cat.startsWith('1-') || cat.startsWith('2-'))) continue;
    const bad = [...t.wobble, ...t.stableFail];
    if (bad.length) coreModesUnstable.push(`${cat}: ${bad.join(', ')}`);
  }

  const leadingObservations = [];
  for (const r of counted) {
    const hits = r.sampleResults.filter(s => s.leading && s.leading.detected);
    if (hits.length) leadingObservations.push({ id: r.id, samples: hits.length, excerpt: hits[0].leading.excerpt });
  }
  const captureRuleObservations = [];
  for (const r of counted) {
    const withCap = r.sampleResults.filter(s => s.captureRules && s.captureRules.length);
    if (withCap.length) captureRuleObservations.push({
      id: r.id, samples: withCap.length,
      totalLines: withCap.reduce((n, s) => n + s.captureRules.length, 0),
      example: withCap[0].captureRules[0],
    });
  }

  const report = {
    model: MODEL, maxTokens: MAX_TOKENS, judgeModel: JUDGE_MODEL, startedAt, samples,
    aggregate: { meanPass, counted: counted.length, stablePass: stablePass.length, wobble: wobble.length,
      stableFail: stableFail.length, skipped: results.filter(r => r.skipped).length, errors: results.filter(r => r.error).length },
    byCategory, coreModesUnstable, leadingObservations, captureRuleObservations, cases: results,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = startedAt.replace(/[:.]/g, '-');
  const md = renderMd(report);
  fs.writeFileSync(path.join(RESULTS_DIR, `eval-${stamp}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(RESULTS_DIR, `eval-${stamp}.md`), md);
  fs.writeFileSync(path.join(RESULTS_DIR, 'latest.md'), md);

  console.log(`\nMoyenne ${meanPass.toFixed(1)}/${counted.length} PASS par run · STABLE-PASS ${stablePass.length} · WOBBLE ${wobble.length} · STABLE-FAIL ${stableFail.length}`);
  if (coreModesUnstable.length) console.log(`⚠️ modes cœur instables : ${coreModesUnstable.join(' | ')}`);
  console.log(`Scorecard : ${path.relative(process.cwd(), path.join(RESULTS_DIR, `eval-${stamp}.md`))}`);
}

main().catch(e => { console.error(e); process.exit(1); });

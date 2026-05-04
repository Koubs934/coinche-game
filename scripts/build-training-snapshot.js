#!/usr/bin/env node
// Read every training annotation under backend/data/training/<source>/ and
// emit a single self-contained markdown report at docs/training-snapshot-
// <YYYY-MM-DD>.md. The report mirrors the structure of the original
// hand-written 2026-04-21 snapshot (summary stats, per-scenario breakdown,
// tag histogram, convergence/divergence) AND adds new sections that score
// each annotation against the scenario's `expectedAnswer` field — the
// "rule consistency" view that the schemaVersion 2 bump enables.
//
// Source-dir override: set TRAINING_SNAPSHOT_SOURCE to a different folder
// under backend/data/training/ (default: the existing 2026-04-21 mirror).
//
// Anonymization: usernames pass through verbatim — the existing report
// already shows them. userIds are kept too because the existing report
// quotes them; they're already in the gitignored snapshot dir, so leaving
// them intact in the markdown is consistent. If we ever re-host the report
// somewhere user-visible, swap to per-user codes the way build-games-
// report.js does.
//
// No expectedAnswer rendering for the picker / annotation UI: this script
// only writes to docs/. Hard requirement — exposing expected answers would
// bias data collection.

const fs   = require('fs');
const path = require('path');

const REPO_ROOT     = path.resolve(__dirname, '..');
const TRAINING_DIR  = path.join(REPO_ROOT, 'backend', 'data', 'training');
const SCENARIOS_DIR = path.join(REPO_ROOT, 'backend', 'src', 'training', 'scenarios');
const SOURCE_NAME   = process.env.TRAINING_SNAPSHOT_SOURCE || '_snapshot-source-2026-04-21';
const SOURCE_DIR    = path.join(TRAINING_DIR, SOURCE_NAME);
const TODAY         = new Date().toISOString().slice(0, 10);
const OUT_FILE      = path.join(REPO_ROOT, 'docs', `training-snapshot-${TODAY}.md`);

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

// ─── I/O ────────────────────────────────────────────────────────────────────

function readAllScenarios() {
  const out = new Map();
  for (const f of fs.readdirSync(SCENARIOS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const full = path.join(SCENARIOS_DIR, f);
    const raw  = fs.readFileSync(full, 'utf8');
    const obj  = JSON.parse(raw);
    out.set(obj.id, obj);
  }
  return out;
}

function readAllAnnotations() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`source not found: ${SOURCE_DIR}`);
  }
  const annotations = [];
  const exhaustedByUser = new Map();
  for (const userEntry of fs.readdirSync(SOURCE_DIR)) {
    const userDir = path.join(SOURCE_DIR, userEntry);
    const stat    = fs.statSync(userDir);
    if (!stat.isDirectory()) continue; // skip _analysis.json, top-level _exhausted.json, etc.
    for (const file of fs.readdirSync(userDir)) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(userDir, file);
      const raw  = fs.readFileSync(full, 'utf8');
      let rec;
      try { rec = JSON.parse(raw); } catch (err) {
        console.warn(`[skip] parse error: ${full}: ${err.message}`);
        continue;
      }
      if (file === '_exhausted.json') {
        exhaustedByUser.set(rec.userId || userEntry, rec.exhaustedScenarios || []);
        continue;
      }
      annotations.push(rec);
    }
  }
  return { annotations, exhaustedByUser };
}

// ─── Domain helpers ─────────────────────────────────────────────────────────

function actionLabel(action) {
  if (!action) return '(none)';
  if (action.type === 'pass')        return 'pass';
  if (action.type === 'coinche')     return 'coinche';
  if (action.type === 'surcoinche')  return 'surcoinche';
  if (action.type === 'bid') {
    const val = action.value === 'capot' ? 'capot' : action.value;
    const sym = action.suit === null || action.suit === undefined ? '' : (SUIT_SYM[action.suit] || action.suit);
    return `bid ${val}${sym ? ' ' + sym : ''}`;
  }
  if (action.type === 'play-card' && action.card) {
    return `play ${action.card.value}${SUIT_SYM[action.card.suit] || action.card.suit}`;
  }
  return JSON.stringify(action);
}

// Compare a user-submitted action to the scenario's expectedAnswer.action.
// Returns true / false / null where null means "no expected answer" (the
// scenario is in a rule-discovery zone, or it's a v1 scenario without the
// new fields).
function actionMatches(userAction, expectedAction) {
  if (!expectedAction) return null;
  if (userAction.type !== expectedAction.type) return false;
  if (userAction.type === 'bid') {
    if (userAction.value !== expectedAction.value) return false;
    // suit === null in expected means "couleur libre" — any suit is fine.
    if (expectedAction.suit === null || expectedAction.suit === undefined) return true;
    return userAction.suit === expectedAction.suit;
  }
  return true; // pass / coinche / surcoinche all keyed on type alone
}

// ─── Section builders ───────────────────────────────────────────────────────

// v3 annotations carry divergenceType / divergenceAgreement directly. v2
// annotations don't — they predate the divergence schema. Splitting the
// dataset on schemaVersion lets us emit two distinct sections without
// guessing.
function partitionByVersion(annotations) {
  const v2 = [], v3 = [];
  for (const a of annotations) {
    if (a.schemaVersion === 3)      v3.push(a);
    else if (a.schemaVersion === 2) v2.push(a);
    else                            v2.push(a); // v1 / unknown — bucket with legacy
  }
  return { v2, v3 };
}

function buildHeader(annotations) {
  const counts   = {};
  const usernames = {};
  const scenarioCounts = {};
  const versions = { 1: 0, 2: 0 };
  let earliest, latest;
  for (const a of annotations) {
    counts[a.userId] = (counts[a.userId] || 0) + 1;
    if (a.username) usernames[a.userId] = a.username;
    scenarioCounts[a.scenarioId] = (scenarioCounts[a.scenarioId] || 0) + 1;
    versions[a.schemaVersion] = (versions[a.schemaVersion] || 0) + 1;
    const t = a.completedAt ? new Date(a.completedAt).getTime() : null;
    if (t && (!earliest || t < earliest)) earliest = t;
    if (t && (!latest   || t > latest))   latest   = t;
  }
  const lines = [];
  lines.push(`# Training-mode snapshot — ${TODAY}`);
  lines.push('');
  lines.push(`Source: \`backend/data/training/${SOURCE_NAME}/\` (gitignored).`);
  lines.push(`Generated by: \`scripts/build-training-snapshot.js\`. Re-run any time; deterministic given the same source data.`);
  lines.push('');
  lines.push('## 1. Summary stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Total users | ${Object.keys(counts).length} |`);
  lines.push(`| Total annotation files | ${annotations.length} |`);
  lines.push(`| Total decisions | ${annotations.reduce((s, a) => s + (a.decisions?.length || 0), 0)} |`);
  lines.push(`| Date range | ${earliest ? new Date(earliest).toISOString() : 'n/a'} → ${latest ? new Date(latest).toISOString() : 'n/a'} |`);
  lines.push(`| Schema v1 annotations | ${versions[1] || 0} |`);
  lines.push(`| Schema v2 annotations | ${versions[2] || 0} |`);
  lines.push(`| Scenarios touched | ${Object.keys(scenarioCounts).length} |`);
  lines.push('');
  lines.push('### Per-user');
  lines.push('');
  lines.push('| userId | username | annotations |');
  lines.push('|---|---|---|');
  for (const [uid, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${uid}\` | ${usernames[uid] || '(unknown)'} | ${n} |`);
  }
  return lines;
}

function buildPerScenario(annotations, scenarios) {
  const lines = [];
  lines.push('');
  lines.push('## 2. Per-scenario breakdown');
  lines.push('');
  const byScenario = {};
  for (const a of annotations) (byScenario[a.scenarioId] = byScenario[a.scenarioId] || []).push(a);
  const ordered = [...new Set(annotations.map(a => a.scenarioId))].sort();
  for (const sid of ordered) {
    const list = byScenario[sid];
    const scen = scenarios.get(sid);
    lines.push(`### ${sid}`);
    lines.push('');
    lines.push(`- Annotations: ${list.length}`);
    if (scen?.expectedAnswer !== undefined) {
      const exp = scen.expectedAnswer === null ? '_null (rule-discovery)_' : actionLabel(scen.expectedAnswer.action);
      const ref = scen.expectedAnswer?.ruleReference || '(none)';
      lines.push(`- Expected answer: **${exp}** (\`${ref}\`)`);
    }
    if (scen?.ambiguityFlags?.length) {
      lines.push(`- Ambiguity flags: ${scen.ambiguityFlags.map(f => '`' + f + '`').join(', ')}`);
    }
    const dist = {};
    for (const a of list) {
      const decisions = a.decisions || [];
      for (const d of decisions) {
        const k = actionLabel(d.action);
        (dist[k] = dist[k] || []).push(`${a.username || a.userId}`);
      }
    }
    lines.push('- Action distribution:');
    lines.push('');
    lines.push('  | Action | Count | Who |');
    lines.push('  |---|---|---|');
    for (const [act, who] of Object.entries(dist).sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`  | \`${act}\` | ${who.length} | ${who.join(', ')} |`);
    }
    lines.push('');
  }
  return lines;
}

// v3-only: report on the new divergenceType / divergenceAgreement fields
// stamped by the server at submission time. The four data classes
// (match / soft divergence / hard divergence / rule-silent) are the
// signal the v3 design is meant to surface.
function buildV3Divergence(v3, scenarios) {
  const lines = [];
  lines.push('## 3. v3 divergence breakdown');
  lines.push('');
  lines.push('Each v3 annotation carries a server-computed `divergenceType` and the user\'s `divergenceAgreement` answer. The four data classes:');
  lines.push('- **Match** — `divergenceType === null`. User picked exactly what the rules suggest. No reasoning UI was shown; auto-submitted.');
  lines.push('- **Soft divergence** — `divergenceAgreement === "could-be-either"`. User picked something else but conceded the rule answer could also work.');
  lines.push('- **Hard divergence** — `divergenceAgreement === "user-disagrees"`. User picked something else and rejected the rule answer.');
  lines.push('- **Rule-silent** — `divergenceType === "rule-silent"`. Scenario has no expectedAnswer; user reasoning is the data point.');
  lines.push('');
  if (v3.length === 0) {
    lines.push('_(no v3 annotations in this dataset yet)_');
    lines.push('');
    return lines;
  }

  let match = 0, soft = 0, hard = 0, silent = 0, other = 0;
  const perScenario = {};
  for (const a of v3) {
    for (const d of (a.decisions || [])) {
      const dt = d.divergenceType;
      const da = d.divergenceAgreement;
      const slot = (perScenario[a.scenarioId] = perScenario[a.scenarioId] || {
        match: [], soft: [], hard: [], silent: [], other: [],
      });
      if (dt === null) { match++; slot.match.push(a); }
      else if (dt === 'rule-silent') { silent++; slot.silent.push(a); }
      else if (da === 'could-be-either') { soft++; slot.soft.push(a); }
      else if (da === 'user-disagrees')  { hard++; slot.hard.push(a); }
      else { other++; slot.other.push(a); }
    }
  }
  const total = match + soft + hard + silent + other;
  const pct = (n) => total === 0 ? '—' : `${((n / total) * 100).toFixed(0)}%`;

  lines.push('### 3.1 v3 dataset rates');
  lines.push('');
  lines.push('| Class | Count | % |');
  lines.push('|---|---|---|');
  lines.push(`| Match (no UI) | ${match} | ${pct(match)} |`);
  lines.push(`| Soft divergence (could-be-either) | ${soft} | ${pct(soft)} |`);
  lines.push(`| Hard divergence (user-disagrees) | ${hard} | ${pct(hard)} |`);
  lines.push(`| Rule-silent | ${silent} | ${pct(silent)} |`);
  if (other > 0) lines.push(`| Other / malformed | ${other} | ${pct(other)} |`);
  lines.push('');

  lines.push('### 3.2 v3 per-scenario divergence');
  lines.push('');
  lines.push('| Scenario | Match | Soft | Hard | Rule-silent |');
  lines.push('|---|---|---|---|---|');
  for (const sid of Object.keys(perScenario).sort()) {
    const s = perScenario[sid];
    lines.push(`| \`${sid}\` | ${s.match.length} | ${s.soft.length} | ${s.hard.length} | ${s.silent.length} |`);
  }
  lines.push('');

  // Notes from divergent + rule-silent annotations, verbatim. These are
  // the cases where free-text reasoning was required.
  lines.push('### 3.3 v3 reasoning notes (divergent + rule-silent)');
  lines.push('');
  let n = 0;
  for (const a of v3) {
    for (const d of (a.decisions || [])) {
      if (d.divergenceType === null) continue;
      if (!d.note || d.note.trim() === '') continue;
      n++;
      const cls = d.divergenceType === 'rule-silent'
        ? 'rule-silent'
        : (d.divergenceAgreement === 'could-be-either' ? 'soft' : 'hard');
      lines.push(`${n}. **${a.username || a.userId} — \`${a.scenarioId}\` — \`${actionLabel(d.action)}\`** _(${cls})_`);
      const quoted = d.note.split('\n').map(l => '   > ' + l).join('\n');
      lines.push(quoted);
      lines.push('');
    }
  }
  if (n === 0) {
    lines.push('_(no notes recorded yet on v3 annotations requiring reasoning)_');
    lines.push('');
  }
  return lines;
}

// Legacy v2 dataset (the 18 pre-cutover annotations). Drives the original
// expectedAnswer-vs-action consistency check, since v2 records don't carry
// divergenceType themselves but the scenarios they reference still do.
function buildRuleConsistency(annotations, scenarios) {
  const lines = [];
  lines.push('## 4. Legacy v2 dataset — rule consistency');
  lines.push('');
  lines.push('A decision matches the expected answer when:');
  lines.push('- `type` agrees (bid / pass / coinche)');
  lines.push('- For bids: `value` agrees AND (`expected.suit === null` OR `suit` agrees)');
  lines.push('');
  lines.push('Annotations on scenarios with `expectedAnswer: null` are excluded from the percentages and listed separately under "Rule-discovery zone".');
  lines.push('');
  if (annotations.length === 0) {
    lines.push('_(no v2 annotations in this dataset)_');
    lines.push('');
    return lines;
  }

  // Per-user rollup
  const perUser = {};
  for (const a of annotations) {
    const scen = scenarios.get(a.scenarioId);
    const expAction = scen?.expectedAnswer?.action ?? null;
    if (scen?.expectedAnswer === null || expAction === null) continue; // discovery zone
    if (!scen) continue;
    const u = perUser[a.userId] = perUser[a.userId] || { username: a.username, total: 0, matches: 0 };
    u.username = a.username || u.username;
    for (const d of (a.decisions || [])) {
      const m = actionMatches(d.action, expAction);
      if (m === null) continue;
      u.total++;
      if (m) u.matches++;
    }
  }
  lines.push('### 3.1 Per-user rule-consistency rate');
  lines.push('');
  lines.push('| User | Matched | Total | % |');
  lines.push('|---|---|---|---|');
  for (const [uid, u] of Object.entries(perUser)) {
    const pct = u.total === 0 ? '—' : ((u.matches / u.total) * 100).toFixed(0) + '%';
    lines.push(`| ${u.username || uid} | ${u.matches} | ${u.total} | ${pct} |`);
  }
  lines.push('');

  // Per-scenario rollup
  const perScenario = {};
  for (const a of annotations) {
    const scen = scenarios.get(a.scenarioId);
    const expAction = scen?.expectedAnswer?.action ?? null;
    if (scen?.expectedAnswer === null || expAction === null) continue;
    if (!scen) continue;
    const s = perScenario[a.scenarioId] = perScenario[a.scenarioId] || { total: 0, matches: 0, expected: actionLabel(expAction) };
    for (const d of (a.decisions || [])) {
      const m = actionMatches(d.action, expAction);
      if (m === null) continue;
      s.total++;
      if (m) s.matches++;
    }
  }
  lines.push('### 3.2 Per-scenario rule-consistency rate');
  lines.push('');
  lines.push('| Scenario | Expected | Matched | Total | % |');
  lines.push('|---|---|---|---|---|');
  for (const [sid, s] of Object.entries(perScenario).sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct = s.total === 0 ? '—' : ((s.matches / s.total) * 100).toFixed(0) + '%';
    lines.push(`| \`${sid}\` | \`${s.expected}\` | ${s.matches} | ${s.total} | ${pct} |`);
  }
  lines.push('');

  // Divergence drill-down — list each non-matching decision for any
  // scenario with at least one mismatch.
  lines.push('### 3.3 Divergence drill-down');
  lines.push('');
  lines.push('For every scenario where at least one annotation mismatched the expected answer, the user actions are listed below side-by-side with the expected answer.');
  lines.push('');
  let anyDivergence = false;
  for (const [sid, s] of Object.entries(perScenario).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (s.matches === s.total) continue; // fully convergent
    anyDivergence = true;
    const scen = scenarios.get(sid);
    const exp  = scen.expectedAnswer.action;
    lines.push(`#### \`${sid}\` — expected \`${actionLabel(exp)}\``);
    lines.push('');
    lines.push('| User | Action | Match | Tags | Note |');
    lines.push('|---|---|---|---|---|');
    for (const a of annotations.filter(x => x.scenarioId === sid)) {
      for (const d of (a.decisions || [])) {
        const m = actionMatches(d.action, exp);
        if (m === null) continue;
        const tagStr  = (d.tags || []).map(t => '`' + t + '`').join(' ');
        const noteStr = (d.note || '').replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 200);
        lines.push(`| ${a.username || a.userId} | \`${actionLabel(d.action)}\` | ${m ? '✅' : '❌'} | ${tagStr} | ${noteStr} |`);
      }
    }
    lines.push('');
  }
  if (!anyDivergence) {
    lines.push('_(no divergent scenarios)_');
    lines.push('');
  }

  // Rule-discovery zone — list everything we deliberately excluded.
  lines.push('### 3.4 Rule-discovery zone (`expectedAnswer: null`)');
  lines.push('');
  lines.push('These annotations land on scenarios where La Feuille V2 does not (yet) determine the answer — typically competitive bidding or unresolved tie-breaks. The user actions here are evidence for *future* rule formalization, not consistency checks.');
  lines.push('');
  let anyDiscovery = false;
  for (const sid of [...new Set(annotations.map(a => a.scenarioId))].sort()) {
    const scen = scenarios.get(sid);
    if (!scen || scen.expectedAnswer !== null) continue;
    anyDiscovery = true;
    lines.push(`#### \`${sid}\` (flags: ${(scen.ambiguityFlags || []).map(f => '`' + f + '`').join(', ') || 'none'})`);
    lines.push('');
    lines.push('| User | Action | Tags | Note |');
    lines.push('|---|---|---|---|');
    for (const a of annotations.filter(x => x.scenarioId === sid)) {
      for (const d of (a.decisions || [])) {
        const tagStr  = (d.tags || []).map(t => '`' + t + '`').join(' ');
        const noteStr = (d.note || '').replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 200);
        lines.push(`| ${a.username || a.userId} | \`${actionLabel(d.action)}\` | ${tagStr} | ${noteStr} |`);
      }
    }
    lines.push('');
  }
  if (!anyDiscovery) {
    lines.push('_(no rule-discovery annotations in this dataset)_');
    lines.push('');
  }
  return lines;
}

function buildConvergence(annotations) {
  const lines = [];
  lines.push('## 4. Convergence vs. divergence per scenario');
  lines.push('');
  const byScenario = {};
  for (const a of annotations) {
    const decisions = a.decisions || [];
    const arr = byScenario[a.scenarioId] = byScenario[a.scenarioId] || [];
    for (const d of decisions) arr.push({ user: a.username || a.userId, action: actionLabel(d.action) });
  }
  for (const sid of Object.keys(byScenario).sort()) {
    const arr = byScenario[sid];
    const distinctActions = [...new Set(arr.map(r => r.action))];
    const convergent = distinctActions.length === 1;
    lines.push(`- **\`${sid}\`** — ${convergent ? 'convergent' : 'divergent'}: ${distinctActions.length} distinct action(s): ${distinctActions.map(a => '`' + a + '`').join(', ')}`);
  }
  lines.push('');
  return lines;
}

function buildTagHistogram(annotations) {
  const lines = [];
  lines.push('## 5. Tag histogram');
  lines.push('');
  const counts = {};
  for (const a of annotations) {
    for (const d of (a.decisions || [])) {
      for (const t of (d.tags || [])) counts[t] = (counts[t] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    lines.push('_(no tags recorded)_');
    lines.push('');
    return lines;
  }
  lines.push('| Tag | Count |');
  lines.push('|---|---|');
  for (const [tag, n] of sorted) lines.push(`| \`${tag}\` | ${n} |`);
  lines.push('');
  return lines;
}

function buildNotesCorpus(annotations) {
  const lines = [];
  lines.push('## 6. Notes corpus (non-empty notes, verbatim)');
  lines.push('');
  let n = 0;
  for (const a of annotations) {
    for (const d of (a.decisions || [])) {
      if (!d.note || d.note.trim() === '') continue;
      n++;
      lines.push(`${n}. **${a.username || a.userId} — \`${a.scenarioId}\` — \`${actionLabel(d.action)}\`**`);
      const quoted = d.note.split('\n').map(l => '   > ' + l).join('\n');
      lines.push(quoted);
      lines.push('');
    }
  }
  if (n === 0) {
    lines.push('_(no non-empty notes)_');
    lines.push('');
  }
  return lines;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const scenarios = readAllScenarios();
  const { annotations } = readAllAnnotations();
  // Sort by completedAt for determinism in downstream sections.
  annotations.sort((a, b) =>
    (a.completedAt || '').localeCompare(b.completedAt || '')
  );

  const { v2, v3 } = partitionByVersion(annotations);

  const sections = [
    ...buildHeader(annotations),
    ...buildPerScenario(annotations, scenarios),
    ...buildV3Divergence(v3, scenarios),
    ...buildRuleConsistency(v2, scenarios),
    ...buildConvergence(annotations),
    ...buildTagHistogram(v2), // tag histogram is meaningful only for v2 records
    ...buildNotesCorpus(annotations),
  ];
  fs.writeFileSync(OUT_FILE, sections.join('\n') + '\n');
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Annotations: ${annotations.length}, scenarios: ${scenarios.size}`);
}

if (require.main === module) main();

module.exports = {
  actionLabel,
  actionMatches,
  readAllScenarios,
  readAllAnnotations,
  TRAINING_DIR,
  SCENARIOS_DIR,
  SOURCE_DIR,
  OUT_FILE,
};

#!/usr/bin/env node
// One-shot analyzer for Rod's training annotations snapshot.
// Reads backend/data/training/_rod-snapshot/*.json + scenario files,
// emits a structured JSON to stdout that the report can be built from.

const fs = require('fs');
const path = require('path');

const SNAP = path.join(__dirname, '..', 'backend', 'data', 'training', '_rod-snapshot');
const SCENARIOS = path.join(__dirname, '..', 'backend', 'src', 'training', 'scenarios');

const annotationFiles = fs.readdirSync(SNAP)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .sort();

const annotations = annotationFiles.map(f => {
  const a = JSON.parse(fs.readFileSync(path.join(SNAP, f), 'utf8'));
  a._file = f;
  return a;
});

function readScenario(id) {
  const p = path.join(SCENARIOS, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const scenarioCache = {};
for (const a of annotations) {
  if (!scenarioCache[a.scenarioId]) {
    scenarioCache[a.scenarioId] = readScenario(a.scenarioId);
  }
}

function actionStr(action) {
  if (!action) return '—';
  if (action.type === 'pass') return 'pass';
  if (action.type === 'coinche') return 'coinche';
  if (action.type === 'bid') return `${action.value} ${action.suit}`;
  return JSON.stringify(action);
}

function suitEmoji(s) {
  return { S: '♠', H: '♥', D: '♦', C: '♣' }[s] || s;
}

// Sessions: group within 30 min
const sorted = [...annotations].sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
const sessions = [];
for (const a of sorted) {
  const t = new Date(a.startedAt).getTime();
  const last = sessions[sessions.length - 1];
  if (last && t - last.endTime <= 30 * 60 * 1000) {
    last.items.push(a);
    last.endTime = t;
  } else {
    sessions.push({ items: [a], startTime: t, endTime: t });
  }
}

// Divergence breakdown
const divCounts = { match: 0, 'value-different': 0, 'suit-different': 0, 'action-type-different': 0, 'rule-silent': 0, 'no-field': 0 };
const agrCounts = { 'could-be-either': 0, 'user-disagrees': 0, null: 0, 'no-field': 0 };

const cases = []; // unified normalized case list

for (const a of annotations) {
  const d = a.decisions[0];
  const sc = scenarioCache[a.scenarioId];
  const expected = sc?.expectedAnswer?.action;
  const ambFlags = sc?.ambiguityFlags || [];

  // Determine effective divergence:
  // schemaVersion 2 annotations don't have divergenceType yet — derive it.
  let divType = d.divergenceType;
  let divAgr = d.divergenceAgreement;

  // Older schemas (v2/v3) didn't write the field; v4 sometimes leaves it null
  // when the FE didn't compute it (the silent-submit path on a match).
  // Always derive when missing OR when null + we can prove a match.
  if (divType === undefined || divType === null) {
    if (!expected) {
      divType = 'rule-silent';
    } else if (expected.type !== d.action.type) {
      divType = 'action-type-different';
    } else if (d.action.type === 'pass') {
      divType = 'match';
    } else if (expected.type === 'bid') {
      const valueMatch = expected.value === d.action.value;
      // Some scenarios have suit=null in expectedAnswer (any suit valid).
      const suitMatch = expected.suit === null || expected.suit === d.action.suit;
      if (valueMatch && suitMatch) divType = 'match';
      else if (!suitMatch && valueMatch) divType = 'suit-different';
      else divType = 'value-different';
    } else {
      divType = 'match';
    }
    if (divAgr === undefined) divAgr = null;
  }
  if (divAgr === undefined) divAgr = null;

  const c = {
    file: a._file,
    scenarioId: a.scenarioId,
    schemaVersion: a.schemaVersion,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    action: d.action,
    actionStr: actionStr(d.action),
    note: d.note || '',
    noteLen: (d.note || '').length,
    tags: d.tags || [],
    divergenceType: divType,
    divergenceAgreement: divAgr,
    expectedAction: expected || null,
    expectedStr: actionStr(expected),
    expectedRuleRef: sc?.expectedAnswer?.ruleReference || null,
    ambiguityFlags: ambFlags,
    scenarioTitle: sc?.title?.fr || sc?.title?.en || a.scenarioId,
  };
  cases.push(c);
  divCounts[divType] = (divCounts[divType] || 0) + 1;
  if (divType !== 'match') {
    if (divAgr === null) agrCounts.null++;
    else agrCounts[divAgr] = (agrCounts[divAgr] || 0) + 1;
  }
}

// Action distribution
const actionDist = { pass: 0, bid: 0, coinche: 0 };
const bidValues = {};
const bidSuits = {};
for (const c of cases) {
  actionDist[c.action.type] = (actionDist[c.action.type] || 0) + 1;
  if (c.action.type === 'bid') {
    bidValues[c.action.value] = (bidValues[c.action.value] || 0) + 1;
    bidSuits[c.action.suit] = (bidSuits[c.action.suit] || 0) + 1;
  }
}

// Direction of divergence (only when expected exists and Rod diverged)
const direction = { higher: 0, lower: 0, sameValueDiffSuit: 0, actionTypeDiff: 0, deltas: [] };
for (const c of cases) {
  if (!c.expectedAction || c.divergenceType === 'match' || c.divergenceType === 'rule-silent') continue;
  if (c.action.type === 'bid' && c.expectedAction.type === 'bid') {
    if (c.action.suit !== c.expectedAction.suit && c.action.value === c.expectedAction.value) {
      direction.sameValueDiffSuit++;
    } else if (c.action.value > c.expectedAction.value) {
      direction.higher++;
      direction.deltas.push({ scenario: c.scenarioId, delta: c.action.value - c.expectedAction.value, mine: actionStr(c.action), expected: actionStr(c.expectedAction) });
    } else if (c.action.value < c.expectedAction.value) {
      direction.lower++;
      direction.deltas.push({ scenario: c.scenarioId, delta: c.action.value - c.expectedAction.value, mine: actionStr(c.action), expected: actionStr(c.expectedAction) });
    }
  } else {
    direction.actionTypeDiff++;
    direction.deltas.push({ scenario: c.scenarioId, delta: null, mine: actionStr(c.action), expected: actionStr(c.expectedAction) });
  }
}

// Note stats
const notes = cases.map(c => c.noteLen);
const nonEmptyNotes = notes.filter(n => n > 0);
function median(arr) { if (!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
const noteStats = {
  total: notes.length,
  withNote: nonEmptyNotes.length,
  pctWithNote: ((nonEmptyNotes.length / notes.length) * 100).toFixed(1),
  median: median(nonEmptyNotes),
  max: Math.max(...notes, 0),
  mean: nonEmptyNotes.length ? Math.round(nonEmptyNotes.reduce((a,b)=>a+b,0) / nonEmptyNotes.length) : 0,
};

// V2.2 conversational stats — none present in Rod's data
const conversationStats = {
  withConversation: cases.filter(c => false).length, // grep confirmed 0
  totalMessages: 0,
  cardSelections: 0,
};

// Category breakdown by scenario prefix
const categories = {};
for (const c of cases) {
  const m = c.scenarioId.match(/^([a-z\-]+?)(?:-\d+|-\w+\d+)?$/);
  // simpler: take first 2 hyphenated tokens
  const tokens = c.scenarioId.split('-');
  let cat;
  if (tokens[0] === 'partner' && tokens[1] === 'opened') cat = 'partner-opened-opp-overcalled';
  else if (tokens[0] === 'second' && tokens[1] === 'opp') cat = 'second-opp-opened';
  else if (tokens[0] === 'fourth' && tokens[1] === 'position') cat = 'fourth-position';
  else if (tokens[0] === 'response') cat = `response-${tokens[1]}`;
  else if (tokens[0] === 'opening') cat = 'opening';
  else if (tokens[0] === 'petit' && tokens[1] === 'jeu') cat = 'petit-jeu';
  else if (tokens[0] === 'validation') cat = 'validation';
  else if (tokens[0] === 'block') cat = 'block';
  else if (tokens[0] === 'raise') cat = 'raise';
  else cat = tokens[0];
  categories[cat] = (categories[cat] || 0) + 1;
}

// Pattern detection: chiquer terminology, ADC, points vs perdantes
const lowerNotes = cases.map(c => c.note.toLowerCase()).join('\n---\n');
const patterns = {
  chiquerMentions: (lowerNotes.match(/chiqu/g) || []).length,
  pieceMentions: (lowerNotes.match(/pi[èe]ce/g) || []).length,
  asExtMentions: (lowerNotes.match(/as ext|as extér/g) || []).length,
  perdantesMentions: (lowerNotes.match(/perdant|fauss?e? pli|faux pli|faux plis/g) || []).length,
  pointsMentions: (lowerNotes.match(/points?/g) || []).length,
  beloteMentions: (lowerNotes.match(/belote|rebelote/g) || []).length,
  maitreMentions: (lowerNotes.match(/ma[îi]tre/g) || []).length,
  longueMentions: (lowerNotes.match(/longue/g) || []).length,
};

// High-signal cases
const passDeAccord = cases.filter(c => c.divergenceAgreement === 'user-disagrees');
const ruleSilentSubstantive = cases.filter(c => c.divergenceType === 'rule-silent' && c.noteLen >= 30);

// Repeat-direction patterns (e.g. always 10 higher)
const deltaCounts = {};
for (const d of direction.deltas) {
  if (d.delta !== null) {
    deltaCounts[d.delta] = (deltaCounts[d.delta] || 0) + 1;
  }
}

const out = {
  meta: {
    snapshotPath: SNAP,
    user: { id: annotations[0]?.userId, name: annotations[0]?.username },
    annotationCount: annotations.length,
    schemaVersionDist: annotations.reduce((m,a) => { m[a.schemaVersion] = (m[a.schemaVersion]||0)+1; return m; }, {}),
    firstAt: sorted[0]?.startedAt,
    lastAt: sorted[sorted.length-1]?.startedAt,
  },
  sessions: sessions.map(s => ({
    count: s.items.length,
    start: new Date(s.startTime).toISOString(),
    end: new Date(s.endTime).toISOString(),
    durationMin: Math.round((s.endTime - s.startTime) / 60000),
    scenarios: s.items.map(x => x.scenarioId),
  })),
  divCounts,
  agrCounts,
  actionDist,
  bidValues,
  bidSuits,
  direction: { ...direction, deltas: undefined, deltaCounts },
  deltasDetailed: direction.deltas,
  noteStats,
  conversationStats,
  categories,
  patterns,
  passDeAccord,
  ruleSilentSubstantive,
  cases,
};

console.log(JSON.stringify(out, null, 2));

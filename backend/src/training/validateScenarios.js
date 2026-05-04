// Validates every scenario JSON under backend/src/training/scenarios/.
// Checks: schemaVersion, required fields, full 32-card deck coverage with
// no duplicates across the 4 hands, V1 single-decision constraint (exactly
// one user-turn event, at the end), legal event types, authorIntent present
// on every scripted event.
//
// Run: node backend/src/training/validateScenarios.js
// Exit code: 0 = all valid, 1 = any scenario failed (details on stdout).

const fs = require('fs');
const path = require('path');

const SUITS  = ['S', 'H', 'D', 'C'];
const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const DECK_IDS = new Set();
for (const s of SUITS) for (const v of VALUES) DECK_IDS.add(v + s);

const LEGAL_EVENTS = new Set(['bid', 'pass', 'coinche', 'surcoinche', 'play-card', 'user-turn']);
const LEGAL_PHASES = new Set(['BIDDING', 'PLAYING']);
const LEGAL_BID_VALUES = new Set([80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot']);

// schemaVersion 2 expectedAnswer accepts a wider value range than runtime
// scenario events, since partner responses under La Feuille V2 can stack
// past 160 (e.g. 100-opening + outside Aces). Keep this in sync with the
// rules document if conventions add 270+ tiers later.
const LEGAL_EXPECTED_BID_VALUES = new Set([
  80, 90, 100, 110, 120, 130, 140, 150, 160,
  170, 180, 190, 200, 210, 220, 230, 240, 250,
  'capot',
]);
const LEGAL_EXPECTED_ACTION_TYPES = new Set(['bid', 'pass', 'coinche']);

// ─── schemaVersion 2 — expectedAnswer / ambiguityFlags ─────────────────────
//
// Both fields are OPTIONAL. Absent means "no expected answer; treated as v1
// for analysis". When present:
//   - expectedAnswer is null (rules don't cover this case) or
//     { action: { type, value?, suit? }, ruleReference: <non-empty string> }
//     where action.type ∈ {bid, pass, coinche}; for type==='bid', value must
//     be a legal expected-bid value and suit must be S/H/D/C or null
//     (null = "couleur libre", i.e. trump-tie-break unformalized).
//   - ambiguityFlags is an array of strings (empty array allowed).
//
// These fields are consumed by analysis tooling (scripts/build-training-
// snapshot.js) and MUST NOT be surfaced in the picker / reason-panel UI —
// that would bias data collection.
function validateExpectedAnswer(scenario, errs) {
  if (!('expectedAnswer' in scenario)) return;
  const ea = scenario.expectedAnswer;
  if (ea === null) return; // explicit "rules don't determine an answer"
  if (typeof ea !== 'object') {
    errs.push('expectedAnswer must be null or an object');
    return;
  }
  if (typeof ea.ruleReference !== 'string' || ea.ruleReference.trim() === '') {
    errs.push('expectedAnswer.ruleReference must be a non-empty string');
  }
  const a = ea.action;
  if (!a || typeof a !== 'object') {
    errs.push('expectedAnswer.action is required when expectedAnswer is non-null');
    return;
  }
  if (!LEGAL_EXPECTED_ACTION_TYPES.has(a.type)) {
    errs.push(`expectedAnswer.action.type must be one of ${[...LEGAL_EXPECTED_ACTION_TYPES].join(', ')}`);
  }
  if (a.type === 'bid') {
    if (!LEGAL_EXPECTED_BID_VALUES.has(a.value)) {
      errs.push(`expectedAnswer.action.value invalid for bid: ${JSON.stringify(a.value)}`);
    }
    if (a.suit !== null && !SUITS.includes(a.suit)) {
      errs.push(`expectedAnswer.action.suit must be one of S/H/D/C or null, got ${JSON.stringify(a.suit)}`);
    }
  }
}

function validateAmbiguityFlags(scenario, errs) {
  if (!('ambiguityFlags' in scenario)) return;
  const f = scenario.ambiguityFlags;
  if (!Array.isArray(f)) {
    errs.push('ambiguityFlags must be an array');
    return;
  }
  for (const v of f) {
    if (typeof v !== 'string' || v.trim() === '') {
      errs.push(`ambiguityFlags entries must be non-empty strings, got ${JSON.stringify(v)}`);
    }
  }
}

function validateScenario(filename, scenario) {
  const errs = [];

  // Required top-level fields
  if (![1, 2].includes(scenario.schemaVersion)) {
    errs.push('schemaVersion must be 1 or 2');
  }
  // v1 cannot carry the v2-only fields — guard against accidental mixing.
  if (scenario.schemaVersion === 1) {
    if ('expectedAnswer' in scenario)  errs.push('expectedAnswer requires schemaVersion 2');
    if ('ambiguityFlags' in scenario)  errs.push('ambiguityFlags requires schemaVersion 2');
  }
  if (scenario.schemaVersion === 2) {
    validateExpectedAnswer(scenario, errs);
    validateAmbiguityFlags(scenario, errs);
  }
  if (!scenario.id) errs.push('missing id');
  if (scenario.id && `${scenario.id}.json` !== filename) errs.push(`id '${scenario.id}' does not match filename '${filename}'`);
  if (![0, 1, 2, 3].includes(scenario.userSeat)) errs.push('userSeat must be 0-3');
  if (![0, 1, 2, 3].includes(scenario.dealer)) errs.push('dealer must be 0-3');
  if (!scenario.title?.fr || !scenario.title?.en) errs.push('title.fr and title.en required');
  if (!scenario.description?.fr || !scenario.description?.en) errs.push('description.fr and description.en required');
  if (!scenario.notes?.fr || !scenario.notes?.en) errs.push('notes.fr and notes.en required');

  // Hands — exactly 32 cards, no duplicates
  const seen = new Set();
  for (const seat of ['0', '1', '2', '3']) {
    const hand = scenario.hands?.[seat];
    if (!Array.isArray(hand) || hand.length !== 8) {
      errs.push(`hand ${seat}: must be an 8-card array`);
      continue;
    }
    for (const c of hand) {
      const id = c?.value + c?.suit;
      if (!SUITS.includes(c?.suit) || !VALUES.includes(c?.value)) {
        errs.push(`hand ${seat}: malformed card ${JSON.stringify(c)}`);
        continue;
      }
      if (!DECK_IDS.has(id)) errs.push(`hand ${seat}: card ${id} not in 32-card deck`);
      if (seen.has(id)) errs.push(`duplicate card ${id} across hands`);
      seen.add(id);
    }
  }
  if (seen.size !== 32) errs.push(`deck coverage: ${seen.size}/32 cards — missing: ${[...DECK_IDS].filter(c => !seen.has(c)).join(', ')}`);

  // Timeline — V1 single-decision constraint
  const tl = scenario.timeline || [];
  const userTurns = tl.filter(e => e.event === 'user-turn').length;
  if (userTurns !== 1) errs.push(`timeline must have exactly 1 user-turn event, got ${userTurns}`);
  if (tl.length === 0 || tl[tl.length - 1]?.event !== 'user-turn') errs.push('timeline must end with a user-turn event');
  for (const e of tl) {
    if (!LEGAL_EVENTS.has(e.event)) errs.push(`unknown timeline event: ${e.event}`);
    if (e.event !== 'user-turn') {
      if (!('seat' in e) || ![0, 1, 2, 3].includes(e.seat)) errs.push(`event ${e.event}: missing/invalid seat`);
      if (!e.authorIntent) errs.push(`event ${e.event} at seat ${e.seat}: missing authorIntent`);
      if (e.event === 'bid') {
        if (!LEGAL_BID_VALUES.has(e.value)) errs.push(`bid at seat ${e.seat}: invalid value ${e.value}`);
        if (!SUITS.includes(e.suit)) errs.push(`bid at seat ${e.seat}: invalid suit ${e.suit}`);
      }
      if (e.event === 'play-card') {
        if (!e.card || !SUITS.includes(e.card.suit) || !VALUES.includes(e.card.value)) {
          errs.push(`play-card at seat ${e.seat}: invalid card ${JSON.stringify(e.card)}`);
        }
      }
    }
  }

  // initialState (optional)
  if (scenario.initialState) {
    if (!LEGAL_PHASES.has(scenario.initialState.phase)) errs.push('initialState.phase must be BIDDING or PLAYING');
    if (scenario.initialState.phase === 'PLAYING') {
      if (!SUITS.includes(scenario.initialState.trumpSuit)) errs.push('initialState.trumpSuit required when phase=PLAYING');
      if (!scenario.initialState.currentBid) errs.push('initialState.currentBid required when phase=PLAYING');
    }
  }

  return errs;
}

function main() {
  const dir = path.join(__dirname, 'scenarios');
  if (!fs.existsSync(dir)) {
    console.error(`Scenarios directory not found: ${dir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let fail = 0;

  for (const f of files.sort()) {
    const scenario = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const errs = validateScenario(f, scenario);
    if (errs.length) {
      console.log(`[FAIL] ${f}`);
      for (const e of errs) console.log('   -', e);
      fail++;
    } else {
      console.log(`[OK]   ${f}`);
    }
  }

  console.log(`\n${files.length - fail}/${files.length} scenarios valid`);
  process.exit(fail ? 1 : 0);
}

if (require.main === module) main();
module.exports = { validateScenario };

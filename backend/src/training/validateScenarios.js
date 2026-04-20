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

function validateScenario(filename, scenario) {
  const errs = [];

  // Required top-level fields
  if (scenario.schemaVersion !== 1) errs.push('schemaVersion must be 1');
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

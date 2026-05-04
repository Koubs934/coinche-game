// Loads and caches scenario JSON files from backend/src/training/scenarios/.
// Any file that fails validateScenario() is logged and skipped — a bad edit
// should not crash the server.

const fs   = require('fs');
const path = require('path');
const { validateScenario } = require('./validateScenarios');

const SCENARIOS_DIR = path.join(__dirname, 'scenarios');

let cache = null;    // id → full scenario object

function loadAll() {
  const byId = new Map();
  if (!fs.existsSync(SCENARIOS_DIR)) return byId;

  const entries = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
  for (const filename of entries.sort()) {
    const full = path.join(SCENARIOS_DIR, filename);
    let scenario;
    try {
      scenario = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      console.error(`[scenarioLoader] parse error in ${filename}: ${err.message}`);
      continue;
    }
    const errs = validateScenario(filename, scenario);
    if (errs.length) {
      console.error(`[scenarioLoader] invalid ${filename}:`);
      for (const e of errs) console.error('   -', e);
      continue;
    }
    byId.set(scenario.id, scenario);
  }
  return byId;
}

function ensureLoaded() {
  if (cache === null) {
    cache = loadAll();
    console.log(`[training] loaded ${cache.size} scenario(s)`);
  }
}

/**
 * Spoiler-free summary list for the picker screen. Omits hands, timeline,
 * and notes (notes contain probe-intent and may spoil the right answer).
 */
function listScenarios() {
  ensureLoaded();
  const out = [];
  for (const s of cache.values()) {
    out.push({
      id:          s.id,
      title:       s.title,
      description: s.description,
      userSeat:    s.userSeat,
      dealer:      s.dealer,
    });
  }
  return out;
}

/** Full scenario JSON for the runner + frontend renderer. */
function getScenario(id) {
  ensureLoaded();
  return cache.get(id) || null;
}

/** Test / diagnostic hook: drop the cache so a fresh read occurs. */
function reload() {
  cache = null;
  ensureLoaded();
}

/**
 * Sanitize a scenario for transmission to a connected client. Strips
 * everything that would either spoil the user's reasoning or bias their
 * annotation:
 *   - expectedAnswer / ambiguityFlags: the rule-consistency hooks added in
 *     schemaVersion 2 — analysis-only fields, never shown to users.
 *   - notes: scenario-author notes meant for maintainers, not players.
 *   - hands for seats other than userSeat: the user must see only their
 *     own hand (we mask the others to a same-length null array, mirroring
 *     publicView's filteredHands convention in trainingRooms.js).
 *   - timeline[].authorIntent: free-text reveal of the "why" behind each
 *     scripted bid — same bias risk as expectedAnswer.
 *
 * Preserved (the picker / runtime needs these):
 *   id, title, description, schemaVersion, userSeat, dealer, initialState,
 *   playbackSpeed, hands (for the user's seat), timeline (events sans
 *   authorIntent).
 *
 * Returns null on null input. The original scenario object is never
 * mutated — the loader's in-memory cache stays canonical.
 */
function pickClientScenarioFields(scenario) {
  if (!scenario) return null;
  const out = {
    id:            scenario.id,
    title:         scenario.title,
    description:   scenario.description,
    schemaVersion: scenario.schemaVersion,
    userSeat:      scenario.userSeat,
    dealer:        scenario.dealer,
  };
  if (scenario.initialState)   out.initialState   = scenario.initialState;
  if (scenario.playbackSpeed)  out.playbackSpeed  = scenario.playbackSpeed;

  if (scenario.hands && typeof scenario.hands === 'object') {
    const userSeat = scenario.userSeat;
    const filtered = {};
    for (const seat of Object.keys(scenario.hands)) {
      const hand = scenario.hands[seat];
      const isUser = Number(seat) === userSeat;
      if (isUser) {
        filtered[seat] = hand;
      } else if (Array.isArray(hand)) {
        filtered[seat] = Array(hand.length).fill(null);
      } else {
        filtered[seat] = null;
      }
    }
    out.hands = filtered;
  }

  if (Array.isArray(scenario.timeline)) {
    out.timeline = scenario.timeline.map(e => {
      const { authorIntent, ...rest } = e;
      return rest;
    });
  }
  return out;
}

module.exports = { listScenarios, getScenario, reload, pickClientScenarioFields };

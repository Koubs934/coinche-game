// Loads and caches scenario JSON files from backend/src/training/scenarios/.
// Any file that fails validateScenario() is logged and skipped — a bad edit
// should not crash the server.

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { validateScenario } = require('./validateScenarios');

// ───────────────────────────────────────────────────────────────────────────
// TEMP — RATIFICATION ROUND. When ON, the picker lists ONLY the zone-grise
// ratification scenarios (ids starting with "opening-zg-" or "response-zg-")
// so Aaron / Jerem / Sacha play exactly that set. Reverting is a ONE-LINE flip:
// set the flag to false to restore the full scenario list. Applied at the
// single source of the picker list (listScenarios()).
const TRAINING_ONLY_ZG = true; // TEMP: flip to false to restore all scenarios
const TRAINING_ONLY_ZG_PREFIXES = ['opening-zg-', 'response-zg-'];
// ───────────────────────────────────────────────────────────────────────────

// Deterministic shuffle key — first 8 hex chars of SHA-256(id). Stable
// across runs and across all users, so the picker shows the same order
// to everyone, but categories are interleaved instead of grouped (since
// IDs are clustered by category prefix). Replaces the prior alphabetical
// sort by filename. See `listScenarios()`.
function scenarioOrderKey(id) {
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 8);
}

const SCENARIOS_DIR = path.join(__dirname, 'scenarios');

let cache = null;          // id → full scenario object
let numberById = null;     // id → 1-based stable number (alphabetical filename sort)

function loadAll() {
  const byId = new Map();
  const nums = new Map();
  if (!fs.existsSync(SCENARIOS_DIR)) return { byId, nums };

  const entries = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
  // Sequential 1..N numbering follows the alphabetical filename order — a
  // user-facing reference ("scénario #47") that's stable across loads and
  // independent of the picker's hash-shuffled display order. Adding or
  // removing a scenario shifts numbers from that point forward; that's
  // fine because the number is a UI affordance, not a stored identifier
  // (annotations on disk reference scenarioId, never the number).
  let seq = 0;
  for (const filename of entries.sort()) {
    seq += 1;
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
    nums.set(scenario.id, seq);
  }

  // TEMP (TRAINING_ONLY_ZG): the picker lists ONLY the zg ratification set, so
  // make its "Scénario #N" badge contiguous — renumber the filtered ids 1..N
  // in alphabetical (= filename) order. Non-listed scenarios KEEP their global
  // number (the flow can still run one by id — e.g. on restart — so its badge
  // must stay a number, just not part of the picker's 1..N sequence). Flipping
  // TRAINING_ONLY_ZG to false skips this and restores pure global numbering.
  if (TRAINING_ONLY_ZG) {
    [...byId.keys()]
      .filter(id => TRAINING_ONLY_ZG_PREFIXES.some(p => String(id).startsWith(p)))
      .sort()
      .forEach((id, i) => nums.set(id, i + 1));
  }

  return { byId, nums };
}

function ensureLoaded() {
  if (cache === null) {
    const { byId, nums } = loadAll();
    cache = byId;
    numberById = nums;
    console.log(`[training] loaded ${cache.size} scenario(s)`);
  }
}

/**
 * Stable 1-based number for a scenario, derived from the alphabetical
 * filename sort. Used by the FE as a "Scénario #N" badge so users can
 * refer to scenarios by number in conversation. Returns null for unknown
 * ids.
 */
function getScenarioNumber(id) {
  ensureLoaded();
  return numberById.get(id) ?? null;
}

/**
 * Spoiler-free summary list for the picker screen. Omits hands, timeline,
 * notes, and the v2 expectedAnswer / ambiguityFlags fields.
 *
 * Order: deterministic hash-shuffle of `id` (see scenarioOrderKey). With
 * 100+ scenarios prefixed by category (opening-*, response-*, second-pass-*,
 * etc.), alphabetical sort produces a long block of one category followed
 * by the next; the picker becomes unwieldy. Hash-shuffling interleaves
 * categories while still being stable across loads and consistent across
 * users.
 */
function listScenarios() {
  ensureLoaded();
  const out = [];
  for (const s of cache.values()) {
    out.push({
      id:          s.id,
      number:      numberById.get(s.id) ?? null,
      title:       s.title,
      description: s.description,
      section:     s.section ?? null,
      userSeat:    s.userSeat,
      dealer:      s.dealer,
    });
  }
  // TEMP (TRAINING_ONLY_ZG): restrict the picker to the ratification set.
  const listed = TRAINING_ONLY_ZG
    ? out.filter(s => TRAINING_ONLY_ZG_PREFIXES.some(p => String(s.id).startsWith(p)))
    : out;
  listed.sort((a, b) => scenarioOrderKey(a.id).localeCompare(scenarioOrderKey(b.id)));
  return listed;
}

/** Full scenario JSON for the runner + frontend renderer. */
function getScenario(id) {
  ensureLoaded();
  return cache.get(id) || null;
}

/** Test / diagnostic hook: drop the cache so a fresh read occurs. */
function reload() {
  cache = null;
  numberById = null;
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
  ensureLoaded();
  const out = {
    id:            scenario.id,
    number:        numberById.get(scenario.id) ?? null,
    title:         scenario.title,
    description:   scenario.description,
    section:       scenario.section ?? null,
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

module.exports = {
  listScenarios, getScenario, getScenarioNumber, reload, pickClientScenarioFields,
  // exported for tests
  scenarioOrderKey,
};

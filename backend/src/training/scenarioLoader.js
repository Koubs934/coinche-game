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

module.exports = { listScenarios, getScenario, reload };

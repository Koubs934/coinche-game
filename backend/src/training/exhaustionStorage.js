// Per-user bookkeeping of "exhausted" scenarios (scenarios the user has
// declared they have no more alternative strategies for). Complements
// annotationStorage.js — NOT an annotation file. The picker reads from here
// to hide scenarios by default.
//
// Path layout: ${TRAINING_DATA_DIR}/<userId>/_exhausted.json
//
// File schema (schemaVersion: 1):
//   {
//     "schemaVersion": 1,
//     "userId": "<uuid>",
//     "exhaustedScenarios": [
//       { "scenarioId": "...", "sessionId": "...", "exhaustedAt": "ISO", "alternativesRecorded": N },
//       ...
//     ]
//   }
//
// Dedupe policy: one entry per scenarioId (the most recent exhaustion session
// wins). This keeps the picker's "hide" check a simple Set membership query;
// richer per-session history is future work. If the user re-opens an
// exhausted scenario (via the "show completed" toggle) and concludes a fresh
// session, the old entry is replaced.
//
// Atomic writes: same <path>.tmp + rename pattern as annotationStorage.
//
// Leading-underscore filename is intentional — gives a visual signal in
// directory listings that this is metadata, not an annotation file. The
// annotation cleanup sweeps in annotationStorage skip files that don't end
// in a known status field, so this file is safe from them.

const fs   = require('fs');
const path = require('path');

const FILE_SCHEMA_VERSION = 1;
const FILE_NAME           = '_exhausted.json';

function dataDir() {
  return process.env.TRAINING_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'training');
}

function userDir(userId) {
  const safe = String(userId).replace(/[\\/]/g, '_');
  return path.join(dataDir(), safe);
}

function filePathFor(userId) {
  return path.join(userDir(userId), FILE_NAME);
}

function writeAtomic(targetPath, content) {
  const tmp = `${targetPath}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
}

function emptyRecord(userId) {
  return {
    schemaVersion:       FILE_SCHEMA_VERSION,
    userId,
    exhaustedScenarios: [],
  };
}

/**
 * Read the user's exhausted list. Returns an empty record (never null) if
 * the file doesn't exist yet, so callers can always treat the result the
 * same way. Corrupt files bubble up the parse error — better to surface
 * than silently reset the user's history.
 *
 * @returns {{schemaVersion:number, userId:string, exhaustedScenarios:Array}}
 */
function readExhausted(userId) {
  const target = filePathFor(userId);
  if (!fs.existsSync(target)) return emptyRecord(userId);
  const raw = fs.readFileSync(target, 'utf8');
  const rec = JSON.parse(raw);
  if (!rec || typeof rec !== 'object' || !Array.isArray(rec.exhaustedScenarios)) {
    throw new Error(`[exhaustionStorage] malformed file ${target}`);
  }
  return rec;
}

/**
 * Append or replace an exhaustion entry. Dedupes by scenarioId — the latest
 * session wins; older entries for the same scenario are dropped. Creates
 * the user directory and file if missing.
 *
 * @param {string} userId
 * @param {{scenarioId:string, sessionId:string, alternativesRecorded:number}} entry
 * @returns {{schemaVersion:number, userId:string, exhaustedScenarios:Array}}
 */
function addExhausted(userId, { scenarioId, sessionId, alternativesRecorded }) {
  if (!scenarioId) throw new Error('[exhaustionStorage] addExhausted: scenarioId required');
  if (!sessionId)  throw new Error('[exhaustionStorage] addExhausted: sessionId required');
  if (typeof alternativesRecorded !== 'number' || alternativesRecorded < 1) {
    throw new Error('[exhaustionStorage] addExhausted: alternativesRecorded must be a positive integer');
  }

  const dir = userDir(userId);
  fs.mkdirSync(dir, { recursive: true });

  const rec = fs.existsSync(filePathFor(userId))
    ? readExhausted(userId)
    : emptyRecord(userId);

  const newEntry = {
    scenarioId,
    sessionId,
    exhaustedAt: new Date().toISOString(),
    alternativesRecorded,
  };

  // Dedupe by scenarioId: newest wins.
  rec.exhaustedScenarios = rec.exhaustedScenarios.filter(e => e.scenarioId !== scenarioId);
  rec.exhaustedScenarios.push(newEntry);

  writeAtomic(filePathFor(userId), JSON.stringify(rec, null, 2));
  return rec;
}

/**
 * Convenience: just the set of scenarioIds the user has exhausted. Used by
 * the picker to hide those scenarios by default.
 *
 * @returns {Set<string>}
 */
function listExhaustedScenarioIds(userId) {
  const rec = readExhausted(userId);
  return new Set(rec.exhaustedScenarios.map(e => e.scenarioId));
}

module.exports = {
  readExhausted,
  addExhausted,
  listExhaustedScenarioIds,
  // exported for diagnostic tooling and tests
  filePathFor,
  dataDir,
  FILE_NAME,
};

// File-based annotation persistence. One file per run — its lifecycle is
// partial → complete (both at the same path; `status` field discriminates).
//
// Path layout:
//   backend/data/training/<userId>/<isoStamp>-<scenarioId>.json
//     where isoStamp uses hyphens (filesystem-safe): 2026-04-20T23-15-00
//
// Atomicity: writes go through <path>.tmp then fs.renameSync to <path>.

const fs   = require('fs');
const path = require('path');

const SCHEMA_VERSION          = 1;
const PARTIAL_TTL_MS          = 30 * 60 * 1000;
const STATUS_AWAITING_REASON  = 'awaiting-reason';
const STATUS_COMPLETE         = 'complete';
const STATUS_ABANDONED_PARTIAL = 'abandoned-partial';

function dataDir() {
  // Tests override via TRAINING_DATA_DIR to write under a scratch directory.
  // Not cached — read each call so tests can toggle freely.
  return process.env.TRAINING_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'training');
}

function userDir(userId) {
  // userId is authenticated server-side so we trust it, but strip path
  // separators defensively in case it ever contains one.
  const safe = String(userId).replace(/[\\/]/g, '_');
  return path.join(dataDir(), safe);
}

function ensureUserDir(userId) {
  const dir = userDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filesystemSafeStamp(isoStamp) {
  // 2026-04-20T23:15:00.123Z → 2026-04-20T23-15-00
  return isoStamp.replace(/:/g, '-').replace(/\.\d+Z$/, '');
}

function partialIdFor(startedAt, scenarioId) {
  return `${filesystemSafeStamp(startedAt)}-${scenarioId}`;
}

function filePathFor(userId, partialId) {
  return path.join(userDir(userId), `${partialId}.json`);
}

function writeAtomic(targetPath, content) {
  const tmp = `${targetPath}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
}

// ─── Write operations ──────────────────────────────────────────────────────

function writePartial(run) {
  if (!run.pendingAction) throw new Error('[annotationStorage] writePartial: no pendingAction');
  ensureUserDir(run.userId);

  const partialId = partialIdFor(run.startedAt, run.scenarioId);
  const target    = filePathFor(run.userId, partialId);

  const record = {
    schemaVersion:         SCHEMA_VERSION,
    scenarioId:            run.scenarioId,
    scenarioSchemaVersion: run.scenario.schemaVersion,
    tagsSchemaVersion:     SCHEMA_VERSION,
    userId:                run.userId,
    username:              run.username,
    startedAt:             run.startedAt,
    completedAt:           null,
    status:                STATUS_AWAITING_REASON,
    decisions: [
      {
        index:        0,
        timelineStep: run.pendingAction.timelineStep,
        phase:        run.game.phase,
        action:       run.pendingAction.action,
        tags:         null,
        note:         null,
        decidedAt:    null,
      },
    ],
  };
  writeAtomic(target, JSON.stringify(record, null, 2));
  run.partialId = partialId;
  return partialId;
}

function writeComplete(run, { tags, note, decidedAt }) {
  if (!run.partialId) throw new Error('[annotationStorage] writeComplete: no partialId on run');
  if (!run.pendingAction) throw new Error('[annotationStorage] writeComplete: no pendingAction');

  const target = filePathFor(run.userId, run.partialId);
  // Rebuild the record end-to-end rather than read-modify-write — the run is
  // the authoritative source, the file is just a snapshot.
  const record = {
    schemaVersion:         SCHEMA_VERSION,
    scenarioId:            run.scenarioId,
    scenarioSchemaVersion: run.scenario.schemaVersion,
    tagsSchemaVersion:     SCHEMA_VERSION,
    userId:                run.userId,
    username:              run.username,
    startedAt:             run.startedAt,
    completedAt:           new Date().toISOString(),
    status:                STATUS_COMPLETE,
    decisions: [
      {
        index:        0,
        timelineStep: run.pendingAction.timelineStep,
        phase:        run.game.phase,
        action:       run.pendingAction.action,
        tags,
        note,
        decidedAt,
      },
    ],
  };
  writeAtomic(target, JSON.stringify(record, null, 2));
  return target;
}

function discardPartial(userId, partialId) {
  const target = filePathFor(userId, partialId);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

// ─── Read operations ───────────────────────────────────────────────────────

function loadPartial(userId, partialId) {
  const target = filePathFor(userId, partialId);
  if (!fs.existsSync(target)) return null;
  const raw = fs.readFileSync(target, 'utf8');
  const rec = JSON.parse(raw);
  rec._partialId = partialId; // convenience so callers can round-trip
  return rec;
}

/**
 * List awaiting-reason files for a user that are less than 30 min old.
 * Used on reconnect to surface resumable runs.
 *
 * @returns {Array<{ partialId, scenarioId, startedAt, action, ageMs }>}
 */
function listResumablePartials(userId) {
  const dir = userDir(userId);
  if (!fs.existsSync(dir)) return [];
  const now = Date.now();
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, entry), 'utf8');
      const rec = JSON.parse(raw);
      if (rec.status !== STATUS_AWAITING_REASON) continue;
      const ageMs = now - new Date(rec.startedAt).getTime();
      if (ageMs > PARTIAL_TTL_MS) continue; // stale partials shouldn't be offered as resumable
      out.push({
        partialId:  entry.replace(/\.json$/, ''),
        scenarioId: rec.scenarioId,
        startedAt:  rec.startedAt,
        action:     rec.decisions?.[0]?.action ?? null,
        ageMs,
      });
    } catch (err) {
      console.error(`[annotationStorage] corrupt partial ${entry}: ${err.message}`);
    }
  }
  return out;
}

/**
 * Startup sweep: every awaiting-reason file older than 30 min is promoted
 * to `abandoned-partial` on disk (kept for later analysis — giving up is
 * signal) but removed from the "resumable" set.
 */
function cleanupStalePartials() {
  const root = dataDir();
  if (!fs.existsSync(root)) return { promoted: 0, scanned: 0 };
  let promoted = 0, scanned = 0;
  const now = Date.now();
  for (const userEntry of fs.readdirSync(root)) {
    const ud = path.join(root, userEntry);
    if (!fs.statSync(ud).isDirectory()) continue;
    for (const fileEntry of fs.readdirSync(ud)) {
      if (!fileEntry.endsWith('.json')) continue;
      scanned++;
      const p = path.join(ud, fileEntry);
      try {
        const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (rec.status !== STATUS_AWAITING_REASON) continue;
        const ageMs = now - new Date(rec.startedAt).getTime();
        if (ageMs <= PARTIAL_TTL_MS) continue;
        rec.status = STATUS_ABANDONED_PARTIAL;
        writeAtomic(p, JSON.stringify(rec, null, 2));
        promoted++;
      } catch (err) {
        console.error(`[annotationStorage] corrupt file during cleanup ${p}: ${err.message}`);
      }
    }
  }
  if (promoted > 0) console.log(`[training] promoted ${promoted} stale partial(s) to abandoned-partial`);
  return { promoted, scanned };
}

module.exports = {
  writePartial,
  writeComplete,
  discardPartial,
  loadPartial,
  listResumablePartials,
  cleanupStalePartials,
  // exported for tests / diagnostic tooling
  partialIdFor,
  filePathFor,
  dataDir,
  STATUS_AWAITING_REASON,
  STATUS_COMPLETE,
  STATUS_ABANDONED_PARTIAL,
  PARTIAL_TTL_MS,
};

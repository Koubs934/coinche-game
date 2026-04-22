// File-based persistence for completed-game records. Parallel system to
// training/annotationStorage.js — different data domain, same operational
// patterns (atomic write, per-user directory, env-var override).
//
// Path layout:
//   <GAMES_DATA_DIR>/<roomCreatorUserId>/<isoStamp>-<gameId>.json
//     where isoStamp uses hyphens (filesystem-safe): 2026-04-22T23-15-00-123
//
// Env var: GAMES_DATA_DIR. Local default is backend/data/games/ (mirrors the
// training module's fallback); Railway sets GAMES_DATA_DIR=/data/games/
// explicitly. Tests override via env var to write under a scratch directory.
//
// Atomicity: writes go through <path>.tmp then fs.renameSync to <path>.

const fs   = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function dataDir() {
  return process.env.GAMES_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'games');
}

function userDir(userId) {
  const safe = String(userId).replace(/[\\/]/g, '_');
  return path.join(dataDir(), safe);
}

function ensureUserDir(userId) {
  const dir = userDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filesystemSafeStamp(isoStamp) {
  return isoStamp.replace(/:/g, '-').replace(/\.(\d+)Z$/, '-$1');
}

function filenameFor(isoStamp, gameId) {
  return `${filesystemSafeStamp(isoStamp)}-${gameId}.json`;
}

function filePathFor(userId, filename) {
  return path.join(userDir(userId), filename);
}

function writeAtomic(targetPath, content) {
  const tmp = `${targetPath}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
}

/**
 * Persist a completed GameRecord. The record is the authoritative source —
 * this function does not transform or validate beyond ensuring schemaVersion
 * is stamped.
 *
 * @param {object} record fully-built GameRecord (schemaVersion, gameId, etc.)
 * @returns {string} absolute path of the written file
 */
function writeGameRecord(record) {
  if (!record || !record.gameId) throw new Error('[gameRecordStorage] writeGameRecord: record.gameId required');
  if (!record.roomCreatorUserId) throw new Error('[gameRecordStorage] writeGameRecord: record.roomCreatorUserId required');
  if (!record.completedAt) throw new Error('[gameRecordStorage] writeGameRecord: record.completedAt required');

  const userId = record.roomCreatorUserId;
  ensureUserDir(userId);

  const filename = filenameFor(record.completedAt, record.gameId);
  const target   = filePathFor(userId, filename);

  const stamped = { ...record, schemaVersion: SCHEMA_VERSION };
  writeAtomic(target, JSON.stringify(stamped, null, 2));
  return target;
}

/**
 * Read back a GameRecord by userId + filename. Intended for tests and
 * diagnostic tooling — the production path never rereads its own output.
 */
function readGameRecord(userId, filename) {
  const target = filePathFor(userId, filename);
  if (!fs.existsSync(target)) return null;
  const raw = fs.readFileSync(target, 'utf8');
  return JSON.parse(raw);
}

module.exports = {
  writeGameRecord,
  readGameRecord,
  dataDir,
  filePathFor,
  filenameFor,
  SCHEMA_VERSION,
};

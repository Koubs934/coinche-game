// Unit tests for the GameRecord persistence module. Uses a scratch directory
// via GAMES_DATA_DIR so no real game data is touched.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH_DIR = path.join(__dirname, 'tmp-games-data');
process.env.GAMES_DATA_DIR = SCRATCH_DIR;

const require = createRequire(import.meta.url);
const gameRecordStorage = require('../gameRecordStorage.js');

function makeRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    gameId: 'game-uuid-1',
    roomCreatorUserId: 'creator-1',
    roomCreatorUsername: 'AK7',
    createdAt:   '2026-04-22T12:00:00.000Z',
    completedAt: '2026-04-22T12:15:00.000Z',
    players: [
      { seat: 0, userId: 'creator-1', username: 'AK7' },
      { seat: 1, userId: 'bot-1',     username: 'Bot 1' },
      { seat: 2, userId: 'bot-2',     username: 'Bot 2' },
      { seat: 3, userId: 'bot-3',     username: 'Bot 3' },
    ],
    teams: [
      { teamId: 0, seats: [0, 2] },
      { teamId: 1, seats: [1, 3] },
    ],
    deal: { hands: { 0: [], 1: [], 2: [], 3: [] }, dealer: 0 },
    bidding: { rounds: [], winner: null, coinche: null },
    play:    { tricks: [], belote: { declaredBy: null, trickIndex: null, rebeloteAt: null } },
    outcome: { team0Score: 0, team1Score: 0, team0CumulativeScore: 0, team1CumulativeScore: 0, winningTeam: null },
    errorAnnotations: [],
    ...overrides,
  };
}

describe('gameRecordStorage', () => {
  beforeEach(() => {
    if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });

  it('writes to the GAMES_DATA_DIR scratch directory', () => {
    const target = gameRecordStorage.writeGameRecord(makeRecord());
    expect(target.startsWith(SCRATCH_DIR)).toBe(true);
    expect(fs.existsSync(target)).toBe(true);
  });

  it('creates a per-user subdirectory', () => {
    gameRecordStorage.writeGameRecord(makeRecord({ roomCreatorUserId: 'user-A' }));
    gameRecordStorage.writeGameRecord(makeRecord({
      roomCreatorUserId: 'user-B',
      gameId: 'game-uuid-2',
      completedAt: '2026-04-22T12:20:00.000Z',
    }));
    expect(fs.existsSync(path.join(SCRATCH_DIR, 'user-A'))).toBe(true);
    expect(fs.existsSync(path.join(SCRATCH_DIR, 'user-B'))).toBe(true);
    const filesA = fs.readdirSync(path.join(SCRATCH_DIR, 'user-A'));
    const filesB = fs.readdirSync(path.join(SCRATCH_DIR, 'user-B'));
    expect(filesA).toHaveLength(1);
    expect(filesB).toHaveLength(1);
    expect(filesA[0]).not.toBe(filesB[0]);
  });

  it('writes atomically — no .tmp residue after a successful write', () => {
    const rec = makeRecord();
    gameRecordStorage.writeGameRecord(rec);
    const files = fs.readdirSync(path.join(SCRATCH_DIR, rec.roomCreatorUserId));
    expect(files.some(f => f.endsWith('.tmp'))).toBe(false);
    expect(files).toHaveLength(1);
  });

  it('round-trips: writeGameRecord then readGameRecord returns identical content', () => {
    const rec = makeRecord({
      errorAnnotations: [{
        annotationId: 'ann-1',
        cardRef: { trickIndex: 0, seat: 1, card: '9H' },
        note: 'Wasted the 9 of trump too early',
        createdAt: '2026-04-22T12:05:00.000Z',
        createdByUserId: 'creator-1',
      }],
    });
    const target   = gameRecordStorage.writeGameRecord(rec);
    const filename = path.basename(target);
    const back     = gameRecordStorage.readGameRecord(rec.roomCreatorUserId, filename);
    expect(back).toEqual({ ...rec, schemaVersion: 1 });
  });

  it('filename embeds a filesystem-safe ISO stamp (no colons, no .Z)', () => {
    const rec = makeRecord({ completedAt: '2026-04-22T12:15:30.250Z', gameId: 'abcd' });
    const target   = gameRecordStorage.writeGameRecord(rec);
    const filename = path.basename(target);
    expect(filename).toMatch(/^2026-04-22T12-15-30-250-abcd\.json$/);
  });

  it('rejects records missing required identity fields', () => {
    expect(() => gameRecordStorage.writeGameRecord({})).toThrow(/gameId/);
    expect(() => gameRecordStorage.writeGameRecord({ gameId: 'g1' })).toThrow(/roomCreatorUserId/);
    expect(() => gameRecordStorage.writeGameRecord({ gameId: 'g1', roomCreatorUserId: 'u1' })).toThrow(/completedAt/);
  });

  it('stamps schemaVersion: 1 on the persisted record', () => {
    const rec = makeRecord();
    delete rec.schemaVersion;
    const target   = gameRecordStorage.writeGameRecord(rec);
    const written  = JSON.parse(fs.readFileSync(target, 'utf8'));
    expect(written.schemaVersion).toBe(1);
  });

  it('readGameRecord returns null when the file does not exist', () => {
    expect(gameRecordStorage.readGameRecord('nobody', 'missing.json')).toBeNull();
  });
});

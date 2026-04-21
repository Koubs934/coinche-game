// Unit tests for the per-user exhaustion storage module. Uses a scratch
// directory via TRAINING_DATA_DIR so no real annotation state is touched.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH_DIR = path.join(__dirname, 'tmp-exhaustion-data');
process.env.TRAINING_DATA_DIR = SCRATCH_DIR;

const require = createRequire(import.meta.url);
const exhaustionStorage = require('../exhaustionStorage.js');

const USER_ID = 'test-user-exhaust';

function userFilePath(userId) {
  return path.join(SCRATCH_DIR, userId, exhaustionStorage.FILE_NAME);
}

describe('exhaustionStorage', () => {
  beforeEach(() => {
    if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });

  describe('readExhausted', () => {
    it('returns an empty record when the file does not exist', () => {
      const r = exhaustionStorage.readExhausted(USER_ID);
      expect(r.schemaVersion).toBe(1);
      expect(r.userId).toBe(USER_ID);
      expect(r.exhaustedScenarios).toEqual([]);
    });

    it('reads an existing record verbatim', () => {
      const seed = {
        schemaVersion: 1,
        userId: USER_ID,
        exhaustedScenarios: [{
          scenarioId: 'seed-scenario',
          sessionId: 'seed-session-uuid',
          exhaustedAt: '2026-04-21T00:00:00.000Z',
          alternativesRecorded: 2,
        }],
      };
      fs.mkdirSync(path.dirname(userFilePath(USER_ID)), { recursive: true });
      fs.writeFileSync(userFilePath(USER_ID), JSON.stringify(seed, null, 2));

      const r = exhaustionStorage.readExhausted(USER_ID);
      expect(r.exhaustedScenarios).toHaveLength(1);
      expect(r.exhaustedScenarios[0].scenarioId).toBe('seed-scenario');
    });

    it('throws on malformed file rather than silently resetting', () => {
      fs.mkdirSync(path.dirname(userFilePath(USER_ID)), { recursive: true });
      fs.writeFileSync(userFilePath(USER_ID), JSON.stringify({ nonsense: true }));
      expect(() => exhaustionStorage.readExhausted(USER_ID)).toThrow(/malformed/);
    });
  });

  describe('addExhausted', () => {
    it('creates the file and directory on first write', () => {
      expect(fs.existsSync(userFilePath(USER_ID))).toBe(false);
      const rec = exhaustionStorage.addExhausted(USER_ID, {
        scenarioId: 'scenario-a',
        sessionId: 'session-uuid-1',
        alternativesRecorded: 2,
      });
      expect(fs.existsSync(userFilePath(USER_ID))).toBe(true);
      expect(rec.exhaustedScenarios).toHaveLength(1);
      expect(rec.exhaustedScenarios[0]).toMatchObject({
        scenarioId: 'scenario-a',
        sessionId: 'session-uuid-1',
        alternativesRecorded: 2,
      });
      expect(typeof rec.exhaustedScenarios[0].exhaustedAt).toBe('string');
    });

    it('appends a new entry for a different scenarioId', () => {
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', sessionId: 's1', alternativesRecorded: 1 });
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'b', sessionId: 's2', alternativesRecorded: 3 });
      const r = exhaustionStorage.readExhausted(USER_ID);
      expect(r.exhaustedScenarios.map(e => e.scenarioId)).toEqual(['a', 'b']);
    });

    it('dedupes by scenarioId — newest session replaces the prior entry', () => {
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', sessionId: 's1', alternativesRecorded: 2 });
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', sessionId: 's2', alternativesRecorded: 5 });
      const r = exhaustionStorage.readExhausted(USER_ID);
      expect(r.exhaustedScenarios).toHaveLength(1);
      expect(r.exhaustedScenarios[0].sessionId).toBe('s2');
      expect(r.exhaustedScenarios[0].alternativesRecorded).toBe(5);
    });

    it('writes atomically (no .tmp residue after success)', () => {
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', sessionId: 's1', alternativesRecorded: 1 });
      const userDir = path.dirname(userFilePath(USER_ID));
      const tmpFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('rejects malformed input', () => {
      expect(() => exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', sessionId: 's1', alternativesRecorded: 0 }))
        .toThrow(/positive integer/);
      expect(() => exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', alternativesRecorded: 1 }))
        .toThrow(/sessionId/);
      expect(() => exhaustionStorage.addExhausted(USER_ID, { sessionId: 's1', alternativesRecorded: 1 }))
        .toThrow(/scenarioId/);
    });
  });

  describe('listExhaustedScenarioIds', () => {
    it('returns a Set of scenarioIds', () => {
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'a', sessionId: 's1', alternativesRecorded: 1 });
      exhaustionStorage.addExhausted(USER_ID, { scenarioId: 'b', sessionId: 's2', alternativesRecorded: 2 });
      const ids = exhaustionStorage.listExhaustedScenarioIds(USER_ID);
      expect(ids).toBeInstanceOf(Set);
      expect(ids.has('a')).toBe(true);
      expect(ids.has('b')).toBe(true);
      expect(ids.has('c')).toBe(false);
    });

    it('returns an empty set when the file does not exist', () => {
      const ids = exhaustionStorage.listExhaustedScenarioIds(USER_ID);
      expect(ids.size).toBe(0);
    });
  });
});

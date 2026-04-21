// End-to-end integration tests for the training-mode subsystem.
//
// Spin up a real Socket.io server wired with registerTrainingHandlers
// (same wire-up as server.js uses for live), connect via socket.io-client,
// drive the full lifecycle. Each test uses a distinct userId so state
// cannot leak between tests.
//
// TRAINING_DATA_DIR redirects all annotation writes to a scratch directory
// under __tests__/; the whole directory is deleted in afterAll. Real
// annotation data in backend/data/training/ is never touched.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH_DATA_DIR = path.join(__dirname, 'tmp-training-data');

// Redirect annotation storage BEFORE loading any training modules.
process.env.TRAINING_DATA_DIR = SCRATCH_DATA_DIR;

// Dynamic require after env var is set.
const { createRequire } = await import('module');
const require = createRequire(import.meta.url);
const { registerTrainingHandlers } = require('../trainingSocket.js');

let httpServer, ioServer, address;

async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 20 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function connectClient(userId, username) {
  const client = ioClient(`http://localhost:${address.port}`, {
    auth: { userId, username },
    reconnection: false,
    transports: ['websocket'],
  });
  return client;
}

function collectEvents(client, names) {
  const events = {};
  for (const n of names) events[n] = [];
  for (const n of names) client.on(n, payload => events[n].push(payload));
  return events;
}

beforeAll(async () => {
  // Clean scratch dir from any previous run.
  if (fs.existsSync(SCRATCH_DATA_DIR)) fs.rmSync(SCRATCH_DATA_DIR, { recursive: true, force: true });

  httpServer = createServer();
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  ioServer.use((socket, next) => {
    const { userId, username } = socket.handshake.auth || {};
    if (!userId || !username) return next(new Error('Authentication required'));
    socket.userId = userId;
    socket.username = username;
    next();
  });
  ioServer.on('connection', socket => {
    const training = registerTrainingHandlers(socket);
    training.surfaceResumableOnConnect();
  });

  await new Promise(resolve => {
    httpServer.listen(0, () => {
      address = httpServer.address();
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise(resolve => ioServer.close(resolve));
  await new Promise(resolve => httpServer.close(resolve));
  if (fs.existsSync(SCRATCH_DATA_DIR)) fs.rmSync(SCRATCH_DATA_DIR, { recursive: true, force: true });
});

// ─── Test A: happy path ────────────────────────────────────────────────────

describe('training flow — happy path', () => {
  const USER_ID = 'test-user-happy';
  const USERNAME = 'Happy Tester';
  const SCENARIO = 'opening-petit-jeu-first-to-speak'; // no scripted events, straight to user-turn

  it('start → action → reason → completed + annotation file matches', async () => {
    const client = connectClient(USER_ID, USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);

    await new Promise(resolve => client.on('connect', resolve));

    client.emit('startTrainingScenario', { scenarioId: SCENARIO });

    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION')
    );

    expect(events.trainingStarted).toHaveLength(1);
    const started = events.trainingStarted[0];
    expect(started.trainingState.scenarioId).toBe(SCENARIO);
    const runId = started.trainingState.runId;
    expect(runId).toBeTruthy();

    // Submit action
    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });

    await waitFor(() => events.trainingAwaitingReason.length > 0);
    expect(events.error).toHaveLength(0);

    const awaiting = events.trainingAwaitingReason[0];
    expect(awaiting.trainingState.runState).toBe('AWAITING-REASON');
    expect(awaiting.trainingState.pendingAction).toEqual({ type: 'bid', value: 90, suit: 'S' });

    // Partial file must exist
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const partialFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
    expect(partialFiles).toHaveLength(1);
    const partialPath = path.join(userDir, partialFiles[0]);
    const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(partial.status).toBe('awaiting-reason');
    expect(partial.decisions[0].action).toEqual({ type: 'bid', value: 90, suit: 'S' });
    expect(partial.decisions[0].tags).toBeNull();

    // Submit reason (v2 tags: one Group-4 `ouverture` is the required action tag;
    // `valet-troisième` describes the trump hand)
    client.emit('submitTrainingReason', {
      runId,
      tags: ['ouverture', 'valet-troisième'],
      note: 'J-third in ♠, first to speak',
    });

    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const completed = events.trainingCompleted[0];
    expect(completed.runId).toBe(runId);
    expect(completed.annotation.scenarioId).toBe(SCENARIO);
    expect(completed.annotation.decisions).toHaveLength(1);
    expect(completed.annotation.decisions[0].tags).toEqual(['ouverture', 'valet-troisième']);

    // Final file on disk matches completed state, at SAME path (startedAt-derived)
    const finalFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
    expect(finalFiles).toHaveLength(1);
    expect(finalFiles[0]).toBe(partialFiles[0]);  // same filename

    const annotation = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(annotation.schemaVersion).toBe(1);
    expect(annotation.scenarioSchemaVersion).toBe(1);
    expect(annotation.tagsSchemaVersion).toBe(2);
    expect(annotation.status).toBe('complete');
    expect(annotation.userId).toBe(USER_ID);
    expect(annotation.username).toBe(USERNAME);
    expect(annotation.scenarioId).toBe(SCENARIO);
    expect(annotation.completedAt).toBeTruthy();
    expect(annotation.decisions).toHaveLength(1);
    expect(annotation.decisions[0].action).toEqual({ type: 'bid', value: 90, suit: 'S' });
    expect(annotation.decisions[0].tags).toEqual(['ouverture', 'valet-troisième']);
    expect(annotation.decisions[0].note).toBe('J-third in ♠, first to speak');
    expect(annotation.decisions[0].decidedAt).toBeTruthy();

    // No orphan .tmp files
    const tmpFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);

    client.disconnect();
  });
});

// ─── Test B: partial resume path ──────────────────────────────────────────

describe('training flow — partial resume', () => {
  const USER_ID = 'test-user-resume';
  const USERNAME = 'Resume Tester';
  const SCENARIO = 'petit-jeu-after-opp-80-spades'; // scripted bid → user-turn

  it('action → disconnect → reconnect → resume → completed; file stays at same path', async () => {
    // ── Phase 1: action submitted, then client disconnects ───────────────
    const client1 = connectClient(USER_ID, USERNAME);
    const events1 = collectEvents(client1, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason', 'error',
    ]);

    await new Promise(resolve => client1.on('connect', resolve));
    client1.emit('startTrainingScenario', { scenarioId: SCENARIO });

    // Wait until the scripted bid replays AND the user-turn lands
    await waitFor(() =>
      events1.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
      { timeoutMs: 4000 }
    );

    const runId1 = events1.trainingStarted[0].trainingState.runId;

    // User counters with their own 90♠
    client1.emit('submitTrainingAction', { runId: runId1, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events1.trainingAwaitingReason.length > 0);
    expect(events1.error).toHaveLength(0);

    // Confirm partial on disk
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const partialFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
    expect(partialFiles).toHaveLength(1);
    const partialFilename = partialFiles[0];
    const partialPath = path.join(userDir, partialFilename);
    const partialBefore = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(partialBefore.status).toBe('awaiting-reason');

    // Disconnect — triggers immediate GC of the AWAITING-REASON in-memory run
    client1.disconnect();
    // Give the server a beat to process disconnect
    await new Promise(r => setTimeout(r, 100));

    // ── Phase 2: reconnect, resume, complete ─────────────────────────────
    const client2 = connectClient(USER_ID, USERNAME);
    const events2 = collectEvents(client2, [
      'trainingResumablePending', 'trainingAwaitingReason', 'trainingCompleted', 'error',
    ]);

    await new Promise(resolve => client2.on('connect', resolve));

    // Server should surface the pending partial on connect
    await waitFor(() => events2.trainingResumablePending.length > 0);

    const resumable = events2.trainingResumablePending[0];
    expect(resumable.partials).toHaveLength(1);
    const partial = resumable.partials[0];
    expect(partial.scenarioId).toBe(SCENARIO);
    expect(partial.action).toEqual({ type: 'bid', value: 90, suit: 'S' });

    // Resume the partial
    client2.emit('resumeTrainingScenario', { partialId: partial.partialId });
    await waitFor(() => events2.trainingAwaitingReason.length > 0);
    expect(events2.error).toHaveLength(0);

    const runId2 = events2.trainingAwaitingReason[0].trainingState.runId;
    expect(runId2).toBeTruthy();
    // Server generates a fresh runId on resume (in-memory identity).
    // That's fine — the client uses whatever runId the server hands back.

    // Submit final reason (v2: `faire-monter-pour-coincher` is the Group-4
    // action tag; `valet-troisième` is the trump-hand tag so no soft
    // warning bounce — `recommendAtLeastOne` on trump-hand is satisfied)
    client2.emit('submitTrainingReason', {
      runId: runId2,
      tags: ['faire-monter-pour-coincher', 'valet-troisième'],
      note: 'reasserted after resume',
    });
    await waitFor(() => events2.trainingCompleted.length > 0);
    expect(events2.error).toHaveLength(0);

    // ── Disk checks ──────────────────────────────────────────────────────
    // Still exactly one JSON file
    const finalFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
    expect(finalFiles).toHaveLength(1);
    // And it's at the SAME path as the partial (startedAt-derived filename)
    expect(finalFiles[0]).toBe(partialFilename);

    const finalAnnotation = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(finalAnnotation.status).toBe('complete');
    expect(finalAnnotation.startedAt).toBe(partialBefore.startedAt);
    expect(finalAnnotation.decisions[0].tags).toEqual(['faire-monter-pour-coincher', 'valet-troisième']);
    expect(finalAnnotation.decisions[0].note).toBe('reasserted after resume');

    // No orphan .tmp files
    const tmpFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);

    client2.disconnect();
  });
});

// ─── Test C: soft-warning ack round-trip ──────────────────────────────────

describe('training flow — soft warning ack', () => {
  const USER_ID = 'test-user-warn';
  const USERNAME = 'Warn Tester';
  const SCENARIO = 'opening-petit-jeu-first-to-speak';

  it('submit without trump-hand tag → trainingReasonWarning → ack → trainingCompleted', async () => {
    const client = connectClient(USER_ID, USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingReasonWarning', 'trainingCompleted', 'error',
    ]);

    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: SCENARIO });
    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );
    const runId = events.trainingStarted[0].trainingState.runId;

    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events.trainingAwaitingReason.length > 0);

    // No trump-hand tag → trump-hand recommendAtLeastOne triggers a warning.
    // Server holds the run in AWAITING-REASON; nothing written to status=complete.
    client.emit('submitTrainingReason', {
      runId,
      tags: ['ouverture'],
      note: 'testing warning path',
    });
    await waitFor(() => events.trainingReasonWarning.length > 0);

    expect(events.trainingCompleted).toHaveLength(0);
    const warn = events.trainingReasonWarning[0];
    expect(warn.runId).toBe(runId);
    expect(warn.warnings[0]).toMatch(/trump-hand/);
    expect(warn.tags).toEqual(['ouverture']);

    // On-disk file is still awaiting-reason, not complete
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const interim = JSON.parse(fs.readFileSync(
      path.join(userDir, fs.readdirSync(userDir).find(f => f.endsWith('.json'))),
      'utf8',
    ));
    expect(interim.status).toBe('awaiting-reason');

    // Ack and resubmit — now completion proceeds despite missing trump-hand
    client.emit('submitTrainingReason', {
      runId,
      tags: ['ouverture'],
      note: 'testing warning path',
      ackWarnings: true,
    });
    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const finalAnnotation = JSON.parse(fs.readFileSync(
      path.join(userDir, fs.readdirSync(userDir).find(f => f.endsWith('.json'))),
      'utf8',
    ));
    expect(finalAnnotation.status).toBe('complete');
    expect(finalAnnotation.decisions[0].tags).toEqual(['ouverture']);

    client.disconnect();
  });
});

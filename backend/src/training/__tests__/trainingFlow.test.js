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

describe('training flow — happy path (match case, v3)', () => {
  const USER_ID = 'test-user-happy';
  const USERNAME = 'Happy Tester';
  // Per V2.1, the expected opening on this hand is `pass`. Submitting pass
  // exercises the match path — no divergenceAgreement, no required note.
  const SCENARIO = 'opening-petit-jeu-first-to-speak';

  it('start → pass (match) → reason (null/empty) → completed + v3 annotation', async () => {
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
    const runId = events.trainingStarted[0].trainingState.runId;

    // Match path: action equals scenario.expectedAnswer.action
    client.emit('submitTrainingAction', { runId, action: { type: 'pass' } });

    await waitFor(() => events.trainingAwaitingReason.length > 0);
    expect(events.error).toHaveLength(0);

    // Partial on disk uses v3 shape — no `tags` field anywhere.
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const partialFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    expect(partialFiles).toHaveLength(1);
    const partialPath = path.join(userDir, partialFiles[0]);
    const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(partial.schemaVersion).toBe(3);
    expect(partial).not.toHaveProperty('tagsSchemaVersion');
    expect(partial.status).toBe('awaiting-reason');
    expect(partial.decisions[0].action).toEqual({ type: 'pass' });
    expect(partial.decisions[0]).not.toHaveProperty('tags');
    expect(partial.decisions[0].divergenceType).toBeNull();
    expect(partial.decisions[0].divergenceAgreement).toBeNull();
    expect(partial.decisions[0].note).toBeNull();

    // Match-case reason payload: null agreement + empty note (server allows).
    client.emit('submitTrainingReason', { runId, divergenceAgreement: null, note: '' });

    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const completed = events.trainingCompleted[0];
    expect(completed.runId).toBe(runId);
    expect(completed.annotation.decisions).toHaveLength(1);
    const decision = completed.annotation.decisions[0];
    expect(decision.divergenceType).toBeNull();
    expect(decision.divergenceAgreement).toBeNull();
    expect(decision.note).toBe('');

    // Final file on disk: v3 schema, at the same path as the partial.
    const finalFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    expect(finalFiles).toHaveLength(1);
    expect(finalFiles[0]).toBe(partialFiles[0]);
    const annotation = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(annotation.schemaVersion).toBe(3);
    expect(annotation.scenarioSchemaVersion).toBe(2);
    expect(annotation).not.toHaveProperty('tagsSchemaVersion');
    expect(annotation.status).toBe('complete');
    expect(annotation.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(annotation.alternativeIndex).toBe(0);
    expect(annotation.sessionStatus).toBe('in-progress');
    expect(annotation.userId).toBe(USER_ID);
    expect(annotation.username).toBe(USERNAME);
    expect(annotation.scenarioId).toBe(SCENARIO);
    expect(annotation.decisions[0].action).toEqual({ type: 'pass' });
    expect(annotation.decisions[0].divergenceType).toBeNull();
    expect(annotation.decisions[0].divergenceAgreement).toBeNull();
    expect(annotation.decisions[0].note).toBe('');
    expect(annotation.decisions[0]).not.toHaveProperty('tags');

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
    const partialFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
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

    // The scenario `petit-jeu-after-opp-80-spades` is rule-silent
    // (`expectedAnswer: null`, `competitive-bidding-not-formalized` flag).
    // v3 rules: divergenceAgreement must be null, note must be non-empty.
    client2.emit('submitTrainingReason', {
      runId: runId2,
      divergenceAgreement: null,
      note: 'reasserted after resume',
    });
    await waitFor(() => events2.trainingCompleted.length > 0);
    expect(events2.error).toHaveLength(0);

    // ── Disk checks ──────────────────────────────────────────────────────
    // Still exactly one JSON file
    const finalFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    expect(finalFiles).toHaveLength(1);
    // And it's at the SAME path as the partial (startedAt-derived filename)
    expect(finalFiles[0]).toBe(partialFilename);

    const finalAnnotation = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(finalAnnotation.schemaVersion).toBe(3);
    expect(finalAnnotation.status).toBe('complete');
    expect(finalAnnotation.startedAt).toBe(partialBefore.startedAt);
    expect(finalAnnotation.decisions[0].divergenceType).toBe('rule-silent');
    expect(finalAnnotation.decisions[0].divergenceAgreement).toBeNull();
    expect(finalAnnotation.decisions[0].note).toBe('reasserted after resume');
    expect(finalAnnotation.decisions[0]).not.toHaveProperty('tags');

    // No orphan .tmp files
    const tmpFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);

    client2.disconnect();
  });
});

// ─── Test C: v3 divergence error paths ───────────────────────────────────

describe('training flow — v3 divergence validation errors', () => {
  const USER_ID = 'test-user-divergence-errors';
  const USERNAME = 'Divergence Tester';
  // Expected = pass; submitting a bid is action-type-different (divergent).
  const SCENARIO = 'opening-petit-jeu-first-to-speak';

  async function startAndAct(client, events) {
    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: SCENARIO });
    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );
    const runId = events.trainingStarted[0].trainingState.runId;
    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events.trainingAwaitingReason.length > 0);
    return runId;
  }

  it('rejects divergent submission missing divergenceAgreement', async () => {
    const client = connectClient(USER_ID, USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events);

    client.emit('submitTrainingReason', { runId, divergenceAgreement: null, note: 'has note but no agreement' });
    await waitFor(() => events.error.length > 0);
    expect(events.trainingCompleted).toHaveLength(0);
    expect(events.error[events.error.length - 1].code).toBe('MISSING_DIVERGENCE_AGREEMENT');
    client.disconnect();
  });

  it('rejects divergent submission with invalid divergenceAgreement value', async () => {
    const client = connectClient('test-user-invalid-agree', USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events);

    client.emit('submitTrainingReason', { runId, divergenceAgreement: 'maybe-so', note: 'whatever' });
    await waitFor(() => events.error.length > 0);
    expect(events.trainingCompleted).toHaveLength(0);
    expect(events.error[events.error.length - 1].code).toBe('INVALID_DIVERGENCE_AGREEMENT');
    client.disconnect();
  });

  it('rejects divergent submission with empty note', async () => {
    const client = connectClient('test-user-empty-note', USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events);

    client.emit('submitTrainingReason', { runId, divergenceAgreement: 'could-be-either', note: '   ' });
    await waitFor(() => events.error.length > 0);
    expect(events.trainingCompleted).toHaveLength(0);
    expect(events.error[events.error.length - 1].code).toBe('MISSING_REQUIRED_NOTE');
    client.disconnect();
  });

  it('accepts valid divergent submission and stores divergenceType', async () => {
    const client = connectClient('test-user-valid-divergent', USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events);

    client.emit('submitTrainingReason', {
      runId,
      divergenceAgreement: 'user-disagrees',
      note: 'I think 90♠ is the right opening here',
    });
    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const decision = events.trainingCompleted[0].annotation.decisions[0];
    expect(decision.divergenceType).toBe('action-type-different');
    expect(decision.divergenceAgreement).toBe('user-disagrees');
    expect(decision.note).toBe('I think 90♠ is the right opening here');
    expect(decision).not.toHaveProperty('tags');
    client.disconnect();
  });
});

// ─── Test D: full exhaustion session (multi-alternative + duplicate refusal) ──

describe('training flow — exhaustion session', () => {
  const USER_ID = 'test-user-exhaust';
  const USERNAME = 'Exhaust Tester';
  const SCENARIO = 'opening-petit-jeu-first-to-speak'; // instant user-turn

  async function submitAlt(client, events, runId, action, divergenceAgreement, note) {
    // Clear the completion/prompt trackers for the upcoming alternative.
    const before = events.trainingCompleted.length;
    const beforePrompt = events.trainingScenarioReviewPrompt.length;
    client.emit('submitTrainingAction', { runId, action });
    await waitFor(() => events.trainingAwaitingReason.length >
      events.trainingCompleted.length); // awaiting > completed proves this run reached AWAITING-REASON again
    client.emit('submitTrainingReason', { runId, divergenceAgreement, note });
    await waitFor(() => events.trainingCompleted.length > before);
    await waitFor(() => events.trainingScenarioReviewPrompt.length > beforePrompt);
  }

  it('alt 0 → yes → alt 1 (duplicate refused) → alt 1 (different bid) → no → exhausted', async () => {
    const client = connectClient(USER_ID, USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'trainingScenarioReviewPrompt',
      'trainingScenarioReviewed', 'trainingScenarioExhausted',
      'exhaustedScenarios',
      'error',
    ]);

    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: SCENARIO });
    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );

    const started = events.trainingStarted[0];
    const runId     = started.trainingState.runId;
    const sessionId = started.trainingState.session.sessionId;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(started.trainingState.session.alternativeIndex).toBe(0);

    // ── Alternative 0: submit 90♠ (divergent — expected is pass) ─────────
    await submitAlt(client, events, runId,
      { type: 'bid', value: 90, suit: 'S' },
      'could-be-either',
      'alt 0',
    );

    const prompt0 = events.trainingScenarioReviewPrompt[0];
    expect(prompt0.sessionId).toBe(sessionId);
    expect(prompt0.alternativeIndex).toBe(0);

    // Yes → next alternative
    client.emit('submitScenarioReviewAnswer', { runId, sessionId, answer: 'yes' });
    await waitFor(() => events.trainingScenarioReviewed.length > 0);
    expect(events.trainingScenarioReviewed[0].trainingState.session.alternativeIndex).toBe(1);

    // Scenario replays (instantly for this one) and returns to AWAITING-ACTION
    await waitFor(() =>
      events.trainingUpdate.some(u =>
        u.trainingState.runState === 'AWAITING-ACTION' &&
        u.trainingState.session?.alternativeIndex === 1,
      ),
    );

    // ── Alt 1 attempt: duplicate 90♠ — must be refused ──────────────────
    const errorsBeforeDup = events.error.length;
    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events.error.length > errorsBeforeDup);
    const dupErr = events.error[events.error.length - 1];
    expect(dupErr.code).toBe('DUPLICATE_BID_IN_SESSION');

    // No new partial file was written for the failed attempt — count stays at 1
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const filesAfterDupAttempt = fs.readdirSync(userDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'));
    expect(filesAfterDupAttempt).toHaveLength(1);

    // ── Alt 1 retry: different bid (80♠ — also divergent vs expected pass) ──
    await submitAlt(client, events, runId,
      { type: 'bid', value: 80, suit: 'S' },
      'user-disagrees',
      'alt 1',
    );

    const prompt1 = events.trainingScenarioReviewPrompt[1];
    expect(prompt1.sessionId).toBe(sessionId);
    expect(prompt1.alternativeIndex).toBe(1);

    // Now say no — concludes session, writes _exhausted.json
    client.emit('submitScenarioReviewAnswer', { runId, sessionId, answer: 'no' });
    await waitFor(() => events.trainingScenarioExhausted.length > 0);
    const exhaustedEvt = events.trainingScenarioExhausted[0];
    expect(exhaustedEvt.sessionId).toBe(sessionId);
    expect(exhaustedEvt.scenarioId).toBe(SCENARIO);
    expect(exhaustedEvt.alternativesRecorded).toBe(2);
    expect(exhaustedEvt.exhaustedScenarios).toHaveLength(1);
    expect(exhaustedEvt.exhaustedScenarios[0].scenarioId).toBe(SCENARIO);

    // ── Disk checks ─────────────────────────────────────────────────────
    // 2 annotation files with matching sessionId + incrementing alternativeIndex
    const annotFiles = fs.readdirSync(userDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .sort();
    expect(annotFiles).toHaveLength(2);

    const alts = annotFiles.map(f =>
      JSON.parse(fs.readFileSync(path.join(userDir, f), 'utf8')),
    ).sort((a, b) => a.alternativeIndex - b.alternativeIndex);

    expect(alts[0].sessionId).toBe(sessionId);
    expect(alts[0].alternativeIndex).toBe(0);
    expect(alts[0].sessionStatus).toBe('concluded');
    expect(alts[0].decisions[0].action).toEqual({ type: 'bid', value: 90, suit: 'S' });

    expect(alts[1].sessionId).toBe(sessionId);
    expect(alts[1].alternativeIndex).toBe(1);
    expect(alts[1].sessionStatus).toBe('concluded');
    expect(alts[1].decisions[0].action).toEqual({ type: 'bid', value: 80, suit: 'S' });

    // _exhausted.json exists with the one entry
    const exhaustedPath = path.join(userDir, '_exhausted.json');
    expect(fs.existsSync(exhaustedPath)).toBe(true);
    const exhaustedRec = JSON.parse(fs.readFileSync(exhaustedPath, 'utf8'));
    expect(exhaustedRec.exhaustedScenarios).toHaveLength(1);
    expect(exhaustedRec.exhaustedScenarios[0]).toMatchObject({
      scenarioId:          SCENARIO,
      sessionId,
      alternativesRecorded: 2,
    });

    client.disconnect();
  });

  it('getExhaustedScenarios returns what addExhausted wrote', async () => {
    // Relies on prior test having written _exhausted.json for USER_ID.
    const client = connectClient(USER_ID, USERNAME);
    const events = collectEvents(client, ['exhaustedScenarios', 'error']);
    await new Promise(resolve => client.on('connect', resolve));

    // surfaceResumableOnConnect auto-emits exhaustedScenarios on connect
    await waitFor(() => events.exhaustedScenarios.length > 0);
    const surfaced = events.exhaustedScenarios[0];
    expect(surfaced.exhaustedScenarios.some(e => e.scenarioId === SCENARIO)).toBe(true);

    // On-demand fetch behaves identically
    client.emit('getExhaustedScenarios');
    await waitFor(() => events.exhaustedScenarios.length > 1);
    const fetched = events.exhaustedScenarios[1];
    expect(fetched.exhaustedScenarios.some(e => e.scenarioId === SCENARIO)).toBe(true);

    client.disconnect();
  });
});

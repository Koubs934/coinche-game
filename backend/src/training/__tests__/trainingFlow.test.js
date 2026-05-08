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
    expect(partial.schemaVersion).toBe(4);
    expect(partial).not.toHaveProperty('tagsSchemaVersion');
    expect(partial.status).toBe('awaiting-reason');
    expect(partial.decisions[0].action).toEqual({ type: 'pass' });
    expect(partial.decisions[0]).not.toHaveProperty('tags');
    expect(partial.decisions[0].divergenceType).toBeNull();
    expect(partial.decisions[0].divergenceAgreement).toBeNull();
    expect(partial.decisions[0].note).toBeNull();

    // V2.2 Phase 2C: FE auto-fires submitTrainingReason with `note: ''` for
    // every case. Server canonicalises agreement (match → null).
    client.emit('submitTrainingReason', { runId, note: '' });

    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const completed = events.trainingCompleted[0];
    expect(completed.runId).toBe(runId);
    // V2.2 Phase 2 / 2C — payload now carries annotationFilename + caseType.
    expect(completed.annotationFilename).toMatch(/\.json$/);
    expect(completed.caseType).toBe('match');
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
    expect(annotation.schemaVersion).toBe(4);
    expect(annotation.scenarioSchemaVersion).toBe(2);
    expect(annotation).not.toHaveProperty('tagsSchemaVersion');
    expect(annotation.status).toBe('complete');
    expect(annotation.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(annotation.alternativeIndex).toBe(0);
    // v3.1: auto-conclude on submit — every annotation lands as 'concluded'.
    expect(annotation.sessionStatus).toBe('concluded');
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
    // V2.2 Phase 2C: rule-silent annotations are written with agreement
    // 'user-disagrees' (server-canonical); note is optional.
    client2.emit('submitTrainingReason', {
      runId: runId2,
      note: 'reasserted after resume',
    });
    await waitFor(() => events2.trainingCompleted.length > 0);
    expect(events2.error).toHaveLength(0);
    expect(events2.trainingCompleted[0].caseType).toBe('rule-silent');

    // ── Disk checks ──────────────────────────────────────────────────────
    // Still exactly one JSON file
    const finalFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    expect(finalFiles).toHaveLength(1);
    // And it's at the SAME path as the partial (startedAt-derived filename)
    expect(finalFiles[0]).toBe(partialFilename);

    const finalAnnotation = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    expect(finalAnnotation.schemaVersion).toBe(4);
    expect(finalAnnotation.status).toBe('complete');
    expect(finalAnnotation.startedAt).toBe(partialBefore.startedAt);
    expect(finalAnnotation.decisions[0].divergenceType).toBe('rule-silent');
    expect(finalAnnotation.decisions[0].divergenceAgreement).toBe('user-disagrees');
    expect(finalAnnotation.decisions[0].note).toBe('reasserted after resume');
    expect(finalAnnotation.decisions[0]).not.toHaveProperty('tags');

    // No orphan .tmp files
    const tmpFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);

    client2.disconnect();
  });
});

// ─── Test C: V2.2 Phase 2C — server-canonical agreement, no required modal ──
//
// The "D'accord / Pas d'accord" modal and the rule-silent obligatory-note
// modal are gone. The frontend auto-fires submitTrainingReason with
// `note: ''` (and no agreement field) for every case. The server
// canonicalises the stored divergenceAgreement based on divergenceType:
// match → null, divergent or rule-silent → 'user-disagrees'. The strict
// validation errors that backed the old modal (MISSING_DIVERGENCE_AGREEMENT,
// MISSING_REQUIRED_NOTE, INVALID_DIVERGENCE_AGREEMENT) no longer exist.

describe('training flow — V2.2 Phase 2C divergence canonicalisation', () => {
  const USERNAME = 'Divergence Tester';
  // Expected = pass; submitting a bid is action-type-different (divergent).
  const DIVERGENT_SCENARIO = 'opening-petit-jeu-first-to-speak';

  async function startAndAct(client, events, scenarioId, action) {
    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId });
    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );
    const runId = events.trainingStarted[0].trainingState.runId;
    client.emit('submitTrainingAction', { runId, action });
    await waitFor(() => events.trainingAwaitingReason.length > 0);
    return runId;
  }

  it('divergent + empty note + no agreement → caseType:divergent, agreement:user-disagrees', async () => {
    const client = connectClient('test-user-divergent-empty-note', USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events, DIVERGENT_SCENARIO, { type: 'bid', value: 90, suit: 'S' });

    // No `divergenceAgreement` field; empty note. Both used to be rejected.
    client.emit('submitTrainingReason', { runId, note: '' });
    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const completed = events.trainingCompleted[0];
    expect(completed.caseType).toBe('divergent');
    const decision = completed.annotation.decisions[0];
    expect(decision.divergenceType).toBe('action-type-different');
    expect(decision.divergenceAgreement).toBe('user-disagrees');
    expect(decision.note).toBe('');
    client.disconnect();
  });

  it('divergent + non-empty note → server still canonicalises agreement to user-disagrees', async () => {
    const client = connectClient('test-user-divergent-with-note', USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events, DIVERGENT_SCENARIO, { type: 'bid', value: 90, suit: 'S' });

    client.emit('submitTrainingReason', {
      runId,
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

  it('client-supplied divergenceAgreement is ignored (server is canonical)', async () => {
    // A misbehaving client sends a stale 'could-be-either' value. The
    // server must still write 'user-disagrees' for every divergent case.
    const client = connectClient('test-user-ignored-agreement', USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    const runId = await startAndAct(client, events, DIVERGENT_SCENARIO, { type: 'bid', value: 90, suit: 'S' });

    client.emit('submitTrainingReason', {
      runId,
      divergenceAgreement: 'could-be-either',  // server should ignore
      note: '',
    });
    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);
    expect(events.trainingCompleted[0].annotation.decisions[0].divergenceAgreement)
      .toBe('user-disagrees');
    client.disconnect();
  });
});

// ─── Test C2: pass on rule-silent → skip Claude V2.2 chat ─────────────────
//
// When the user passes on a scenario the Feuille V2.1 doesn't cover, treat
// the annotation as agreement (divergenceType=null, agreement=null) so the
// frontend auto-advances to the next scenario instead of opening the
// Claude conversation. The annotation is still persisted so the trace of
// the user passing on this scenario survives.

describe('training flow — pass on rule-silent skips Claude V2.2 chat', () => {
  // petit-jeu-after-opp-80-spades has expectedAnswer === null
  // (competitive-bidding-not-formalized), so submitting pass exercises the
  // new skip path.
  const RULE_SILENT_SCENARIO = 'petit-jeu-after-opp-80-spades';

  it('pass + rule-silent → caseType:match, divergenceType:null, agreement:null', async () => {
    const USER_ID = 'test-user-pass-rule-silent';
    const client = connectClient(USER_ID, 'Pass Skip Tester');
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: RULE_SILENT_SCENARIO });

    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );
    const runId = events.trainingStarted[0].trainingState.runId;
    client.emit('submitTrainingAction', { runId, action: { type: 'pass' } });

    await waitFor(() => events.trainingAwaitingReason.length > 0);
    client.emit('submitTrainingReason', { runId, note: '' });

    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    const completed = events.trainingCompleted[0];
    // Skip path: server reports match; App.jsx auto-advances, no Claude chat.
    expect(completed.caseType).toBe('match');
    const decision = completed.annotation.decisions[0];
    expect(decision.divergenceType).toBeNull();
    expect(decision.divergenceAgreement).toBeNull();
    expect(decision.action).toEqual({ type: 'pass' });

    // Annotation IS persisted on disk — the trace of "user passed on a
    // rule-silent scenario" must not be lost just because the chat was
    // skipped. The "no rule" case can be recovered later by inspecting
    // scenario.expectedAnswer === null.
    expect(completed.annotationFilename).toMatch(/\.json$/);
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const annotationPath = path.join(userDir, completed.annotationFilename);
    expect(fs.existsSync(annotationPath)).toBe(true);
    const persisted = JSON.parse(fs.readFileSync(annotationPath, 'utf8'));
    expect(persisted.status).toBe('complete');
    expect(persisted.scenarioId).toBe(RULE_SILENT_SCENARIO);
    expect(persisted.decisions[0].action).toEqual({ type: 'pass' });
    expect(persisted.decisions[0].divergenceType).toBeNull();
    client.disconnect();
  });

  it('restartTrainingScenario discards the completed annotation and emits a fresh trainingStarted', async () => {
    // Path: bid on a rule-silent scenario → CompletionSummary opens →
    // user backs out via the BackButton on the CardSelector → server
    // discards the annotation, rolls back _exhausted, spins up a new run.
    const USER_ID = 'test-user-restart-flow';
    const client = connectClient(USER_ID, 'Restart Tester');
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'trainingScenarioExhausted', 'error',
    ]);
    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: RULE_SILENT_SCENARIO });
    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );
    const runId = events.trainingStarted[0].trainingState.runId;
    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events.trainingAwaitingReason.length > 0);
    client.emit('submitTrainingReason', { runId, note: '' });
    await waitFor(() => events.trainingCompleted.length > 0);

    const completedFilename = events.trainingCompleted[0].annotationFilename;
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const annotationPath = path.join(userDir, completedFilename);
    expect(fs.existsSync(annotationPath)).toBe(true);
    // Confirm exhaustion sidecar shows the scenario after the initial submit.
    const exhaustionPath = path.join(userDir, '_exhausted.json');
    const beforeExhaustion = JSON.parse(fs.readFileSync(exhaustionPath, 'utf8'));
    expect(beforeExhaustion.exhaustedScenarios.some(e => e.scenarioId === RULE_SILENT_SCENARIO)).toBe(true);

    // ── Restart ──────────────────────────────────────────────────────────
    // Note: server GCs the in-memory run as soon as submitTrainingReason
    // completes, so we pass scenarioId + annotationFilename (not the now-
    // stale runId).
    const eventsBeforeRestart = events.trainingStarted.length;
    client.emit('restartTrainingScenario', {
      scenarioId: RULE_SILENT_SCENARIO,
      annotationFilename: completedFilename,
    });
    await waitFor(() => events.trainingStarted.length > eventsBeforeRestart);
    expect(events.error).toHaveLength(0);

    // Side effects: completed annotation gone, _exhausted entry gone.
    expect(fs.existsSync(annotationPath)).toBe(false);
    const afterExhaustion = JSON.parse(fs.readFileSync(exhaustionPath, 'utf8'));
    expect(afterExhaustion.exhaustedScenarios.some(e => e.scenarioId === RULE_SILENT_SCENARIO)).toBe(false);

    // The new trainingStarted carries a fresh runId on the SAME scenario.
    const restarted = events.trainingStarted[events.trainingStarted.length - 1];
    expect(restarted.trainingState.scenarioId).toBe(RULE_SILENT_SCENARIO);
    expect(restarted.trainingState.runId).not.toBe(runId);
    // V2.2 UI affordance — scenario number is propagated on the wire.
    expect(typeof restarted.trainingState.scenarioNumber).toBe('number');
    expect(restarted.trainingState.scenarioNumber).toBeGreaterThanOrEqual(1);
    client.disconnect();
  });

  it('bid on rule-silent (NOT pass) still opens chat (caseType:rule-silent)', async () => {
    // Sanity: the value-different / action-type-different paths remain
    // unaffected by the skip rule. Only literal pass + rule-silent skips.
    const client = connectClient('test-user-bid-rule-silent-still-opens', 'Pass Skip Tester');
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'error',
    ]);
    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: RULE_SILENT_SCENARIO });

    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );
    const runId = events.trainingStarted[0].trainingState.runId;
    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events.trainingAwaitingReason.length > 0);
    client.emit('submitTrainingReason', { runId, note: '' });
    await waitFor(() => events.trainingCompleted.length > 0);
    expect(events.error).toHaveLength(0);

    expect(events.trainingCompleted[0].caseType).toBe('rule-silent');
    expect(events.trainingCompleted[0].annotation.decisions[0].divergenceAgreement)
      .toBe('user-disagrees');
    client.disconnect();
  });
});

// ─── Test D: v3.1 auto-conclude — no review prompt ────────────────────────
//
// In v3.1 every annotation auto-concludes as a single-alternative session.
// trainingScenarioReviewPrompt is no longer emitted; trainingScenarioExhausted
// fires immediately after every successful submit; the run is GC'd. The
// underlying socket events (submitScenarioReviewAnswer / trainingScenarioReviewed)
// remain on the server for contract continuity but are unreachable from the
// new flow.

describe('training flow — v3.1 auto-conclude', () => {
  const USER_ID = 'test-user-autoconclude';
  const USERNAME = 'AutoConclude Tester';
  const SCENARIO = 'opening-petit-jeu-first-to-speak';

  it('single submit auto-concludes: trainingScenarioExhausted fires; no review prompt', async () => {
    const client = connectClient(USER_ID, USERNAME);
    const events = collectEvents(client, [
      'trainingStarted', 'trainingUpdate', 'trainingAwaitingReason',
      'trainingCompleted', 'trainingScenarioReviewPrompt',
      'trainingScenarioReviewed', 'trainingScenarioExhausted',
      'exhaustedScenarios', 'error',
    ]);

    await new Promise(resolve => client.on('connect', resolve));
    client.emit('startTrainingScenario', { scenarioId: SCENARIO });
    await waitFor(() =>
      events.trainingUpdate.some(u => u.trainingState.runState === 'AWAITING-ACTION'),
    );

    const started   = events.trainingStarted[0];
    const runId     = started.trainingState.runId;
    const sessionId = started.trainingState.session.sessionId;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(started.trainingState.session.alternativeIndex).toBe(0);

    // Submit a divergent action (expected is pass; user picks 90♠).
    // V2.2 Phase 2C — agreement is server-canonicalised; FE no longer
    // sends one. Note may be empty.
    client.emit('submitTrainingAction', { runId, action: { type: 'bid', value: 90, suit: 'S' } });
    await waitFor(() => events.trainingAwaitingReason.length > 0);
    client.emit('submitTrainingReason', {
      runId,
      note: 'auto-conclude smoke',
    });

    // Both completion AND exhausted fire on the SAME submit
    await waitFor(() => events.trainingCompleted.length > 0);
    await waitFor(() => events.trainingScenarioExhausted.length > 0);
    expect(events.error).toHaveLength(0);

    // The review-prompt path is gone in v3.1
    expect(events.trainingScenarioReviewPrompt).toHaveLength(0);
    expect(events.trainingScenarioReviewed).toHaveLength(0);

    const exhaustedEvt = events.trainingScenarioExhausted[0];
    expect(exhaustedEvt.sessionId).toBe(sessionId);
    expect(exhaustedEvt.scenarioId).toBe(SCENARIO);
    expect(exhaustedEvt.alternativesRecorded).toBe(1);
    expect(exhaustedEvt.exhaustedScenarios).toHaveLength(1);
    expect(exhaustedEvt.exhaustedScenarios[0].scenarioId).toBe(SCENARIO);

    // ── Disk checks ─────────────────────────────────────────────────────
    const userDir = path.join(SCRATCH_DATA_DIR, USER_ID);
    const annotFiles = fs.readdirSync(userDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'));
    expect(annotFiles).toHaveLength(1);

    const annot = JSON.parse(fs.readFileSync(path.join(userDir, annotFiles[0]), 'utf8'));
    expect(annot.sessionId).toBe(sessionId);
    expect(annot.alternativeIndex).toBe(0);
    expect(annot.sessionStatus).toBe('concluded'); // auto-concluded on submit
    expect(annot.decisions[0].action).toEqual({ type: 'bid', value: 90, suit: 'S' });
    expect(annot.decisions[0].divergenceType).toBe('action-type-different');

    const exhaustedPath = path.join(userDir, '_exhausted.json');
    expect(fs.existsSync(exhaustedPath)).toBe(true);
    const exhaustedRec = JSON.parse(fs.readFileSync(exhaustedPath, 'utf8'));
    expect(exhaustedRec.exhaustedScenarios).toHaveLength(1);
    expect(exhaustedRec.exhaustedScenarios[0]).toMatchObject({
      scenarioId:          SCENARIO,
      sessionId,
      alternativesRecorded: 1,
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

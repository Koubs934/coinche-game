// Socket handlers for training mode. Registered per-connection by server.js;
// all event names are namespaced with "training" to keep the contract
// visually distinct from the normal-game events. See backend/src/socketEvents.js
// for the full C→S / S→C list.
//
// Isolation: every path in this file touches trainingRooms / scenarioLoader /
// annotationStorage / trainingProcessor / divergence. Nothing here calls
// roomManager.js, botProcessor.js, or persistence.js — training is a
// parallel subsystem by construction.

const trainingRooms     = require('./trainingRooms');
const trainingProcessor = require('./trainingProcessor');
const scenarioLoader    = require('./scenarioLoader');
const annotationStorage = require('./annotationStorage');
const exhaustionStorage = require('./exhaustionStorage');
const divergence        = require('./divergence');

const GC_AFTER_DISCONNECT_MS = 5 * 60 * 1000;

/**
 * Check whether a new bid would duplicate one already submitted in this
 * session. Bids collide on (type='bid', value, suit). Pass / coinche /
 * surcoinche are never considered duplicates — pass can always follow a
 * bid, and coinche/surcoinche are rare enough in exhaustion sessions that
 * we defer a precise rule until usage surfaces the pattern.
 */
function sessionDuplicateBidOf(session, action) {
  if (!session || !action || action.type !== 'bid') return null;
  return session.priorActions.find(a =>
    a.type  === 'bid' &&
    a.value === action.value &&
    a.suit  === action.suit,
  ) || null;
}

let startupCleanupDone = false;

function emitError(socket, message, code) {
  socket.emit('error', code ? { message, code } : { message });
}

/** Emit the public view of a run to its owning socket. */
function broadcastTo(socket, run, eventName = 'trainingUpdate', extra = {}) {
  socket.emit(eventName, { ...trainingRooms.publicView(run), ...extra });
}

// ─── Handler registration (per-socket) ─────────────────────────────────────

function registerTrainingHandlers(socket) {
  const ownedRunIds = new Set(); // runs created by this socket — used for disconnect cleanup

  function broadcastForRun(runId) {
    const run = trainingRooms.getRun(runId);
    if (!run) return;
    let eventName = 'trainingUpdate';
    if (run.runState === 'AWAITING-ACTION')  eventName = 'trainingUpdate';
    if (run.runState === 'AWAITING-REASON')  eventName = 'trainingAwaitingReason';
    socket.emit(eventName, trainingRooms.publicView(run));
  }

  // Surface resumable partials and exhausted scenarios on connect (the
  // caller invokes this right after attaching handlers; kept here to keep
  // the training-specific logic out of server.js's connection handler).
  function surfaceResumableOnConnect() {
    const partials = annotationStorage.listResumablePartials(socket.userId);
    if (partials.length > 0) {
      socket.emit('trainingResumablePending', { partials });
    }
    // Always emit the exhausted list, even if empty — the picker relies on
    // the event to know the fetch completed (and to swap from "loading" to
    // "all scenarios, exhausted ones filtered").
    const exhausted = exhaustionStorage.readExhausted(socket.userId);
    socket.emit('exhaustedScenarios', { exhaustedScenarios: exhausted.exhaustedScenarios });
  }

  // ── Discovery events ─────────────────────────────────────────────────────

  // v3 cutover: structured tag vocabulary removed. Event kept for socket-
  // contract continuity but emits a `null` payload — clients should treat
  // a null tags response as "no vocabulary; use the divergence flow".
  socket.on('getTrainingTags', () => {
    socket.emit('trainingTags', { tags: null });
  });

  socket.on('listTrainingScenarios', () => {
    socket.emit('trainingScenariosList', { scenarios: scenarioLoader.listScenarios() });
  });

  // On-demand partials refresh. Mirrors the auto-emit done in
  // surfaceResumableOnConnect() but can be requested at any time — used by the
  // frontend to recover after an UNKNOWN_TRAINING_RUN error (backend restart
  // wiped in-memory state but the partial is still on disk).
  socket.on('getResumablePartials', () => {
    const partials = annotationStorage.listResumablePartials(socket.userId);
    socket.emit('trainingResumablePending', { partials });
  });

  socket.on('getTrainingScenario', ({ scenarioId } = {}) => {
    const scenario = scenarioLoader.getScenario(scenarioId);
    if (!scenario) return emitError(socket, `Unknown scenario: ${scenarioId}`);
    // Sanitize before emit — the cached scenario carries expectedAnswer,
    // ambiguityFlags, all four hands, authoring notes, and per-event
    // authorIntent strings; none of those should reach the client.
    socket.emit('trainingScenario', {
      scenario: scenarioLoader.pickClientScenarioFields(scenario),
    });
  });

  // ── Lifecycle events ─────────────────────────────────────────────────────

  socket.on('startTrainingScenario', ({ scenarioId } = {}) => {
    const scenario = scenarioLoader.getScenario(scenarioId);
    if (!scenario) return emitError(socket, `Unknown scenario: ${scenarioId}`);
    const run = trainingRooms.createRun({
      userId:   socket.userId,
      username: socket.username,
      scenario,
    });
    ownedRunIds.add(run.runId);
    socket.emit('trainingStarted', trainingRooms.publicView(run));
    trainingProcessor.advance(run.runId, broadcastForRun);
  });

  socket.on('submitTrainingAction', ({ runId, action } = {}) => {
    const run = trainingRooms.getRun(runId);
    if (!run || run.userId !== socket.userId) return emitError(socket, 'Unknown training run', 'UNKNOWN_TRAINING_RUN');

    // Hard-refuse duplicate bids within the same exhaustion session BEFORE
    // mutating any game state — this keeps the server's game model in sync
    // even if the client submits the same bid twice across alternatives.
    const dup = sessionDuplicateBidOf(run.session, action);
    if (dup) {
      return emitError(
        socket,
        'This bid was already recorded in this session. Choose a different bid.',
        'DUPLICATE_BID_IN_SESSION',
      );
    }

    const result = trainingProcessor.validateAndApplyUserAction(run, action);
    if (!result.ok) return emitError(socket, result.message);

    run.pendingAction = { timelineStep: run.timelineCursor, action };
    run.runState = 'AWAITING-REASON';

    // Write the partial BEFORE broadcasting — if the disk write fails we
    // don't want the client to believe their action was captured.
    try {
      annotationStorage.writePartial(run);
    } catch (err) {
      console.error(`[training] writePartial failed: ${err.message}`);
      // Roll back state transition so the client can retry.
      run.runState = 'AWAITING-ACTION';
      run.pendingAction = null;
      return emitError(socket, 'Could not save your action — please retry');
    }

    socket.emit('trainingAwaitingReason', trainingRooms.publicView(run));
  });

  // V2.2 Phase 2C — simplified payload semantics.
  // Frontend now auto-fires submitTrainingReason for every case (no modal),
  // sending `{ runId, divergenceAgreement: null, note: '' }`. The server
  // computes the canonical agreement from divergenceType (match → null,
  // anything else → 'user-disagrees'). The note is whatever the client
  // sent, including ''. Strict validation errors that backed the old
  // modal (MISSING_DIVERGENCE_AGREEMENT / MISSING_REQUIRED_NOTE / etc.)
  // are gone — see divergence.validateSubmission for the new contract.
  socket.on('submitTrainingReason', ({ runId, note = '' } = {}) => {
    const run = trainingRooms.getRun(runId);
    if (!run || run.userId !== socket.userId) return emitError(socket, 'Unknown training run', 'UNKNOWN_TRAINING_RUN');
    if (run.runState !== 'AWAITING-REASON') return emitError(socket, `Cannot submit reason in state ${run.runState}`);

    const v = divergence.validateSubmission({
      scenario: run.scenario,
      action:   run.pendingAction.action,
    });

    const trimmedNote = (note ?? '').trim();
    const decidedAt   = new Date().toISOString();
    const completedDecision = {
      index:               run.decisions.length,
      timelineStep:        run.pendingAction.timelineStep,
      phase:               run.game.phase,
      action:              run.pendingAction.action,
      divergenceType:      v.divergenceType,
      divergenceAgreement: v.agreement,
      note:                trimmedNote,
      decidedAt,
    };
    run.decisions.push(completedDecision);
    run.runState = 'COMPLETE';

    // v3.1 (2026-05-04): the post-submit "Autre stratégie possible ?"
    // overlay was removed. Every annotation auto-concludes as a single-
    // alternative session. Stamp reviewAnswered=true BEFORE writeComplete
    // so the on-disk record carries sessionStatus='concluded' from the
    // start. Schema fields (sessionId, alternativeIndex, sessionStatus,
    // _exhausted.json sidecar) are unchanged — the user no longer
    // chooses, the server just commits.
    if (run.session) run.session.reviewAnswered = true;

    try {
      annotationStorage.writeComplete(run, {
        divergenceType:      v.divergenceType,
        divergenceAgreement: v.agreement,
        note:                trimmedNote,
        decidedAt,
      });
    } catch (err) {
      console.error(`[training] writeComplete failed: ${err.message}`);
      // Roll back to AWAITING-REASON so the user can retry without losing partial.
      run.decisions.pop();
      run.runState = 'AWAITING-REASON';
      if (run.session) run.session.reviewAnswered = false;
      return emitError(socket, 'Could not save your reasoning — please retry');
    }

    // Auto-conclude: append the scenario to the user's _exhausted.json.
    // alternativesRecorded is always 1 in v3.1 (no multi-alt path remains).
    let exhaustedRecord = null;
    try {
      exhaustedRecord = exhaustionStorage.addExhausted(run.userId, {
        scenarioId:           run.scenarioId,
        sessionId:            run.session.sessionId,
        alternativesRecorded: run.session.alternativeIndex + 1,
      });
    } catch (err) {
      // Sidecar write failed — annotation is on disk but the picker won't
      // hide the scenario until the next time addExhausted succeeds. Log
      // and fall through; the user shouldn't be blocked on a sidecar issue.
      console.error(`[training] auto-conclude addExhausted failed: ${err.message}`);
    }

    socket.emit('trainingCompleted', {
      runId:      run.runId,
      // V2.2 Phase 2: clients post to /api/conversation/* with this filename
      // when divergenceAgreement === 'user-disagrees'. partialId is the
      // stable filename token used by annotationStorage; .json is appended
      // exactly as on disk.
      annotationFilename: `${run.partialId}.json`,
      // V2.2 Phase 2C — frontend uses caseType to branch:
      //   'match'       → auto-advance to next scenario, no completion screen
      //   'divergent'   → completion screen + Claude conversation
      //   'rule-silent' → completion screen + Claude conversation
      caseType:   divergence.caseTypeFor(v.divergenceType),
      annotation: {
        scenarioId:  run.scenarioId,
        startedAt:   run.startedAt,
        completedAt: new Date().toISOString(),
        decisions:   run.decisions,
      },
    });

    if (exhaustedRecord) {
      socket.emit('trainingScenarioExhausted', {
        runId:                 run.runId,
        scenarioId:            run.scenarioId,
        sessionId:             run.session.sessionId,
        alternativesRecorded:  run.session.alternativeIndex + 1,
        exhaustedScenarios:    exhaustedRecord.exhaustedScenarios,
      });
    }

    // GC the run — completion screen lives client-side, server doesn't
    // need to retain in-memory state.
    trainingRooms.deleteRun(run.runId);
    ownedRunIds.delete(run.runId);
  });

  // ── Exhaustion review answer ───────────────────────────────────────────
  //
  // The client sends this after the user clicks Oui / Non on the overlay.
  // 'yes' → conclude the current alternative, reset the run to SCRIPT-PLAYING
  //         for the next alternative (re-plays the scripted timeline), and
  //         signal via trainingScenarioReviewed.
  // 'no'  → conclude the current alternative, append this scenario to the
  //         user's _exhausted.json, emit trainingScenarioExhausted, GC the run.
  socket.on('submitScenarioReviewAnswer', ({ runId, sessionId, answer } = {}) => {
    const run = trainingRooms.getRun(runId);
    if (!run || run.userId !== socket.userId) {
      return emitError(socket, 'Unknown training run', 'UNKNOWN_TRAINING_RUN');
    }
    if (!run.session || run.session.sessionId !== sessionId) {
      return emitError(socket, 'Unknown or mismatched session', 'UNKNOWN_SESSION');
    }
    if (run.runState !== 'COMPLETE') {
      return emitError(socket, `Cannot answer review in state ${run.runState}`);
    }
    if (answer !== 'yes' && answer !== 'no') {
      return emitError(socket, `answer must be 'yes' or 'no', got ${answer}`);
    }

    // Flip the file's sessionStatus in place. Required for both yes and no
    // paths so downstream readers can tell a user has finished considering
    // this alternative.
    run.session.reviewAnswered = true;
    try {
      annotationStorage.concludeAnnotation(run.userId, run.partialId);
    } catch (err) {
      console.error(`[training] concludeAnnotation failed: ${err.message}`);
      return emitError(socket, 'Could not update annotation status — please retry');
    }

    if (answer === 'yes') {
      const justCompletedAction = run.decisions[run.decisions.length - 1]?.action;
      try {
        trainingRooms.resetRunForNextAlternative(run, justCompletedAction);
      } catch (err) {
        console.error(`[training] resetRunForNextAlternative failed: ${err.message}`);
        return emitError(socket, 'Could not start next alternative — please retry');
      }
      // Announce the reset publicly — client transitions UI back to the
      // run view before scripted playback resumes.
      socket.emit('trainingScenarioReviewed', trainingRooms.publicView(run));
      trainingProcessor.advance(run.runId, broadcastForRun);
      return;
    }

    // answer === 'no'
    const alternativesRecorded = run.session.alternativeIndex + 1;
    let exhaustedRecord;
    try {
      exhaustedRecord = exhaustionStorage.addExhausted(run.userId, {
        scenarioId:          run.scenarioId,
        sessionId:           run.session.sessionId,
        alternativesRecorded,
      });
    } catch (err) {
      console.error(`[training] addExhausted failed: ${err.message}`);
      return emitError(socket, 'Could not save exhaustion status — please retry');
    }

    socket.emit('trainingScenarioExhausted', {
      runId:                 run.runId,
      scenarioId:            run.scenarioId,
      sessionId:             run.session.sessionId,
      alternativesRecorded,
      exhaustedScenarios:    exhaustedRecord.exhaustedScenarios,
    });

    trainingRooms.deleteRun(runId);
    ownedRunIds.delete(runId);
  });

  // On-demand fetch for the picker. Response payload matches
  // trainingScenarioExhausted's exhaustedScenarios field so the client can
  // reuse the same update path.
  socket.on('getExhaustedScenarios', () => {
    const rec = exhaustionStorage.readExhausted(socket.userId);
    socket.emit('exhaustedScenarios', { exhaustedScenarios: rec.exhaustedScenarios });
  });

  socket.on('undoTrainingAction', ({ runId } = {}) => {
    const run = trainingRooms.getRun(runId);
    if (!run || run.userId !== socket.userId) return emitError(socket, 'Unknown training run', 'UNKNOWN_TRAINING_RUN');

    const result = trainingProcessor.undoUserAction(run);
    if (!result.ok) return emitError(socket, result.message);

    // Undo intent: the partial on disk is no longer accurate — delete it
    // so no stale awaiting-reason file lingers after the user changes mind.
    if (run.partialId) {
      try { annotationStorage.discardPartial(run.userId, run.partialId); }
      catch (err) { console.error(`[training] undoTrainingAction discardPartial failed: ${err.message}`); }
      run.partialId = null;
    }

    socket.emit('trainingUpdate', trainingRooms.publicView(run));
  });

  socket.on('abandonTrainingScenario', ({ runId } = {}) => {
    const run = trainingRooms.getRun(runId);
    if (!run || run.userId !== socket.userId) return emitError(socket, 'Unknown training run', 'UNKNOWN_TRAINING_RUN');
    // If a partial exists on disk, remove it — abandon means discard.
    if (run.partialId) {
      try { annotationStorage.discardPartial(run.userId, run.partialId); }
      catch (err) { console.error(`[training] discardPartial failed: ${err.message}`); }
    }
    trainingRooms.deleteRun(runId);
    ownedRunIds.delete(runId);
    socket.emit('trainingAbandoned', { runId });
  });

  socket.on('leaveTrainingSummary', ({ runId } = {}) => {
    const run = trainingRooms.getRun(runId);
    if (!run || run.userId !== socket.userId) return; // silent no-op — idempotent
    if (run.runState !== 'COMPLETE') {
      return emitError(socket, `leaveTrainingSummary requires COMPLETE state (got ${run.runState})`);
    }
    trainingRooms.deleteRun(runId);
    ownedRunIds.delete(runId);
  });

  // V2.2 Phase 2D — back-button retraction from the completion flow.
  // Client invokes this when the user backs out of the CardSelector phase
  // and wants to re-bid the same scenario. We:
  //   1. Delete the just-written annotation file (status='complete' on disk)
  //   2. Roll back the _exhausted.json sidecar entry so the picker treats
  //      the scenario as available again and duplicate-bid detection in
  //      the new run starts fresh
  //   3. Spin up a fresh run on the same scenario and emit trainingStarted
  //      just like the regular start path
  //
  // Payload uses scenarioId + annotationFilename (NOT runId) because the
  // server GCs the in-memory run as soon as submitTrainingReason completes
  // (see writeComplete handler above). By the time the user clicks back
  // through CardSelector, the runId is stale on the client. The Claude
  // conversation (if any) was already torn down by ClaudeConversation's
  // unmount cleanup with reason='navigation' before this fires.
  socket.on('restartTrainingScenario', ({ scenarioId, annotationFilename } = {}) => {
    if (!scenarioId || typeof scenarioId !== 'string') {
      return emitError(socket, 'restartTrainingScenario requires scenarioId');
    }
    const scenario = scenarioLoader.getScenario(scenarioId);
    if (!scenario) return emitError(socket, `Unknown scenario: ${scenarioId}`);

    // Best-effort cleanup. Failures here shouldn't block the restart —
    // the new run is the user's intent; orphaned bytes on disk are a
    // janitor problem for later.
    if (annotationFilename && typeof annotationFilename === 'string') {
      const partialId = annotationFilename.replace(/\.json$/, '');
      try { annotationStorage.discardPartial(socket.userId, partialId); }
      catch (err) { console.error(`[training] restart discardPartial failed: ${err.message}`); }
    }
    try { exhaustionStorage.removeExhausted(socket.userId, scenarioId); }
    catch (err) { console.error(`[training] restart removeExhausted failed: ${err.message}`); }

    const newRun = trainingRooms.createRun({
      userId:   socket.userId,
      username: socket.username,
      scenario,
    });
    ownedRunIds.add(newRun.runId);
    socket.emit('trainingStarted', trainingRooms.publicView(newRun));
    trainingProcessor.advance(newRun.runId, broadcastForRun);
  });

  // ── Resume flow ─────────────────────────────────────────────────────────

  socket.on('resumeTrainingScenario', ({ partialId } = {}) => {
    const partial = annotationStorage.loadPartial(socket.userId, partialId);
    if (!partial) return emitError(socket, 'Unknown or expired partial');
    if (partial.status !== annotationStorage.STATUS_AWAITING_REASON) {
      return emitError(socket, `Partial is not resumable (status=${partial.status})`);
    }
    const scenario = scenarioLoader.getScenario(partial.scenarioId);
    if (!scenario) return emitError(socket, `Partial references unknown scenario: ${partial.scenarioId}`);

    let run;
    try {
      run = trainingProcessor.rehydrateFromPartial(scenario, partial, socket.userId, socket.username);
    } catch (err) {
      console.error(`[training] rehydrate failed: ${err.message}`);
      return emitError(socket, 'Could not resume this partial');
    }
    ownedRunIds.add(run.runId);
    socket.emit('trainingAwaitingReason', trainingRooms.publicView(run));
  });

  socket.on('discardPartialTraining', ({ partialId } = {}) => {
    try {
      annotationStorage.discardPartial(socket.userId, partialId);
    } catch (err) {
      console.error(`[training] discardPartial failed: ${err.message}`);
      return emitError(socket, 'Could not discard this partial');
    }
    // No confirmation event — success is silent.
  });

  // ── Disconnect cleanup ──────────────────────────────────────────────────

  socket.on('disconnect', () => {
    // Single-recovery-path invariant:
    //   COMPLETE runs linger 5 min so a flaky reconnect can still hit the
    //   summary screen. Every other state GCs immediately — AWAITING-REASON
    //   recovery is exclusively via the on-disk partial, and SCRIPT-PLAYING
    //   / AWAITING-ACTION have nothing useful to recover.
    for (const runId of ownedRunIds) {
      const run = trainingRooms.getRun(runId);
      if (!run) continue;
      if (run.runState === 'COMPLETE') {
        run.gcTimer = setTimeout(() => trainingRooms.deleteRun(runId), GC_AFTER_DISCONNECT_MS);
      } else {
        trainingRooms.deleteRun(runId);
      }
    }
  });

  return { surfaceResumableOnConnect };
}

// ─── One-time startup ──────────────────────────────────────────────────────

function runStartupCleanup() {
  if (startupCleanupDone) return;
  startupCleanupDone = true;
  try {
    annotationStorage.cleanupStalePartials();
  } catch (err) {
    console.error(`[training] startup cleanup failed: ${err.message}`);
  }
  // Prime the scenario cache so the first socket request doesn't pay the
  // disk-read latency.
  scenarioLoader.listScenarios();
}

module.exports = { registerTrainingHandlers, runStartupCleanup };

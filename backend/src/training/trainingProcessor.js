// Deterministic playback of scripted scenario events, plus validation &
// application of the user's own action at the user-turn.
//
// Unlike botProcessor, this module does NOT evaluate AI decisions and does
// NOT use a nonce guard — scenarios are single-threaded through
// timelineCursor, have no undo, and no concurrent user actions.

const trainingRooms = require('./trainingRooms');
const { getValidCards } = require('../game/rules');
const { VALID_BID_VALUES } = require('../game/constants');

const DELAY_NORMAL_MS  = 300;
const DELAY_INSTANT_MS = 0;

function scriptedDelay(run) {
  return run.scenario.playbackSpeed === 'instant' ? DELAY_INSTANT_MS : DELAY_NORMAL_MS;
}

// ─── Scripted event application ────────────────────────────────────────────
// Scenarios are pre-validated; we mutate state directly without re-checking
// legality. Keep these mutations aligned with the public surface of
// roomManager.js — divergence is a bug. If rules change over there, mirror
// the behaviour here.

function _applyBid(run, { seat, value, suit }) {
  const g = run.game;
  g.currentBid = {
    value, suit,
    playerIndex: seat,
    team: seat % 2,
    coinched: false,
    surcoinched: false,
  };
  g.biddingActions[seat] = { type: 'bid', value, suit };
  g.biddingHistory.push({ position: seat, type: 'bid', value, suit });
  g.consecutivePasses = 0;
  g.biddingTurn = (seat + 1) % 4;
}

function _applyPass(run, { seat }) {
  const g = run.game;
  g.biddingActions[seat] = { type: 'pass' };
  g.biddingHistory.push({ position: seat, type: 'pass' });
  g.consecutivePasses++;
  g.biddingTurn = (seat + 1) % 4;
}

function _applyCoinche(run, { seat }) {
  const g = run.game;
  if (g.currentBid) g.currentBid.coinched = true;
  g.biddingActions[seat] = { type: 'coinche' };
  g.biddingHistory.push({ position: seat, type: 'coinche' });
  g.consecutivePasses = 0;
  g.biddingTurn = (seat + 1) % 4;
}

function _applySurcoinche(run, { seat }) {
  const g = run.game;
  if (g.currentBid) g.currentBid.surcoinched = true;
  g.biddingActions[seat] = { type: 'surcoinche' };
  g.biddingHistory.push({ position: seat, type: 'surcoinche' });
  g.consecutivePasses = 0;
  g.biddingTurn = (seat + 1) % 4;
}

function _applyPlayCard(run, { seat, card, declareBelote }) {
  // Not exercised by V1 seed scenarios (all bidding-phase), but documented
  // in the schema so the runner supports it for later card-play scenarios.
  const g = run.game;
  const hand = g.hands[seat];
  const idx = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
  if (idx === -1) throw new Error(`[training] scripted play-card not in hand: ${JSON.stringify(card)} seat=${seat}`);
  hand.splice(idx, 1);
  g.currentTrick.push({ card, playerIndex: seat });
  if (declareBelote && g.trumpSuit && card.suit === g.trumpSuit && (card.value === 'K' || card.value === 'Q')) {
    g.beloteInfo.declared = 'yes';
    g.beloteInfo.playerIndex = seat;
  }
  g.currentPlayer = (seat + 1) % 4;
}

const SCRIPTED_APPLIERS = {
  'bid':        _applyBid,
  'pass':       _applyPass,
  'coinche':    _applyCoinche,
  'surcoinche': _applySurcoinche,
  'play-card':  _applyPlayCard,
};

function applyScriptedEvent(run, event) {
  const fn = SCRIPTED_APPLIERS[event.event];
  if (!fn) throw new Error(`[training] unknown scripted event: ${event.event}`);
  fn(run, event);
}

// ─── Timeline advance ──────────────────────────────────────────────────────

/**
 * Drive the timeline cursor forward. If the next event is a scripted one,
 * schedule it via setTimeout (respecting playbackSpeed) then recurse. If
 * it's a user-turn, transition to AWAITING-ACTION and stop.
 *
 * broadcastFn(runId) is expected to emit the appropriate trainingUpdate /
 * trainingAwaitingReason event to the owning socket.
 */
function advance(runId, broadcastFn) {
  const run = trainingRooms.getRun(runId);
  if (!run) return;
  if (run.runState !== 'SCRIPT-PLAYING') return;

  const event = run.timeline[run.timelineCursor];
  if (!event) {
    // Timeline exhausted but still SCRIPT-PLAYING — V1 invariant violation.
    console.error(`[training] timeline exhausted in run ${runId}`);
    return;
  }

  if (event.event === 'user-turn') {
    run.runState = 'AWAITING-ACTION';
    broadcastFn(runId);
    return;
  }

  const delay = scriptedDelay(run);
  const fire = () => {
    // Guard against state changes (e.g., abandoned) while the timer waited.
    const current = trainingRooms.getRun(runId);
    if (!current || current.runState !== 'SCRIPT-PLAYING') return;
    applyScriptedEvent(current, event);
    current.timelineCursor++;
    broadcastFn(runId);
    advance(runId, broadcastFn);
  };
  if (delay === 0) fire();
  else setTimeout(fire, delay);
}

// ─── User action: validate + apply ─────────────────────────────────────────
// Returns { ok: true } or { ok: false, code, message } for a clear error path.

function validateAndApplyUserAction(run, action) {
  if (run.runState !== 'AWAITING-ACTION') {
    return { ok: false, code: 'BAD-STATE', message: `cannot submit action in runState=${run.runState}` };
  }
  const userSeat = run.userSeat;
  const g = run.game;

  // Snapshot for undo — taken BEFORE any mutation, deep-cloned so later
  // edits don't leak back. The handler for undoTrainingAction restores this
  // exactly, reverting biddingHistory / currentTrick / hand splices / etc.
  run.preActionSnapshot = JSON.parse(JSON.stringify(g));

  if (g.phase === 'BIDDING') {
    const turn = g.biddingTurn;
    if (turn !== userSeat) return { ok: false, code: 'NOT-YOUR-TURN', message: 'not your bidding turn' };

    if (action.type === 'bid') {
      if (!VALID_BID_VALUES.includes(action.value)) return { ok: false, code: 'INVALID-BID-VALUE', message: `invalid bid value: ${action.value}` };
      if (!['S', 'H', 'D', 'C'].includes(action.suit)) return { ok: false, code: 'INVALID-SUIT', message: 'invalid suit' };
      const cur = g.currentBid;
      if (cur) {
        if (cur.coinched) return { ok: false, code: 'BID-AFTER-COINCHE', message: 'cannot bid after coinche' };
        if (cur.value === 'capot') return { ok: false, code: 'OVERBID-CAPOT', message: 'cannot outbid capot' };
        if (action.value !== 'capot' && action.value <= cur.value) return { ok: false, code: 'BID-TOO-LOW', message: 'bid must be higher than current bid' };
      }
      _applyBid(run, { seat: userSeat, value: action.value, suit: action.suit });
      return { ok: true };
    }
    if (action.type === 'pass') {
      _applyPass(run, { seat: userSeat });
      return { ok: true };
    }
    if (action.type === 'coinche') {
      const cur = g.currentBid;
      if (!cur) return { ok: false, code: 'NO-BID-TO-COINCHE', message: 'no bid to coinche' };
      if (cur.coinched) return { ok: false, code: 'ALREADY-COINCHED', message: 'already coinched' };
      if (userSeat % 2 === cur.team) return { ok: false, code: 'SELF-COINCHE', message: 'cannot coinche your own team' };
      _applyCoinche(run, { seat: userSeat });
      return { ok: true };
    }
    if (action.type === 'surcoinche') {
      const cur = g.currentBid;
      if (!cur) return { ok: false, code: 'NO-BID-TO-SURCOINCHE', message: 'no bid to surcoinche' };
      if (!cur.coinched) return { ok: false, code: 'MUST-COINCHE-FIRST', message: 'must be coinched before surcoinche' };
      if (cur.surcoinched) return { ok: false, code: 'ALREADY-SURCOINCHED', message: 'already surcoinched' };
      if (userSeat % 2 !== cur.team) return { ok: false, code: 'NOT-CONTRACTING-TEAM', message: 'only contracting team may surcoinche' };
      _applySurcoinche(run, { seat: userSeat });
      return { ok: true };
    }
    return { ok: false, code: 'UNKNOWN-ACTION-TYPE', message: `unknown action type in BIDDING: ${action.type}` };
  }

  if (g.phase === 'PLAYING') {
    if (g.currentPlayer !== userSeat) return { ok: false, code: 'NOT-YOUR-TURN', message: 'not your turn to play' };
    if (action.type !== 'play-card') return { ok: false, code: 'UNKNOWN-ACTION-TYPE', message: `unknown action type in PLAYING: ${action.type}` };
    const hand = g.hands[userSeat];
    const held = hand.some(c => c.suit === action.card.suit && c.value === action.card.value);
    if (!held) return { ok: false, code: 'CARD-NOT-IN-HAND', message: 'card not in hand' };
    const legal = getValidCards(hand, g.currentTrick, g.trumpSuit, userSeat);
    if (!legal.some(c => c.suit === action.card.suit && c.value === action.card.value)) {
      return { ok: false, code: 'CARD-NOT-LEGAL', message: 'that card cannot be played right now' };
    }
    _applyPlayCard(run, { seat: userSeat, card: action.card, declareBelote: !!action.declareBelote });
    return { ok: true };
  }

  return { ok: false, code: 'BAD-PHASE', message: `cannot act in phase ${g.phase}` };
}

// ─── Undo pending action ───────────────────────────────────────────────────
// Roll back the user's action so they can reconsider without abandoning the
// whole scenario. Only valid in AWAITING-REASON — the user has acted but
// has not yet submitted reasoning.

function undoUserAction(run) {
  if (run.runState !== 'AWAITING-REASON') {
    return { ok: false, code: 'BAD-STATE', message: `cannot undo in runState=${run.runState}` };
  }
  if (!run.preActionSnapshot) {
    return { ok: false, code: 'NO-SNAPSHOT', message: 'no pre-action snapshot to restore' };
  }
  run.game = run.preActionSnapshot;
  run.preActionSnapshot = null;
  run.pendingAction = null;
  run.runState = 'AWAITING-ACTION';
  return { ok: true };
}

// ─── Rehydration ───────────────────────────────────────────────────────────
// When a user resumes a partial run on reconnect, we rebuild the in-memory
// TrainingRoom state: replay the timeline up to (but not including) the
// user-turn, then apply the user's saved action, and stop at AWAITING-REASON.

function rehydrateFromPartial(scenario, partial, userId, username) {
  const run = trainingRooms.createRun({ userId, username, scenario });
  // Fast-forward: apply every scripted event before the user-turn inline
  // without delays — this is a rebuild, not a playback.
  for (const event of run.timeline) {
    if (event.event === 'user-turn') break;
    applyScriptedEvent(run, event);
    run.timelineCursor++;
  }
  // The partial carries exactly one decision: the user's action.
  const decision = partial.decisions?.[0];
  if (!decision) {
    trainingRooms.deleteRun(run.runId);
    throw new Error('[training] partial has no decision to rehydrate');
  }
  run.runState = 'AWAITING-ACTION'; // the validator wants this state
  const result = validateAndApplyUserAction(run, decision.action);
  if (!result.ok) {
    trainingRooms.deleteRun(run.runId);
    throw new Error(`[training] rehydrate failed: ${result.code} ${result.message}`);
  }
  run.pendingAction = { timelineStep: run.timelineCursor, action: decision.action };
  run.runState = 'AWAITING-REASON';
  run.startedAt = partial.startedAt;     // preserve original
  run.partialId = partial._partialId;    // loader sets this on the partial record
  return run;
}

module.exports = {
  advance,
  validateAndApplyUserAction,
  undoUserAction,
  applyScriptedEvent,
  rehydrateFromPartial,
  // exported for tests
  scriptedDelay,
};

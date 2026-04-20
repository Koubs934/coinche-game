// In-memory lifecycle for training sessions.
//
// Isolation: training runs live in their own Map here; they do NOT share the
// `rooms` Map in roomManager.js. As a result the Redis write-through in
// server.js → broadcast() → persistence.saveRoom never sees training state.
// That isolation is by construction, not by filter — do not introduce a
// `kind` discriminator in roomManager.

const crypto = require('crypto');

/** @type {Map<string, TrainingRoom>} */
const runs = new Map();

function generateRunId(userId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `${userId}-${Date.now()}-${rand}`;
}

/**
 * Build the initial game state for a scenario, mirroring the shape the
 * frontend already consumes from publicGame in roomManager.js. Scripted
 * events are replayed later by trainingProcessor; this is the pre-replay
 * snapshot.
 *
 * @param {object} scenario - full scenario JSON
 * @returns {object} game
 */
function buildInitialGame(scenario) {
  const init = scenario.initialState || { phase: 'BIDDING' };
  const hands = ['0', '1', '2', '3'].map(seat => [...scenario.hands[seat]]);
  return {
    dealer: scenario.dealer,
    phase: init.phase,
    currentBid: init.currentBid ?? null,
    biddingTurn: init.phase === 'BIDDING' ? (scenario.dealer + 1) % 4 : null,
    consecutivePasses: 0,
    biddingActions: [null, null, null, null],
    biddingHistory: [],
    tricks: [],
    currentTrick: [],
    currentPlayer: init.phase === 'PLAYING' ? (scenario.dealer + 1) % 4 : null,
    trumpSuit: init.trumpSuit ?? null,
    beloteInfo: { playerIndex: null, declared: null, rebeloteDone: false, complete: false },
    roundScores: [0, 0],
    contractMade: null,
    trickPoints: null,
    hands,
  };
}

/**
 * Build synthetic player records. User's seat carries the real username so
 * the UI displays Pierre's identity; scripted seats carry direction labels
 * (resolved to fr/en on the client — we ship the i18n key here).
 */
function buildPlayers(scenario, userId, username) {
  const out = [];
  for (let seat = 0; seat < 4; seat++) {
    const isUser = seat === scenario.userSeat;
    // Direction of this seat relative to the user (bottom/right/top/left)
    // matches the existing GameBoard orientation code.
    const offset = (seat - scenario.userSeat + 4) % 4;
    const directionKey = ['self', 'right', 'partner', 'left'][offset];
    out.push({
      userId:    isUser ? userId : `scripted-${seat}`,
      username:  isUser ? username : null,   // client will substitute via i18n
      directionKey,                           // 'self' | 'right' | 'partner' | 'left'
      team:      seat % 2,
      position:  seat,
      connected: true,
      isBot:     false,
      isScripted: !isUser,
    });
  }
  return out;
}

/**
 * Create a new training run. Scenario must be the full (already-validated)
 * scenario object from scenarioLoader — this function does NOT re-validate.
 *
 * @typedef {Object} TrainingRoom
 * @property {string} runId
 * @property {string} userId
 * @property {string} username
 * @property {string} scenarioId
 * @property {object} scenario               full scenario, kept by reference
 * @property {string} startedAt              ISO 8601
 * @property {number} userSeat
 * @property {number} dealer
 * @property {object} game                   mirrors publicGame shape
 * @property {Array}  players                4 entries, one per seat
 * @property {Array}  timeline               scenario.timeline alias
 * @property {number} timelineCursor         index of next event to process
 * @property {object|null} pendingAction     { timelineStep, action } once submitted, cleared on reason
 * @property {Array}  decisions              completed decisions (action + tags + note)
 * @property {'SCRIPT-PLAYING'|'AWAITING-ACTION'|'AWAITING-REASON'|'COMPLETE'|'ABANDONED'} runState
 * @property {string|null} partialId         filename token once a partial is on disk
 * @property {NodeJS.Timeout|null} gcTimer   set on socket drop while COMPLETE
 */
function createRun({ userId, username, scenario }) {
  const runId = generateRunId(userId);
  /** @type {TrainingRoom} */
  const room = {
    runId,
    userId,
    username,
    scenarioId: scenario.id,
    scenario,
    startedAt: new Date().toISOString(),
    userSeat: scenario.userSeat,
    dealer: scenario.dealer,
    game: buildInitialGame(scenario),
    players: buildPlayers(scenario, userId, username),
    timeline: scenario.timeline,
    timelineCursor: 0,
    pendingAction: null,
    decisions: [],
    runState: 'SCRIPT-PLAYING',
    partialId: null,
    gcTimer: null,
  };
  runs.set(runId, room);
  return room;
}

function getRun(runId) {
  return runs.get(runId) || null;
}

function deleteRun(runId) {
  const run = runs.get(runId);
  if (run?.gcTimer) clearTimeout(run.gcTimer);
  runs.delete(runId);
}

/** List runs owned by a specific user (for disconnect / reconnect surfaces). */
function listRunsForUser(userId) {
  const out = [];
  for (const run of runs.values()) if (run.userId === userId) out.push(run);
  return out;
}

/**
 * Produce a client-facing public view of the training room, reusing the
 * publicGame shape so GameBoard.jsx renders it without a second codepath.
 * Other seats' hands are masked, matching the normal-game filter.
 */
function publicView(run) {
  const g = run.game;
  const filteredHands = g.hands.map((hand, i) =>
    i === run.userSeat ? hand : Array(hand.length).fill(null)
  );
  return {
    trainingState: {
      runId:         run.runId,
      scenarioId:    run.scenarioId,
      runState:      run.runState,
      timelineCursor: run.timelineCursor,
      totalSteps:    run.timeline.length,
      pendingAction: run.pendingAction?.action ?? null,
      // Stable across resume — used by the frontend as the localStorage key
      // for note/tag drafts so an interrupted annotation can be recovered.
      partialId:     run.partialId ?? null,
    },
    room: {
      code:     run.runId,                         // frontend can use this as a stable id
      phase:    'PLAYING',                          // training stays in PLAYING-equivalent umbrella
      players:  run.players.map(p => ({
        userId:       p.userId,
        username:     p.username,
        directionKey: p.directionKey,
        isScripted:   p.isScripted,
        team:         p.team,
        position:     p.position,
        connected:    p.connected,
        isBot:        false,
      })),
      scores:       [0, 0],
      targetScore:  0,
      paused:       false,
      pendingJoins: [],
      nextRoundReady:         [],
      shuffleDealer:          null,
      cutPlayer:              null,
      lastShuffleCutAction:   null,
      lastShuffleCutActorPos: null,
      canUndo:                false,
    },
    game: {
      dealer: g.dealer,
      phase:  g.phase,
      currentBid:        g.currentBid,
      biddingTurn:       g.biddingTurn,
      consecutivePasses: g.consecutivePasses,
      biddingActions:    g.biddingActions,
      biddingHistory:    g.biddingHistory,
      tricks:            g.tricks,
      currentTrick:      g.currentTrick,
      currentPlayer:     g.currentPlayer,
      trumpSuit:         g.trumpSuit,
      beloteInfo:        { ...g.beloteInfo, team: g.beloteInfo.playerIndex != null ? g.beloteInfo.playerIndex % 2 : null },
      roundScores:       g.roundScores,
      contractMade:      g.contractMade,
      trickPoints:       g.trickPoints,
      hands:             filteredHands,
      handCounts:        g.hands.map(h => h.length),
    },
    myPosition: run.userSeat,
  };
}

module.exports = {
  createRun,
  getRun,
  deleteRun,
  listRunsForUser,
  publicView,
  // exported for unit tests / processor
  buildInitialGame,
};

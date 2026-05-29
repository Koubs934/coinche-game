const crypto = require('crypto');
const { createDeck, shuffle: shuffleArr, buildDeckFromTricks, cutDeck: cutDeckArr, dealFrom } = require('./game/deck');
const { getTrickWinner, getValidCards } = require('./game/rules');
const { calculateRoundScore } = require('./game/scoring');
const { VALID_BID_VALUES } = require('./game/constants');

// ─── Room state machine ────────────────────────────────────────────────────
//
// Each room moves through these phases (room.phase, plus game.phase inside a round):
//
//   LOBBY ──startGame()──▶ SHUFFLE ──shuffleDeck()/skipShuffle()──▶ CUT
//                                                                    │
//                    ┌───────────────────────────────────────────────┘
//                    ▼ cutDeck()/skipCut()
//                 PLAYING (game.phase = BIDDING → PLAYING)
//                    │                                 │
//                    │ 3 passes after bid              │ 8th trick done
//                    │     ─ or ─                      │
//                    │ 4 passes, no bid  ◀─── reset ───┤
//                    ▼                                 ▼
//                 SHUFFLE (next dealer)          ROUND_OVER
//                                                      │
//                                                      ▼ confirmNextRound()
//                                       SHUFFLE (next dealer) → or GAME_OVER
//
// Undo: pushHistorySnapshot() is called BEFORE every mutating action; undoLastAction()
// pops the last snapshot and bumps room.actionNonce so pending bot callbacks abort.

const rooms = new Map(); // code -> room

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function getPosition(room, userId) {
  const p = room.players.find(p => p.userId === userId);
  return p ? p.position : -1;
}

function getTeamByPosition(position) {
  // positions 0,2 → team 0 ; positions 1,3 → team 1
  return position % 2;
}

// Next position clockwise from `fromPos` that belongs to `team` (skips the other team).
function _nextSameTeamPosition(fromPos, team) {
  let p = (fromPos + 1) % 4;
  for (let i = 0; i < 4; i++) {
    if (getTeamByPosition(p) === team) return p;
    p = (p + 1) % 4;
  }
  return (fromPos + 1) % 4; // unreachable with the 2-per-team layout
}

function getTeamByUserId(room, userId) {
  const p = room.players.find(p => p.userId === userId);
  return p ? p.team : -1;
}

// ─── Guard helpers (reduce repetition in public API functions) ─────────────

function requireRoom(code) {
  const room = rooms.get(code);
  return room ? { room } : { error: 'Room not found' };
}

function requireCreator(code, userId) {
  const r = requireRoom(code);
  if (r.error) return r;
  if (r.room.creatorId !== userId) return { error: 'Only the room creator can perform this action' };
  return r;
}

// ─── History / Undo ───────────────────────────────────────────────────────

const HISTORY_LIMIT = 10;

/**
 * Deep-clone the reversible fields of a room and push them onto room.history.
 * Must be called BEFORE any mutation so the snapshot reflects pre-action state.
 */
function pushHistorySnapshot(room) {
  if (!room.history) room.history = [];
  const snap = {
    game:                 JSON.parse(JSON.stringify(room.game)),
    phase:                room.phase,
    nextDealer:           room.nextDealer,
    shuffleDealer:        room.shuffleDealer,
    cutPlayer:            room.cutPlayer,
    nextRoundReady:       [...(room.nextRoundReady || [])],
    lastShuffleCutAction: room.lastShuffleCutAction ?? null,
    lastShuffleCutActorPos: room.lastShuffleCutActorPos ?? null,
  };
  room.history.push(snap);
  if (room.history.length > HISTORY_LIMIT) room.history.shift();
}

function undoLastAction(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== userId) return { error: 'Only the creator can undo' };
  if (!room.history?.length) return { error: 'Nothing to undo' };

  const snap = room.history.pop();
  room.game                  = snap.game;
  room.phase                 = snap.phase;
  room.nextDealer            = snap.nextDealer;
  room.shuffleDealer         = snap.shuffleDealer;
  room.cutPlayer             = snap.cutPlayer;
  room.nextRoundReady        = snap.nextRoundReady;
  room.lastShuffleCutAction  = snap.lastShuffleCutAction;
  room.lastShuffleCutActorPos = snap.lastShuffleCutActorPos;

  // Increment nonce so any pending bot callbacks (scheduled before undo) abort
  room.actionNonce = (room.actionNonce || 0) + 1;

  return { room };
}

// ─── Public room state (no hands) ─────────────────────────────────────────

function publicRoom(room) {
  return {
    code: room.code,
    creatorId: room.creatorId,
    players: room.players.map(({ userId, username, team, position, connected, isBot }) =>
      ({ userId, username, team, position, connected, isBot: !!isBot })),
    targetScore: room.targetScore,
    phase: room.phase,
    scores: room.scores,
    paused: room.paused || false,
    pendingJoins: (room.pendingJoins || []).map(({ userId, username }) => ({ userId, username })),
    nextRoundReady: room.nextRoundReady || [],
    shuffleDealer:           room.shuffleDealer ?? null,
    cutPlayer:               room.cutPlayer ?? null,
    lastShuffleCutAction:    room.lastShuffleCutAction ?? null,
    lastShuffleCutActorPos:  room.lastShuffleCutActorPos ?? null,
    canUndo:                 (room.history?.length ?? 0) > 0,
  };
}

// ─── Partner peek (private inside-joke feature) ─────────────────────────────
// A toggle that lets two SPECIFIC partnered users see each other's hands. Gated
// hard to these two user IDs, only when both are present AND on the same team.
// Self-contained: one flag (room.partnerPeek), one toggle fn, one branch in
// publicGame. The reveal is injected PER RECIPIENT in publicGame, so it never
// reaches any other player. Hardcoding the IDs is intentional.
const PARTNER_PEEK_IDS = [
  '7f35ed6a-8e9a-421e-8e79-1086fa663478', // Aaron / AK7
  '507f441f-a481-4269-9d18-356b9ba76f43', // Sacha
];

// Returns { a, b } when both gated users are present and partnered (same team);
// null otherwise. Same team in the 2v2 fixed layout ⟺ partners (positions ±2).
function partnerPeekPair(room) {
  const a = room.players.find(p => p.userId === PARTNER_PEEK_IDS[0]);
  const b = room.players.find(p => p.userId === PARTNER_PEEK_IDS[1]);
  if (a && b && a.team === b.team) return { a, b };
  return null;
}

// Per-viewer peek result. canPeek = this viewer is one of the two gated users and
// both are present+partnered (→ show the toggle). peekHand = the partner's actual
// cards, present ONLY when the flag is also ON. Returns {canPeek:false} for anyone
// who isn't one of the two gated users — so opponents/bots get no peek fields.
function computePartnerPeek(room, viewerPosition) {
  const viewer = room.players.find(p => p.position === viewerPosition);
  if (!viewer || !PARTNER_PEEK_IDS.includes(viewer.userId)) return { canPeek: false };
  const pair = partnerPeekPair(room);
  if (!pair) return { canPeek: false };
  const partner = viewer.userId === PARTNER_PEEK_IDS[0] ? pair.b : pair.a;
  const out = { canPeek: true, peekOn: !!room.partnerPeek, partnerPosition: partner.position };
  if (room.partnerPeek && room.game) out.peekHand = room.game.hands[partner.position];
  return out;
}

function togglePartnerPeek(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (!PARTNER_PEEK_IDS.includes(userId)) return { error: 'Not allowed' };
  if (!partnerPeekPair(room)) return { error: 'Partner peek not available' };
  room.partnerPeek = !room.partnerPeek;
  return { room };
}

// Game state filtered for a specific viewer (hides other hands)
function publicGame(room, viewerPosition) {
  const g = room.game;
  if (!g) return null;
  // initialHands is exposed ONLY at round end (round-summary view needs it).
  // During BIDDING/PLAYING/SHUFFLE/CUT this stays undefined to prevent leaking
  // opponents' hands mid-round.
  const isRoundOver = room.phase === 'ROUND_OVER' || room.phase === 'GAME_OVER';
  const peek = computePartnerPeek(room, viewerPosition);
  return {
    // Partner peek — present ONLY for the two gated users (canPeek:false otherwise
    // means these keys are simply false/undefined, never the partner's cards).
    canPeek: peek.canPeek,
    peekOn: peek.canPeek ? peek.peekOn : undefined,
    peekPartnerPosition: peek.canPeek ? peek.partnerPosition : undefined,
    peekHand: peek.peekHand,
    gameId: g.gameId || null,
    errorAnnotations: g.errorAnnotations || [],
    dealer: g.dealer,
    phase: g.phase,
    currentBid: g.currentBid,
    biddingTurn: g.biddingTurn,
    consecutivePasses: g.consecutivePasses,
    biddingActions: g.biddingActions || [null, null, null, null],
    biddingHistory: g.biddingHistory || [],
    tricks: g.tricks,
    currentTrick: g.currentTrick,
    currentPlayer: g.currentPlayer,
    trumpSuit: g.trumpSuit,
    beloteInfo: {
      playerIndex:  g.beloteInfo.playerIndex,
      declared:     g.beloteInfo.declared,
      rebeloteDone: g.beloteInfo.rebeloteDone,
      complete:     g.beloteInfo.complete,
      team: g.beloteInfo.playerIndex !== null ? g.beloteInfo.playerIndex % 2 : null,
    },
    roundScores: g.roundScores,
    contractMade: g.contractMade,
    trickPoints: g.trickPoints,
    // Own hand visible, others replaced with card-count placeholders
    hands: g.hands.map((hand, i) =>
      i === viewerPosition ? hand : Array(hand.length).fill(null)),
    handCounts: g.hands.map(h => h.length),
    initialHands: isRoundOver ? g.initialHands : undefined,
  };
}

// ─── Room lifecycle ────────────────────────────────────────────────────────

function createRoom({ userId, username, socketId }) {
  const code = generateCode();
  rooms.set(code, {
    code,
    creatorId: userId,
    players: [{ userId, username, socketId, team: 0, position: 0, connected: true }],
    targetScore: 2000,
    phase: 'LOBBY',
    scores: [0, 0],
    game: null,
    paused: false,
    pendingJoins: [],
    history: [],
    actionNonce: 0,
    chatMessages: [],
  });
  return rooms.get(code);
}

function joinRoom(code, { userId, username, socketId }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'LOBBY') return { error: 'Game already in progress' };
  if (room.players.length >= 4) return { error: 'Room is full' };
  if (room.players.find(p => p.userId === userId)) return { error: 'Already in room' };

  const position = room.players.length;
  room.players.push({ userId, username, socketId, team: position % 2, position, connected: true });
  return { room };
}

function assignTeam(code, creatorId, targetUserId, team) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== creatorId) return { error: 'Only the room creator can assign teams' };
  if (room.phase !== 'LOBBY') return { error: 'Game already in progress' };

  const player = room.players.find(p => p.userId === targetUserId);
  if (!player) return { error: 'Player not found' };
  player.team = team;
  return { room };
}

function fillWithBots(code, creatorId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== creatorId) return { error: 'Only the room creator can add bots' };
  if (room.phase !== 'LOBBY') return { error: 'Game already in progress' };

  let botNum = 1;
  // Skip bot numbers already in the room
  const existingBotNums = new Set(
    room.players.filter(p => p.isBot).map(p => parseInt(p.userId.replace('bot-', ''), 10))
  );
  while (existingBotNums.has(botNum)) botNum++;

  while (room.players.length < 4) {
    while (existingBotNums.has(botNum)) botNum++;
    const position = room.players.length;
    room.players.push({
      userId: `bot-${botNum}`,
      username: `Bot ${botNum}`,
      socketId: null,
      team: position % 2,
      position,
      connected: true,
      isBot: true,
    });
    existingBotNums.add(botNum);
    botNum++;
  }

  return { room };
}

function setTargetScore(code, creatorId, targetScore) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== creatorId) return { error: 'Only the room creator can set the target score' };
  if (typeof targetScore !== 'number' || targetScore < 500) return { error: 'Invalid target score' };
  room.targetScore = targetScore;
  return { room };
}

function startGame(code, creatorId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== creatorId) return { error: 'Only the room creator can start the game' };
  if (room.players.length !== 4) return { error: 'Need exactly 4 players to start' };

  const t0 = room.players.filter(p => p.team === 0);
  const t1 = room.players.filter(p => p.team === 1);
  if (t0.length !== 2 || t1.length !== 2) return { error: 'Each team must have exactly 2 players' };

  // Assign table positions: team 0 → 0,2 ; team 1 → 1,3
  t0[0].position = 0;
  t0[1].position = 2;
  t1[0].position = 1;
  t1[1].position = 3;

  room.scores = [0, 0];
  room.deck = createDeck();
  _beginShuffle(room, 0);
  return { room };
}

// ─── Round management ──────────────────────────────────────────────────────

function _beginShuffle(room, dealer) {
  room.nextDealer    = dealer;
  room.shuffleDealer = dealer;
  room.cutPlayer     = null;
  room.phase         = 'SHUFFLE';
  room.nextRoundReady = [];
}

function _beginCut(room) {
  room.cutPlayer = (room.nextDealer + 3) % 4; // player to the left of dealer
  room.phase     = 'CUT';
}

function _startRound(room, dealer) {
  const firstPlayer = (dealer + 1) % 4;
  const hands = dealFrom(room.deck, firstPlayer);
  room.phase = 'PLAYING';
  room.game = {
    // gameId + createdAt + initialHands are the per-round review identity. They're
    // captured here (before any mutation) so the final GameRecord can reconstruct
    // the deal exactly. initialHands is a defensive deep-copy — hands[] is mutated
    // as cards are played.
    gameId:               crypto.randomUUID(),
    createdAt:            new Date().toISOString(),
    initialHands:         hands.map(h => h.map(c => ({ ...c }))),
    errorAnnotations:     [],
    beloteDeclaredTrickIndex: null,
    beloteRebeloteAt:     null,
    dealer,
    hands,
    phase: 'BIDDING',
    currentBid: null,
    biddingTurn: (dealer + 1) % 4,
    consecutivePasses: 0,
    biddingActions: [null, null, null, null],
    biddingHistory: [],
    tricks: [],
    currentTrick: [],
    currentPlayer: null,
    trumpSuit: null,
    beloteInfo: { playerIndex: null, declared: null, rebeloteDone: false, complete: false },
    roundScores: [0, 0],
    contractMade: null,
    trickPoints: null,
  };
}

function confirmNextRound(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'ROUND_OVER') return { error: 'Round not over yet' };
  if (room.paused) return { error: 'Game is paused — waiting for players' };

  if (!room.nextRoundReady) room.nextRoundReady = [];
  if (!room.nextRoundReady.includes(userId)) {
    room.nextRoundReady.push(userId);
  }

  // Round starts when every human player has confirmed (bots auto-confirm separately)
  const humanPlayers = room.players.filter(p => !p.isBot);
  const allConfirmed = humanPlayers.every(p => room.nextRoundReady.includes(p.userId));

  if (allConfirmed) {
    const nextDealer = (room.game.dealer + 1) % 4;
    _beginShuffle(room, nextDealer);
    return { room, started: true };
  }

  return { room, started: false };
}

// ─── Bidding ───────────────────────────────────────────────────────────────

function placeBid(code, userId, value, suit) {
  const room = rooms.get(code);
  if (!room || !room.game || room.game.phase !== 'BIDDING') return { error: 'Not in bidding phase' };

  const position = getPosition(room, userId);
  if (position === -1) return { error: 'Not in this room' };
  if (room.game.biddingTurn !== position) return { error: 'Not your turn' };
  if (!VALID_BID_VALUES.includes(value)) return { error: 'Invalid bid value' };
  if (!['S', 'H', 'D', 'C'].includes(suit)) return { error: 'Invalid suit' };

  const current = room.game.currentBid;
  if (current) {
    if (current.coinched) return { error: 'Cannot bid after coinche' };
    if (current.value === 'capot') return { error: 'Cannot outbid a capot' };
    if (value !== 'capot' && value <= current.value) return { error: 'Bid must be higher than current bid' };
  }

  pushHistorySnapshot(room);
  room.game.currentBid = {
    value,
    suit,
    playerIndex: position,
    team: getTeamByPosition(position),
    coinched: false,
    surcoinched: false,
  };
  room.game.biddingActions[position] = { type: 'bid', value, suit };
  room.game.biddingHistory.push({ position, type: 'bid', value, suit });
  room.game.consecutivePasses = 0;
  room.game.biddingTurn = (position + 1) % 4;
  return { room };
}

function passBid(code, userId) {
  const room = rooms.get(code);
  if (!room || !room.game || room.game.phase !== 'BIDDING') return { error: 'Not in bidding phase' };

  const position = getPosition(room, userId);
  if (position === -1) return { error: 'Not in this room' };
  if (room.game.biddingTurn !== position) return { error: 'Not your turn' };

  pushHistorySnapshot(room);
  room.game.biddingActions[position] = { type: 'pass' };
  room.game.biddingHistory.push({ position, type: 'pass' });
  room.game.consecutivePasses++;

  const bid = room.game.currentBid;

  // Surcoinche window: bid is coinched but not yet surcoinched. Only the contracting team is
  // prompted here (the coinching team is skipped), so every pass = a contracting player
  // declining to surcoinche. Two contracting players → close once both have declined.
  if (bid && bid.coinched && !bid.surcoinched) {
    if (room.game.consecutivePasses >= 2) {
      _startPlaying(room);
    } else {
      room.game.biddingTurn = _nextSameTeamPosition(position, bid.team);
    }
    return { room };
  }

  // Normal (pre-coinche) flow — unchanged:
  room.game.biddingTurn = (position + 1) % 4;
  if (room.game.consecutivePasses >= 3 && room.game.currentBid) {
    _startPlaying(room);
  } else if (room.game.consecutivePasses >= 4 && !room.game.currentBid) {
    // All passed — go through shuffle/cut with new dealer
    _beginShuffle(room, (room.game.dealer + 1) % 4);
  }

  return { room };
}

function coinche(code, userId) {
  const room = rooms.get(code);
  if (!room || !room.game || room.game.phase !== 'BIDDING') return { error: 'Not in bidding phase' };

  const position = getPosition(room, userId);
  if (position === -1) return { error: 'Not in this room' };
  if (room.game.biddingTurn !== position) return { error: 'Not your turn to coinche' };

  const bid = room.game.currentBid;
  if (!bid) return { error: 'No bid to coinche' };
  if (bid.coinched) return { error: 'Already coinched' };
  if (getTeamByPosition(position) === bid.team) return { error: 'Cannot coinche your own team\'s bid' };

  pushHistorySnapshot(room);
  bid.coinched = true;
  room.game.biddingActions[position] = { type: 'coinche' };
  room.game.biddingHistory.push({ position, type: 'coinche' });
  room.game.consecutivePasses = 0;
  // Only the contracting team may respond (Surcoinche / Pass). Skip the coinching team so
  // the coincher's partner is never asked to pass.
  room.game.biddingTurn = _nextSameTeamPosition(position, bid.team);
  return { room };
}

function surcoinche(code, userId) {
  const room = rooms.get(code);
  if (!room || !room.game || room.game.phase !== 'BIDDING') return { error: 'Not in bidding phase' };

  const position = getPosition(room, userId);
  if (position === -1) return { error: 'Not in this room' };
  if (room.game.biddingTurn !== position) return { error: 'Not your turn to surcoinche' };

  const bid = room.game.currentBid;
  if (!bid) return { error: 'No bid to surcoinche' };
  if (!bid.coinched) return { error: 'Bid must be coinched before surcoinching' };
  if (bid.surcoinched) return { error: 'Already surcoinched' };
  if (getTeamByPosition(position) !== bid.team) return { error: 'Only the contracting team can surcoinche' };

  pushHistorySnapshot(room);
  bid.surcoinched = true;
  room.game.biddingActions[position] = { type: 'surcoinche' };
  room.game.biddingHistory.push({ position, type: 'surcoinche' });
  // Surcoinche is the ceiling — nothing can follow. Close bidding now.
  _startPlaying(room);
  return { room };
}

function _startPlaying(room) {
  const g = room.game;
  g.phase = 'PLAYING';
  g.trumpSuit = g.currentBid.suit;
  g.currentPlayer = (g.dealer + 1) % 4; // player after dealer leads first trick
  g.currentTrick = [];
}

// ─── Card play ─────────────────────────────────────────────────────────────
//
// Belote / Rebelote state machine on game.beloteInfo:
//   { playerIndex: 0-3 | null,  // declarer, once Belote chosen
//     declared: 'yes'|'no'|null,// answer to the first-of-pair prompt
//     rebeloteDone: boolean,    // second of pair has been played
//     complete: boolean }       // both halves played — ready for scoring
//
// Transitions, from fresh (all null/false) when a player plays K or Q of trump:
//   1. first-of-pair, hand still has the other half  → require declareBelote ∈ {true,false}
//      declared := 'yes'|'no' ; if 'yes' playerIndex := position
//   2. first-of-pair, hand does NOT have the other half → no prompt, nothing to declare
//   3. second-of-pair, declarer announced 'yes'        → rebeloteDone=true, complete=true

// Returns one of:
//   'prompt'  (caller must re-emit with declareBelote)
//   'declare' (first of pair, declareBelote provided — apply)
//   'complete' (second of pair — apply rebelote)
//   'none' (no belote interaction)
function classifyBelotePlay(hand, card, beloteInfo, trumpSuit, position, declareBelote) {
  if (!trumpSuit) return 'none';
  if (card.suit !== trumpSuit) return 'none';
  if (card.value !== 'K' && card.value !== 'Q') return 'none';

  if (beloteInfo.declared === null) {
    const otherValue = card.value === 'K' ? 'Q' : 'K';
    const hasOther = hand.some(c => c.suit === trumpSuit && c.value === otherValue);
    if (!hasOther) return 'none';
    if (typeof declareBelote !== 'boolean') return 'prompt';
    return 'declare';
  }

  const isDeclarerSecond = beloteInfo.declared === 'yes' &&
                           beloteInfo.playerIndex === position &&
                           !beloteInfo.rebeloteDone;
  return isDeclarerSecond ? 'complete' : 'none';
}

function playCard(code, userId, card, declareBelote) {
  const room = rooms.get(code);
  if (!room || !room.game || room.game.phase !== 'PLAYING') return { error: 'Not in playing phase' };

  const position = getPosition(room, userId);
  if (position === -1) return { error: 'Not in this room' };
  if (room.game.currentPlayer !== position) return { error: 'Not your turn' };

  const hand = room.game.hands[position];
  const cardIdx = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
  if (cardIdx === -1) return { error: 'Card not in hand' };

  const valid = getValidCards(hand, room.game.currentTrick, room.game.trumpSuit, position);
  if (!valid.some(c => c.suit === card.suit && c.value === card.value)) {
    return { error: 'That card cannot be played right now' };
  }

  // Belote classification runs BEFORE pushHistorySnapshot so a 'prompt' return
  // doesn't leave a spurious history entry that the client can't undo back through.
  const { trumpSuit, beloteInfo } = room.game;
  const beloteAction = classifyBelotePlay(hand, card, beloteInfo, trumpSuit, position, declareBelote);
  if (beloteAction === 'prompt') return { error: 'beloteDecisionRequired' };

  pushHistorySnapshot(room);

  if (beloteAction === 'declare') {
    beloteInfo.declared = declareBelote ? 'yes' : 'no';
    if (declareBelote) {
      beloteInfo.playerIndex = position;
      // trick being played right now = first in-progress trick; record its index
      // so the GameRecord can point to exactly when Belote was declared.
      room.game.beloteDeclaredTrickIndex = room.game.tricks.length;
    }
  } else if (beloteAction === 'complete') {
    beloteInfo.rebeloteDone = true;
    beloteInfo.complete = true;
    room.game.beloteRebeloteAt = new Date().toISOString();
  }

  hand.splice(cardIdx, 1);
  room.game.currentTrick.push({ card, playerIndex: position, playedAt: new Date().toISOString() });

  if (room.game.currentTrick.length === 4) {
    _completeTrick(room);
  } else {
    room.game.currentPlayer = (position + 1) % 4;
  }

  return { room };
}

function _completeTrick(room) {
  const g = room.game;
  const winner = getTrickWinner(g.currentTrick, g.trumpSuit);
  g.tricks.push({ cards: g.currentTrick, winner });
  g.currentTrick = [];

  if (g.tricks.length === 8) {
    _finishRound(room);
  } else {
    g.currentPlayer = winner;
  }
}

function _finishRound(room) {
  const g = room.game;

  // beloteInfo is fully populated during play — just read it
  const beloteTeam = g.beloteInfo.rebeloteDone ? g.beloteInfo.playerIndex % 2 : null;

  const { scores, contractMade, trickPoints } = calculateRoundScore({
    tricks: g.tricks,
    trumpSuit: g.trumpSuit,
    contract: g.currentBid,
    beloteTeam,
  });

  g.roundScores = scores;
  g.contractMade = contractMade;
  g.trickPoints = trickPoints;
  g.phase = 'ROUND_OVER';
  room.phase = 'ROUND_OVER';
  room.nextRoundReady = []; // reset per-player confirmation list

  room.scores[0] += scores[0];
  room.scores[1] += scores[1];

  // Rebuild deck from tricks for the next round
  const contractTeam = g.currentBid.team;
  const winningTeam = contractMade ? contractTeam : 1 - contractTeam;
  room.deck = buildDeckFromTricks(g.tricks, winningTeam);

  if (room.scores[0] >= room.targetScore || room.scores[1] >= room.targetScore) {
    room.phase = 'GAME_OVER';
  }
}

// ─── Game Review: error annotations + GameRecord assembly ────────────────
//
// V1 scope: only the room creator can tag errors on cards during a round.
// Annotations accumulate in-memory on room.game.errorAnnotations and get
// serialized into the GameRecord at end-of-round. Mid-round crashes lose them
// (acceptable — persistence is at round-end only).

const NOTE_MAX_LEN = 2000;

function _cardToStr(c) {
  return `${c.value}${c.suit}`;
}

// Linear scan over rooms looking for an active game with a matching gameId.
// Used for socket events that key on gameId (createGameErrorAnnotation,
// getCurrentGameState). Room count stays small in practice so O(n) is fine.
function getRoomByGameId(gameId) {
  if (!gameId) return null;
  for (const room of rooms.values()) {
    if (room.game && room.game.gameId === gameId) return room;
  }
  return null;
}

function createGameErrorAnnotation(gameId, userId, cardRef, note) {
  const room = getRoomByGameId(gameId);
  if (!room || !room.game) return { error: 'UNKNOWN_GAME', code: 'UNKNOWN_GAME' };
  if (room.creatorId !== userId) {
    return { error: 'Only the room creator can tag errors', code: 'FORBIDDEN_NOT_ROOM_CREATOR' };
  }

  if (typeof note !== 'string' || note.trim().length === 0) {
    return { error: 'Note cannot be empty', code: 'NOTE_EMPTY' };
  }
  if (note.length > NOTE_MAX_LEN) {
    return { error: `Note exceeds ${NOTE_MAX_LEN} chars`, code: 'NOTE_TOO_LONG' };
  }

  if (!cardRef || typeof cardRef !== 'object') {
    return { error: 'Missing cardRef', code: 'INVALID_CARD_REF' };
  }
  const { trickIndex, seat, card } = cardRef;
  if (typeof trickIndex !== 'number' || !Number.isInteger(trickIndex) || trickIndex < 0) {
    return { error: 'Invalid trickIndex', code: 'INVALID_CARD_REF' };
  }
  if (typeof seat !== 'number' || seat < 0 || seat > 3) {
    return { error: 'Invalid seat', code: 'INVALID_CARD_REF' };
  }
  if (typeof card !== 'string' || !card) {
    return { error: 'Invalid card', code: 'INVALID_CARD_REF' };
  }

  const g = room.game;
  const completedTricks = g.tricks.length;
  const hasInProgress = (g.currentTrick || []).length > 0;
  const maxIdx = hasInProgress ? completedTricks : completedTricks - 1;
  if (trickIndex > maxIdx) {
    return { error: 'Trick index exceeds current trick', code: 'INVALID_CARD_REF' };
  }

  const trickCards = trickIndex < completedTricks ? g.tricks[trickIndex].cards : g.currentTrick;
  const played = trickCards.find(c => c.playerIndex === seat);
  if (!played) {
    return { error: 'Seat did not play in that trick', code: 'INVALID_CARD_REF' };
  }
  if (_cardToStr(played.card) !== card) {
    return { error: 'Card does not match the one played', code: 'INVALID_CARD_REF' };
  }

  const annotation = {
    annotationId:    crypto.randomUUID(),
    cardRef:         { trickIndex, seat, card },
    note:            note.trim(),
    createdAt:       new Date().toISOString(),
    createdByUserId: userId,
  };
  if (!g.errorAnnotations) g.errorAnnotations = [];
  g.errorAnnotations.push(annotation);
  return { room, annotation };
}

/**
 * Assemble the GameRecord for the round that just ended. Called by the server
 * after _finishRound. Reads exclusively from the authoritative in-memory state
 * — no side effects.
 */
function buildGameRecord(room) {
  const g = room.game;
  if (!g) return null;
  const sortedPlayers = [...room.players].sort((a, b) => a.position - b.position);
  const creator = room.players.find(p => p.userId === room.creatorId);
  const completedAt = new Date().toISOString();

  const hands = {};
  for (let i = 0; i < 4; i++) {
    hands[String(i)] = (g.initialHands[i] || []).map(_cardToStr);
  }

  const biddingRounds = (g.biddingHistory || []).map(h => {
    if (h.type === 'bid') {
      return { seat: h.position, action: { type: 'bid', value: h.value, suit: h.suit } };
    }
    return { seat: h.position, action: { type: h.type } };
  });
  const biddingWinner = g.currentBid ? {
    seat:  g.currentBid.playerIndex,
    value: g.currentBid.value,
    suit:  g.currentBid.suit,
    team:  g.currentBid.team,
  } : null;
  const coincheInfo = g.currentBid?.coinched
    ? { surcoinched: !!g.currentBid.surcoinched }
    : null;

  const tricks = (g.tricks || []).map((t, i) => ({
    trickIndex: i,
    leadSeat:   t.cards[0]?.playerIndex ?? null,
    cards:      t.cards.map(c => ({
      seat:     c.playerIndex,
      card:     _cardToStr(c.card),
      playedAt: c.playedAt || null,
    })),
    winnerSeat: t.winner,
  }));

  const belote = {
    declaredBy: g.beloteInfo?.playerIndex ?? null,
    trickIndex: g.beloteDeclaredTrickIndex ?? null,
    rebeloteAt: g.beloteRebeloteAt ?? null,
  };

  const contractTeam = g.currentBid?.team ?? null;
  const winningTeam = contractTeam !== null
    ? (g.contractMade ? contractTeam : 1 - contractTeam)
    : null;

  const outcome = {
    team0Score:            g.roundScores?.[0] ?? 0,
    team1Score:            g.roundScores?.[1] ?? 0,
    team0CumulativeScore:  room.scores?.[0] ?? 0,
    team1CumulativeScore:  room.scores?.[1] ?? 0,
    winningTeam,
  };

  return {
    schemaVersion:       1,
    gameId:              g.gameId,
    roomCreatorUserId:   room.creatorId,
    roomCreatorUsername: creator?.username ?? null,
    createdAt:           g.createdAt,
    completedAt,
    players: sortedPlayers.map(p => ({ seat: p.position, userId: p.userId, username: p.username })),
    teams: [
      { teamId: 0, seats: [0, 2] },
      { teamId: 1, seats: [1, 3] },
    ],
    deal: { hands, dealer: g.dealer },
    bidding: {
      rounds:  biddingRounds,
      winner:  biddingWinner,
      coinche: coincheInfo,
    },
    play: { tricks, belote },
    outcome,
    errorAnnotations: Array.isArray(g.errorAnnotations) ? g.errorAnnotations.slice() : [],
  };
}

// ─── Shuffle / Cut ────────────────────────────────────────────────────────

function shuffleDeck(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'SHUFFLE') return { error: 'Not in shuffle phase' };
  const position = getPosition(room, userId);
  if (position !== room.shuffleDealer) return { error: 'Not your turn to shuffle' };
  room.deck = shuffleArr(room.deck);
  room.lastShuffleCutAction   = 'shuffled';
  room.lastShuffleCutActorPos = position;
  _beginCut(room);
  return { room };
}

function skipShuffle(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'SHUFFLE') return { error: 'Not in shuffle phase' };
  const position = getPosition(room, userId);
  if (position !== room.shuffleDealer) return { error: 'Not your turn to shuffle' };
  room.lastShuffleCutAction   = 'notShuffled';
  room.lastShuffleCutActorPos = position;
  _beginCut(room);
  return { room };
}

function doCutDeck(code, userId, n) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'CUT') return { error: 'Not in cut phase' };
  const position = getPosition(room, userId);
  if (position !== room.cutPlayer) return { error: 'Not your turn to cut' };
  if (typeof n !== 'number' || n < 1 || n > 31) return { error: 'Invalid cut value' };
  room.deck = cutDeckArr(room.deck, n);
  room.lastShuffleCutAction   = 'cut';
  room.lastShuffleCutActorPos = position;
  _startRound(room, room.nextDealer);
  return { room };
}

function skipCut(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'CUT') return { error: 'Not in cut phase' };
  const position = getPosition(room, userId);
  if (position !== room.cutPlayer) return { error: 'Not your turn to cut' };
  room.lastShuffleCutAction   = 'notCut';
  room.lastShuffleCutActorPos = position;
  _startRound(room, room.nextDealer);
  return { room };
}

// ─── Leave room ────────────────────────────────────────────────────────────

function leaveRoom(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };

  const playerIdx = room.players.findIndex(p => p.userId === userId);
  if (playerIdx === -1) return { error: 'Not in this room' };

  if (room.phase === 'LOBBY') {
    room.players.splice(playerIdx, 1);
    // Delete room if no human players remain
    if (!room.players.some(p => !p.isBot)) {
      rooms.delete(code);
      return { deleted: true };
    }
    // Transfer creator to first human player if creator left
    if (room.creatorId === userId) {
      room.creatorId = room.players.find(p => !p.isBot).userId;
    }
    return { room };
  }

  // Any in-game state (PLAYING, ROUND_OVER, GAME_OVER):
  // remove only this player, pause the room, keep it alive for others
  room.players.splice(playerIdx, 1);
  room.paused = true;
  return { room };
}

// ─── Pending join requests ─────────────────────────────────────────────────

// Creator rejoining their own room bypasses the approval queue
function creatorJoin(code, { userId, username, socketId }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== userId) return { error: 'Not the room creator' };
  if (room.players.find(p => p.userId === userId)) return { error: 'Already in this game' };

  const takenPositions = new Set(room.players.map(p => p.position));
  let openPosition = -1;
  for (let i = 0; i < 4; i++) {
    if (!takenPositions.has(i)) { openPosition = i; break; }
  }
  if (openPosition === -1) return { error: 'Room is full' };

  room.players.push({
    userId, username, socketId,
    team: openPosition % 2,
    position: openPosition,
    connected: true,
    isBot: false,
  });

  if (room.players.length === 4) room.paused = false;

  return { room, position: openPosition };
}

function requestJoin(code, { userId, username, socketId }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (!['PLAYING', 'ROUND_OVER', 'GAME_OVER', 'SHUFFLE', 'CUT'].includes(room.phase)) {
    return { error: 'Use joinRoom for lobby rooms' };
  }
  if (room.players.find(p => p.userId === userId)) return { error: 'Already in this game' };

  // Check an open seat exists
  const takenPositions = new Set(room.players.map(p => p.position));
  const hasOpenSeat = [0, 1, 2, 3].some(i => !takenPositions.has(i));
  if (!hasOpenSeat) return { error: 'Room is full' };

  // Upsert: if already pending (e.g. after browser refresh), just update socketId
  const existing = (room.pendingJoins || []).find(p => p.userId === userId);
  if (existing) {
    existing.socketId = socketId;
    existing.username = username;
    return { room, alreadyPending: true };
  }

  room.pendingJoins.push({ userId, username, socketId });
  return { room };
}

function acceptJoin(code, creatorId, targetUserId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== creatorId) return { error: 'Only the creator can accept requests' };

  const requestIdx = (room.pendingJoins || []).findIndex(p => p.userId === targetUserId);
  if (requestIdx === -1) return { error: 'No pending request from this player' };

  const request = room.pendingJoins[requestIdx];

  const takenPositions = new Set(room.players.map(p => p.position));
  let openPosition = -1;
  for (let i = 0; i < 4; i++) {
    if (!takenPositions.has(i)) { openPosition = i; break; }
  }
  if (openPosition === -1) {
    room.pendingJoins.splice(requestIdx, 1);
    return { error: 'No open seats available' };
  }

  room.pendingJoins.splice(requestIdx, 1);
  room.players.push({
    userId: request.userId,
    username: request.username,
    socketId: request.socketId,
    team: openPosition % 2,
    position: openPosition,
    connected: true,
    isBot: false,
  });

  if (room.players.length === 4) room.paused = false;

  return { room, acceptedSocketId: request.socketId, acceptedPosition: openPosition };
}

function removePlayer(code, creatorId, targetUserId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== creatorId) return { error: 'Only the creator can remove players' };

  const playerIdx = room.players.findIndex(p => p.userId === targetUserId);
  if (playerIdx === -1) return { error: 'Player not found' };
  const removedSocketId = room.players[playerIdx].socketId;
  room.players.splice(playerIdx, 1);
  // Only pause for in-game phases; lobby needs no pause
  if (['PLAYING', 'ROUND_OVER', 'GAME_OVER', 'SHUFFLE', 'CUT'].includes(room.phase)) room.paused = true;

  return { room, removedSocketId };
}

function cancelJoinRequest(code, userId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const idx = (room.pendingJoins || []).findIndex(p => p.userId === userId);
  if (idx === -1) return { error: 'No pending request' };
  room.pendingJoins.splice(idx, 1);
  return { room };
}

// ─── Connection handling ───────────────────────────────────────────────────

function handleDisconnect(socketId) {
  for (const room of rooms.values()) {
    // Active player
    const player = room.players.find(p => p.socketId === socketId);
    if (player) {
      player.connected = false;
      if (['PLAYING', 'ROUND_OVER', 'SHUFFLE', 'CUT'].includes(room.phase)) {
        room.paused = true;
      }
      return { code: room.code, room, player };
    }
    // Pending join request
    const pendingIdx = (room.pendingJoins || []).findIndex(p => p.socketId === socketId);
    if (pendingIdx !== -1) {
      room.pendingJoins.splice(pendingIdx, 1);
      return { code: room.code, room };
    }
  }
  return null;
}

function handleReconnect(socketId, code, userId) {
  const room = rooms.get(code);
  if (!room) return null;

  // Active player reconnecting
  const player = room.players.find(p => p.userId === userId);
  if (player) {
    player.socketId = socketId;
    player.connected = true;
    if (room.paused && room.players.every(p => p.connected)) {
      room.paused = false;
    }
    return { room, player };
  }

  // Pending join request reconnecting — restore socket
  const pending = (room.pendingJoins || []).find(p => p.userId === userId);
  if (pending) {
    pending.socketId = socketId;
    return { room, pending: true };
  }

  return null;
}

function getRoomForSocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.find(p => p.socketId === socketId)) return room;
  }
  return null;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

// ─── Lobby: active-rooms listing ─────────────────────────────────────────────
//
// Powers the home screen's "Parties en cours" list. Returns the rooms this user
// can interact with, each tagged with whether they can JOIN (a free seat, not a
// member) or REJOIN (already hold a seat). Rooms that are full AND that the user
// isn't part of are omitted — there is no spectator mode. Hands/cards are never
// exposed here; only public lobby metadata.
//
// NOTE: there is no distinct Coinche/Belote game-mode setting in the codebase —
// the game is always Coinche-Belote — so `mode` is reported as room.mode when
// present (future-proofing) and otherwise the 'coinche' default.
function listJoinableRooms(userId) {
  const out = [];
  for (const room of rooms.values()) {
    const seated = room.players.length; // counts bots too (they hold seats)
    if (seated === 0) continue;         // defensive: empty rooms are normally deleted
    const isMember = room.players.some(p => p.userId === userId && !p.isBot);
    const isFull   = seated >= 4;
    // No spectating: hide full rooms the user has no seat in.
    if (isFull && !isMember) continue;

    out.push({
      code:        room.code,
      phase:       room.phase,
      playerCount: seated,
      maxPlayers:  4,
      mode:        room.mode || 'coinche',
      players: room.players.map(p => ({
        username:  p.username,
        isBot:     !!p.isBot,
        connected: p.connected !== false,
      })),
      canRejoin: isMember,
      canJoin:   !isMember && !isFull,
    });
  }
  // Rooms the user already holds a seat in float to the top, then fuller rooms,
  // then a stable alphabetical tiebreak.
  out.sort((a, b) =>
    (Number(b.canRejoin) - Number(a.canRejoin)) ||
    (b.playerCount - a.playerCount) ||
    a.code.localeCompare(b.code));
  return out;
}

// ─── Table chat ──────────────────────────────────────────────────────────────
//
// Per-room, ephemeral, text-only chat shared by all four seats. Lives entirely
// in room.chatMessages (in-memory, capped at CHAT_HISTORY_LIMIT). It rides along
// in the persisted room snapshot so a server restart re-hydrates recent history,
// but there is no dedicated DB/Supabase storage — it's intentionally throwaway.
// Bots never call this (they have no socket); the handler in server.js is only
// reachable from a real player socket.

const CHAT_HISTORY_LIMIT = 50;
const CHAT_TEXT_MAX = 500;

function addChatMessage(code, userId, text) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };

  const player = room.players.find(p => p.userId === userId);
  if (!player || player.isBot) return { error: 'Not a player in this room' };

  if (typeof text !== 'string') return { error: 'Invalid message' };
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Empty message' };
  const capped = trimmed.slice(0, CHAT_TEXT_MAX);

  if (!Array.isArray(room.chatMessages)) room.chatMessages = [];
  const message = {
    id:       crypto.randomUUID(),
    userId,
    username: player.username,
    position: player.position, // FE anchors the seat bubble off this
    text:     capped,
    ts:       Date.now(),
  };
  room.chatMessages.push(message);
  if (room.chatMessages.length > CHAT_HISTORY_LIMIT) {
    room.chatMessages.splice(0, room.chatMessages.length - CHAT_HISTORY_LIMIT);
  }
  return { room, message };
}

// ─── Persistence integration ───────────────────────────────────────────────

// Seed the in-memory Map from a previously-persisted snapshot array.
// Called once at server startup, before the socket server accepts connections.
function hydrateRooms(roomsArray) {
  for (const room of roomsArray) {
    if (room && room.code) rooms.set(room.code, room);
  }
}

module.exports = {
  createRoom,
  joinRoom,
  fillWithBots,
  assignTeam,
  setTargetScore,
  startGame,
  placeBid,
  passBid,
  coinche,
  surcoinche,
  playCard,
  undoLastAction,
  confirmNextRound,
  shuffleDeck,
  skipShuffle,
  doCutDeck,
  skipCut,
  leaveRoom,
  creatorJoin,
  requestJoin,
  acceptJoin,
  removePlayer,
  cancelJoinRequest,
  handleDisconnect,
  handleReconnect,
  getRoomForSocket,
  getRoom,
  publicRoom,
  publicGame,
  togglePartnerPeek,
  addChatMessage,
  listJoinableRooms,
  getPosition,
  hydrateRooms,
  getRoomByGameId,
  createGameErrorAnnotation,
  buildGameRecord,
};

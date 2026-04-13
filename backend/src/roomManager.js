const { deal } = require('./game/deck');
const { getTrickWinner, getValidCards } = require('./game/rules');
const { calculateRoundScore } = require('./game/scoring');

const rooms = new Map(); // code -> room

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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

function getTeamByUserId(room, userId) {
  const p = room.players.find(p => p.userId === userId);
  return p ? p.team : -1;
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
  };
}

// Game state filtered for a specific viewer (hides other hands)
function publicGame(room, viewerPosition) {
  const g = room.game;
  if (!g) return null;
  return {
    dealer: g.dealer,
    phase: g.phase,
    currentBid: g.currentBid,
    biddingTurn: g.biddingTurn,
    consecutivePasses: g.consecutivePasses,
    biddingActions: g.biddingActions || [null, null, null, null],
    tricks: g.tricks,
    currentTrick: g.currentTrick,
    currentPlayer: g.currentPlayer,
    trumpSuit: g.trumpSuit,
    beloteInfo: {
      playerIndex: g.beloteInfo.playerIndex,
      complete: g.beloteInfo.complete,
      team: g.beloteInfo.playerIndex !== null ? g.beloteInfo.playerIndex % 2 : null,
    },
    roundScores: g.roundScores,
    contractMade: g.contractMade,
    trickPoints: g.trickPoints,
    // Own hand visible, others replaced with card-count placeholders
    hands: g.hands.map((hand, i) =>
      i === viewerPosition ? hand : Array(hand.length).fill(null)),
    handCounts: g.hands.map(h => h.length),
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
  _startRound(room, 0);
  return { room };
}

// ─── Round management ──────────────────────────────────────────────────────

function _startRound(room, dealer) {
  const hands = deal();
  room.phase = 'PLAYING';
  room.game = {
    dealer,
    hands,
    phase: 'BIDDING',
    currentBid: null,
    biddingTurn: (dealer + 1) % 4,
    consecutivePasses: 0,
    biddingActions: [null, null, null, null],
    tricks: [],
    currentTrick: [],
    currentPlayer: null,
    trumpSuit: null,
    beloteInfo: { playerIndex: null, complete: false },
    roundScores: [0, 0],
    contractMade: null,
    trickPoints: null,
  };
}

function nextRound(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'ROUND_OVER') return { error: 'Round not over yet' };
  if (room.paused) return { error: 'Game is paused — waiting for players' };

  const nextDealer = (room.game.dealer + 1) % 4;
  _startRound(room, nextDealer);
  return { room };
}

// ─── Bidding ───────────────────────────────────────────────────────────────

const VALID_BID_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot'];

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

  room.game.currentBid = {
    value,
    suit,
    playerIndex: position,
    team: getTeamByPosition(position),
    coinched: false,
    surcoinched: false,
  };
  room.game.biddingActions[position] = { type: 'bid', value, suit };
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

  room.game.biddingActions[position] = { type: 'pass' };
  room.game.consecutivePasses++;
  room.game.biddingTurn = (position + 1) % 4;

  if (room.game.consecutivePasses >= 3 && room.game.currentBid) {
    _startPlaying(room);
  } else if (room.game.consecutivePasses >= 4 && !room.game.currentBid) {
    // All passed — redeal, rotate dealer
    _startRound(room, (room.game.dealer + 1) % 4);
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

  bid.coinched = true;
  room.game.biddingActions[position] = { type: 'coinche' };
  // Bidding continues — 3 consecutive passes needed to end (no new bids allowed)
  room.game.consecutivePasses = 0;
  room.game.biddingTurn = (position + 1) % 4;
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

  bid.surcoinched = true;
  room.game.biddingActions[position] = { type: 'surcoinche' };
  // Bidding continues — 3 consecutive passes needed to end
  room.game.consecutivePasses = 0;
  room.game.biddingTurn = (position + 1) % 4;
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

function playCard(code, userId, card) {
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

  // Remove from hand and add to trick
  hand.splice(cardIdx, 1);
  room.game.currentTrick.push({ card, playerIndex: position });

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

// Auto-detect Belote/Rebelote: player who played both K and Q of trump in the same hand.
function _detectBelote(tricks, trumpSuit) {
  const trumpPlayed = {}; // playerIndex -> Set of trump values played
  for (const trick of tricks) {
    for (const { card, playerIndex } of trick.cards) {
      if (card.suit === trumpSuit) {
        if (!trumpPlayed[playerIndex]) trumpPlayed[playerIndex] = new Set();
        trumpPlayed[playerIndex].add(card.value);
      }
    }
  }
  for (const [idx, values] of Object.entries(trumpPlayed)) {
    if (values.has('K') && values.has('Q')) return parseInt(idx, 10);
  }
  return null;
}

function _finishRound(room) {
  const g = room.game;

  const belotePlayerIndex = _detectBelote(g.tricks, g.trumpSuit);
  g.beloteInfo = { playerIndex: belotePlayerIndex, complete: belotePlayerIndex !== null };
  const beloteTeam = belotePlayerIndex !== null ? belotePlayerIndex % 2 : null;

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

  room.scores[0] += scores[0];
  room.scores[1] += scores[1];

  if (room.scores[0] >= room.targetScore || room.scores[1] >= room.targetScore) {
    room.phase = 'GAME_OVER';
  }
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
  if (!['PLAYING', 'ROUND_OVER', 'GAME_OVER'].includes(room.phase)) {
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
  if (['PLAYING', 'ROUND_OVER', 'GAME_OVER'].includes(room.phase)) room.paused = true;

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
      if (['PLAYING', 'ROUND_OVER'].includes(room.phase)) {
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
  nextRound,
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
  getPosition,
};

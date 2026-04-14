const rm = require('./roomManager');
const { getBotBidAction, getBotCardAction } = require('./game/botLogic');

const BOT_DELAY_MS = 700;
const BOT_CONFIRM_DELAY_MS = 2000;

function isBotPosition(room, position) {
  return room.players.some(p => p.position === position && p.isBot);
}

function isBotTurn(room) {
  const g = room.game;
  if (!g) return false;
  if (g.phase === 'BIDDING') return isBotPosition(room, g.biddingTurn);
  if (g.phase === 'PLAYING') return isBotPosition(room, g.currentPlayer);
  return false;
}

/**
 * Schedule the next bot turn for a room.
 * Re-fetches room by code at execution time to use up-to-date state.
 */
function scheduleBotTurns(code, broadcastFn) {
  setTimeout(() => {
    const room = rm.getRoom(code);
    if (!room || room.paused || !isBotTurn(room)) return;
    _execute(room, broadcastFn);
  }, BOT_DELAY_MS);
}

function _execute(room, broadcastFn) {
  const g = room.game;
  const code = room.code;

  if (g.phase === 'BIDDING') {
    const pos    = g.biddingTurn;
    const player = room.players.find(p => p.position === pos);
    const action = getBotBidAction(g, pos);

    const result = action.type === 'bid'
      ? rm.placeBid(code, player.userId, action.value, action.suit)
      : rm.passBid(code, player.userId);

    if (!result.error) {
      broadcastFn(result.room);
      scheduleBotTurns(code, broadcastFn); // chain next bot turn if needed
    } else {
      console.error('[bot] bid error:', result.error);
    }

  } else if (g.phase === 'PLAYING') {
    const pos    = g.currentPlayer;
    const player = room.players.find(p => p.position === pos);
    const action = getBotCardAction(g, pos);

    const result = rm.playCard(code, player.userId, action.card);

    if (!result.error) {
      broadcastFn(result.room);
      scheduleBotTurns(code, broadcastFn);
    } else {
      console.error('[bot] play error:', result.error);
    }
  }
}

/**
 * After a delay, auto-confirm all bots for the next round.
 * If that makes all humans confirmed too, the round starts and broadcastFn
 * is called with the new game state; otherwise just broadcasts the updated
 * ready count.
 */
function scheduleBotConfirms(code, broadcastFn) {
  setTimeout(() => {
    const room = rm.getRoom(code);
    if (!room || room.phase !== 'ROUND_OVER' || room.paused) return;

    const bots = room.players.filter(p => p.isBot);
    const botsNeedingConfirm = bots.filter(b => !(room.nextRoundReady || []).includes(b.userId));
    if (botsNeedingConfirm.length === 0) return; // already confirmed, nothing to do

    let currentRoom = room;
    let started = false;

    for (const bot of botsNeedingConfirm) {
      const result = rm.confirmNextRound(currentRoom.code, bot.userId);
      if (result.error) continue;
      currentRoom = result.room;
      if (result.started) { started = true; break; }
    }

    broadcastFn(currentRoom);
    if (started) {
      scheduleBotTurns(currentRoom.code, broadcastFn);
    }
  }, BOT_CONFIRM_DELAY_MS);
}

/**
 * After a delay, bot dealer shuffles and/or bot left-of-dealer cuts.
 * Dealer bots always shuffle; cut bots pick a random value 1–31.
 */
function scheduleBotShuffleCut(code, broadcastFn) {
  setTimeout(() => {
    const room = rm.getRoom(code);
    if (!room || room.paused) return;
    if (room.phase === 'SHUFFLE') {
      const bot = room.players.find(p => p.position === room.shuffleDealer && p.isBot);
      if (!bot) return;
      const result = rm.shuffleDeck(code, bot.userId);
      if (!result.error) broadcastFn(result.room);
    } else if (room.phase === 'CUT') {
      const bot = room.players.find(p => p.position === room.cutPlayer && p.isBot);
      if (!bot) return;
      const n = Math.floor(Math.random() * 31) + 1;
      const result = rm.doCutDeck(code, bot.userId, n);
      if (!result.error) broadcastFn(result.room);
    }
  }, 1500);
}

module.exports = { scheduleBotTurns, isBotTurn, scheduleBotConfirms, scheduleBotShuffleCut };

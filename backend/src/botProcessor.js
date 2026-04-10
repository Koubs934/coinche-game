const rm = require('./roomManager');
const { getBotBidAction, getBotCardAction } = require('./game/botLogic');

const BOT_DELAY_MS = 700;

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

module.exports = { scheduleBotTurns, isBotTurn };

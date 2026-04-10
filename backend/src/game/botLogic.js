const { getValidCards, getTrickWinner } = require('./rules');

const TRUMP_RANK     = { J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1 };
const NON_TRUMP_RANK = { A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1 };

// Comparable sort key: trump cards score higher than non-trump
function sortKey(card, trumpSuit) {
  return card.suit === trumpSuit
    ? 100 + TRUMP_RANK[card.value]
    : NON_TRUMP_RANK[card.value];
}

function highest(cards, trump) {
  return cards.reduce((b, c) => sortKey(c, trump) > sortKey(b, trump) ? c : b, cards[0]);
}

function lowest(cards, trump) {
  return cards.reduce((b, c) => sortKey(c, trump) < sortKey(b, trump) ? c : b, cards[0]);
}

// Find the suit the bot has the most cards in (for bidding)
function longestSuit(hand) {
  const counts = {};
  for (const c of hand) counts[c.suit] = (counts[c.suit] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Returns { type: 'bid', value, suit } or { type: 'pass' }.
 *
 * Strategy: bid 80 in the longest suit if no contract exists yet
 * (guarantees the game always has a contract to play).
 * If a bid already exists, always pass — bots don't compete over contracts.
 */
function getBotBidAction(game, position) {
  if (!game.currentBid) {
    return { type: 'bid', value: 80, suit: longestSuit(game.hands[position]) };
  }
  return { type: 'pass' };
}

/**
 * Returns { card, declareBelote: false }.
 *
 * Strategy:
 *  - Leading a trick: play highest non-trump (pressure opponents); if only trump, highest trump.
 *  - Partner winning: play lowest card (conserve high cards).
 *  - Otherwise: play highest available card (try to win).
 */
function getBotCardAction(game, position) {
  const { hands, currentTrick, trumpSuit } = game;
  const hand = hands[position];
  const valid = getValidCards(hand, currentTrick, trumpSuit, position);

  let card;

  if (currentTrick.length === 0) {
    // Leading
    const nonTrump = valid.filter(c => c.suit !== trumpSuit);
    card = highest(nonTrump.length > 0 ? nonTrump : valid, trumpSuit);
  } else {
    const winnerPos  = getTrickWinner(currentTrick, trumpSuit);
    const partnerPos = (position + 2) % 4;

    if (winnerPos === partnerPos) {
      // Partner winning — don't waste a high card
      card = lowest(valid, trumpSuit);
    } else {
      // Try to win with highest available card
      card = highest(valid, trumpSuit);
    }
  }

  return { card, declareBelote: false };
}

module.exports = { getBotBidAction, getBotCardAction };

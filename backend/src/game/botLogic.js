const { getValidCards, getTrickWinner } = require('./rules');
const { bestOpeningBid, partnerResponseBid } = require('./botBidding');

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


/**
 * Returns { type: 'bid', value, suit } or { type: 'pass' }.
 *
 * Decision flow:
 *   1. Coinched bid → always pass (only surcoinche is legal, which is a separate event).
 *   2. Partner is highest bidder → partner-response logic (V1).
 *   3. Opponent's bid, or no bid yet but falls through → opening logic or pass.
 *
 * Opening tiers (see botBidding.js for full convention):
 *   pass → fewer than 2 Aces and no qualifying trump suit
 *   80   → 2+ Aces, no qualifying trump suit  (information opening)
 *   90   → petit jeu  (J+3rd  OR  9+4th + outside Ace)
 *   100  → maître à l'atout  (J + 9 + A)
 *   110  → maître + 1 outside Ace
 *   120  → bicolore  (maître + exploitable side suit)
 *
 * Partner-response tiers (V1, capped at 120):
 *   support in partner's suit → partnerBid.value + outsideAces×10 (+ trump Ace bonus for 90)
 *   switch to own suit        → own opening bid when its value > partner's bid value
 *   pass                      → no Ace contribution and no valid switch
 *
 * Competitive / coinche / surcoinche layers: not yet implemented.
 */
function getBotBidAction(game, position) {
  const partnerPos = (position + 2) % 4;

  if (game.currentBid) {
    // After coinche only surcoinche is legal — that is a separate socket event,
    // not a placeBid call, so the bot simply passes here.
    if (game.currentBid.coinched) return { type: 'pass' };

    // Partner is currently the highest bidder → try to respond.
    if (game.currentBid.playerIndex === partnerPos) {
      const r = partnerResponseBid(game.hands[position], game.currentBid);
      if (r) return { type: 'bid', value: r.value, suit: r.suit };
      return { type: 'pass' };
    }

    // Opponent's bid (competitive layer: future) → pass.
    return { type: 'pass' };
  }

  // No bid yet → opening logic.
  const bid = bestOpeningBid(game.hands[position]);
  if (bid) return { type: 'bid', value: bid.value, suit: bid.suit };
  return { type: 'pass' };
}

/**
 * Returns { card, declareBelote }.
 *
 * Strategy:
 *  - Leading a trick: play highest non-trump (pressure opponents); if only trump, highest trump.
 *  - Partner winning: play lowest card (conserve high cards).
 *  - Otherwise: play highest available card (try to win).
 *
 * Belote: bot always declares when playing the first of its K+Q of trump.
 */
function getBotCardAction(game, position) {
  const { hands, currentTrick, trumpSuit, beloteInfo } = game;
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

  // Belote declaration: true if this is the first of the bot's K+Q of trump pair
  let declareBelote = false;
  if (trumpSuit && card.suit === trumpSuit && (card.value === 'K' || card.value === 'Q')) {
    if (!beloteInfo || beloteInfo.declared === null) {
      const otherValue = card.value === 'K' ? 'Q' : 'K';
      if (hand.some(c => c.suit === trumpSuit && c.value === otherValue)) {
        declareBelote = true;
      }
    }
  }

  return { card, declareBelote };
}

module.exports = { getBotBidAction, getBotCardAction };

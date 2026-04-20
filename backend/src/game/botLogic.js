const { getValidCards, getTrickWinner, cardPoints, TRUMP_RANK } = require('./rules');
const { bestOpeningBid, partnerResponseBid } = require('./botBidding');

const NON_TRUMP_RANK = { A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1 };

// ─── Dump-priority score ───────────────────────────────────────────────────
// Lower score = dump first. Tiers:
//  1  non-trump 7/8  (0 pts — pure garbage)
//  2  non-trump 9    (0 pts — marginal)
//  3  trump 7/8      (0 pts — trump capital, but least valuable)
//  4  non-trump J    (2 pts)
//  5  non-trump Q    (3 pts)
//  6  trump Q        (3 pts)
//  7  non-trump K    (4 pts)
//  8  trump K        (4 pts)
//  9  non-trump 10   (10 pts — protect)
// 10  non-trump A    (11 pts — strongly protect)
// 11  trump 10/A     (10/11 pts — strongly protect)
// 12  trump 9        (14 pts — almost never)
// 13  trump J        (20 pts — forced only)
function dumpScore(card, trump) {
  const isTrump = card.suit === trump;
  const v = card.value;
  if (!isTrump) {
    if (v === '7' || v === '8') return 1;
    if (v === '9')              return 2;
    if (v === 'J')              return 4;
    if (v === 'Q')              return 5;
    if (v === 'K')              return 7;
    if (v === '10')             return 9;
    if (v === 'A')              return 10;
  } else {
    if (v === '7' || v === '8') return 3;
    if (v === 'Q')              return 6;
    if (v === 'K')              return 8;
    if (v === '10')             return 11;
    if (v === 'A')              return 11;
    if (v === '9')              return 12;
    if (v === 'J')              return 13;
  }
  return 5;
}

// Simulate playing card: would this card win the trick from position?
function wouldWin(card, position, trick, trump) {
  const sim = [...trick, { card, playerIndex: position }];
  return getTrickWinner(sim, trump) === position;
}

// Cheapest winning card: minimum point cost, prefer non-trump at equal cost,
// prefer lower rank at equal cost. Hard guard: never use trump J if a cheaper trump wins.
function cheapestWinner(cards, trump) {
  const sorted = [...cards].sort((a, b) => {
    const pa = cardPoints(a, trump), pb = cardPoints(b, trump);
    if (pa !== pb) return pa - pb;
    // prefer non-trump
    const ta = a.suit === trump ? 1 : 0, tb = b.suit === trump ? 1 : 0;
    if (ta !== tb) return ta - tb;
    // lower rank first
    const ra = a.suit === trump ? TRUMP_RANK[a.value] : NON_TRUMP_RANK[a.value];
    const rb = b.suit === trump ? TRUMP_RANK[b.value] : NON_TRUMP_RANK[b.value];
    return ra - rb;
  });
  const best = sorted[0];
  // Hard guard: avoid trump J if any other trump can win
  if (best && best.suit === trump && best.value === 'J') {
    const cheaper = sorted.find(c => !(c.suit === trump && c.value === 'J'));
    if (cheaper) return cheaper;
  }
  return best;
}

// Cheapest loser: sort by dumpScore ascending (dump garbage first, protect A/10/trumpJ/trump9).
// Within the same tier, dump the lower-point card first.
function cheapestLoser(cards, trump) {
  return [...cards].sort((a, b) => {
    const da = dumpScore(a, trump), db = dumpScore(b, trump);
    if (da !== db) return da - db;
    return cardPoints(a, trump) - cardPoints(b, trump);
  })[0];
}

// Derive all trick context variables needed for role assignment.
function computeTrickContext(game, position) {
  const { currentBid, currentTrick, trumpSuit, tricks } = game;
  const contractTeam   = currentBid.team;
  const myTeam         = position % 2;
  const isAttacking    = myTeam === contractTeam;
  const partnerPos     = (position + 2) % 4;
  const trickPos       = currentTrick.length;
  const isLeading      = trickPos === 0;
  const isLast         = trickPos === 3;
  const isLastTrick    = tricks.length === 7;
  let currentWinner    = null;
  let partnerIsWinning = false;
  let trickValue       = 0;
  if (!isLeading) {
    currentWinner    = getTrickWinner(currentTrick, trumpSuit);
    partnerIsWinning = currentWinner === partnerPos;
    trickValue       = currentTrick.reduce((s, t) => s + cardPoints(t.card, trumpSuit), 0);
  }
  const effectiveTrickValue = isLastTrick ? trickValue + 10 : trickValue;
  return {
    contractTeam, myTeam, isAttacking,
    partnerPos, trickPos, isLeading, isLast, isLastTrick,
    currentWinner, partnerIsWinning,
    trickValue, effectiveTrickValue,
  };
}

// Light bidding awareness: find the suit partner declared (non-trump only).
function partnerBidSuit(game, position) {
  const { biddingHistory, trumpSuit } = game;
  if (!biddingHistory?.length) return null;
  const partnerPos = (position + 2) % 4;
  const bid = [...biddingHistory].reverse().find(
    e => e.position === partnerPos && e.type === 'bid'
  );
  return (bid && bid.suit && bid.suit !== trumpSuit) ? bid.suit : null;
}

// Lead selection priority: B → A → C → D
function chooseLead(game, position) {
  const { hands, trumpSuit, tricks, currentBid } = game;
  const hand          = hands[position];
  const isAttacking   = (position % 2) === currentBid.team;
  const tricksPlayed  = tricks.length;
  const nonTrumps     = hand.filter(c => c.suit !== trumpSuit);
  const myTrumps      = hand.filter(c => c.suit === trumpSuit);
  const suggestedSuit = partnerBidSuit(game, position);

  // B: draw trump (attacking + holding J+9 + early game)
  if (isAttacking && tricksPlayed < 4 && myTrumps.length > 0) {
    const hasJ = myTrumps.some(c => c.value === 'J');
    const has9 = myTrumps.some(c => c.value === '9');
    if (hasJ && has9) {
      return myTrumps.reduce((best, c) =>
        TRUMP_RANK[c.value] > TRUMP_RANK[best.value] ? c : best, myTrumps[0]);
    }
  }

  // A: cash a non-trump Ace early
  const myAces = nonTrumps.filter(c => c.value === 'A');
  if (myAces.length > 0 && tricksPlayed < 5) {
    // Prefer Ace in partner's bid suit if available
    const partnerAce = suggestedSuit ? myAces.find(c => c.suit === suggestedSuit) : null;
    return partnerAce || myAces[0];
  }

  // C: lead partner's bid suit (highest card in that suit)
  if (suggestedSuit) {
    const suitCards = hand.filter(c => c.suit === suggestedSuit);
    if (suitCards.length > 0) {
      return suitCards.reduce((best, c) =>
        NON_TRUMP_RANK[c.value] > NON_TRUMP_RANK[best.value] ? c : best, suitCards[0]);
    }
  }

  // D: fallback — highest non-trump; if only trumps, cheapest trump
  if (nonTrumps.length > 0) {
    return nonTrumps.reduce((best, c) =>
      NON_TRUMP_RANK[c.value] > NON_TRUMP_RANK[best.value] ? c : best, nonTrumps[0]);
  }
  return myTrumps.reduce((best, c) =>
    TRUMP_RANK[c.value] < TRUMP_RANK[best.value] ? c : best, myTrumps[0]);
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
 * Role-based strategy:
 *  LEAD    — first to act; uses chooseLead priority (B→A→C→D)
 *  WIN     — can win and it's worth it; plays cheapestWinner
 *  SUPPORT — partner already winning; plays cheapestLoser (dump garbage)
 *  ABANDON — cannot win, or winning costs more than the trick is worth; plays cheapestLoser
 *
 * Protection philosophy: cheapestLoser uses dumpScore tiers that strongly
 * protect Aces, 10s, trump Jack, trump 9 — these are last resorts to dump.
 *
 * Belote: bot always declares when playing the first of its K+Q of trump.
 */
function getBotCardAction(game, position) {
  const { hands, currentTrick, trumpSuit, beloteInfo } = game;
  const hand  = hands[position];
  const valid = getValidCards(hand, currentTrick, trumpSuit, position);
  const ctx   = computeTrickContext(game, position);

  let card;

  if (ctx.isLeading) {
    card = chooseLead(game, position);
  } else {
    const winningCards = valid.filter(c => wouldWin(c, position, currentTrick, trumpSuit));
    const canWin       = winningCards.length > 0;

    let role;
    if (ctx.partnerIsWinning) {
      // Partner is taking this trick — no need to fight
      role = 'SUPPORT';
    } else if (canWin) {
      const win     = cheapestWinner(winningCards, trumpSuit);
      const winCost = cardPoints(win, trumpSuit);
      // Don't burn a high-value card to win a worthless trick
      if (ctx.effectiveTrickValue === 0 && winCost >= 10) {
        role = 'ABANDON';
      } else {
        role = 'WIN';
      }
    } else {
      role = 'ABANDON';
    }

    card = role === 'WIN'
      ? cheapestWinner(winningCards, trumpSuit)
      : cheapestLoser(valid, trumpSuit);
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

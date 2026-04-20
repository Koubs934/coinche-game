// Card-play strategy for bots. Does not know about the bidding convention —
// only reads biddingHistory for the lead heuristic (partnerBidSuit).

const { getValidCards, getTrickWinner, cardPoints } = require('./rules');
const { TRUMP_RANK, NON_TRUMP_RANK } = require('./constants');

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
    const ta = a.suit === trump ? 1 : 0, tb = b.suit === trump ? 1 : 0;
    if (ta !== tb) return ta - tb;
    const ra = a.suit === trump ? TRUMP_RANK[a.value] : NON_TRUMP_RANK[a.value];
    const rb = b.suit === trump ? TRUMP_RANK[b.value] : NON_TRUMP_RANK[b.value];
    return ra - rb;
  });
  const best = sorted[0];
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

// Read-only probe of bidding history — only to pick a lead suit.
// Does not depend on botBidding's convention logic.
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
 * Role-based strategy:
 *  LEAD    — first to act; uses chooseLead priority (B→A→C→D)
 *  WIN     — can win and it's worth it; plays cheapestWinner
 *  SUPPORT — partner already winning; plays cheapestLoser
 *  ABANDON — cannot win, or winning costs more than the trick is worth
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
      role = 'SUPPORT';
    } else if (canWin) {
      const win     = cheapestWinner(winningCards, trumpSuit);
      const winCost = cardPoints(win, trumpSuit);
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

module.exports = { getBotCardAction };

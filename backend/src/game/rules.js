const TRUMP_RANK = { J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1 };
const NON_TRUMP_RANK = { A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1 };
const TRUMP_POINTS = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const NON_TRUMP_POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

function cardPoints(card, trumpSuit) {
  if (card.suit === trumpSuit) return TRUMP_POINTS[card.value];
  return NON_TRUMP_POINTS[card.value];
}

// Returns the playerIndex of the trick winner
function getTrickWinner(trick, trumpSuit) {
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const curr = trick[i];
    const b = best.card;
    const c = curr.card;
    const ledSuit = trick[0].card.suit;
    const bTrump = b.suit === trumpSuit;
    const cTrump = c.suit === trumpSuit;

    if (bTrump && !cTrump) continue;
    if (!bTrump && cTrump) { best = curr; continue; }
    if (bTrump && cTrump) {
      if (TRUMP_RANK[c.value] > TRUMP_RANK[b.value]) best = curr;
    } else {
      // Neither trump — only led suit can win
      if (c.suit === ledSuit && b.suit !== ledSuit) { best = curr; continue; }
      if (c.suit === ledSuit && b.suit === ledSuit) {
        if (NON_TRUMP_RANK[c.value] > NON_TRUMP_RANK[b.value]) best = curr;
      }
    }
  }
  return best.playerIndex;
}

// Returns the subset of cards in `hand` that are legal to play
function getValidCards(hand, trick, trumpSuit, playerIndex) {
  if (trick.length === 0) return hand; // leading: any card

  const ledSuit = trick[0].card.suit;
  const myTrumps = hand.filter(c => c.suit === trumpSuit);

  // ── Lead suit IS trump ──────────────────────────────────────────────────────
  if (ledSuit === trumpSuit) {
    if (myTrumps.length === 0) return hand; // no trump at all — play anything
    const highestTrumpInTrick = trick
      .filter(t => t.card.suit === trumpSuit)
      .reduce((max, t) => !max || TRUMP_RANK[t.card.value] > TRUMP_RANK[max.value] ? t.card : max, null);
    if (!highestTrumpInTrick) return myTrumps; // edge case: shouldn't happen when trump is led
    const overtrump = myTrumps.filter(c => TRUMP_RANK[c.value] > TRUMP_RANK[highestTrumpInTrick.value]);
    return overtrump.length > 0 ? overtrump : myTrumps;
  }

  // ── Lead suit is NOT trump ──────────────────────────────────────────────────

  // 1. Must follow led suit if possible
  const suitMatch = hand.filter(c => c.suit === ledSuit);
  if (suitMatch.length > 0) return suitMatch;

  // 2. Can't follow suit — check trump obligation
  if (myTrumps.length === 0) return hand; // no trumps either — play anything

  // 3. Partner currently winning (maître) — free to play anything, regardless of trump in trick
  const partnerIndex = (playerIndex + 2) % 4;
  if (getTrickWinner(trick, trumpSuit) === partnerIndex) return hand;

  // 4. Opponent is winning — must play trump
  const trumpInTrick = trick.filter(t => t.card.suit === trumpSuit);
  if (trumpInTrick.length === 0) return myTrumps; // no trump yet — any trump will do

  // 5. Trump already in trick — must overtrump if possible; otherwise any trump
  const highestTrumpInTrick = trumpInTrick
    .reduce((max, t) => !max || TRUMP_RANK[t.card.value] > TRUMP_RANK[max.value] ? t.card : max, null);
  const overtrump = myTrumps.filter(c => TRUMP_RANK[c.value] > TRUMP_RANK[highestTrumpInTrick.value]);
  return overtrump.length > 0 ? overtrump : myTrumps;
}

module.exports = { cardPoints, getTrickWinner, getValidCards, TRUMP_RANK };

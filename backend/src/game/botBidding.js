// ─── Opening-bid convention V1 ────────────────────────────────────────────────
//
// The bot's opening bid encodes hand strength as a signal to its partner:
//
//   80  → 2+ Aces, no qualifying trump suit  (information opening)
//   90  → petit jeu  (J + 3rd card in suit,  OR  9 + 4th card + outside Ace)
//   100 → maître à l'atout  (J + 9 + A in the same suit)
//   110 → maître + 1 outside Ace
//   120 → bicolore  (maître + an exploitable second suit)
//
// Openings are capped at 120 in V1.
// Response / competitive / coinche layers are not yet implemented.

const SUITS  = ['S', 'H', 'D', 'C']; // canonical order used for tie-breaking

// Trump point potential per card value (mirrors rules.js TRUMP_POINTS)
const TRUMP_PTS = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };

// Values that count as an "honour" for the bicolore side-suit test (J/Q/K/10)
const HONORS = new Set(['J', 'Q', 'K', '10']);

// ─── Per-suit feature extraction ──────────────────────────────────────────────

/**
 * Compute all bidding-relevant features for one suit treated as candidate trump.
 *
 * @param {Array}  hand - [{suit, value}, ...]
 * @param {string} suit - 'S'|'H'|'D'|'C'
 * @returns {object} features
 */
function computeSuitFeatures(hand, suit) {
  const cards       = hand.filter(c => c.suit === suit);
  const count       = cards.length;
  const hasJ        = cards.some(c => c.value === 'J');
  const has9        = cards.some(c => c.value === '9');
  const hasA        = cards.some(c => c.value === 'A');

  // Sum of trump-point values if this suit were trump
  const trumpPtsSum = cards.reduce((s, c) => s + (TRUMP_PTS[c.value] ?? 0), 0);

  // Maître à l'atout (user definition): must hold J + 9 + A in the suit
  const isMaster = hasJ && has9 && hasA;

  // Aces held in suits other than this candidate trump
  const outsideAces = hand.filter(c => c.suit !== suit && c.value === 'A').length;

  // A suit is "exploitable" as a bicolore second suit when:
  //   – it has 4+ cards  (length establishes tricks), OR
  //   – it has an Ace + at least one honour (J/Q/K/10)  (strong short holding)
  const hasHonorForExpl = cards.some(c => HONORS.has(c.value));
  const isExploitable   = count >= 4 || (hasA && hasHonorForExpl);

  // Petit jeu: playable trump, not yet maître
  //   pattern A — Jack third:              hasJ  AND count >= 3
  //   pattern B — 9-fourth + outside Ace: has9  AND count >= 4  AND outsideAces >= 1
  const isPetitJeu = !isMaster && (
    (hasJ && count >= 3) ||
    (has9 && count >= 4 && outsideAces >= 1)
  );

  return { suit, count, hasJ, has9, hasA, trumpPtsSum,
           isMaster, isPetitJeu, outsideAces, isExploitable };
}

// ─── Bid-level classification per suit ────────────────────────────────────────

/**
 * Given precomputed features for all 4 suits, return the highest opening bid
 * level (0 | 90 | 100 | 110 | 120) that `features.suit` justifies as trump.
 *
 * @param {object} features    - result of computeSuitFeatures for the candidate suit
 * @param {Array}  allFeatures - results of computeSuitFeatures for all 4 suits
 * @returns {number} 0 | 90 | 100 | 110 | 120
 */
function suitBidLevel(features, allFeatures) {
  if (features.isMaster) {
    // Bicolore: any OTHER suit exploitable as a second colour?
    const hasBicolore = allFeatures.some(
      f => f.suit !== features.suit && f.isExploitable
    );
    if (hasBicolore)               return 120;
    if (features.outsideAces >= 1) return 110;
    return 100;
  }

  if (features.isPetitJeu) return 90;

  return 0; // no trump-based bid for this suit
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Given a hand (8 cards), return the best opening bid or null (= pass).
 *
 * Selection rules:
 *   1. Highest bid level across all suits wins (120 > 110 > 100 > 90 > 80 fallback).
 *   2. Tie-break within same level: highest trumpPtsSum, then canonical suit order S<H<D<C.
 *   3. If no suit qualifies for 90+ but totalAces >= 2, bid 80 in the suit with the
 *      highest trump potential (best information for partner).
 *   4. Otherwise: pass (null).
 *
 * @param {Array} hand - [{suit, value}, ...]
 * @returns {{ value: number, suit: string } | null}
 */
function bestOpeningBid(hand) {
  const totalAces   = hand.filter(c => c.value === 'A').length;
  const allFeatures = SUITS.map(s => computeSuitFeatures(hand, s));

  const scored = allFeatures.map(f => ({
    ...f,
    bidLevel: suitBidLevel(f, allFeatures),
  }));

  const bestLevel = Math.max(...scored.map(s => s.bidLevel));

  if (bestLevel > 0) {
    // Among all suits reaching the best level, pick by trumpPtsSum then canonical order
    const winner = scored
      .filter(s => s.bidLevel === bestLevel)
      .sort((a, b) =>
        b.trumpPtsSum !== a.trumpPtsSum
          ? b.trumpPtsSum - a.trumpPtsSum
          : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
      )[0];
    return { value: bestLevel, suit: winner.suit };
  }

  // Fallback: 80 if 2+ Aces — bid in the suit with the highest trump potential
  if (totalAces >= 2) {
    const best = [...allFeatures].sort((a, b) =>
      b.trumpPtsSum !== a.trumpPtsSum
        ? b.trumpPtsSum - a.trumpPtsSum
        : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
    )[0];
    return { value: 80, suit: best.suit };
  }

  return null; // pass
}

// ─── Partner response logic V1 ────────────────────────────────────────────────
//
// Activated when partner is currently the highest bidder.
// The bot interprets partner's bid using the same convention family,
// then decides whether to support, switch to its own suit, or pass.
//
// Contribution model (V1 — Aces only):
//   +10 per Ace held in any suit other than partner's trump suit
//   +10 for holding the Ace of partner's trump suit ONLY when partner bid 90
//         (petit jeu does not guarantee the trump Ace; 100+ already declares J+9+A)
//   K/Q/10 of partner's suit: excluded in V1
//
// Response cap: 120. Bot never bids 130+ as a response in V1.

const RESPONSE_CAP = 120;

/**
 * Count the Ace-equivalent contribution I can add toward partner's bid.
 *
 * @param {Array}  hand       - own hand
 * @param {object} partnerBid - { value, suit }  (game.currentBid)
 * @returns {number} total Ace-equivalent contributions (0, 1, 2, …)
 */
function myContributionToPartner(hand, partnerBid) {
  // Aces in suits other than partner's trump always count
  const outsideAces = hand.filter(
    c => c.suit !== partnerBid.suit && c.value === 'A'
  ).length;

  // Trump Ace bonus: only when partner bid 90 (petit jeu might not include the Ace)
  // When partner bid 100+ they already declared J+9+A, so they own the trump Ace.
  const hasTrumpAce = hand.some(
    c => c.suit === partnerBid.suit && c.value === 'A'
  );
  const trumpAceBonus = (partnerBid.value === 90 && hasTrumpAce) ? 1 : 0;

  return outsideAces + trumpAceBonus;
}

/**
 * Return the best "switch" bid: my own opening bid in a suit OTHER than
 * partner's, only when the value is strictly higher than partner's bid.
 * Keeps bids truthful — I only bid what my opening logic justifies.
 *
 * @param {Array}  hand       - own hand
 * @param {object} partnerBid - { value, suit }
 * @returns {{ value: number, suit: string } | null}
 */
function bestSwitchBid(hand, partnerBid) {
  const myOpening = bestOpeningBid(hand);
  if (!myOpening)                           return null; // no opening bid
  if (myOpening.suit === partnerBid.suit)   return null; // same suit → support, not switch
  if (myOpening.value <= partnerBid.value)  return null; // can't outbid
  return myOpening;
}

/**
 * Compute the best partner-response bid or null (= pass).
 *
 * Priority:
 *   1. If both switch and support are available, prefer the one with the higher value.
 *      Tie-break: switch (own trump certainty > Ace signal).
 *   2. Switch only  → switch.
 *   3. Support only → support.
 *   4. Neither      → pass.
 *
 * @param {Array}  hand       - own 8-card hand
 * @param {object} partnerBid - game.currentBid (caller guarantees partner is highest bidder)
 * @returns {{ value: number, suit: string } | null}
 */
function partnerResponseBid(hand, partnerBid) {
  // V1 cap — cannot raise above 120
  if (partnerBid.value >= RESPONSE_CAP) return null;

  // ── Support option ──────────────────────────────────────────────────────────
  const contributionAces = myContributionToPartner(hand, partnerBid);
  const rawSupport       = partnerBid.value + contributionAces * 10;
  const supportValue     = Math.min(rawSupport, RESPONSE_CAP);
  const canSupport       = supportValue > partnerBid.value; // at least 1 Ace equivalent

  // ── Switch option ────────────────────────────────────────────────────────────
  const switchBid = bestSwitchBid(hand, partnerBid);
  const canSwitch = switchBid !== null;

  // ── Decision ─────────────────────────────────────────────────────────────────
  if (canSwitch && canSupport) {
    // Both options available: prefer switch when values are equal or switch is higher
    return switchBid.value >= supportValue
      ? switchBid
      : { value: supportValue, suit: partnerBid.suit };
  }
  if (canSwitch)  return switchBid;
  if (canSupport) return { value: supportValue, suit: partnerBid.suit };
  return null; // pass
}

module.exports = {
  bestOpeningBid, computeSuitFeatures, suitBidLevel,
  partnerResponseBid, myContributionToPartner, bestSwitchBid,
};

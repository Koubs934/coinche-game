// ─── Bot bidding — La Feuille V2.1 ────────────────────────────────────────────
//
// Reference: docs/la-feuille-v2.md (with the 2026-05-04 V2.1 correction to
// the response-to-90 table). The bot is the production bidder used by
// botProcessor.js for live games. Training-mode scenarios use this same
// rule set as their `expectedAnswer` ground truth.
//
// Opening hierarchy (highest first, V2.1): 120 → 110 → 100 → 80 → 90 → pass.
//   120 bicolore : maître à l'atout + ≥1 autre atout + cartes en
//                  STRICTEMENT 2 couleurs (atout + 1 autre).
//   110          : maître + ≥1 As extérieur (en plus de l'A d'atout).
//   100          : maître seul (sans As extérieur).
//   80           : EXACTEMENT 2 As + petit-jeu.
//   90           : Pièce 4ème + 1 As ext OU Valet 3ème + belote + 1 As ext
//                  OU V + 9 + 1 autre atout + 1 As ext.
//
// Petit-jeu (pour qualifier 80): ≥1 pièce + ≥2 atouts OU 4 atouts + belote
// (sans pièce) OU ≥5 atouts (sans pièce). Pièce = J ou 9 d'atout.
//
// Response tables — see classifyResponseToXX() per opening value.
//
// V2.1 leaves several zones explicitly unformalized: competitive bidding
// (after opp open / after opp overcall), second-position-after-partner-pass,
// fourth position, coinche / surcoinche, capot. The bot returns `pass` in
// those cases — same as V1 — until those zones are formalized.

const { SUITS, TRUMP_POINTS: TRUMP_PTS } = require('./constants');

// ─── Per-suit feature extraction ─────────────────────────────────────────────

function computeSuitFeatures(hand, suit) {
  const cards       = hand.filter(c => c.suit === suit);
  const count       = cards.length;
  const hasJ        = cards.some(c => c.value === 'J');
  const has9        = cards.some(c => c.value === '9');
  const hasA        = cards.some(c => c.value === 'A');
  const hasK        = cards.some(c => c.value === 'K');
  const hasQ        = cards.some(c => c.value === 'Q');
  const trumpPtsSum = cards.reduce((s, c) => s + (TRUMP_PTS[c.value] ?? 0), 0);
  const piece       = hasJ || has9;
  const hasBelote   = hasK && hasQ;
  const isMaitre    = hasJ && has9 && hasA;
  const outsideAces = hand.filter(c => c.suit !== suit && c.value === 'A').length;
  return {
    suit, count, hasJ, has9, hasA, hasK, hasQ, hasBelote,
    piece, isMaitre, outsideAces, trumpPtsSum,
  };
}

function totalAces(hand) {
  return hand.filter(c => c.value === 'A').length;
}

// "Strictly 2 colors" for the 120-bicolore test. Trump suit is one; the
// other is the side suit. 3+ non-zero suits → not bicolore.
function isStrictBicolore(hand, trumpSuit) {
  if (hand.filter(c => c.suit === trumpSuit).length === 0) return false;
  const otherPresent = SUITS.filter(s => s !== trumpSuit)
    .filter(s => hand.some(c => c.suit === s));
  return otherPresent.length === 1;
}

// V2 petit-jeu: ≥1 pièce + ≥2 atouts OR 4 atouts + belote (sans pièce)
// OR ≥5 atouts (sans pièce).
function isPetitJeu(f) {
  if (f.piece && f.count >= 2) return true;
  if (!f.piece && f.count === 4 && f.hasBelote) return true;
  if (!f.piece && f.count >= 5) return true;
  return false;
}

// V2 90: any of three patterns, all requiring 1 outside Ace.
function qualifiesFor90(f) {
  if (f.outsideAces < 1) return false;
  if (f.piece && f.count >= 4)                  return true; // pièce 4ème
  if (f.hasJ && f.count >= 3 && f.hasBelote)    return true; // V 3ème + belote
  if (f.hasJ && f.has9 && f.count >= 3)         return true; // V + 9 + 1
  return false;
}

// ─── Opening ─────────────────────────────────────────────────────────────────

/**
 * Highest opening per the V2.1 hierarchy. Returns { value, suit } or null.
 */
function bestOpeningBid(hand) {
  // 100/110/120 — maître-based. We score every suit that's maître and
  // pick the highest-value candidate; tie-break on trumpPtsSum, then on
  // canonical SUITS order.
  let bestMaitre = null;
  for (const suit of SUITS) {
    const f = computeSuitFeatures(hand, suit);
    if (!f.isMaitre) continue;
    let value;
    if (isStrictBicolore(hand, suit) && f.count >= 2) value = 120;
    else if (f.outsideAces >= 1)                      value = 110;
    else                                              value = 100;
    if (!bestMaitre ||
        value > bestMaitre.value ||
        (value === bestMaitre.value && f.trumpPtsSum > bestMaitre.f.trumpPtsSum) ||
        (value === bestMaitre.value && f.trumpPtsSum === bestMaitre.f.trumpPtsSum &&
          SUITS.indexOf(suit) < SUITS.indexOf(bestMaitre.suit))) {
      bestMaitre = { value, suit, f };
    }
  }
  if (bestMaitre) return { value: bestMaitre.value, suit: bestMaitre.suit };

  // 80 — EXACTLY 2 Aces + petit-jeu somewhere.
  if (totalAces(hand) === 2) {
    let best80 = null;
    for (const suit of SUITS) {
      const f = computeSuitFeatures(hand, suit);
      if (!isPetitJeu(f)) continue;
      if (!best80 ||
          f.trumpPtsSum > best80.f.trumpPtsSum ||
          (f.trumpPtsSum === best80.f.trumpPtsSum &&
            SUITS.indexOf(suit) < SUITS.indexOf(best80.suit))) {
        best80 = { suit, f };
      }
    }
    if (best80) return { value: 80, suit: best80.suit };
  }

  // 90 — strongest 90-qualifying suit.
  let best90 = null;
  for (const suit of SUITS) {
    const f = computeSuitFeatures(hand, suit);
    if (!qualifiesFor90(f)) continue;
    if (!best90 ||
        f.trumpPtsSum > best90.f.trumpPtsSum ||
        (f.trumpPtsSum === best90.f.trumpPtsSum &&
          SUITS.indexOf(suit) < SUITS.indexOf(best90.suit))) {
      best90 = { suit, f };
    }
  }
  if (best90) return { value: 90, suit: best90.suit };

  return null; // pass
}

// ─── Response tables ─────────────────────────────────────────────────────────
//
// Each classifier returns the highest applicable line for the given
// (hand, partner suit) pair, or null if none applies. `null` is
// "rule-silent" in V2.1 — the doc doesn't enumerate "pass" as a formal
// response; the bot interprets it as pass for now (a safe lower bound).

function classifyResponseTo80(hand, partnerSuit) {
  const f = computeSuitFeatures(hand, partnerSuit);
  const aces    = totalAces(hand);
  const piece2  = f.piece && f.count >= 2;
  const piece3  = f.piece && f.count >= 3;
  const valetSec = f.hasJ && f.count === 1; // J alone — qualifies for 90
  const isBare9  = f.has9 && !f.hasJ && f.count === 1; // never 90 (per doc)

  if (piece3 && aces >= 2) return { value: 140, suit: partnerSuit };
  if (piece3 && aces >= 1) return { value: 130, suit: partnerSuit };
  if (piece3)              return { value: 120, suit: partnerSuit };
  if (piece2 && aces >= 2) return { value: 110, suit: partnerSuit };
  if (piece2 && aces >= 1) return { value: 100, suit: partnerSuit };
  if (valetSec || piece2)  return { value: 90,  suit: partnerSuit };
  // isBare9 explicitly excluded (no 90 with 9 sec per la-feuille-v2.md).
  return null;
}

function classifyResponseTo90(hand, partnerSuit) {
  const f = computeSuitFeatures(hand, partnerSuit);
  const aces   = totalAces(hand);
  const piece2 = f.piece && f.count >= 2;
  const piece3 = f.piece && f.count >= 3;

  if (piece3 && aces >= 2) return { value: 130, suit: partnerSuit };
  if (piece3 && aces >= 1) return { value: 120, suit: partnerSuit };
  if (aces >= 3)           return { value: 120, suit: partnerSuit };
  if (piece2 && aces >= 1) return { value: 110, suit: partnerSuit };
  // ≥1 atout + 1 As, no piece
  if (!f.piece && f.count >= 1 && aces >= 1) return { value: 100, suit: partnerSuit };
  return null;
}

// +10 par As ext. Plafond pratique 130 (partenaire a déjà l'A d'atout).
function classifyResponseTo100(hand, partnerSuit) {
  const aces = hand.filter(c => c.suit !== partnerSuit && c.value === 'A').length;
  if (aces === 0) return null;
  return { value: Math.min(100 + aces * 10, 130), suit: partnerSuit };
}

// +10 par As ext. Pas de plafond mécanique.
function classifyResponseTo110(hand, partnerSuit) {
  const aces = hand.filter(c => c.suit !== partnerSuit && c.value === 'A').length;
  if (aces === 0) return null;
  return { value: 110 + aces * 10, suit: partnerSuit };
}

// 130 sur 3 As OU une pièce d'atout. Pass sinon (règle restrictive V2).
function classifyResponseTo120(hand, partnerSuit) {
  const f = computeSuitFeatures(hand, partnerSuit);
  if (totalAces(hand) >= 3) return { value: 130, suit: partnerSuit };
  if (f.piece)              return { value: 130, suit: partnerSuit };
  return null;
}

function partnerResponseBid(hand, partnerBid) {
  if (!partnerBid) return null;
  if (partnerBid.value === 'capot') return null;
  switch (partnerBid.value) {
    case  80: return classifyResponseTo80(hand, partnerBid.suit);
    case  90: return classifyResponseTo90(hand, partnerBid.suit);
    case 100: return classifyResponseTo100(hand, partnerBid.suit);
    case 110: return classifyResponseTo110(hand, partnerBid.suit);
    case 120: return classifyResponseTo120(hand, partnerBid.suit);
    default:  return null; // 130+ — V2.1 silent on further raises
  }
}

// ─── Public entry point ─────────────────────────────────────────────────────

function getBotBidAction(game, position) {
  const partnerPos = (position + 2) % 4;

  if (game.currentBid) {
    if (game.currentBid.coinched) return { type: 'pass' };
    if (game.currentBid.playerIndex === partnerPos) {
      const r = partnerResponseBid(game.hands[position], game.currentBid);
      // Only emit a raise that strictly outbids partner — same-value or
      // lower is treated as pass.
      if (r && r.value > game.currentBid.value) {
        return { type: 'bid', value: r.value, suit: r.suit };
      }
      return { type: 'pass' };
    }
    // V2.1 doesn't formalize competitive responses to opponents.
    return { type: 'pass' };
  }

  const bid = bestOpeningBid(game.hands[position]);
  if (bid) return { type: 'bid', value: bid.value, suit: bid.suit };
  return { type: 'pass' };
}

module.exports = {
  // Public API (consumed by botProcessor.js, verify.js, smoke.test.js)
  bestOpeningBid,
  computeSuitFeatures,
  partnerResponseBid,
  getBotBidAction,
  // Helpers exported for tests
  isPetitJeu,
  qualifiesFor90,
  isStrictBicolore,
  totalAces,
  classifyResponseTo80,
  classifyResponseTo90,
  classifyResponseTo100,
  classifyResponseTo110,
  classifyResponseTo120,
};

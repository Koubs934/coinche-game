'use strict';
// FICHE DE MAIN — pure, factual per-suit hand features for the training coach.
//
// FACTUAL ONLY. This module computes what a hand CONTAINS (counts, pièces,
// maître, belote, points). It makes NO recommendation and asserts NO Feuille
// prescription — it never says "annonce X". La Feuille remains the sole
// convention authority; this is the reliable-arithmetic layer beneath it.
//
// Definitions are the Feuille's (docs/la-feuille-v2.md, the definitions list):
//   - Pièce          = Valet (J) OU 9 de l'atout (uniquement à l'atout).
//   - Maître à l'atout = Valet + 9 + As de la couleur d'atout (les 3 réunis).
//   - As extérieur   = As dans une couleur AUTRE que l'atout.
//   - Belote         = Roi + Dame de l'atout dans la même main.
//   - Antibelote     = tenir le Roi OU la Dame de l'atout (rend la belote
//                      adverse impossible). Avoir les deux ⇒ belote ET antibelote.
//   - Petit jeu (qualifie 80) = au moins une de ces conditions :
//        • ≥1 pièce + ≥2 atouts
//        • 4 atouts avec belote, sans pièce
//        • ≥5 atouts, sans pièce
//
// Input format matches the scenario hands: an array of { suit, value } where
// suit ∈ {S,H,D,C} and value ∈ {7,8,9,10,J,Q,K,A}. Card-strings ("JS","10H")
// are also accepted for convenience.

const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
// Display values in French table parlance (V/D/R), points stay numeric.
const VALUE_FR = { J: 'V', Q: 'D', K: 'R', A: 'A', '10': '10', '9': '9', '8': '8', '7': '7' };

// Card-point tables (the FACTS from regles-du-jeu.md).
const TRUMP_POINTS    = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const NONTRUMP_POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

// Strongest-to-weakest order within a suit, for stable display only.
const TRUMP_ORDER    = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const NONTRUMP_ORDER = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];

// Normalize one card to { suit, value }. Accepts { suit, value } or a string
// like "JS" / "10H" / "9C" (value chars, then a single suit char).
function normCard(c) {
  if (c && typeof c === 'object' && c.suit != null && c.value != null) {
    return { suit: String(c.suit).toUpperCase(), value: String(c.value).toUpperCase() };
  }
  if (typeof c === 'string') {
    const s = c.trim().toUpperCase();
    return { suit: s.slice(-1), value: s.slice(0, -1) };
  }
  throw new Error(`handFeatures: unrecognized card ${JSON.stringify(c)}`);
}

function normHand(hand) {
  if (!Array.isArray(hand)) return [];
  return hand.map(normCard);
}

// Compute hand-level + per-suit features. Returns:
//   { cards, asTotaux, noJ, suits: { S:{...}, H:{...}, D:{...}, C:{...} } }
// Each suit object reflects "if THIS suit is trump".
function computeHandFeatures(rawHand) {
  const cards = normHand(rawHand);
  const asTotaux = cards.filter(c => c.value === 'A').length;     // hand-level
  const noJ = cards.every(c => c.value !== 'J');                  // no Valet anywhere

  const suits = {};
  for (const S of SUITS) {
    const valuesInSuit = cards.filter(c => c.suit === S).map(c => c.value);
    const has = v => valuesInSuit.includes(v);
    const nbAtouts = valuesInSuit.length;

    const hasJ = has('J'), has9 = has('9'), hasA = has('A'), hasK = has('K'), hasQ = has('Q');
    const piece      = hasJ || has9;
    const maitre     = hasJ && has9 && hasA;
    const belote     = hasK && hasQ;
    const antibelote = hasK || hasQ;
    const asExterieurs = asTotaux - (hasA ? 1 : 0);

    // Petit jeu — the three Feuille conditions, literally (the "sans pièce"
    // qualifiers are kept; the with-pièce path is condition 1).
    const petitJeu =
      (piece && nbAtouts >= 2) ||
      (!piece && nbAtouts === 4 && belote) ||
      (!piece && nbAtouts >= 5);

    // Points if S is trump: trump table for cards of S, non-trump table elsewhere.
    let pointsEnMain = 0;
    for (const c of cards) {
      const table = c.suit === S ? TRUMP_POINTS : NONTRUMP_POINTS;
      pointsEnMain += table[c.value] ?? 0;
    }

    suits[S] = {
      suit: S, symbol: SUIT_SYMBOL[S],
      nbAtouts, hasJ, has9, hasA, hasK, hasQ,
      piece, maitre, belote, antibelote,
      asExterieurs, asTotaux, petitJeu, pointsEnMain,
    };
  }
  return { cards, asTotaux, noJ, suits };
}

// Sort a suit's held values strongest-first for display.
function orderValues(values, asTrump) {
  const order = asTrump ? TRUMP_ORDER : NONTRUMP_ORDER;
  return [...values].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(v => VALUE_FR[v] || v);
}

const oui = b => (b ? 'OUI' : 'non');

// Render a compact French "FICHE DE MAIN" block. Lists, for each suit the
// player actually holds cards in (candidate trump), the key facts — strongest
// trump candidates first. No recommendation, no Feuille prescription.
function renderFiche(rawHand) {
  const f = computeHandFeatures(rawHand);
  if (f.cards.length === 0) return '';

  // Full hand line, grouped by suit (no-trump ordering, just for readability).
  const handLine = SUITS
    .map(S => {
      const vals = f.cards.filter(c => c.suit === S).map(c => c.value);
      if (vals.length === 0) return null;
      return `${SUIT_SYMBOL[S]} ${orderValues(vals, false).join(' ')}`;
    })
    .filter(Boolean)
    .join('  ·  ');

  // Candidate trumps = suits held, strongest first (most atouts, then points).
  const candidates = SUITS
    .map(S => f.suits[S])
    .filter(s => s.nbAtouts > 0)
    .sort((a, b) => (b.nbAtouts - a.nbAtouts) || (b.pointsEnMain - a.pointsEnMain) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));

  const rows = candidates.map(s => {
    const trumpVals = orderValues(f.cards.filter(c => c.suit === s.suit).map(c => c.value), true).join(' ');
    return `• ${s.symbol} comme atout — ${s.nbAtouts} atout${s.nbAtouts > 1 ? 's' : ''} (${trumpVals})`
      + ` · maître: ${oui(s.maitre)} · pièce: ${oui(s.piece)} · belote: ${oui(s.belote)} · antibelote: ${oui(s.antibelote)}`
      + ` · As extérieurs: ${s.asExterieurs} · petit-jeu (critère 80): ${oui(s.petitJeu)} · points en main: ${s.pointsEnMain}`;
  });

  return [
    'FICHE DE MAIN (calculée, fiable)',
    `Main (${f.cards.length} cartes) : ${handLine}`,
    `As au total dans la main : ${f.asTotaux}${f.noJ ? ' · aucun Valet dans la main' : ''}`,
    'Par couleur d\'atout envisageable (FAITS calculés, aucune recommandation) :',
    ...rows,
  ].join('\n');
}

module.exports = { computeHandFeatures, renderFiche, normHand, normCard };

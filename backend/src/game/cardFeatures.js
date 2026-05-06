// V2.2 Phase 2C — feature extraction over an ARBITRARY card subset (the
// "cards motivating the bid" selected by the user on the completion
// screen). Output feeds the Claude system prompt as recognized coinche
// patterns: maître, pièce, belote, longue, as extérieur.
//
// Kept independent of botBidding.js's computeSuitFeatures even though the
// shapes overlap — the bot reasons over a full 8-card hand to compute a
// single bid; this module reasons over any subset to surface patterns the
// user *thought* about. The two would diverge if either side gained
// new patterns, so a shared helper would couple unrelated concerns.
//
// Trump suit: the suit of the user's submitted bid
// (annotation.decisions[0].action.suit). Pass / coinche / surcoinche have
// no trump → patterns that require trump (maître, pièce, belote-on-trump)
// are simply not detected; non-trump patterns (longue, totalAces) still
// fire.

const SUITS  = ['S', 'H', 'D', 'C'];
const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const TRUMP_POINTS = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };

function emptyByRank() {
  const out = {};
  for (const v of VALUES) out[v] = 0;
  return out;
}

function suitFeatures(cards, suit) {
  const inSuit     = cards.filter(c => c && c.suit === suit);
  const count      = inSuit.length;
  const values     = new Set(inSuit.map(c => c.value));
  const hasJ       = values.has('J');
  const has9       = values.has('9');
  const hasA       = values.has('A');
  const hasK       = values.has('K');
  const hasQ       = values.has('Q');
  const has10      = values.has('10');
  const has8       = values.has('8');
  const has7       = values.has('7');
  const trumpPtsSum = inSuit.reduce((s, c) => s + (TRUMP_POINTS[c.value] ?? 0), 0);
  return {
    suit, count,
    cards: inSuit.map(c => ({ ...c })),
    hasJ, has9, hasA, hasK, hasQ, has10, has8, has7,
    hasBelote: hasK && hasQ,
    isMaitre:  hasJ && has9 && hasA,
    piece:     hasJ || has9,
    trumpPtsSum,
  };
}

function detectPatterns(bySuit, trumpSuit) {
  const patterns = [];
  // STRICT TRUMP-ONLY GATE — DO NOT iterate over all four suits here.
  //
  // "Pièce", "maître à l'atout" and "belote" are vocabulary tied to the
  // CONTRACT TRUMP. A J or 9 in a non-trump suit is NOT a pièce — it's a
  // carte extérieure. K+Q in a non-trump suit is NOT belote. We therefore
  // only inspect bySuit[trumpSuit] for these patterns and never iterate
  // over SUITS for them. (Longue and outsideAces below DO span all suits;
  // those concepts are suit-independent.)
  //
  // V2.2 calibration: "pièce" = the J OR the 9 of trump (the "missing piece"
  // that completes the maître). Aaron's group treats both equivalently for
  // the pièce N-ème vocabulary; the only finer distinction is "9 sec" / "J
  // sec" but those are positional and don't change the pattern enum here.
  //
  // maître subsumes the pièce N-ème patterns (J+9+A is necessarily a
  // pièce 3ème+) so we don't double-fire — the descriptor renders maître
  // alone.
  if (trumpSuit && bySuit[trumpSuit]) {
    const t = bySuit[trumpSuit];
    if (t.isMaitre) {
      patterns.push('maitre');
    } else {
      const hasPiece = t.hasJ || t.has9;
      if (hasPiece && t.count === 2)     patterns.push('piece-2nde');
      if (hasPiece && t.count === 3)     patterns.push('piece-3eme');
      if (hasPiece && t.count === 4)     patterns.push('piece-4eme');
      if (hasPiece && t.count >= 5)      patterns.push('piece-longue');
    }
    if (t.hasBelote)                     patterns.push('belote');
  }
  // Longues — any suit with ≥4 cards. We tag the suit so the prompt can
  // surface "longue ♠" (4) vs "longue ♥" (5+).
  for (const s of SUITS) {
    const f = bySuit[s];
    if (!f) continue;
    if (f.count >= 6)      patterns.push(`longue-${s}-${f.count}`);
    else if (f.count >= 4) patterns.push(`longue-${s}-${f.count}`);
  }
  // Aces. We surface the count and (when trumpSuit is set) how many are
  // "extérieurs" (i.e. not in trump).
  return patterns;
}

/**
 * Compute feature breakdown of a card subset.
 *
 * @param {Array<{value:string, suit:string}>} selectedCards
 * @param {string|null} trumpSuit  the suit of the user's bid; null if pass / no bid
 * @returns {{
 *   selectedCards: Array,
 *   trumpSuit: string|null,
 *   bySuit: { S: object, H: object, D: object, C: object },
 *   patterns: string[],
 *   countByRank: Record<string, number>,
 *   totalAces: number,
 *   outsideAces: number,
 *   selectedCount: number
 * }}
 */
function computeFeatures(selectedCards, trumpSuit = null) {
  const cards = (selectedCards || []).filter(c => c && c.suit && c.value);
  const bySuit = {};
  for (const s of SUITS) bySuit[s] = suitFeatures(cards, s);

  const countByRank = emptyByRank();
  for (const c of cards) {
    if (countByRank[c.value] !== undefined) countByRank[c.value] += 1;
  }
  const totalAces = countByRank.A;
  const outsideAces = trumpSuit
    ? cards.filter(c => c.value === 'A' && c.suit !== trumpSuit).length
    : totalAces;

  const patterns = detectPatterns(bySuit, trumpSuit);

  return {
    selectedCards: cards.map(c => ({ value: c.value, suit: c.suit })),
    trumpSuit,
    bySuit,
    patterns,
    countByRank,
    totalAces,
    outsideAces,
    selectedCount: cards.length,
  };
}

// ─── Pretty-printer for the Claude system prompt ───────────────────────────
//
// Output is plain French sentences. The detective doesn't need raw enum
// strings; he needs "pièce 4ème ♠ + 1 As extérieur".

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_FR     = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };

function describePatterns(features) {
  if (!features) return '(aucune sélection)';
  if (features.selectedCount === 0) return '(aucune carte sélectionnée)';

  const lines = [];
  const t = features.trumpSuit;
  const tSym = t ? SUIT_SYMBOL[t] : null;

  // V2.2 calibration: "pièce" = J OR 9 of trump. The descriptor reports
  // which one(s) the user actually selected so the pattern stays concrete
  // ("Pièce 2nde ♠ avec le 9" vs "Pièce 2nde ♠ avec le Valet").
  const tFeat = t ? features.bySuit[t] : null;
  const pieceLabel = tFeat
    ? (tFeat.hasJ && tFeat.has9 ? 'V + 9'
       : tFeat.hasJ             ? 'Valet'
       : tFeat.has9             ? '9 d\'atout'
       :                          'pièce')
    : 'pièce';
  if (features.patterns.includes('maitre')) {
    lines.push(`- Maître à l'atout ${tSym} (V + 9 + As)`);
  } else {
    if (features.patterns.includes('piece-2nde'))   lines.push(`- Pièce 2nde ${tSym} (${pieceLabel} + 1 autre atout)`);
    if (features.patterns.includes('piece-3eme'))   lines.push(`- Pièce 3ème ${tSym} (${pieceLabel} + 2 autres atouts)`);
    if (features.patterns.includes('piece-4eme'))   lines.push(`- Pièce 4ème ${tSym} (${pieceLabel} + 3 autres atouts)`);
    if (features.patterns.includes('piece-longue')) lines.push(`- Pièce longue ${tSym} (${pieceLabel} + 4+ autres atouts)`);
  }
  if (features.patterns.includes('belote')) {
    lines.push(`- Belote ${tSym} (Roi + Dame d'atout)`);
  }
  // Longues outside trump
  for (const p of features.patterns) {
    const m = /^longue-([SHDC])-(\d+)$/.exec(p);
    if (!m) continue;
    const s = m[1];
    if (s === t) continue; // already covered by pièce N-ème
    lines.push(`- Longue ${SUIT_SYMBOL[s]} (${m[2]} cartes en ${SUIT_FR[s]})`);
  }
  // Aces
  if (features.totalAces > 0) {
    if (t && features.outsideAces > 0 && features.outsideAces < features.totalAces) {
      lines.push(`- ${features.outsideAces} As extérieur(s) + As d'atout`);
    } else if (t && features.outsideAces > 0) {
      lines.push(`- ${features.outsideAces} As extérieur(s)`);
    } else if (t && features.outsideAces === 0) {
      lines.push(`- 1 As d'atout (aucun As extérieur)`);
    } else {
      lines.push(`- ${features.totalAces} As au total`);
    }
  }

  if (lines.length === 0) {
    lines.push('- (aucun pattern reconnu)');
  }
  return lines.join('\n');
}

function describeSelectedCards(features) {
  if (!features || features.selectedCount === 0) return '(aucune carte)';
  const lines = [];
  for (const s of SUITS) {
    const f = features.bySuit[s];
    if (!f || f.count === 0) continue;
    lines.push(`- ${SUIT_SYMBOL[s]}: ${f.cards.map(c => c.value).join(', ')}`);
  }
  return lines.join('\n');
}

module.exports = {
  computeFeatures,
  describePatterns,
  describeSelectedCards,
};

// Unit tests for the FICHE DE MAIN factual hand-feature module.
// Expected values are derived from the Feuille definitions
// (docs/la-feuille-v2.md): pièce = J|9 of trump; maître = J&9&A of trump;
// belote = K&Q of trump; antibelote = K|Q of trump; As ext = aces outside
// trump; petit jeu (qualifies 80) = (pièce + ≥2 atouts) | (4 atouts + belote,
// sans pièce) | (≥5 atouts, sans pièce).

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { computeHandFeatures, renderFiche } = require('../handFeatures.js');

// Aaron opening-04 hand: ♠ J9AKQ + ♥ AK10.
const hand1 = [
  { suit: 'S', value: 'J' }, { suit: 'S', value: '9' }, { suit: 'S', value: 'A' },
  { suit: 'S', value: 'K' }, { suit: 'S', value: 'Q' },
  { suit: 'H', value: 'A' }, { suit: 'H', value: 'K' }, { suit: 'H', value: '10' },
];

// Annotation 05bde12c hand: ♠ K97 ♥ K7 ♦ KQ ♣ 9.
const hand2 = [
  { suit: 'S', value: 'K' }, { suit: 'S', value: '9' }, { suit: 'S', value: '7' },
  { suit: 'H', value: 'K' }, { suit: 'H', value: '7' },
  { suit: 'D', value: 'K' }, { suit: 'D', value: 'Q' },
  { suit: 'C', value: '9' },
];

// Antibelote-only construction: K♠ without Q♠ (and no belote elsewhere).
const hand3 = [
  { suit: 'S', value: 'K' }, { suit: 'S', value: '10' }, { suit: 'S', value: '8' }, { suit: 'S', value: '7' },
  { suit: 'H', value: '9' }, { suit: 'H', value: '8' },
  { suit: 'D', value: '7' },
  { suit: 'C', value: '7' },
];

describe('handFeatures — hand 1 (♠J9AKQ + ♥AK10, Aaron opening-04)', () => {
  const f = computeHandFeatures(hand1);
  it('hand-level: 2 aces total, a Valet is present', () => {
    expect(f.asTotaux).toBe(2);
    expect(f.noJ).toBe(false);
  });
  it('♠ as trump: 5 atouts, maître + pièce + belote true, 1 As ext, petit jeu true', () => {
    const s = f.suits.S;
    expect(s.nbAtouts).toBe(5);
    expect(s.maitre).toBe(true);
    expect(s.piece).toBe(true);
    expect(s.belote).toBe(true);
    expect(s.antibelote).toBe(true);
    expect(s.asExterieurs).toBe(1);   // A♥
    expect(s.asTotaux).toBe(2);
    expect(s.petitJeu).toBe(true);    // pièce + ≥2 atouts
  });
  it('♠ as trump: points en main = 77 (52 trump + 25 hors-atout)', () => {
    expect(f.suits.S.pointsEnMain).toBe(77);
  });
  it('♥ as trump: 3 atouts, not maître, 1 As ext (A♠), points en main = 45', () => {
    const h = f.suits.H;
    expect(h.nbAtouts).toBe(3);
    expect(h.maitre).toBe(false);
    expect(h.asExterieurs).toBe(1);   // A♠
    expect(h.pointsEnMain).toBe(45);
  });
});

describe('handFeatures — hand 2 (♠K97 ♥K7 ♦KQ ♣9, 05bde12c)', () => {
  const f = computeHandFeatures(hand2);
  it('hand-level: 0 aces, no Valet anywhere', () => {
    expect(f.asTotaux).toBe(0);
    expect(f.noJ).toBe(true);
  });
  it('♠ as trump: pièce via the 9, not maître, antibelote (K) but no belote', () => {
    const s = f.suits.S;
    expect(s.piece).toBe(true);
    expect(s.has9).toBe(true);
    expect(s.hasJ).toBe(false);
    expect(s.maitre).toBe(false);
    expect(s.belote).toBe(false);     // no Q♠
    expect(s.antibelote).toBe(true);  // K♠
    expect(s.nbAtouts).toBe(3);
    expect(s.petitJeu).toBe(true);    // pièce + ≥2 atouts
  });
  it('♦ as trump: K and Q present → belote true (and antibelote true)', () => {
    const d = f.suits.D;
    expect(d.belote).toBe(true);
    expect(d.antibelote).toBe(true);
    expect(d.piece).toBe(false);
    expect(d.nbAtouts).toBe(2);
    expect(d.petitJeu).toBe(false);   // belote but only 2 atouts (needs 4)
  });
  it('♣ as trump: pièce (9♣) but a lone atout → petit jeu false', () => {
    const c = f.suits.C;
    expect(c.piece).toBe(true);
    expect(c.nbAtouts).toBe(1);
    expect(c.antibelote).toBe(false);
    expect(c.petitJeu).toBe(false);   // pièce but <2 atouts
  });
});

describe('handFeatures — hand 3 (antibelote only: K♠ without Q♠)', () => {
  const f = computeHandFeatures(hand3);
  it('♠ as trump: antibelote true, belote false, no pièce', () => {
    const s = f.suits.S;
    expect(s.hasK).toBe(true);
    expect(s.hasQ).toBe(false);
    expect(s.antibelote).toBe(true);
    expect(s.belote).toBe(false);
    expect(s.piece).toBe(false);
    expect(s.nbAtouts).toBe(4);
    expect(s.petitJeu).toBe(false);   // 4 atouts but no belote and no pièce
  });
  it('a suit with neither K nor Q has antibelote false', () => {
    expect(f.suits.D.antibelote).toBe(false);  // only 7♦
    expect(f.suits.C.antibelote).toBe(false);  // only 7♣
  });
});

describe('handFeatures — petit jeu, all three Feuille branches', () => {
  // Condition 2: 4 atouts avec belote, SANS pièce (no J, no 9 in trump).
  it('4 atouts + belote, sans pièce → petit jeu true', () => {
    const hand = [
      { suit: 'S', value: 'K' }, { suit: 'S', value: 'Q' }, { suit: 'S', value: '10' }, { suit: 'S', value: '8' },
      { suit: 'H', value: '7' }, { suit: 'D', value: '7' }, { suit: 'C', value: '7' }, { suit: 'C', value: '8' },
    ];
    const s = computeHandFeatures(hand).suits.S;
    expect(s.nbAtouts).toBe(4);
    expect(s.piece).toBe(false);   // no J♠, no 9♠
    expect(s.belote).toBe(true);   // K♠ + Q♠
    expect(s.petitJeu).toBe(true);
  });
  // Condition 3: ≥5 atouts, SANS pièce (and here without belote either).
  it('5 atouts, sans pièce et sans belote → petit jeu true', () => {
    const hand = [
      { suit: 'S', value: 'A' }, { suit: 'S', value: 'K' }, { suit: 'S', value: '10' }, { suit: 'S', value: '8' }, { suit: 'S', value: '7' },
      { suit: 'H', value: '7' }, { suit: 'D', value: '7' }, { suit: 'C', value: '7' },
    ];
    const s = computeHandFeatures(hand).suits.S;
    expect(s.nbAtouts).toBe(5);
    expect(s.piece).toBe(false);   // no J♠, no 9♠
    expect(s.belote).toBe(false);  // K♠ but no Q♠
    expect(s.petitJeu).toBe(true);
  });
});

describe('handFeatures — input formats', () => {
  it('accepts card-strings ("JS","10H") identically to {suit,value}', () => {
    const strHand = ['JS', '9S', 'AS', 'KS', 'QS', 'AH', 'KH', '10H'];
    const f = computeHandFeatures(strHand);
    expect(f.suits.S.maitre).toBe(true);
    expect(f.suits.S.nbAtouts).toBe(5);
    expect(f.asTotaux).toBe(2);
  });
});

describe('handFeatures — renderFiche', () => {
  it('renders a factual block with the header and key facts for hand 1', () => {
    const out = renderFiche(hand1);
    expect(out).toMatch(/FICHE DE MAIN \(calculée, fiable\)/);
    expect(out).toMatch(/♠ comme atout/);
    expect(out).toMatch(/maître: OUI/);
    expect(out).toMatch(/points en main: 77/);
    // Factual only — no bid prescription leaks in. (The header's own
    // "aucune recommandation" is the disclaimer, not a prescription.)
    expect(out).not.toMatch(/tu dois|il faut|je recommande|annonce\s+\d/i);
  });
  it('returns empty string for an empty hand', () => {
    expect(renderFiche([])).toBe('');
  });
});

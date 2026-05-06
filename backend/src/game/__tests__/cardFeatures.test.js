// Unit tests for V2.2 Phase 2C cardFeatures — pattern detection over an
// arbitrary card subset selected by the user.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { computeFeatures, describePatterns, describeSelectedCards } = require('../cardFeatures.js');

const c = (value, suit) => ({ value, suit });

describe('computeFeatures — empty selection', () => {
  it('returns zero counts and no patterns', () => {
    const f = computeFeatures([], 'S');
    expect(f.selectedCount).toBe(0);
    expect(f.totalAces).toBe(0);
    expect(f.outsideAces).toBe(0);
    expect(f.patterns).toEqual([]);
    expect(f.countByRank.A).toBe(0);
    expect(f.bySuit.S.count).toBe(0);
  });

  it('handles null/undefined selectedCards', () => {
    expect(computeFeatures(null, 'S').selectedCount).toBe(0);
    expect(computeFeatures(undefined, 'S').selectedCount).toBe(0);
  });
});

describe('computeFeatures — maître à l\'atout', () => {
  it('detects maître on J + 9 + A in trump suit', () => {
    const f = computeFeatures([c('J', 'S'), c('9', 'S'), c('A', 'S')], 'S');
    expect(f.patterns).toContain('maitre');
    // maître subsumes pièce — we don't double-fire piece-* on the maître path
    expect(f.patterns).not.toContain('piece-3eme');
  });

  it('does not detect maître if A is missing', () => {
    const f = computeFeatures([c('J', 'S'), c('9', 'S')], 'S');
    expect(f.patterns).not.toContain('maitre');
    expect(f.patterns).toContain('piece-2nde');
  });

  it('does not detect maître if trump suit differs', () => {
    const f = computeFeatures([c('J', 'S'), c('9', 'S'), c('A', 'S')], 'H');
    expect(f.patterns).not.toContain('maitre');
  });
});

describe('computeFeatures — pièces (J + others in trump)', () => {
  it('piece-2nde: J + 1 other trump', () => {
    const f = computeFeatures([c('J', 'H'), c('K', 'H')], 'H');
    expect(f.patterns).toContain('piece-2nde');
  });

  it('piece-3eme: J + 2 other trumps', () => {
    const f = computeFeatures([c('J', 'H'), c('K', 'H'), c('Q', 'H')], 'H');
    expect(f.patterns).toContain('piece-3eme');
    // K+Q → also belote
    expect(f.patterns).toContain('belote');
  });

  it('piece-4eme: J + 3 other trumps', () => {
    const f = computeFeatures([c('J', 'H'), c('9', 'H'), c('K', 'H'), c('Q', 'H')], 'H');
    expect(f.patterns).toContain('piece-4eme');
    expect(f.patterns).toContain('belote');
  });

  it('neuf-d-atout: 9 of trump without J', () => {
    const f = computeFeatures([c('9', 'D'), c('K', 'D')], 'D');
    expect(f.patterns).toContain('neuf-d-atout');
    expect(f.patterns).not.toContain('piece-2nde');
  });
});

describe('computeFeatures — belote', () => {
  it('detects K + Q in trump as belote', () => {
    const f = computeFeatures([c('K', 'C'), c('Q', 'C')], 'C');
    expect(f.patterns).toContain('belote');
  });

  it('does NOT mark belote when K+Q are not in the trump suit', () => {
    const f = computeFeatures([c('K', 'C'), c('Q', 'C')], 'S');
    expect(f.patterns).not.toContain('belote');
  });
});

describe('computeFeatures — As extérieurs', () => {
  it('counts both Aces as outside when neither is trump', () => {
    const f = computeFeatures([c('A', 'S'), c('A', 'H')], 'D');
    expect(f.totalAces).toBe(2);
    expect(f.outsideAces).toBe(2);
  });

  it('subtracts the trump Ace from outsideAces', () => {
    const f = computeFeatures([c('A', 'S'), c('A', 'H')], 'S');
    expect(f.totalAces).toBe(2);
    expect(f.outsideAces).toBe(1);
  });

  it('treats every Ace as outside when no trumpSuit is provided', () => {
    const f = computeFeatures([c('A', 'S'), c('A', 'H')], null);
    expect(f.totalAces).toBe(2);
    expect(f.outsideAces).toBe(2);
  });
});

describe('computeFeatures — longues', () => {
  it('flags longue-S-4 on 4 spades non-trump', () => {
    const f = computeFeatures(
      [c('A', 'S'), c('K', 'S'), c('Q', 'S'), c('10', 'S')],
      'H',
    );
    expect(f.patterns).toContain('longue-S-4');
  });

  it('flags longue-H-5 on 5 hearts when hearts is trump', () => {
    // J+9+A → maître (subsumes pièce N-ème). longue-H-5 still fires.
    const f = computeFeatures(
      [c('J', 'H'), c('9', 'H'), c('A', 'H'), c('K', 'H'), c('Q', 'H')],
      'H',
    );
    expect(f.patterns).toContain('longue-H-5');
    expect(f.patterns).toContain('maitre'); // J+9+A
    expect(f.patterns).toContain('belote'); // K+Q
    expect(f.patterns).not.toContain('piece-longue'); // suppressed by maître
  });

  it('flags piece-longue on 5+ trumps with J but no maître (missing A)', () => {
    const f = computeFeatures(
      [c('J', 'H'), c('9', 'H'), c('K', 'H'), c('Q', 'H'), c('10', 'H')],
      'H',
    );
    expect(f.patterns).toContain('piece-longue');
    expect(f.patterns).not.toContain('maitre');
    expect(f.patterns).toContain('longue-H-5');
  });
});

describe('computeFeatures — bySuit + countByRank shape', () => {
  it('correctly groups cards by suit and rank', () => {
    const f = computeFeatures(
      [c('A', 'S'), c('K', 'S'), c('A', 'H'), c('J', 'D')],
      'D',
    );
    expect(f.bySuit.S.count).toBe(2);
    expect(f.bySuit.S.hasA).toBe(true);
    expect(f.bySuit.D.hasJ).toBe(true);
    expect(f.countByRank.A).toBe(2);
    expect(f.countByRank.K).toBe(1);
    expect(f.countByRank.J).toBe(1);
    expect(f.countByRank['10']).toBe(0);
    expect(f.selectedCount).toBe(4);
  });
});

describe('describePatterns — French rendering', () => {
  it('renders maître + As extérieur succinctly', () => {
    const f = computeFeatures([c('J', 'S'), c('9', 'S'), c('A', 'S'), c('A', 'H')], 'S');
    const text = describePatterns(f);
    expect(text).toMatch(/Maître à l'atout ♠/);
    expect(text).toMatch(/As extérieur/);
  });

  it('renders rule-silent (no trump) sensibly', () => {
    const f = computeFeatures([c('A', 'S'), c('A', 'H')], null);
    const text = describePatterns(f);
    expect(text).toMatch(/2 As au total/);
  });

  it('returns a placeholder for an empty selection', () => {
    expect(describePatterns(computeFeatures([], 'S'))).toMatch(/aucune/);
  });
});

describe('describeSelectedCards — French rendering', () => {
  it('lists cards grouped by suit', () => {
    const f = computeFeatures([c('J', 'S'), c('9', 'S'), c('A', 'H')], 'S');
    const text = describeSelectedCards(f);
    expect(text).toMatch(/♠: J, 9/);
    expect(text).toMatch(/♥: A/);
  });
});

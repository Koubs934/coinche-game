// Unit tests for the v3 divergence engine. Drives computeDivergenceType()
// and validateSubmission() against synthetic scenarios so the tests don't
// couple to the live scenario library.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { computeDivergenceType, validateSubmission } = require('../divergence.js');

function bidScenario(value, suit) {
  return { expectedAnswer: { action: { type: 'bid', value, suit }, ruleReference: 'fixture' } };
}
function passScenario() {
  return { expectedAnswer: { action: { type: 'pass' }, ruleReference: 'fixture' } };
}
function silentScenario() {
  return { expectedAnswer: null, ambiguityFlags: ['fixture'] };
}

describe('computeDivergenceType', () => {
  it('returns null for an exact bid match', () => {
    expect(computeDivergenceType(bidScenario(110, 'S'), { type: 'bid', value: 110, suit: 'S' })).toBeNull();
  });

  it('returns null for an exact pass match', () => {
    expect(computeDivergenceType(passScenario(), { type: 'pass' })).toBeNull();
  });

  it('returns "value-different" when value differs but suit matches', () => {
    expect(computeDivergenceType(bidScenario(110, 'S'), { type: 'bid', value: 100, suit: 'S' })).toBe('value-different');
  });

  it('returns "suit-different" when suit differs but value matches', () => {
    expect(computeDivergenceType(bidScenario(110, 'S'), { type: 'bid', value: 110, suit: 'H' })).toBe('suit-different');
  });

  it('returns "action-type-different" when types differ (bid vs pass)', () => {
    expect(computeDivergenceType(bidScenario(110, 'S'), { type: 'pass' })).toBe('action-type-different');
    expect(computeDivergenceType(passScenario(), { type: 'bid', value: 80, suit: 'D' })).toBe('action-type-different');
  });

  it('returns "rule-silent" when scenario.expectedAnswer is null', () => {
    expect(computeDivergenceType(silentScenario(), { type: 'bid', value: 90, suit: 'C' })).toBe('rule-silent');
  });

  it('returns "rule-silent" when expectedAnswer is missing entirely (v1 scenarios)', () => {
    expect(computeDivergenceType({}, { type: 'pass' })).toBe('rule-silent');
  });

  describe('free-color scenarios (expectedAnswer.action.suit === null)', () => {
    it('counts any user-chosen suit as a match when value agrees', () => {
      const s = bidScenario(90, null);
      expect(computeDivergenceType(s, { type: 'bid', value: 90, suit: 'S' })).toBeNull();
      expect(computeDivergenceType(s, { type: 'bid', value: 90, suit: 'H' })).toBeNull();
      expect(computeDivergenceType(s, { type: 'bid', value: 90, suit: 'D' })).toBeNull();
      expect(computeDivergenceType(s, { type: 'bid', value: 90, suit: 'C' })).toBeNull();
    });

    it('still flags value-different when value disagrees on a free-color scenario', () => {
      expect(computeDivergenceType(bidScenario(90, null), { type: 'bid', value: 80, suit: 'S' })).toBe('value-different');
    });
  });

  it('falls back to "value-different" when both value and suit differ', () => {
    // Two axes off at once: documented choice is to report value-different
    // since value drives the contract level.
    expect(computeDivergenceType(bidScenario(110, 'S'), { type: 'bid', value: 80, suit: 'D' })).toBe('value-different');
  });
});

// ─── V2.2 Phase 2C — server-canonical agreement ─────────────────────────
//
// The "D'accord / Pas d'accord" modal and the rule-silent obligatory-note
// modal are gone. validateSubmission no longer rejects — it always returns
// { ok: true } plus the divergenceType and the canonical agreement to
// persist. The 4 sentinel error codes (MISSING_REQUIRED_NOTE,
// MISSING_DIVERGENCE_AGREEMENT, INVALID_DIVERGENCE_AGREEMENT,
// UNEXPECTED_DIVERGENCE_AGREEMENT) are removed in this phase.

describe('validateSubmission — match path', () => {
  it('returns null agreement on a match', () => {
    const r = validateSubmission({
      scenario: bidScenario(110, 'S'),
      action:   { type: 'bid', value: 110, suit: 'S' },
    });
    expect(r).toEqual({ ok: true, divergenceType: null, agreement: null });
  });
});

describe('validateSubmission — divergent path', () => {
  const scenario = bidScenario(110, 'S');
  const action   = { type: 'bid', value: 100, suit: 'S' }; // value-different

  it('returns user-disagrees + correct divergenceType for a value-different bid', () => {
    const r = validateSubmission({ scenario, action });
    expect(r).toEqual({ ok: true, divergenceType: 'value-different', agreement: 'user-disagrees' });
  });

  it('returns user-disagrees for an action-type-different submission', () => {
    const r = validateSubmission({ scenario: passScenario(), action: { type: 'bid', value: 80, suit: 'D' } });
    expect(r.divergenceType).toBe('action-type-different');
    expect(r.agreement).toBe('user-disagrees');
  });
});

describe('validateSubmission — rule-silent path', () => {
  const scenario = silentScenario();
  const action   = { type: 'bid', value: 90, suit: 'C' };

  it('returns user-disagrees on a rule-silent submission (server-canonical)', () => {
    const r = validateSubmission({ scenario, action });
    expect(r).toEqual({ ok: true, divergenceType: 'rule-silent', agreement: 'user-disagrees' });
  });
});

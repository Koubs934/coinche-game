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

describe('validateSubmission — match path', () => {
  it('accepts a match with null agreement and empty note', () => {
    const r = validateSubmission({
      scenario: bidScenario(110, 'S'),
      action:   { type: 'bid', value: 110, suit: 'S' },
      divergenceAgreement: null,
      note: '',
    });
    expect(r).toEqual({ ok: true, divergenceType: null });
  });

  it('rejects a match if user provided a divergenceAgreement', () => {
    const r = validateSubmission({
      scenario: bidScenario(110, 'S'),
      action:   { type: 'bid', value: 110, suit: 'S' },
      divergenceAgreement: 'could-be-either',
      note: '',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('UNEXPECTED_DIVERGENCE_AGREEMENT');
  });
});

describe('validateSubmission — divergent path', () => {
  const scenario = bidScenario(110, 'S');
  const action   = { type: 'bid', value: 100, suit: 'S' }; // value-different

  it('rejects when divergenceAgreement is null on a divergent action', () => {
    const r = validateSubmission({ scenario, action, divergenceAgreement: null, note: 'x' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('MISSING_DIVERGENCE_AGREEMENT');
  });

  it('rejects when divergenceAgreement is not in the legal set', () => {
    const r = validateSubmission({ scenario, action, divergenceAgreement: 'maybe', note: 'x' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_DIVERGENCE_AGREEMENT');
  });

  it('rejects when note is empty (or whitespace-only)', () => {
    const r1 = validateSubmission({ scenario, action, divergenceAgreement: 'could-be-either', note: '' });
    const r2 = validateSubmission({ scenario, action, divergenceAgreement: 'user-disagrees',  note: '   ' });
    expect(r1.code).toBe('MISSING_REQUIRED_NOTE');
    expect(r2.code).toBe('MISSING_REQUIRED_NOTE');
  });

  it('accepts a divergent submission with valid agreement + non-empty note', () => {
    const r = validateSubmission({
      scenario, action, divergenceAgreement: 'user-disagrees', note: 'because…',
    });
    expect(r).toEqual({ ok: true, divergenceType: 'value-different' });
  });
});

describe('validateSubmission — rule-silent path', () => {
  const scenario = silentScenario();
  const action   = { type: 'bid', value: 90, suit: 'C' };

  it('rejects when divergenceAgreement is provided on a rule-silent case', () => {
    const r = validateSubmission({ scenario, action, divergenceAgreement: 'could-be-either', note: 'x' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('UNEXPECTED_DIVERGENCE_AGREEMENT');
  });

  it('rejects when note is empty on a rule-silent case', () => {
    const r = validateSubmission({ scenario, action, divergenceAgreement: null, note: '' });
    expect(r.code).toBe('MISSING_REQUIRED_NOTE');
  });

  it('accepts a rule-silent submission with null agreement + non-empty note', () => {
    const r = validateSubmission({
      scenario, action, divergenceAgreement: null, note: 'I tried 90♣ because…',
    });
    expect(r).toEqual({ ok: true, divergenceType: 'rule-silent' });
  });
});

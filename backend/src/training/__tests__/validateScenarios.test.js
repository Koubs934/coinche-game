// Unit tests for the scenario validator. Driven against synthetic scenario
// objects rather than disk fixtures — covers the v1 → v2 schema boundary
// and the optional expectedAnswer / ambiguityFlags fields without coupling
// to the live scenario library.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateScenario } = require('../validateScenarios.js');

// Build a minimal valid scenario shell. Caller mutates as needed before
// passing to validateScenario(). Hands cover all 32 cards exactly once;
// this helper is the source of truth for "passes the v1 deck-coverage
// check".
function baseScenario(overrides = {}) {
  const SUITS  = ['S', 'H', 'D', 'C'];
  const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const all = [];
  for (const s of SUITS) for (const v of VALUES) all.push({ suit: s, value: v });
  // Deal canonical-order: 8 cards per seat, 0..7, 8..15, 16..23, 24..31.
  const hands = {
    "0": all.slice(0, 8),
    "1": all.slice(8, 16),
    "2": all.slice(16, 24),
    "3": all.slice(24, 32),
  };
  return {
    schemaVersion: 1,
    id: 'fixture-scenario',
    title:       { fr: 'Fixture', en: 'Fixture' },
    description: { fr: 'Fixture', en: 'Fixture' },
    notes:       { fr: 'Fixture', en: 'Fixture' },
    userSeat: 0,
    dealer:   3,
    hands,
    timeline: [{ event: 'user-turn' }],
    ...overrides,
  };
}

describe('validateScenarios — v1 backward compat', () => {
  it('accepts a clean v1 scenario (no v2 fields)', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario());
    expect(errs).toEqual([]);
  });

  it('rejects v1 scenario with expectedAnswer field present', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      expectedAnswer: null,
    }));
    expect(errs).toContain('expectedAnswer requires schemaVersion 2');
  });

  it('rejects v1 scenario with ambiguityFlags field present', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      ambiguityFlags: [],
    }));
    expect(errs).toContain('ambiguityFlags requires schemaVersion 2');
  });

  it('rejects schemaVersion outside {1, 2}', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 3,
    }));
    expect(errs).toContain('schemaVersion must be 1 or 2');
  });
});

describe('validateScenarios — v2 expectedAnswer / ambiguityFlags', () => {
  it('accepts a v2 scenario with no v2 fields (treated as no expected answer)', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
    }));
    expect(errs).toEqual([]);
  });

  it('accepts a v2 scenario with a populated expectedAnswer (bid)', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'bid', value: 110, suit: 'S' },
        ruleReference: 'opening:110:maitre+1as_ext',
      },
      ambiguityFlags: [],
    }));
    expect(errs).toEqual([]);
  });

  it('accepts a v2 scenario with expectedAnswer.action.suit === null (couleur libre)', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'bid', value: 90, suit: null },
        ruleReference: 'tie-break-not-formalized',
      },
      ambiguityFlags: ['tie-break-not-formalized'],
    }));
    expect(errs).toEqual([]);
  });

  it('accepts a v2 scenario with expectedAnswer === null + ambiguityFlags', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: null,
      ambiguityFlags: ['competitive-bidding-not-formalized'],
    }));
    expect(errs).toEqual([]);
  });

  it('accepts a pass expectedAnswer (no value/suit needed)', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'pass' },
        ruleReference: 'opening:no-pattern-matches',
      },
      ambiguityFlags: [],
    }));
    expect(errs).toEqual([]);
  });

  it('rejects expectedAnswer with empty ruleReference', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'bid', value: 90, suit: 'H' },
        ruleReference: '',
      },
      ambiguityFlags: [],
    }));
    expect(errs).toContain('expectedAnswer.ruleReference must be a non-empty string');
  });

  it('rejects expectedAnswer missing ruleReference entirely', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action: { type: 'bid', value: 90, suit: 'H' },
      },
      ambiguityFlags: [],
    }));
    expect(errs).toContain('expectedAnswer.ruleReference must be a non-empty string');
  });

  it('rejects expectedAnswer with invalid action.type', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'play-card', card: { suit: 'S', value: 'A' } },
        ruleReference: 'should-not-allow-play-card',
      },
      ambiguityFlags: [],
    }));
    expect(errs.some(e => e.startsWith('expectedAnswer.action.type'))).toBe(true);
  });

  it('rejects expectedAnswer with bid value outside the legal range', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'bid', value: 75, suit: 'S' },
        ruleReference: 'whatever',
      },
      ambiguityFlags: [],
    }));
    expect(errs.some(e => e.startsWith('expectedAnswer.action.value invalid'))).toBe(true);
  });

  it('rejects expectedAnswer with invalid suit', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: {
        action:        { type: 'bid', value: 90, suit: 'X' },
        ruleReference: 'whatever',
      },
      ambiguityFlags: [],
    }));
    expect(errs.some(e => e.startsWith('expectedAnswer.action.suit'))).toBe(true);
  });

  it('rejects ambiguityFlags that is not an array', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: null,
      ambiguityFlags: 'tie-break-not-formalized',
    }));
    expect(errs).toContain('ambiguityFlags must be an array');
  });

  it('rejects ambiguityFlags entries that are not non-empty strings', () => {
    const errs = validateScenario('fixture-scenario.json', baseScenario({
      schemaVersion: 2,
      expectedAnswer: null,
      ambiguityFlags: ['valid-flag', '', 42],
    }));
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
});

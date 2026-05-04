// Unit tests for the scenario loader's client-bound sanitizer. Driven
// against synthetic scenario objects so the tests don't depend on the
// shifting contents of backend/src/training/scenarios/.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { pickClientScenarioFields, scenarioOrderKey, listScenarios } = require('../scenarioLoader.js');

function fixtureScenario(overrides = {}) {
  return {
    schemaVersion: 2,
    id: 'fixture-scenario',
    title:       { fr: 'Fixture', en: 'Fixture' },
    description: { fr: 'Fixture', en: 'Fixture' },
    notes:       { fr: 'Authoring notes — internal',           en: 'Authoring notes — internal' },
    userSeat: 0,
    dealer:   3,
    hands: {
      "0": [{ suit: 'S', value: 'J' }, { suit: 'S', value: '9' }],
      "1": [{ suit: 'H', value: 'A' }, { suit: 'H', value: 'K' }],
      "2": [{ suit: 'D', value: 'A' }, { suit: 'D', value: '10' }],
      "3": [{ suit: 'C', value: 'A' }, { suit: 'C', value: 'K' }],
    },
    initialState:  { phase: 'BIDDING' },
    timeline: [
      {
        event: 'bid', seat: 2, value: 80, suit: 'S',
        authorIntent: 'Information-80 — should NOT leak to client',
      },
      { event: 'pass', seat: 3, authorIntent: 'Weak hand' },
      { event: 'user-turn' },
    ],
    expectedAnswer: {
      action:        { type: 'bid', value: 110, suit: 'S' },
      ruleReference: 'opening:110:maitre+1as_ext',
    },
    ambiguityFlags: ['some-flag'],
    ...overrides,
  };
}

describe('pickClientScenarioFields — analysis-field stripping', () => {
  it('removes expectedAnswer and ambiguityFlags', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    expect(out).not.toHaveProperty('expectedAnswer');
    expect(out).not.toHaveProperty('ambiguityFlags');
  });

  it('removes the scenario notes (author-only)', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    expect(out).not.toHaveProperty('notes');
  });
});

describe('pickClientScenarioFields — hand filtering', () => {
  it("preserves the user's own hand at hands[userSeat]", () => {
    const s = fixtureScenario();
    const out = pickClientScenarioFields(s);
    expect(out.hands["0"]).toEqual(s.hands["0"]);
  });

  it("masks other seats' hands to same-length null arrays", () => {
    const out = pickClientScenarioFields(fixtureScenario());
    expect(out.hands["1"]).toEqual([null, null]);
    expect(out.hands["2"]).toEqual([null, null]);
    expect(out.hands["3"]).toEqual([null, null]);
  });

  it('honors a non-zero userSeat', () => {
    const s = fixtureScenario({ userSeat: 2 });
    const out = pickClientScenarioFields(s);
    expect(out.hands["2"]).toEqual(s.hands["2"]);
    expect(out.hands["0"]).toEqual([null, null]);
    expect(out.hands["1"]).toEqual([null, null]);
    expect(out.hands["3"]).toEqual([null, null]);
  });
});

describe('pickClientScenarioFields — timeline sanitization', () => {
  it('strips authorIntent from every timeline entry', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    for (const e of out.timeline) {
      expect(e).not.toHaveProperty('authorIntent');
    }
  });

  it('preserves event/seat/value/suit on bid entries', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    const bid = out.timeline.find(e => e.event === 'bid');
    expect(bid).toEqual({ event: 'bid', seat: 2, value: 80, suit: 'S' });
  });

  it('preserves user-turn entries verbatim (only authorIntent absent)', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    expect(out.timeline[out.timeline.length - 1]).toEqual({ event: 'user-turn' });
  });
});

describe('pickClientScenarioFields — picker fields preserved', () => {
  it('keeps id, title, description, userSeat, dealer, initialState', () => {
    const s = fixtureScenario();
    const out = pickClientScenarioFields(s);
    expect(out.id).toBe(s.id);
    expect(out.title).toEqual(s.title);
    expect(out.description).toEqual(s.description);
    expect(out.userSeat).toBe(s.userSeat);
    expect(out.dealer).toBe(s.dealer);
    expect(out.initialState).toEqual(s.initialState);
  });

  it('preserves schemaVersion (clients depend on it for cross-version compat)', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    expect(out.schemaVersion).toBe(2);
  });

  it('passes through optional playbackSpeed when present', () => {
    const out = pickClientScenarioFields(fixtureScenario({ playbackSpeed: 'instant' }));
    expect(out.playbackSpeed).toBe('instant');
  });

  it('omits playbackSpeed when not set on the source', () => {
    const out = pickClientScenarioFields(fixtureScenario());
    expect(out).not.toHaveProperty('playbackSpeed');
  });
});

describe('pickClientScenarioFields — defensive paths', () => {
  it('returns null for null input', () => {
    expect(pickClientScenarioFields(null)).toBeNull();
  });

  it('does not mutate the source object', () => {
    const s = fixtureScenario();
    const before = JSON.parse(JSON.stringify(s));
    pickClientScenarioFields(s);
    expect(s).toEqual(before);
  });
});

describe('scenarioOrderKey — deterministic picker shuffle', () => {
  it('is stable across runs for the same id', () => {
    const k1 = scenarioOrderKey('opening-01-foo');
    const k2 = scenarioOrderKey('opening-01-foo');
    expect(k1).toBe(k2);
  });

  it('is different for different ids', () => {
    expect(scenarioOrderKey('opening-01-foo'))
      .not.toBe(scenarioOrderKey('opening-02-bar'));
  });

  it('produces an 8-char hex slice', () => {
    expect(scenarioOrderKey('whatever')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('listScenarios returns the same order on repeated calls', () => {
    const a = listScenarios().map(s => s.id);
    const b = listScenarios().map(s => s.id);
    expect(a).toEqual(b);
  });

  it('listScenarios interleaves categories (not all opening-* first)', () => {
    const ids = listScenarios().map(s => s.id);
    if (ids.length < 30) return; // skip on tiny scenario sets
    // The first 20 scenarios should NOT all share a category prefix —
    // alphabetical would give 20 'opening-*' or 'partner-*' first; the
    // shuffle should mix categories within the head of the list.
    const firstPrefixes = new Set(ids.slice(0, 20).map(id => id.split('-')[0]));
    expect(firstPrefixes.size).toBeGreaterThan(1);
  });
});

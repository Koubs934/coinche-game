// Unit tests for the avatar config seam (pure helpers — no DiceBear/React).
import { describe, it, expect } from 'vitest';
import {
  OPTIONS, FEATURE_KEYS, DEFAULT_AVATAR,
  normalizeAvatarConfig, cycleFeature, randomAvatarConfig, toDiceBearOptions,
} from './avatar.js';

describe('normalizeAvatarConfig', () => {
  it('returns null for null / non-object (→ letter-circle fallback)', () => {
    expect(normalizeAvatarConfig(null)).toBeNull();
    expect(normalizeAvatarConfig(undefined)).toBeNull();
    expect(normalizeAvatarConfig('nope')).toBeNull();
    expect(normalizeAvatarConfig(42)).toBeNull();
  });

  it('clamps unknown field values to defaults and drops unknown keys', () => {
    const out = normalizeAvatarConfig({ top: 'NOT_A_STYLE', eyes: 'happy', bogus: 'x' });
    expect(out.top).toBe(DEFAULT_AVATAR.top);   // unknown value → default
    expect(out.eyes).toBe('happy');             // valid value preserved
    expect('bogus' in out).toBe(false);         // unknown key dropped
    // every feature key present + valid
    for (const k of FEATURE_KEYS) expect(OPTIONS[k]).toContain(out[k]);
  });

  it('a {} config normalizes to all-defaults (renders the default avatar, not garbage)', () => {
    expect(normalizeAvatarConfig({})).toEqual(DEFAULT_AVATAR);
  });
});

describe('cycleFeature', () => {
  it('wraps forward and backward through the option list', () => {
    const base = { ...DEFAULT_AVATAR, eyes: OPTIONS.eyes[OPTIONS.eyes.length - 1] };
    expect(cycleFeature(base, 'eyes', 1).eyes).toBe(OPTIONS.eyes[0]);          // wrap to start
    expect(cycleFeature({ ...DEFAULT_AVATAR, eyes: OPTIONS.eyes[0] }, 'eyes', -1).eyes)
      .toBe(OPTIONS.eyes[OPTIONS.eyes.length - 1]);                            // wrap to end
  });
});

describe('randomAvatarConfig', () => {
  it('produces a valid config for every feature (deterministic with injected rand)', () => {
    const cfg = randomAvatarConfig(() => 0); // always first option
    for (const k of FEATURE_KEYS) expect(cfg[k]).toBe(OPTIONS[k][0]);
    // and a real-ish random stays valid
    let i = 0; const cfg2 = randomAvatarConfig(() => ((i++ * 0.37) % 1));
    expect(normalizeAvatarConfig(cfg2)).toEqual(cfg2);
  });
});

describe('toDiceBearOptions', () => {
  it('emits single-value arrays + topProbability so output is deterministic', () => {
    const o = toDiceBearOptions({ ...DEFAULT_AVATAR, top: 'fro', skinColor: 'edb98a' });
    expect(o.top).toEqual(['fro']);
    expect(o.skinColor).toEqual(['edb98a']);
    expect(o.topProbability).toBe(100);
  });

  it('switches accessories/facial-hair probability OFF for the "none" sentinel', () => {
    const o = toDiceBearOptions({ ...DEFAULT_AVATAR, accessories: 'none', facialHair: 'none' });
    expect(o.accessoriesProbability).toBe(0);
    expect(o.facialHairProbability).toBe(0);
    expect(o.accessories).toBeUndefined();
    expect(o.facialHair).toBeUndefined();
  });

  it('switches them ON (with value) when a real option is chosen', () => {
    const o = toDiceBearOptions({ ...DEFAULT_AVATAR, accessories: 'round', facialHair: 'beardLight', hairColor: '2c1b18' });
    expect(o.accessories).toEqual(['round']);
    expect(o.accessoriesProbability).toBe(100);
    expect(o.facialHair).toEqual(['beardLight']);
    expect(o.facialHairProbability).toBe(100);
    expect(o.facialHairColor).toEqual(['2c1b18']); // beard inherits hair color
  });

  it('falls back to defaults for an invalid/null config (never throws)', () => {
    expect(() => toDiceBearOptions(null)).not.toThrow();
    expect(toDiceBearOptions(null).top).toEqual([DEFAULT_AVATAR.top]);
  });
});

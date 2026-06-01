// Unit tests for the avatar config seam (pure helpers — no react-peeps/React).
import { describe, it, expect } from 'vitest';
import {
  OPTIONS, FEATURE_KEYS, DEFAULT_AVATAR,
  normalizeAvatarConfig, cycleFeature, randomAvatarConfig, toPeepProps, botAvatarConfig,
} from './avatar.js';

// An old avataaars blob — incompatible with Open Peeps; must read as "no avatar".
const LEGACY_AVATAAARS = {
  skinColor: 'edb98a', top: 'shortFlat', hairColor: '4a312c',
  eyes: 'happy', mouth: 'smile', clothing: 'hoodie', accessories: 'round',
};

describe('normalizeAvatarConfig', () => {
  it('returns null for null / non-object (→ letter-circle fallback)', () => {
    expect(normalizeAvatarConfig(null)).toBeNull();
    expect(normalizeAvatarConfig(undefined)).toBeNull();
    expect(normalizeAvatarConfig('nope')).toBeNull();
    expect(normalizeAvatarConfig(42)).toBeNull();
  });

  it('returns null for an old avataaars config (incompatible → fallback, no crash)', () => {
    expect(normalizeAvatarConfig(LEGACY_AVATAAARS)).toBeNull();
  });

  it('returns null for {} and for a config missing a valid body/hair/face', () => {
    expect(normalizeAvatarConfig({})).toBeNull();
    expect(normalizeAvatarConfig({ ...DEFAULT_AVATAR, hair: 'NOT_A_HAIR' })).toBeNull();
    expect(normalizeAvatarConfig({ ...DEFAULT_AVATAR, body: 'NOPE' })).toBeNull();
  });

  it('clamps invalid optional fields to defaults once the identity triad is valid', () => {
    const out = normalizeAvatarConfig({
      body: 'ShirtBW', hair: 'Afro', face: 'Smile',
      facialHair: 'NOPE', accessory: 'NOPE', strokeColor: 'NOPE', backgroundColor: 'NOPE',
      bogus: 'x',
    });
    expect(out.hair).toBe('Afro');                               // valid value preserved
    expect(out.facialHair).toBe(DEFAULT_AVATAR.facialHair);      // invalid → default
    expect(out.accessory).toBe(DEFAULT_AVATAR.accessory);
    expect(out.strokeColor).toBe(DEFAULT_AVATAR.strokeColor);
    expect('bogus' in out).toBe(false);                          // unknown key dropped
    for (const k of FEATURE_KEYS) expect(OPTIONS[k]).toContain(out[k]);
  });

  it('a fully-valid config round-trips unchanged', () => {
    expect(normalizeAvatarConfig(DEFAULT_AVATAR)).toEqual(DEFAULT_AVATAR);
  });
});

describe('cycleFeature', () => {
  it('wraps forward and backward through the option list', () => {
    const last = OPTIONS.face[OPTIONS.face.length - 1];
    expect(cycleFeature({ ...DEFAULT_AVATAR, face: last }, 'face', 1).face).toBe(OPTIONS.face[0]);
    expect(cycleFeature({ ...DEFAULT_AVATAR, face: OPTIONS.face[0] }, 'face', -1).face).toBe(last);
  });
});

describe('randomAvatarConfig', () => {
  it('produces a valid config for every feature (deterministic with injected rand)', () => {
    const cfg = randomAvatarConfig(() => 0); // always first option
    for (const k of FEATURE_KEYS) expect(cfg[k]).toBe(OPTIONS[k][0]);
    // and a real-ish random stays valid (normalize keeps it intact)
    let i = 0;
    const cfg2 = randomAvatarConfig(() => ((i++ * 0.37) % 1));
    expect(normalizeAvatarConfig(cfg2)).toEqual(cfg2);
  });
});

describe('toPeepProps', () => {
  it('maps a config straight to react-peeps props (None passes through as a sentinel)', () => {
    const o = toPeepProps({ ...DEFAULT_AVATAR, hair: 'Afro', facialHair: 'None', accessory: 'None' });
    expect(o.hair).toBe('Afro');
    expect(o.facialHair).toBe('None');
    expect(o.accessory).toBe('None');
    expect(o.body).toBe(DEFAULT_AVATAR.body);
  });

  it('falls back to defaults for an invalid/null config (never throws)', () => {
    expect(() => toPeepProps(null)).not.toThrow();
    expect(toPeepProps(LEGACY_AVATAAARS).hair).toBe(DEFAULT_AVATAR.hair);
  });
});

describe('botAvatarConfig', () => {
  it('is deterministic for a given seed and always a valid config', () => {
    const a = botAvatarConfig('faispaschier');
    const b = botAvatarConfig('faispaschier');
    expect(a).toEqual(b);
    expect(normalizeAvatarConfig(a)).toEqual(a); // valid Open Peeps config
  });

  it('produces visibly different figures for different seeds', () => {
    const seeds = ['Bot 1', 'Bot 2', 'Bot 3', 'AK7', 'Pacha'];
    const sigs = new Set(seeds.map(s => JSON.stringify(botAvatarConfig(s))));
    expect(sigs.size).toBeGreaterThan(1); // not all identical
  });
});

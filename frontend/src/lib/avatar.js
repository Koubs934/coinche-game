// Avatar config — pure helpers around the DiceBear "avataaars" style.
//
// Style: avataaars (DiceBear collection). License: CC BY 4.0 — free for personal
// and commercial use with attribution (original "Avataaars" by Pablo Stanley).
// We render deterministically from a stored options object (no network, no image
// files); the options live in profiles.avatar_config (jsonb, nullable).
//
// This module is intentionally framework-free (no React, no DiceBear import) so
// the config shape / serialization is unit-testable on its own. Avatar.jsx does
// the actual SVG rendering via @dicebear/core.

// ── Builder option sets (the values a user can cycle through) ────────────────
// Curated subsets — kept clean (no hats-as-hair clutter beyond a few coverings).
export const OPTIONS = {
  // Hair / head styles (avataaars "top"). A few head coverings included.
  top: [
    'shortFlat', 'shortCurly', 'shortWaved', 'shortRound', 'theCaesar', 'sides',
    'dreads01', 'fro', 'froBand', 'shaggy', 'frizzle',
    'bob', 'bun', 'curly', 'curvy', 'longButNotTooLong', 'straight01', 'straight02',
    'miaWallace', 'bigHair',
    'hat', 'turban', 'hijab', 'winterHat1',
  ],
  // Color fields take a hex string (no '#'); avataaars has no enum for these.
  hairColor: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'c93305', 'd6b370', 'ecdcbf', 'e8e1e1', 'f59797'],
  skinColor: ['ffdbb4', 'edb98a', 'fd9841', 'd08b5b', 'ae5d29', '614335'],
  eyes:  ['default', 'happy', 'wink', 'squint', 'surprised', 'side', 'closed', 'hearts', 'winkWacky', 'eyeRoll', 'cry'],
  mouth: ['default', 'smile', 'twinkle', 'serious', 'eating', 'grimace', 'tongue', 'disbelief', 'concerned', 'sad'],
  clothing: ['shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck', 'hoodie', 'collarAndSweater', 'blazerAndShirt', 'blazerAndSweater', 'graphicShirt', 'overall'],
  clothesColor: ['262e33', '3c4f5c', '5199e4', '25557c', '929598', 'a7ffc4', 'b1e2ff', 'ff488e', 'ff5c5c', 'ffafb9', 'ffffff'],
  // 'none' is a synthetic sentinel meaning "no accessory / no facial hair".
  accessories: ['none', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers', 'kurt', 'eyepatch'],
  facialHair:  ['none', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'],
};

// The fields the builder edits, in display order. Each maps to OPTIONS above.
export const FEATURE_KEYS = ['skinColor', 'top', 'hairColor', 'eyes', 'mouth', 'clothing', 'clothesColor', 'accessories', 'facialHair'];

export const DEFAULT_AVATAR = {
  skinColor:    'edb98a',
  top:          'shortFlat',
  hairColor:    '4a312c',
  eyes:         'default',
  mouth:        'smile',
  clothing:     'shirtCrewNeck',
  clothesColor: '5199e4',
  accessories:  'none',
  facialHair:   'none',
};

// Clamp an arbitrary stored/received object to a valid config (every field a
// known value, unknown keys dropped). Returns a fresh object; never throws.
// `null`/non-object → null (the caller renders the letter-circle fallback).
export function normalizeAvatarConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  const out = {};
  for (const key of FEATURE_KEYS) {
    const allowed = OPTIONS[key];
    out[key] = allowed.includes(cfg[key]) ? cfg[key] : DEFAULT_AVATAR[key];
  }
  return out;
}

// Step a single feature forward/backward through its option list (cycle UI).
export function cycleFeature(cfg, key, dir = 1) {
  const list = OPTIONS[key];
  const cur = list.indexOf(cfg[key]);
  const next = (((cur === -1 ? 0 : cur) + dir) % list.length + list.length) % list.length;
  return { ...cfg, [key]: list[next] };
}

// A random valid config. `rand` is injectable for deterministic tests.
export function randomAvatarConfig(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const cfg = {};
  for (const key of FEATURE_KEYS) cfg[key] = pick(OPTIONS[key]);
  return cfg;
}

// Convert a stored config into the option object DiceBear's avataaars expects.
// Single-value arrays + explicit probabilities make the result deterministic
// regardless of seed. 'none' sentinels switch the corresponding probability off.
export function toDiceBearOptions(cfg) {
  const c = normalizeAvatarConfig(cfg) || DEFAULT_AVATAR;
  const o = {
    seed: 'coinche', // options fully determine output; seed only breaks ties
    skinColor:    [c.skinColor],
    top:          [c.top],
    hairColor:    [c.hairColor],
    eyes:         [c.eyes],
    mouth:        [c.mouth],
    clothing:     [c.clothing],
    clothesColor: [c.clothesColor],
    topProbability: 100,
  };
  if (c.accessories && c.accessories !== 'none') {
    o.accessories = [c.accessories];
    o.accessoriesProbability = 100;
  } else {
    o.accessoriesProbability = 0;
  }
  if (c.facialHair && c.facialHair !== 'none') {
    o.facialHair = [c.facialHair];
    o.facialHairColor = [c.hairColor];
    o.facialHairProbability = 100;
  } else {
    o.facialHairProbability = 0;
  }
  return o;
}

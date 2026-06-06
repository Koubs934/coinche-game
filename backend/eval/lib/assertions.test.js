// Locks the accent-safe boundary matching for the eval's FORBID layer.
//
// Regression guard for the bug where JS `\b` (ASCII-only) silently failed to
// bound accented edges, so `/\bça tient\b/` never matched "Ça tient" and the
// FORBID check returned a false negative (the judge had to backstop it). The
// `bounded()` helper uses Unicode-aware lookarounds; these tests ensure every
// boundary-bearing banned phrase matches regardless of accents and casing, and
// that boundaries still prevent matching inside a larger word.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BANNED, runDeterministic } = require('./assertions.js');

describe('accent-safe banned-phrase boundaries (P4 "ça tient")', () => {
  it('matches an accented start ("Ça tient") — the original bug', () => {
    expect(BANNED.P4.re.test('Ça tient.')).toBe(true);
  });
  it('matches mid-sentence and case-insensitively', () => {
    expect(BANNED.P4.re.test('Donc ça tient, non ?')).toBe(true);
    expect(BANNED.P4.re.test('ÇA TIENT')).toBe(true);
  });
  it('respects the right boundary (no match inside a larger word)', () => {
    expect(BANNED.P4.re.test('ça tientx')).toBe(false);
  });
  it('does not match unrelated text', () => {
    expect(BANNED.P4.re.test('raconte-moi ta logique')).toBe(false);
    expect(BANNED.P4.re.test('le raisonnement se maintient')).toBe(false);
  });
});

describe('P1 "intéressant" still catches the feminine form (no over-tight boundary)', () => {
  it('matches "Intéressant" and "intéressante"', () => {
    expect(BANNED.P1.re.test('Intéressant')).toBe(true);
    expect(BANNED.P1.re.test('une intuition intéressante')).toBe(true);
  });
});

describe('P11 "N atouts maître" (accented "maître", optional plural)', () => {
  it('matches singular and plural', () => {
    expect(BANNED.P11.re.test('tu as 5 atouts maître')).toBe(true);
    expect(BANNED.P11.re.test('5 atouts maîtres incluant la pièce')).toBe(true);
  });
  it('does not match a non-numbered phrase', () => {
    expect(BANNED.P11.re.test('maître à l\'atout')).toBe(false);
  });
});

describe('runDeterministic catches accented banned phrases (FORBID layer)', () => {
  it('flags "Ça tient" as a blocking failure for an over-validation case', () => {
    const r = runDeterministic('Ça tient. Donc voilà ton plan complet pour ce coup-ci.', { bannedPhrases: ['P4'] }, null);
    const p4 = r.checks.find(c => c.name === 'G2-P4');
    expect(p4.pass).toBe(false);
    expect(p4.blocking).toBe(true);
  });
  it('flags an echoed player name (G3, accent-safe boundary)', () => {
    const bad = runDeterministic('comme Sacha le fait toujours sur cette main', {}, null);
    expect(bad.checks.find(c => c.name === 'G3-no-player-name').pass).toBe(false);
    const ok = runDeterministic('peu importe avec qui — explique-moi ta logique', {}, null);
    expect(ok.checks.find(c => c.name === 'G3-no-player-name').pass).toBe(true);
  });
});

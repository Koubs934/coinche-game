// Unit tests for the v2 tag-submission validator.
// Drives validateReasonSubmission directly against the live reasonTags.json.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateReasonSubmission } = require('../tagValidator.js');

describe('tagValidator — v2 rules', () => {
  describe('Group-4 (bidding-action) exactly-one requirement', () => {
    it('rejects a bid decision with zero Group-4 tags', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['valet-troisième', 'as-extérieur-1'], // hand tags only, no action tag
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('GROUP-REQUIRED-MISSING');
      expect(r.details?.group).toBe('bidding-action');
    });

    it('rejects a bid decision with two Group-4 tags', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'monter', 'valet-troisième'],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('GROUP-REQUIRED-MULTIPLE');
      expect(r.details?.selected).toEqual(expect.arrayContaining(['ouverture', 'monter']));
    });

    it('rejects a pass with passer-faible AND passer-stratégique (mutually exclusive)', () => {
      const r = validateReasonSubmission({
        actionType: 'pass',
        tags: ['passer-faible', 'passer-stratégique'],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('GROUP-REQUIRED-MULTIPLE');
    });

    it('accepts a bid with exactly one Group-4 tag and valid other tags', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'valet-troisième', 'as-extérieur-1', 'premier-à-parler'],
        note: '',
      });
      expect(r.ok).toBe(true);
      expect(r.tags).toEqual(
        expect.arrayContaining(['ouverture', 'valet-troisième', 'as-extérieur-1', 'premier-à-parler']),
      );
    });

    it('accepts a coinche with only `coincher` as the Group-4 tag', () => {
      const r = validateReasonSubmission({
        actionType: 'coinche',
        tags: ['coincher'],
        note: '',
      });
      expect(r.ok).toBe(true);
    });

    it('accepts a surcoinche with only `surcoincher`', () => {
      const r = validateReasonSubmission({
        actionType: 'surcoinche',
        tags: ['surcoincher'],
        note: '',
      });
      expect(r.ok).toBe(true);
    });
  });

  describe('tag-level `requiresNote`', () => {
    it('rejects `autre` with an empty note', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'autre'],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('TAG-REQUIRES-NOTE');
    });

    it('rejects `autre` with a whitespace-only note', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'autre'],
        note: '   \t  ',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('TAG-REQUIRES-NOTE');
    });

    it('accepts `autre` with a real note', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'autre'],
        note: 'Something the vocabulary does not yet express',
      });
      expect(r.ok).toBe(true);
    });
  });

  describe('Group-1 (trump-hand) recommendation', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(()  => { warnSpy.mockRestore(); });

    it('accepts but warns when zero trump-hand tags are present on a bid', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'premier-à-parler'], // Group 4 satisfied, no Group 1
        note: '',
      });
      expect(r.ok).toBe(true);
      expect(r.warnings).toBeDefined();
      expect(r.warnings[0]).toMatch(/trump-hand/);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('does not warn when a trump-hand tag is present', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'valet-troisième'],
        note: '',
      });
      expect(r.ok).toBe(true);
      expect(r.warnings).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('unknown tags and malformed input', () => {
    it('rejects a tag that does not exist for the action', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture', 'totally-made-up-tag'],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('UNKNOWN-TAG');
    });

    it('rejects v1 tags under v2 action (e.g. maitre-claim on bid)', () => {
      // `maitre-claim` was a v1 bid tag, replaced by `maitre` (trump-hand) +
      // the relevant Group-4 action tag. It should no longer validate.
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['maitre-claim'],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('UNKNOWN-TAG');
    });

    it('rejects unknown action type', () => {
      const r = validateReasonSubmission({
        actionType: 'fly-to-moon',
        tags: [],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('UNKNOWN-ACTION-TYPE');
    });

    it('rejects tags as non-array', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: 'ouverture',
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('TAGS-NOT-ARRAY');
    });

    it('rejects note as non-string', () => {
      const r = validateReasonSubmission({
        actionType: 'bid',
        tags: ['ouverture'],
        note: null,
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('NOTE-NOT-STRING');
    });
  });

  describe('play-card (legacy v1 action) — rules that do not apply', () => {
    it('allows play-card submission with no Group-4 tag (action has no bidding-action tags)', () => {
      const r = validateReasonSubmission({
        actionType: 'play-card',
        tags: ['drawing-trump'],
        note: '',
      });
      expect(r.ok).toBe(true);
    });

    it('rejects play-card with zero tags AND empty note (legacy EMPTY-SUBMISSION rule)', () => {
      const r = validateReasonSubmission({
        actionType: 'play-card',
        tags: [],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('EMPTY-SUBMISSION');
    });

    it('preserves v1 `other` requires-note behavior on play-card', () => {
      // Preserved by marking the play-card `other` tag with `requiresNote: true`
      // in reasonTags.json during the v2 migration — hardcoded-key rule became
      // a declarative flag, behavior unchanged.
      const r = validateReasonSubmission({
        actionType: 'play-card',
        tags: ['other'],
        note: '',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('TAG-REQUIRES-NOTE');
    });
  });
});

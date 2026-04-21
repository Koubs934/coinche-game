// Server-side validation of reason-submission payloads against reasonTags.json.
//
// v2 rules (driven by reasonTags.json flags, not hardcoded keys):
//   - All `tags[]` entries must exist under actions.<actionType>.tags in JSON
//   - If any selected tag has `requiresNote: true`, `note.trim()` must be non-empty
//   - For each group flagged `requireExactlyOne: true` that the action uses,
//     the submission must contain exactly one tag from that group
//   - If `tags.length === 0` AND `note.trim() === ""` AND the action has no
//     required-exactly-one groups (e.g. play-card), reject — pure noise
//   - Duplicate tag keys are collapsed (not an error)
//
// Soft-warn (does not block submission, surfaced as `warnings` in the result):
//   - For each group flagged `recommendAtLeastOne: true` that the action uses,
//     log a warning when the submission has zero tags from that group

const tagsJson = require('./reasonTags.json');

// Precompute per-action indexes once at module load — reasonTags.json is
// immutable at runtime.
const ACTION_INDEX = {};
for (const [action, spec] of Object.entries(tagsJson.actions)) {
  const byKey   = new Map();
  const byGroup = {};
  for (const t of spec.tags) {
    byKey.set(t.key, t);
    (byGroup[t.group] = byGroup[t.group] || []).push(t.key);
  }
  ACTION_INDEX[action] = { byKey, byGroup };
}

const REQUIRE_EXACTLY_ONE_GROUPS = new Set(
  Object.entries(tagsJson.groups)
    .filter(([, meta]) => meta.requireExactlyOne)
    .map(([key]) => key),
);
const RECOMMEND_AT_LEAST_ONE_GROUPS = new Set(
  Object.entries(tagsJson.groups)
    .filter(([, meta]) => meta.recommendAtLeastOne)
    .map(([key]) => key),
);

function getAllTags() {
  return tagsJson;
}

function getTagsForAction(action) {
  return tagsJson.actions[action] || null;
}

function isValidTagForAction(action, key) {
  const idx = ACTION_INDEX[action];
  return !!idx && idx.byKey.has(key);
}

/**
 * @param {object} submission
 * @param {'bid'|'pass'|'coinche'|'surcoinche'|'play-card'} submission.actionType
 * @param {string[]} submission.tags
 * @param {string}   submission.note
 * @returns {{ok:true, tags:string[], warnings?:string[]}
 *         | {ok:false, code:string, message:string, details?:object}}
 *          On success, `tags` is the deduplicated set.
 */
function validateReasonSubmission({ actionType, tags, note }) {
  const idx = ACTION_INDEX[actionType];
  if (!idx) {
    return { ok: false, code: 'UNKNOWN-ACTION-TYPE', message: `unknown action type: ${actionType}` };
  }
  if (!Array.isArray(tags)) {
    return { ok: false, code: 'TAGS-NOT-ARRAY', message: 'tags must be an array of strings' };
  }
  if (typeof note !== 'string') {
    return { ok: false, code: 'NOTE-NOT-STRING', message: 'note must be a string (empty string is allowed)' };
  }

  const unique  = [...new Set(tags)];
  const unknown = unique.filter(k => !idx.byKey.has(k));
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 'UNKNOWN-TAG',
      message: `unknown tag(s) for action ${actionType}: ${unknown.join(', ')}`,
      details: { unknown },
    };
  }

  const trimmedNote = note.trim();

  // Tag-level: any `requiresNote: true` tag demands a non-empty note.
  const tagsRequiringNote = unique.filter(k => idx.byKey.get(k).requiresNote);
  if (tagsRequiringNote.length > 0 && trimmedNote === '') {
    return {
      ok: false,
      code: 'TAG-REQUIRES-NOTE',
      message: `tag(s) require a non-empty note: ${tagsRequiringNote.join(', ')}`,
      details: { tagsRequiringNote },
    };
  }

  // Group-level: exactly-one enforcement.
  // Only applies when the action actually has tags in the required group
  // (e.g. play-card has no bidding-action tags, so the rule is inert there).
  for (const groupKey of REQUIRE_EXACTLY_ONE_GROUPS) {
    const groupTagKeys = idx.byGroup[groupKey];
    if (!groupTagKeys || groupTagKeys.length === 0) continue;
    const selectedFromGroup = unique.filter(k => idx.byKey.get(k).group === groupKey);
    if (selectedFromGroup.length === 0) {
      return {
        ok: false,
        code: 'GROUP-REQUIRED-MISSING',
        message: `exactly one tag from group "${groupKey}" is required for ${actionType}`,
        details: { group: groupKey },
      };
    }
    if (selectedFromGroup.length > 1) {
      return {
        ok: false,
        code: 'GROUP-REQUIRED-MULTIPLE',
        message: `exactly one tag from group "${groupKey}" is required for ${actionType}, got ${selectedFromGroup.length}: ${selectedFromGroup.join(', ')}`,
        details: { group: groupKey, selected: selectedFromGroup },
      };
    }
  }

  // Fallback noise check — only fires for actions without a required group
  // (e.g. play-card). Actions with required groups already rejected above.
  const hasAnyRequiredGroup = [...REQUIRE_EXACTLY_ONE_GROUPS].some(g => (idx.byGroup[g] || []).length > 0);
  if (!hasAnyRequiredGroup && unique.length === 0 && trimmedNote === '') {
    return { ok: false, code: 'EMPTY-SUBMISSION', message: 'must provide at least one tag or a non-empty note' };
  }

  // Soft warnings — recommend-at-least-one groups.
  const warnings = [];
  for (const groupKey of RECOMMEND_AT_LEAST_ONE_GROUPS) {
    const groupTagKeys = idx.byGroup[groupKey];
    if (!groupTagKeys || groupTagKeys.length === 0) continue;
    const selectedFromGroup = unique.filter(k => idx.byKey.get(k).group === groupKey);
    if (selectedFromGroup.length === 0) {
      const msg = `Layer 1 tag missing — no tag from recommended group "${groupKey}" for ${actionType}. Hand features not captured for this decision.`;
      warnings.push(msg);
      console.warn(`[tagValidator] ${msg}`);
    }
  }

  const result = { ok: true, tags: unique };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

module.exports = {
  getAllTags,
  getTagsForAction,
  isValidTagForAction,
  validateReasonSubmission,
};

// Server-side validation of reason-submission payloads against reasonTags.json.
//
// Enforcement rules (documented in reasonTags.json's _comment; enforced here):
//   - All `tags[]` keys must exist under actions.<actionType>.tags in the JSON
//   - If `tags` contains "other", `note.trim()` must be non-empty
//   - If `tags.length === 0` AND `note.trim() === ""`, reject — pure noise
//   - Duplicate tag keys are collapsed to the set of unique keys (not an error)

const tagsJson = require('./reasonTags.json');

// Cache the per-action key set once at module load — reasonTags.json is
// immutable at runtime.
const ACTION_KEYSETS = Object.fromEntries(
  Object.entries(tagsJson.actions).map(([action, spec]) => [
    action,
    new Set(spec.tags.map(t => t.key)),
  ])
);

function getAllTags() {
  return tagsJson;
}

function getTagsForAction(action) {
  return tagsJson.actions[action] || null;
}

function isValidTagForAction(action, key) {
  const ks = ACTION_KEYSETS[action];
  return !!ks && ks.has(key);
}

/**
 * @param {object} submission
 * @param {'bid'|'pass'|'coinche'|'surcoinche'|'play-card'} submission.actionType
 * @param {string[]} submission.tags
 * @param {string}   submission.note
 * @returns {{ok:true, tags:string[]} | {ok:false, code:string, message:string, details?:object}}
 *          On success, `tags` is the deduplicated set.
 */
function validateReasonSubmission({ actionType, tags, note }) {
  if (!ACTION_KEYSETS[actionType]) {
    return { ok: false, code: 'UNKNOWN-ACTION-TYPE', message: `unknown action type: ${actionType}` };
  }
  if (!Array.isArray(tags)) {
    return { ok: false, code: 'TAGS-NOT-ARRAY', message: 'tags must be an array of strings' };
  }
  if (typeof note !== 'string') {
    return { ok: false, code: 'NOTE-NOT-STRING', message: 'note must be a string (empty string is allowed)' };
  }

  const unique = [...new Set(tags)];
  const unknown = unique.filter(k => !ACTION_KEYSETS[actionType].has(k));
  if (unknown.length > 0) {
    return { ok: false, code: 'UNKNOWN-TAG', message: `unknown tag(s) for action ${actionType}: ${unknown.join(', ')}`, details: { unknown } };
  }

  const trimmedNote = note.trim();

  if (unique.includes('other') && trimmedNote === '') {
    return { ok: false, code: 'OTHER-REQUIRES-NOTE', message: '`other` tag requires a non-empty note' };
  }

  if (unique.length === 0 && trimmedNote === '') {
    return { ok: false, code: 'EMPTY-SUBMISSION', message: 'must provide at least one tag or a non-empty note' };
  }

  return { ok: true, tags: unique };
}

module.exports = {
  getAllTags,
  getTagsForAction,
  isValidTagForAction,
  validateReasonSubmission,
};

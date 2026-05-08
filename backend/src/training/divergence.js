// Server-authoritative divergence computation.
//
// Compares a user-submitted action to the scenario's `expectedAnswer` and
// returns the divergenceType the v3 annotation flow records. The frontend
// runs the same logic to know which UI state to render, but the server
// recomputes on submit — never trust the client.
//
// divergenceType enum:
//   null                    — match
//   'value-different'       — same action type & suit, different value
//   'suit-different'        — same action type & value, different suit
//   'action-type-different' — different action type (e.g. user passed,
//                             expected bid)
//   'rule-silent'           — scenario has no expectedAnswer (rules don't
//                             cover the case; user reasoning is the data)
//
// Free-color scenarios (e.g. validation rows 19/20) carry
// expectedAnswer.action.suit === null. Any user-chosen suit counts as a
// suit-match in that case — the rules only constrain the bid value.

const VALID_AGREEMENT_VALUES = new Set(['could-be-either', 'user-disagrees']);

// V2.2 Phase 2C: collapse divergenceType into a 3-way caseType the frontend
// branches on. 'match' → auto-advance, 'divergent' / 'rule-silent' → open
// the completion screen with a Claude conversation.
function caseTypeFor(divergenceType) {
  if (divergenceType === null)         return 'match';
  if (divergenceType === 'rule-silent') return 'rule-silent';
  return 'divergent';
}

// V2.2 Phase 2C: the canonical agreement that gets written to disk for a
// given divergenceType, irrespective of what the client sent. The "D'accord
// / Pas d'accord" modal is gone — every divergent or rule-silent submission
// is treated as a disagreement (Claude's job is to surface the reasoning).
function canonicalAgreementFor(divergenceType) {
  if (divergenceType === null) return null;
  return 'user-disagrees';
}

/**
 * @param {object|null|undefined} scenarioOrExpected
 *   Pass either the full scenario (preferred) or just its expectedAnswer
 *   field. Both are accepted because callers in the socket handler have
 *   the scenario, but tests prefer to construct the expected piece
 *   directly.
 * @param {object} userAction
 * @returns {null|'value-different'|'suit-different'|'action-type-different'|'rule-silent'}
 */
function computeDivergenceType(scenarioOrExpected, userAction) {
  // Normalize: caller may hand us a scenario or just its expectedAnswer.
  let expected = null;
  if (scenarioOrExpected && typeof scenarioOrExpected === 'object') {
    if ('expectedAnswer' in scenarioOrExpected) {
      expected = scenarioOrExpected.expectedAnswer;
    } else if ('action' in scenarioOrExpected || scenarioOrExpected === null) {
      expected = scenarioOrExpected;
    } else if (scenarioOrExpected.action !== undefined) {
      expected = scenarioOrExpected;
    }
  }
  // No expectedAnswer at all (v1 scenarios, or v2 scenarios without the
  // optional field) → treat as rule-silent. This is what the analysis
  // tooling already does and keeps the schema boundary tidy.
  //
  // Exception: a `pass` on a rule-silent scenario is the safe default —
  // the user agreed there's nothing to bid. Treat as match (divergenceType
  // = null) so the Claude V2.2 chat is skipped and the flow auto-advances.
  // The annotation is still persisted; analysis can recover the "no rule"
  // case by inspecting scenario.expectedAnswer.
  if (!expected) {
    return userAction.type === 'pass' ? null : 'rule-silent';
  }

  const e = expected.action;
  if (!e) return userAction.type === 'pass' ? null : 'rule-silent'; // malformed expected: same exception

  if (userAction.type !== e.type) return 'action-type-different';

  // Pass / coinche / surcoinche carry no value or suit — type-match is the
  // whole match for them.
  if (e.type !== 'bid') return null;

  const suitMatches  = e.suit === null || e.suit === undefined || userAction.suit === e.suit;
  const valueMatches = userAction.value === e.value;

  if (valueMatches && suitMatches) return null;
  if (valueMatches && !suitMatches) return 'suit-different';
  if (!valueMatches && suitMatches) return 'value-different';
  // Both differ: report value-different (it's the more meaningful axis —
  // value determines the contract level; suit determines the trump suit).
  // Either is defensible; we pick one and document the choice rather than
  // adding a fifth enum value.
  return 'value-different';
}

/**
 * V2.2 Phase 2C — simplified validation.
 *
 * The "D'accord / Pas d'accord" modal and the rule-silent obligatory-note
 * modal are gone. The frontend submits with sensible defaults
 * (`divergenceAgreement: null`, `note: ''`) and the server writes the
 * canonical values:
 *
 *   - match (null):       agreement = null,            note = whatever
 *                         was sent (typically '')
 *   - rule-silent:        agreement = 'user-disagrees', note = whatever
 *                         was sent (the Claude conversation replaces the
 *                         modal-collected note)
 *   - any other type:     agreement = 'user-disagrees', note = whatever
 *                         was sent
 *
 * Returns { ok: true, divergenceType, agreement } — the resolved
 * agreement is what callers should persist. Sentinel error codes from
 * the V3 schema (MISSING_DIVERGENCE_AGREEMENT / MISSING_REQUIRED_NOTE /
 * INVALID_DIVERGENCE_AGREEMENT / UNEXPECTED_DIVERGENCE_AGREEMENT) are
 * gone — the only error path now is a malformed scenario / action which
 * computeDivergenceType already handles upstream.
 */
function validateSubmission({ scenario, action }) {
  const divergenceType = computeDivergenceType(scenario, action);
  const agreement      = canonicalAgreementFor(divergenceType);
  return { ok: true, divergenceType, agreement };
}

module.exports = {
  computeDivergenceType,
  validateSubmission,
  caseTypeFor,
  canonicalAgreementFor,
  VALID_AGREEMENT_VALUES,
};

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
  if (!expected) return 'rule-silent';

  const e = expected.action;
  if (!e) return 'rule-silent'; // malformed expected, treat as silent

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
 * Validate the {action, divergenceAgreement, note} triple for v3 annotation
 * submissions. Returns either { ok: true, divergenceType } or
 * { ok: false, code, message }.
 *
 * Rules (driven by the divergenceType the system computed):
 *   - match (null):            agreement must be null,    note may be empty
 *   - rule-silent:             agreement must be null,    note must be non-empty
 *   - any other (divergent):   agreement must be valid,   note must be non-empty
 */
function validateSubmission({ scenario, action, divergenceAgreement, note }) {
  const divergenceType = computeDivergenceType(scenario, action);
  const trimmed = (note ?? '').trim();

  if (divergenceType === null) {
    if (divergenceAgreement !== null && divergenceAgreement !== undefined) {
      return {
        ok: false,
        code: 'UNEXPECTED_DIVERGENCE_AGREEMENT',
        message: 'divergenceAgreement must be null when the action matches the expected answer',
      };
    }
    return { ok: true, divergenceType };
  }

  if (divergenceType === 'rule-silent') {
    if (divergenceAgreement !== null && divergenceAgreement !== undefined) {
      return {
        ok: false,
        code: 'UNEXPECTED_DIVERGENCE_AGREEMENT',
        message: 'divergenceAgreement must be null for rule-silent scenarios',
      };
    }
    if (trimmed === '') {
      return {
        ok: false,
        code: 'MISSING_REQUIRED_NOTE',
        message: 'note is required when the scenario is rule-silent',
      };
    }
    return { ok: true, divergenceType };
  }

  // True divergence: need yes/no AND non-empty note.
  if (divergenceAgreement === null || divergenceAgreement === undefined) {
    return {
      ok: false,
      code: 'MISSING_DIVERGENCE_AGREEMENT',
      message: 'divergenceAgreement is required when the action diverges from the expected answer',
    };
  }
  if (!VALID_AGREEMENT_VALUES.has(divergenceAgreement)) {
    return {
      ok: false,
      code: 'INVALID_DIVERGENCE_AGREEMENT',
      message: `divergenceAgreement must be one of ${[...VALID_AGREEMENT_VALUES].join(', ')}`,
    };
  }
  if (trimmed === '') {
    return {
      ok: false,
      code: 'MISSING_REQUIRED_NOTE',
      message: 'note is required when the action diverges from the expected answer',
    };
  }
  return { ok: true, divergenceType };
}

module.exports = {
  computeDivergenceType,
  validateSubmission,
  VALID_AGREEMENT_VALUES,
};

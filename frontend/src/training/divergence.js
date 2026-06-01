// Client-side mirror of backend/src/training/divergence.js. The frontend
// uses this to decide which UI state to render (match / divergent /
// rule-silent); the server recomputes on submit and is authoritative.
//
// Keep the two implementations in sync. Both must agree on:
//   - free-color match: expected.suit === null counts as suit-match
//   - rule-silent classification: missing or null expectedAnswer
//   - both-axes-differ → 'value-different' (documented choice)

export function computeDivergenceType(expectedAnswerOrScenario, userAction) {
  let expected = null;
  if (expectedAnswerOrScenario && typeof expectedAnswerOrScenario === 'object') {
    if ('expectedAnswer' in expectedAnswerOrScenario) {
      expected = expectedAnswerOrScenario.expectedAnswer;
    } else if (expectedAnswerOrScenario.action !== undefined) {
      expected = expectedAnswerOrScenario;
    }
  }
  // Exception: pass on a rule-silent scenario is treated as match (no
  // divergence, skip the Claude V2.2 chat). Mirrors the backend logic.
  if (!expected) return userAction.type === 'pass' ? null : 'rule-silent';

  const e = expected.action;
  if (!e) return userAction.type === 'pass' ? null : 'rule-silent';
  if (userAction.type !== e.type) return 'action-type-different';
  if (e.type !== 'bid') return null;

  const suitMatches  = e.suit === null || e.suit === undefined || userAction.suit === e.suit;
  const valueMatches = userAction.value === e.value;

  if (valueMatches && suitMatches) return null;
  if (valueMatches && !suitMatches) return 'suit-different';
  if (!valueMatches && suitMatches) return 'value-different';
  return 'value-different';
}

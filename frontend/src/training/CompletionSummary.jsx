// Brief summary shown after a scenario is annotated and persisted. Two
// terminal actions: back to picker, or next scenario.
//
// v3.1 (2026-05-04): the post-submit "Autre stratégie possible ?" overlay
// was removed; every annotation auto-concludes server-side. The
// pendingReview / onReviewContinue / onReviewEnd props are gone, and so
// is the ReviewPromptOverlay component.
//
// v3 (2026-05-04): tag rendering removed. The annotation now contains only
// action + divergenceType + divergenceAgreement + note. We render the
// action and the note (if present); the divergence machinery is plumbed
// through but not surfaced — users don't need to see "you matched the
// rule / you diverged" framing on the success screen.

import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';

export default function CompletionSummary({
  annotation,
  onBackToPicker,
  onNextScenario,
  hasNextScenario,
}) {
  const { t } = useLang();
  const c = t.training.completion;

  const decision = annotation?.decisions?.[0];
  const action   = decision?.action;
  const note     = decision?.note ?? '';

  const actionText = formatActionText(action, t);
  const actionRed  = actionIsRed(action);

  return (
    <div className="training-completion">
      <div className="training-completion-card">
        <div className="tc-title-row">
          <h1>{c.title}</h1>
        </div>

        <section className="tc-section">
          <div className="tc-section-label">{c.actionLabel}</div>
          <div className={`tc-action${actionRed ? ' tc-red' : ''}`}>{actionText}</div>
        </section>

        <section className="tc-section">
          <div className="tc-section-label">{c.noteLabel}</div>
          {note ? (
            <div className="tc-note">{note}</div>
          ) : (
            <div className="tc-empty">{c.noNote}</div>
          )}
        </section>

        <div className="tc-actions">
          <button className="btn-secondary" onClick={onBackToPicker}>
            {c.backToPicker}
          </button>
          {hasNextScenario && (
            <button className="btn-primary" onClick={onNextScenario}>
              {c.nextScenario} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

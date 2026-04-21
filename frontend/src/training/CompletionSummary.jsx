// Brief summary shown after a scenario is completed and the annotation is
// persisted. Two terminal actions: back to picker, or next scenario — but
// if the server has emitted an exhaustion-session review prompt, an
// overlay appears on top asking "Autre stratégie possible ?" and the
// terminal actions are replaced by Oui / Non answers. See
// ReviewPromptOverlay.jsx for the overlay component.

import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';
import ReviewPromptOverlay from './ReviewPromptOverlay';

export default function CompletionSummary({
  annotation,
  tagSchema,          // so we can resolve tag labels to the current locale
  onBackToPicker,
  onNextScenario,
  hasNextScenario,
  pendingReview,      // {runId,sessionId,alternativeIndex}|null — shows overlay when set
  onReviewContinue,   // user clicked "Oui, autre stratégie"
  onReviewEnd,        // user clicked "Non, c'est tout"
}) {
  const { t } = useLang();
  const c = t.training.completion;

  const decision = annotation?.decisions?.[0];
  const action   = decision?.action;
  const tags     = decision?.tags ?? [];
  const note     = decision?.note ?? '';

  const actionText = formatActionText(action, t);
  const actionRed  = actionIsRed(action);

  // Resolve tag keys → localized labels using the tag schema.
  const tagLabels = tags.map(key => {
    const actionType = action?.type;
    if (!actionType) return key;
    return t.training.tags[actionType]?.[key] ?? key;
  });

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
          <div className="tc-section-label">{c.tagsLabel}</div>
          {tagLabels.length > 0 ? (
            <div className="tc-tag-row">
              {tagLabels.map((label, i) => (
                <span key={i} className="tc-tag">{label}</span>
              ))}
            </div>
          ) : (
            <div className="tc-empty">{c.noTags}</div>
          )}
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
      {pendingReview && (
        <ReviewPromptOverlay
          onContinue={onReviewContinue}
          onEnd={onReviewEnd}
        />
      )}
    </div>
  );
}

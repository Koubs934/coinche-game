// Post-completion "Autre stratégie possible ?" overlay. Rendered by
// CompletionSummary when the server has emitted `trainingScenarioReviewPrompt`
// after a successful submit. Non-blocking visually (completion summary stays
// visible behind it) but functionally blocks the return-to-picker path until
// the user answers yes or no.
//
// Styled to match the existing .trp-warning-* overlay — same backdrop dim,
// same card shape, same amber-primary / outlined-secondary button pair.

import { useLang } from '../context/LanguageContext';

export default function ReviewPromptOverlay({ onContinue, onEnd }) {
  const { t } = useLang();
  const p = t.training.panel;
  return (
    <div className="trp-review-backdrop" role="dialog" aria-modal="true" aria-labelledby="trp-review-heading">
      <div className="trp-review-card">
        <h3 id="trp-review-heading" className="trp-review-heading">{p.reviewPromptTitle}</h3>
        <p className="trp-review-body">{p.reviewPromptBody}</p>
        <div className="trp-review-actions">
          <button type="button" className="trp-review-continue" onClick={onContinue}>
            {p.reviewContinueBtn}
          </button>
          <button type="button" className="trp-review-end" onClick={onEnd}>
            {p.reviewEndBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

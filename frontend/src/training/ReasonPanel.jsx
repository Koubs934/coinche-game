// v3.1 reason panel — divergence-driven flow with cleaner layout.
//
// Three states, derived from the scenario's expectedAnswer (passed in) and
// the user's pendingAction:
//
//   match        → no UI; the parent auto-submits with null agreement and
//                  empty note. This component renders nothing in that case
//                  (the parent decides whether to mount it at all).
//   divergent    → "Annonce: X / La Feuille suggère: Y / D'accord-Pas d'accord
//                   / Raisonnement (requis)"
//   rule-silent  → "Annonce: X / [explanatory line] / Raisonnement (requis)"
//
// The server recomputes divergence on submit and is the source of truth;
// this component's job is to gather inputs and call onSubmit.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import formatActionLabel from './formatActionLabel';
import { readDraft, writeDraft, clearDraft } from './noteDraft';
import { computeDivergenceType } from './divergence';

/**
 * @param {object}   props
 * @param {object}   props.action            { type, value?, suit? } — what the user picked
 * @param {object|null} props.expectedAnswer scenario.expectedAnswer ({action, ruleReference}|null)
 * @param {Function} props.onSubmit          (divergenceAgreement, note) => void
 * @param {Function} [props.onChangeAction]  optional — back to action selection
 * @param {string}   [props.draftKey]        stable id for localStorage note draft
 */
export default function ReasonPanel({
  action, expectedAnswer, onSubmit, onChangeAction, draftKey,
}) {
  const { t } = useLang();
  const p = t.training.panel;

  const divergenceType = computeDivergenceType(expectedAnswer, action);

  const [agreement, setAgreement] = useState(null);            // 'could-be-either' | 'user-disagrees' | null
  const [note,      setNote]      = useState(() => readDraft(draftKey)?.note ?? '');

  // ── Draft persistence (debounced + on unmount) ────────────────────────
  const latestRef   = useRef({ note });
  const finishedRef = useRef(false);
  useEffect(() => { latestRef.current = { note }; }, [note]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => writeDraft(draftKey, [], note), 500);
    return () => clearTimeout(timer);
  }, [note, draftKey]);

  useEffect(() => {
    return () => {
      if (!draftKey || finishedRef.current) return;
      writeDraft(draftKey, [], latestRef.current.note);
    };
  }, [draftKey]);

  // Match path: parent auto-submits and doesn't mount us. Defensive return.
  if (divergenceType === null) return null;

  const isDivergent = divergenceType !== 'rule-silent';
  const noteTrimmed = note.trim();
  const noteOK      = noteTrimmed.length > 0;
  const agreementOK = !isDivergent || agreement !== null;
  const canSubmit   = noteOK && agreementOK;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(isDivergent ? agreement : null, noteTrimmed);
  }

  return (
    <div className="training-reason-panel training-reason-v31">
      {/* ── Top bar — change-action lives here, NOT floating over content ── */}
      <div className="trp-topbar">
        {onChangeAction && (
          <button
            type="button"
            className="trp-change-action"
            onClick={() => {
              finishedRef.current = true;
              if (draftKey) clearDraft(draftKey);
              onChangeAction();
            }}
          >
            ↩ {p.changeAction}
          </button>
        )}
      </div>

      {/* ── User's chosen action ─────────────────────────────────────── */}
      <section className="trp-section">
        <h3 className="trp-section-label">{t.training.divergence.label.userAction}</h3>
        <div className="trp-action-large">{formatActionLabel(action, t)}</div>
      </section>

      {/* ── State 2: divergent ────────────────────────────────────────── */}
      {isDivergent && expectedAnswer?.action && (
        <>
          <section className="trp-section">
            <h3 className="trp-section-label">{t.training.divergence.label.feuilleSuggests}</h3>
            <div className="trp-action-large">{formatActionLabel(expectedAnswer.action, t)}</div>
          </section>

          <div className="trp-agreement-row" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={agreement === 'could-be-either'}
              className={`trp-agreement-btn${agreement === 'could-be-either' ? ' trp-agreement-on' : ''}`}
              onClick={() => setAgreement('could-be-either')}
            >
              {t.training.divergence.option.agree}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={agreement === 'user-disagrees'}
              className={`trp-agreement-btn${agreement === 'user-disagrees' ? ' trp-agreement-on' : ''}`}
              onClick={() => setAgreement('user-disagrees')}
            >
              {t.training.divergence.option.disagree}
            </button>
          </div>
        </>
      )}

      {/* ── State 3: rule-silent ──────────────────────────────────────── */}
      {!isDivergent && (
        <p className="trp-rule-silent-intro">{t.training.ruleSilent.intro}</p>
      )}

      {/* ── Reasoning (required in both v3.1 states) ─────────────────── */}
      <form className="trp-form" onSubmit={handleSubmit}>
        <label className="trp-note-label">
          <span className="trp-note-heading">
            {t.training.reasoning.label}{' '}
            <em className="trp-note-required-tag">{t.training.reasoning.required}</em>
          </span>
          <textarea
            className="trp-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t.training.reasoning.placeholder}
            rows={4}
            maxLength={2000}
          />
        </label>
        <button
          type="submit"
          className="trp-submit"
          disabled={!canSubmit}
        >
          {p.submit}
        </button>
      </form>
    </div>
  );
}

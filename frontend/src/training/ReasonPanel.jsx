// v3 reason panel — divergence-driven flow.
//
// Three states, derived from the scenario's expectedAnswer (passed in) and
// the user's pendingAction:
//
//   match        → no UI; the parent auto-submits with null agreement and
//                  empty note. This component renders nothing in that case
//                  (the parent decides whether to mount it at all).
//   divergent    → "You chose: X. Rules suggest: Y. Could Y also work? Yes/No"
//                  + required free-text note. Submit disabled until both
//                  fields are set.
//   rule-silent  → "You chose: X. The rules don't cover this case." +
//                  required free-text note. No yes/no.
//
// The server recomputes divergence on submit and is the source of truth;
// this component's job is to gather the inputs and call onSubmit.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';
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

  const divergenceType = useMemo(
    () => computeDivergenceType(expectedAnswer, action),
    [expectedAnswer, action],
  );

  const [agreement, setAgreement] = useState(null);            // 'could-be-either' | 'user-disagrees' | null
  const [note,      setNote]      = useState(() => readDraft(draftKey)?.note ?? '');

  // Match path: parent decides whether to mount this. If it does mount us
  // on a match, render nothing (defensive — parent handles auto-submit).
  if (divergenceType === null) return null;

  const isDivergent = divergenceType !== 'rule-silent';
  const noteTrimmed = note.trim();
  const noteOK      = noteTrimmed.length > 0;
  const agreementOK = !isDivergent || agreement !== null;
  const canSubmit   = noteOK && agreementOK;

  // ── Draft persistence (debounced + on unmount) ────────────────────────
  // Only the note is persisted; agreement is a quick yes/no the user can
  // re-click and not worth localStorage round-trips.
  const latestRef   = useRef({ note });
  const finishedRef = useRef(false);
  useEffect(() => { latestRef.current = { note }; }, [note]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      writeDraft(draftKey, [], note); // tags arg kept for back-compat with helper signature
    }, 500);
    return () => clearTimeout(timer);
  }, [note, draftKey]);

  useEffect(() => {
    return () => {
      if (!draftKey || finishedRef.current) return;
      writeDraft(draftKey, [], latestRef.current.note);
    };
  }, [draftKey]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(isDivergent ? agreement : null, noteTrimmed);
  }

  const userActionLabel = formatActionText(action, t);
  const userActionRed   = actionIsRed(action);
  const expectedActionLabel = expectedAnswer?.action
    ? formatActionText({ ...expectedAnswer.action, type: expectedAnswer.action.type }, t).replace(/^[^\s]+\s/, '')
    : '';
  // ^ formatActionText prepends "Vous avez annoncé / You bid" — for the
  // "rules suggest" line we want just the bare action ("110 ♠"). Strip
  // the leading prefix to get the clean action label.
  const expectedActionRed = expectedAnswer?.action ? actionIsRed({ ...expectedAnswer.action, type: expectedAnswer.action.type }) : false;

  return (
    <div className="training-reason-panel training-reason-v3">
      {/* ── User's chosen action ─────────────────────────────────────── */}
      <div className="trp-action-head">
        <div className={`trp-action-line${userActionRed ? ' trp-red' : ''}`}>
          {t.training.divergence.heading.userChoice(userActionLabel)}
        </div>
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

      {/* ── State 2: divergent ────────────────────────────────────────── */}
      {isDivergent && expectedAnswer?.action && (
        <>
          <div className={`trp-rules-line${expectedActionRed ? ' trp-red' : ''}`}>
            {t.training.divergence.heading.rulesSuggest(expectedActionLabel)}
          </div>
          <fieldset className="trp-agreement">
            <legend className="trp-agreement-question">
              {t.training.divergence.question(expectedActionLabel)}
            </legend>
            <label className="trp-agreement-option">
              <input
                type="radio"
                name="divergence-agreement"
                value="could-be-either"
                checked={agreement === 'could-be-either'}
                onChange={() => setAgreement('could-be-either')}
              />
              {' '}{t.training.divergence.option.couldBeEither}
            </label>
            <label className="trp-agreement-option">
              <input
                type="radio"
                name="divergence-agreement"
                value="user-disagrees"
                checked={agreement === 'user-disagrees'}
                onChange={() => setAgreement('user-disagrees')}
              />
              {' '}{t.training.divergence.option.userDisagrees}
            </label>
          </fieldset>
        </>
      )}

      {/* ── State 3: rule-silent ──────────────────────────────────────── */}
      {!isDivergent && (
        <p className="trp-rule-silent-intro">{t.training.ruleSilent.intro}</p>
      )}

      {/* ── Note (always required in both v3 states) ──────────────────── */}
      <form className="trp-form" onSubmit={handleSubmit}>
        <label className="trp-note-label">
          <span className="trp-note-heading">
            {t.training.reasoning.notePrompt}{' '}
            <em className="trp-note-required-tag">{t.training.reasoning.noteRequired}</em>
          </span>
          <textarea
            className="trp-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t.training.reasoning.notePlaceholder}
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

// Reason-capture panel. Controlled component — the parent owns the "pending"
// action and the submit/undo handlers. This file's responsibility is:
//   - render the action prominently
//   - render tag groups (labelled sections via groupOrder)
//   - manage local state: selected tag set + note text
//   - client-mirror the server-side validator so submit is never enabled
//     for a submission the server would reject
//   - call onSubmit / onChangeAction when appropriate
//
// The server-side validator (tagValidator.validateReasonSubmission) is the
// authoritative gate; this panel is defensive UX, not validation.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';
import { readDraft, writeDraft, clearDraft } from './noteDraft';

/**
 * @param {object}   props
 * @param {object}   props.action         { type, value?, suit?, card? }
 * @param {object}   props.tagsForAction  reasonTags.json → actions[<type>]   { groupOrder, tags: [...] }
 * @param {object}   props.groupsMap      reasonTags.json → groups            { [groupKey]: { labelPath }}
 * @param {Function} props.onSubmit       (tags, note) => void
 * @param {Function} [props.onChangeAction]  optional — back to action selection
 * @param {string}   [props.draftKey]     stable id (server-assigned partialId)
 *                                         used as the localStorage key for
 *                                         note+tag drafts so an interrupted
 *                                         session can recover the user's text.
 */
export default function ReasonPanel({
  action, tagsForAction, groupsMap, onSubmit, onChangeAction,
  draftKey,
}) {
  const { t } = useLang();
  const p = t.training.panel;

  // Hydrate from any previously-saved draft for this partialId. Runs once
  // at mount (note the function-form useState). If no draft exists the
  // fields start empty, identical to the old behaviour.
  const [selectedTags, setSelectedTags] = useState(() => {
    const d = readDraft(draftKey);
    return new Set(d?.tags ?? []);
  });
  const [note, setNote] = useState(() => {
    const d = readDraft(draftKey);
    return d?.note ?? '';
  });

  // Group the tag list by group key for section rendering — follow groupOrder
  // so sections display in the action's preferred order even if JSON reordered.
  const sections = useMemo(() => {
    const byGroup = {};
    for (const tag of tagsForAction.tags) {
      (byGroup[tag.group] = byGroup[tag.group] || []).push(tag);
    }
    return tagsForAction.groupOrder
      .map(g => ({ group: g, tags: byGroup[g] || [] }))
      .filter(section => section.tags.length > 0);
  }, [tagsForAction]);

  const hasOther     = selectedTags.has('other');
  const noteTrimmed  = note.trim();
  const emptyEmpty   = selectedTags.size === 0 && noteTrimmed === '';
  const otherNoNote  = hasOther && noteTrimmed === '';
  const canSubmit    = !emptyEmpty && !otherNoNote;

  const helper =
      otherNoNote ? p.helperOther
    : emptyEmpty  ? p.helperEmpty
    : null;

  const placeholder = hasOther ? p.notePlaceholderRequired : p.notePlaceholderOptional;

  function toggleTag(key) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Draft persistence ─────────────────────────────────────────────────
  // Three write paths:
  //   1. Debounced on edit (500 ms idle) — normal case
  //   2. Synchronous on unmount — catches the UNKNOWN_TRAINING_RUN redirect
  //      where the panel disappears before the debounce fires
  //   3. clearDraft() on successful submit / change-action — stop tracking
  // A ref mirrors the latest state so the unmount cleanup sees current
  // values (closure would otherwise capture the initial state).
  const latestRef  = useRef({ tags: selectedTags, note });
  const finishedRef = useRef(false);
  useEffect(() => { latestRef.current = { tags: selectedTags, note }; }, [selectedTags, note]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      writeDraft(draftKey, [...selectedTags], note);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedTags, note, draftKey]);

  useEffect(() => {
    // Run-on-unmount: persist whatever is currently typed if the user didn't
    // explicitly finish. Cheap — localStorage write is synchronous.
    return () => {
      if (!draftKey || finishedRef.current) return;
      const { tags, note } = latestRef.current;
      writeDraft(draftKey, [...tags], note);
    };
  }, [draftKey]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    finishedRef.current = true;
    if (draftKey) clearDraft(draftKey);
    onSubmit([...selectedTags], noteTrimmed);
  }

  // Group label resolution: groupsMap[key].labelPath like "training.tags.groups.hand-claim".
  // We look it up on t rather than hardcoding, so localization stays data-driven.
  function resolveLabelPath(labelPath) {
    return labelPath.split('.').reduce((o, seg) => (o ? o[seg] : undefined), t) ?? labelPath;
  }

  const actionLabel = formatActionText(action, t);
  const actionRed   = actionIsRed(action);

  return (
    <div className="training-reason-panel">
      {/* ── Action header ─────────────────────────────────────────────── */}
      <div className="trp-action-head">
        <div className="trp-action-label">{p.actionLabel}</div>
        <div className={`trp-action-value${actionRed ? ' trp-red' : ''}`}>{actionLabel}</div>
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

      <h2 className="trp-title">{p.title}</h2>

      {/* ── Tag sections ──────────────────────────────────────────────── */}
      <form className="trp-form" onSubmit={handleSubmit}>
        {sections.map(({ group, tags }) => (
          <fieldset key={group} className="trp-group">
            <legend className="trp-group-label">
              {resolveLabelPath(groupsMap[group]?.labelPath)}
            </legend>
            <div className="trp-pill-row">
              {tags.map(tag => {
                const labelPath = `training.tags.${tagsForAction.actionType ?? ''}.${tag.key}`;
                // Resolve by walking t: training.tags.<actionType>.<key>
                const actionType = tagsForAction.actionType;
                const label = t.training.tags[actionType]?.[tag.key] ?? tag.key;
                const selected = selectedTags.has(tag.key);
                return (
                  <button
                    key={tag.key}
                    type="button"
                    className={`trp-pill${selected ? ' trp-pill-on' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.key)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {/* ── Note (always visible) ────────────────────────────────────── */}
        <label className="trp-note-label">
          <span className="trp-note-heading">{p.noteLabel}</span>
          <textarea
            className={`trp-note${otherNoNote ? ' trp-note-required' : ''}`}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        </label>

        {/* ── Submit + helper ──────────────────────────────────────────── */}
        <button
          type="submit"
          className="trp-submit"
          disabled={!canSubmit}
        >
          {p.submit}
        </button>
        {helper && (
          <p className="trp-helper">{helper}</p>
        )}
      </form>
    </div>
  );
}

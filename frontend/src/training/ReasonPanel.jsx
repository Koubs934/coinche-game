// Reason-capture panel. Controlled component — the parent owns the "pending"
// action and the submit/undo handlers. This file's responsibility is:
//   - render the action prominently
//   - render tag groups (labelled sections via groupOrder), with required
//     groups visually distinguished (bidding-action in v2)
//   - manage local state: selected tag set + note text
//   - client-mirror the server-side validator (driven by the same JSON flags:
//     `requireExactlyOne` on groups, `requiresNote` on tags) so submit is
//     never enabled for a submission the server would reject
//   - surface the server's soft warnings via a non-blocking confirmation
//     overlay; the user can either Continue or go back and edit
//
// The server-side validator (tagValidator.validateReasonSubmission) remains
// the authoritative gate; this panel is defensive UX.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';
import { readDraft, writeDraft, clearDraft } from './noteDraft';

/**
 * @param {object}   props
 * @param {object}   props.action            { type, value?, suit?, card? }
 * @param {object}   props.tagsForAction     reasonTags.json → actions[<type>]  { actionType, groupOrder, tags: [...] }
 * @param {object}   props.groupsMap         reasonTags.json → groups            { [groupKey]: { labelPath, requireExactlyOne?, recommendAtLeastOne? }}
 * @param {Function} props.onSubmit          (tags, note, ackWarnings) => void
 * @param {Function} [props.onChangeAction]  optional — back to action selection
 * @param {string}   [props.draftKey]        stable id (server-assigned partialId) used as localStorage key
 * @param {string[]|null} [props.pendingWarnings]  soft warnings from the server; when present, the confirmation overlay is shown
 * @param {Function} [props.onDismissWarnings]     called when user opts to edit instead of confirm
 */
export default function ReasonPanel({
  action, tagsForAction, groupsMap, onSubmit, onChangeAction,
  draftKey, pendingWarnings, onDismissWarnings,
}) {
  const { t } = useLang();
  const p = t.training.panel;

  const [selectedTags, setSelectedTags] = useState(() => {
    const d = readDraft(draftKey);
    return new Set(d?.tags ?? []);
  });
  const [note, setNote] = useState(() => {
    const d = readDraft(draftKey);
    return d?.note ?? '';
  });

  // ── Derived tag / group indexes (action-scoped) ─────────────────────────
  const sections = useMemo(() => {
    const byGroup = {};
    for (const tag of tagsForAction.tags) {
      (byGroup[tag.group] = byGroup[tag.group] || []).push(tag);
    }
    return tagsForAction.groupOrder
      .map(g => ({ group: g, tags: byGroup[g] || [] }))
      .filter(section => section.tags.length > 0);
  }, [tagsForAction]);

  const tagsByGroup = useMemo(() => {
    const m = new Map();
    for (const tag of tagsForAction.tags) {
      if (!m.has(tag.group)) m.set(tag.group, new Set());
      m.get(tag.group).add(tag.key);
    }
    return m;
  }, [tagsForAction]);

  const noteRequiredTagKeys = useMemo(
    () => new Set(tagsForAction.tags.filter(t => t.requiresNote).map(t => t.key)),
    [tagsForAction],
  );

  // Required groups present in THIS action's tag list (inert for play-card).
  const activeRequiredGroups = useMemo(() => {
    return Object.entries(groupsMap)
      .filter(([, meta]) => meta.requireExactlyOne)
      .map(([key]) => key)
      .filter(key => (tagsByGroup.get(key) || new Set()).size > 0);
  }, [groupsMap, tagsByGroup]);

  // ── Validation (client mirror of tagValidator.js) ──────────────────────
  const noteTrimmed = note.trim();
  const selectedArr = [...selectedTags];

  const noteMissingForRequired =
    selectedArr.some(k => noteRequiredTagKeys.has(k)) && noteTrimmed === '';

  const perRequiredGroup = activeRequiredGroups.map(groupKey => ({
    groupKey,
    selected: selectedArr.filter(k => tagsByGroup.get(groupKey).has(k)),
  }));
  const missingRequiredGroups  = perRequiredGroup.filter(g => g.selected.length === 0).map(g => g.groupKey);
  const multipleRequiredGroups = perRequiredGroup.filter(g => g.selected.length >  1).map(g => g.groupKey);

  const hasRequiredStructure = activeRequiredGroups.length > 0;
  const emptyEmpty = !hasRequiredStructure && selectedTags.size === 0 && noteTrimmed === '';

  const canSubmit =
    missingRequiredGroups.length  === 0 &&
    multipleRequiredGroups.length === 0 &&
    !noteMissingForRequired &&
    !emptyEmpty;

  // Helper message shown below the submit button — show the first blocker.
  const helper = (() => {
    if (missingRequiredGroups.length > 0) {
      const gLabel = resolveGroupLabel(missingRequiredGroups[0]);
      return p.helperMissingRequired(gLabel);
    }
    if (multipleRequiredGroups.length > 0) {
      const gLabel = resolveGroupLabel(multipleRequiredGroups[0]);
      return p.helperMultipleRequired(gLabel);
    }
    if (noteMissingForRequired) return p.helperNoteRequired;
    if (emptyEmpty)              return p.helperEmpty;
    return null;
  })();

  const hasNoteRequiredSelected = selectedArr.some(k => noteRequiredTagKeys.has(k));
  const placeholder = hasNoteRequiredSelected ? p.notePlaceholderRequired : p.notePlaceholderOptional;

  function toggleTag(key) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Group-label resolver ───────────────────────────────────────────────
  // groupsMap[key].labelPath like "training.tags.groups.bidding-action" —
  // walk `t` rather than hardcode so localization stays data-driven.
  function resolveLabelPath(labelPath) {
    return labelPath.split('.').reduce((o, seg) => (o ? o[seg] : undefined), t) ?? labelPath;
  }
  function resolveGroupLabel(groupKey) {
    return resolveLabelPath(groupsMap[groupKey]?.labelPath || '');
  }

  // ── Draft persistence ─────────────────────────────────────────────────
  // Three write paths:
  //   1. Debounced on edit (500 ms idle) — normal case
  //   2. Synchronous on unmount — catches the UNKNOWN_TRAINING_RUN redirect
  //   3. Re-saved when the user dismisses a warning (don't lose their work
  //      if they reload in the middle of reconsidering)
  // clearDraft is called on change-action (explicit abandonment). We NO
  // LONGER clear on submit-press because a warning bounce may send the user
  // back to editing; the parent/completion handler takes care of clearing
  // once the server has actually accepted the submission.
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
    return () => {
      if (!draftKey || finishedRef.current) return;
      const { tags, note } = latestRef.current;
      writeDraft(draftKey, [...tags], note);
    };
  }, [draftKey]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit([...selectedTags], noteTrimmed, false);
  }

  function handleConfirmWarnings() {
    onSubmit([...selectedTags], noteTrimmed, true);
  }
  function handleDismissWarnings() {
    // Warning dismissed — user wants to edit. Refresh the draft so a reload
    // recovers the current tags + note (the submit-press path may have
    // cleared it in earlier iterations; re-writing is always safe).
    if (draftKey) writeDraft(draftKey, [...selectedTags], note);
    onDismissWarnings?.();
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
        {sections.map(({ group, tags }) => {
          const meta = groupsMap[group] || {};
          const isRequired = !!meta.requireExactlyOne;
          const groupLabel = resolveLabelPath(meta.labelPath);
          const actionType = tagsForAction.actionType;
          return (
            <fieldset key={group} className={`trp-group${isRequired ? ' trp-group-required' : ''}`}>
              <legend className="trp-group-label">
                <span>{groupLabel}</span>
                {isRequired && (
                  <span className="trp-group-badge" aria-label={p.requiredBadge}>
                    {p.requiredBadge}
                  </span>
                )}
              </legend>
              <div className="trp-pill-row">
                {tags.map(tag => {
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
          );
        })}

        {/* ── Note (always visible) ────────────────────────────────────── */}
        <label className="trp-note-label">
          <span className="trp-note-heading">{p.noteLabel}</span>
          <textarea
            className={`trp-note${noteMissingForRequired ? ' trp-note-required' : ''}`}
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

      {/* ── Soft-warning confirmation overlay ──────────────────────────── */}
      {pendingWarnings && pendingWarnings.length > 0 && (
        <div className="trp-warning-backdrop" role="dialog" aria-modal="true" aria-labelledby="trp-warning-heading">
          <div className="trp-warning-card">
            <h3 id="trp-warning-heading" className="trp-warning-heading">{p.warningHeading}</h3>
            <ul className="trp-warning-list">
              {pendingWarnings.map((msg, i) => (
                <li key={i} className="trp-warning-item">💡 {msg}</li>
              ))}
            </ul>
            <div className="trp-warning-actions">
              <button type="button" className="trp-warning-continue" onClick={handleConfirmWarnings}>
                {p.warningContinueBtn}
              </button>
              <button type="button" className="trp-warning-back" onClick={handleDismissWarnings}>
                {p.warningBackBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

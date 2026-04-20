// DEV picker — piece 1 test harness. Shows the scenarios list + any
// resumable partials, gives a single Start button per entry. Piece 2
// replaces this with TrainingPicker.jsx (full styling, proper resumable UX).
//
// Removed once piece 3 is done; left in for now so Pierre has a manual
// click-through path to exercise the training table.

import { useMemo } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';

export default function DevTrainingPicker({
  scenarios,
  resumablePartials,
  onStart,
  onResume,
  onDiscardPartial,
  onBack,
}) {
  const { t, lang } = useLang();
  const tp = t.training.picker;
  const td = t.training.dev;

  // Lookup so resumable cards can show the scenario's human title rather than
  // its kebab-case id. Falls back to id if the scenarios list hasn't arrived.
  const scenariosById = useMemo(() => {
    const m = {};
    for (const s of scenarios || []) m[s.id] = s;
    return m;
  }, [scenarios]);
  function scenarioTitle(scenarioId) {
    const s = scenariosById[scenarioId];
    return s?.title?.[lang] || s?.title?.en || scenarioId;
  }

  return (
    <div className="dev-picker">
      <div className="dev-picker-head">
        <button className="btn-link" onClick={onBack}>← {tp.back}</button>
        <h1>{td.heading}</h1>
        <p className="muted">{td.hint}</p>
      </div>

      {resumablePartials?.length > 0 && (
        <section className="dev-picker-section">
          <h2>{tp.resumableHeading}</h2>
          {resumablePartials.map(p => {
            const ageMin     = Math.max(1, Math.round(p.ageMs / 60000));
            const title      = scenarioTitle(p.scenarioId);
            const actionText = formatActionText(p.action, t);
            const red        = actionIsRed(p.action);
            return (
              <div key={p.partialId} className="dev-picker-item dev-picker-resume">
                <div className="dev-picker-item-main">
                  <div className="dev-picker-item-title">{title}</div>
                  <div className="dev-picker-item-sub">
                    {tp.actionShown}{' '}
                    <span className={`dev-picker-action${red ? ' dev-picker-action-red' : ''}`}>
                      {actionText}
                    </span>
                  </div>
                  <div className="dev-picker-item-meta muted">
                    {tp.resumableAgeMin(ageMin)}
                  </div>
                </div>
                <div className="dev-picker-item-actions">
                  <button className="btn-primary" onClick={() => onResume(p.partialId)}>
                    {tp.resumeBtn}
                  </button>
                  <button className="btn-secondary" onClick={() => onDiscardPartial(p.partialId)}>
                    {tp.discardBtn}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="dev-picker-section">
        <h2>{tp.title}</h2>
        {(!scenarios || scenarios.length === 0) ? (
          <p className="muted">{tp.empty}</p>
        ) : (
          scenarios.map(s => (
            <div key={s.id} className="dev-picker-item">
              <div className="dev-picker-item-main">
                <div className="dev-picker-item-title">
                  {s.title?.[lang] || s.title?.en || s.id}
                </div>
                <div className="dev-picker-item-sub">
                  {s.description?.[lang] || s.description?.en || ''}
                </div>
                <div className="dev-picker-item-meta muted">
                  seat {s.userSeat} · dealer {s.dealer}
                </div>
              </div>
              <div className="dev-picker-item-actions">
                <button className="btn-primary" onClick={() => onStart(s.id)}>
                  {td.startBtn}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

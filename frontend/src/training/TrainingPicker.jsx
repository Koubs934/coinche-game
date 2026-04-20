// TrainingPicker — the user-facing scenario picker. Replaces the piece-1
// DevTrainingPicker harness. Renders a resumable callout (amber-tinted, so
// it reads as "in-progress — finish it", not as one of the scenario cards)
// above the main scenario list.

import { useMemo } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';

export default function TrainingPicker({
  scenarios,
  resumablePartials,
  onStart,
  onResume,
  onDiscardPartial,
  onBack,
}) {
  const { t, lang, toggleLang } = useLang();
  const tp = t.training.picker;

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
    <div className="training-picker">
      <div className="training-picker-inner">
        {/* Top bar: back on left, lang toggle on right. In-flow layout so the
            toggle can't overlap the heading on narrow viewports (unlike the
            global .lang-toggle-fixed overlay). */}
        <div className="training-picker-topbar">
          <button className="btn-link" onClick={onBack}>← {tp.back}</button>
          <button className="btn-lang" onClick={toggleLang}>{lang.toUpperCase()}</button>
        </div>

        <h1 className="training-picker-title">{t.lobbyTrainingBtn}</h1>
        <p className="training-picker-subtitle">{tp.subtitle}</p>

        {resumablePartials?.length > 0 && (
          <section className="training-resumable">
            <h2 className="training-resumable-heading">{tp.resumableHeading}</h2>
            {resumablePartials.map(p => {
              const ageMin     = Math.max(1, Math.round(p.ageMs / 60000));
              const title      = scenarioTitle(p.scenarioId);
              const actionText = formatActionText(p.action, t);
              const red        = actionIsRed(p.action);
              return (
                <div key={p.partialId} className="training-resumable-item">
                  <div className="training-resumable-main">
                    <div className="training-resumable-title">{title}</div>
                    <div className="training-resumable-sub">
                      {tp.actionShown}{' '}
                      <span className={`training-resumable-action${red ? ' training-resumable-action-red' : ''}`}>
                        {actionText}
                      </span>
                    </div>
                    <div className="training-resumable-meta">
                      {tp.resumableAgeMin(ageMin)}
                    </div>
                  </div>
                  <div className="training-resumable-actions">
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

        <section className="training-scenarios">
          <h2 className="training-section-heading">{tp.title}</h2>
          {(!scenarios || scenarios.length === 0) ? (
            <p className="muted">{tp.empty}</p>
          ) : (
            <div className="training-scenario-list">
              {scenarios.map(s => (
                <div key={s.id} className="training-scenario-card">
                  <div className="training-scenario-main">
                    <div className="training-scenario-title">
                      {s.title?.[lang] || s.title?.en || s.id}
                    </div>
                    <div className="training-scenario-description">
                      {s.description?.[lang] || s.description?.en || ''}
                    </div>
                  </div>
                  <div className="training-scenario-actions">
                    <button className="btn-primary" onClick={() => onStart(s.id)}>
                      {tp.startBtn}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

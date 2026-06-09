// TrainingPicker — the user-facing scenario picker. Replaces the piece-1
// DevTrainingPicker harness. Renders a resumable callout (amber-tinted, so
// it reads as "in-progress — finish it", not as one of the scenario cards)
// above the main scenario list.
//
// Exhaustion rendering: scenarios the user has marked "no more alternatives"
// are hidden from the main list by default. A toggle below the main list
// reveals them in a separate faded section with a "Terminé" badge and the
// count of alternatives the user previously recorded. Clicking an exhausted
// scenario is allowed — the server creates a new exhaustion session and,
// on conclusion, its `_exhausted.json` entry is replaced (newest wins).

import { useMemo, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatActionText, actionIsRed } from './formatAction';

export default function TrainingPicker({
  scenarios,
  resumablePartials,
  exhaustedScenarios,   // [{scenarioId, sessionId, exhaustedAt, alternativesRecorded}, ...]
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
  function scenarioNumber(scenarioId) {
    return scenariosById[scenarioId]?.number ?? null;
  }
  // V2.2 Phase 2D — every scenario reference in the UI gets a stable
  // "#N — " prefix so the user can refer to scenarios by number. Number
  // falls back to nothing for legacy paths or if it hasn't loaded yet.
  function formatScenarioTitle(number, title) {
    return number ? `#${number} — ${title}` : title;
  }

  // Partition scenarios into active vs exhausted while preserving server order.
  const exhaustedMap = useMemo(() => {
    const m = {};
    for (const e of exhaustedScenarios || []) m[e.scenarioId] = e;
    return m;
  }, [exhaustedScenarios]);

  const activeScenarios    = useMemo(
    () => (scenarios || []).filter(s => !exhaustedMap[s.id]),
    [scenarios, exhaustedMap],
  );
  const completedScenarios = useMemo(
    () => (scenarios || []).filter(s => exhaustedMap[s.id]),
    [scenarios, exhaustedMap],
  );
  const completedCount = completedScenarios.length;

  // Group active scenarios by `section` for labeled headings (Option A). "120"
  // first, then any other named sections, then the un-sectioned default group
  // last — every active scenario still appears.
  const activeGroups = useMemo(() => {
    const bySection = new Map();
    for (const s of activeScenarios) {
      const key = s.section || '__default__';
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key).push(s);
    }
    const ordered = [];
    if (bySection.has('120')) ordered.push(['120', bySection.get('120')]);
    for (const [key, list] of bySection) {
      if (key === '120' || key === '__default__') continue;
      ordered.push([key, list]);
    }
    if (bySection.has('__default__')) ordered.push(['__default__', bySection.get('__default__')]);
    return ordered;
  }, [activeScenarios]);

  function sectionLabel(key) {
    if (key === '__default__') return tp.sectionDefault;
    return tp.sectionLabels?.[key] || key;
  }

  const [showCompleted, setShowCompleted] = useState(false);

  function renderScenarioCard(s, { completed } = {}) {
    const meta = completed ? exhaustedMap[s.id] : null;
    const cardClass = 'training-scenario-card' + (completed ? ' training-scenario-exhausted' : '');
    return (
      <div key={s.id} className={cardClass}>
        <div className="training-scenario-main">
          <div className="training-scenario-title">
            {formatScenarioTitle(s.number, s.title?.[lang] || s.title?.en || s.id)}
            {completed && (
              <span className="training-scenario-badge">{tp.completedBadge}</span>
            )}
          </div>
          <div className="training-scenario-description">
            {s.description?.[lang] || s.description?.en || ''}
          </div>
          {completed && meta && (
            <div className="training-scenario-alts">
              {tp.alternativesRecorded(meta.alternativesRecorded)}
            </div>
          )}
        </div>
        <div className="training-scenario-actions">
          <button className="btn-primary" onClick={() => onStart(s.id)}>
            {tp.startBtn}
          </button>
        </div>
      </div>
    );
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
              const title      = formatScenarioTitle(scenarioNumber(p.scenarioId), scenarioTitle(p.scenarioId));
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
          <div className="training-scenarios-head">
            <h2 className="training-section-heading">{tp.title}</h2>
            {scenarios?.length > 0 && (
              <span className="training-scenarios-count">
                {tp.scenariosToAnnotate(activeScenarios.length)}
              </span>
            )}
          </div>

          {(!scenarios || scenarios.length === 0) ? (
            <p className="muted">{tp.empty}</p>
          ) : (
            activeGroups.map(([key, list]) => (
              <div key={key} className="training-scenario-group">
                <h3 className="training-section-heading">{sectionLabel(key)}</h3>
                <div className="training-scenario-list">
                  {list.map(s => renderScenarioCard(s))}
                </div>
              </div>
            ))
          )}

          {completedCount > 0 && (
            <>
              <div className="training-completed-toggle-row">
                <button
                  type="button"
                  className="training-completed-toggle"
                  onClick={() => setShowCompleted(v => !v)}
                  aria-expanded={showCompleted}
                >
                  {showCompleted ? tp.hideCompleted : tp.showCompleted(completedCount)}
                </button>
              </div>

              {showCompleted && (
                <section className="training-completed-section">
                  <h3 className="training-completed-heading">{tp.completedSection}</h3>
                  <div className="training-scenario-list">
                    {completedScenarios.map(s => renderScenarioCard(s, { completed: true }))}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

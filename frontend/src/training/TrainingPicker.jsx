// TrainingPicker — the user-facing scenario picker. Renders a resumable callout
// (amber-tinted, so it reads as "in-progress — finish it", not as one of the
// scenario cards) above the main scenario list.
//
// Browsing the active list: a toolbar of family filter chips + a search box +
// a "Numéro / Famille" sort toggle (Numéro = flat by number, the default;
// Famille = grouped by family with headings). Chips/search/sort apply ONLY to
// the active scenarios — the resumable callout and the collapsible
// completed/exhausted section are unaffected.
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

// Scenario "family" derivation (id-prefix + section). A scenario can belong to
// several families (a 120 opening is both "120" and "Ouvertures") — chip
// filtering accepts that overlap. Famille-mode grouping needs a single bucket,
// so it uses the first match in FAMILY_ORDER as the primary family.
const FAMILY_ORDER = ['120', 'Ouvertures', 'Réponses', 'Compétitif', 'Validation', 'Autres'];

function familiesOf(s) {
  const fams = [];
  const id = s.id || '';
  if (s.section === '120') fams.push('120');
  if (id.startsWith('opening-')) fams.push('Ouvertures');
  if (id.startsWith('response-') || id.startsWith('raise-partner-')) fams.push('Réponses');
  if (
    id.startsWith('partner-opened-opp-overcalled-') ||
    id.startsWith('second-opp-opened-') ||
    id.startsWith('block-') ||
    id.startsWith('chique-') ||
    id.startsWith('facing-')
  ) fams.push('Compétitif');
  if (id.startsWith('validation-scenario-')) fams.push('Validation');
  if (fams.length === 0) fams.push('Autres');
  return fams;
}
function primaryFamily(s) {
  const fams = familiesOf(s);
  return FAMILY_ORDER.find(k => fams.includes(k)) || 'Autres';
}
const byNumber = (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity);

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
  function titleText(s) {
    return s.title?.[lang] || s.title?.en || s.id;
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

  // ── Toolbar state — family chip, search query, sort mode ──────────────────
  // Numéro (flat, by ascending number) is the default: the server's hash-
  // shuffled order scattered the numbers, which bugged users.
  const [activeFamily, setActiveFamily] = useState('all');
  const [query, setQuery]               = useState('');
  const [sortMode, setSortMode]         = useState('number'); // 'number' | 'family'

  function familyLabel(key) {
    return key === 'all' ? tp.familyAll : (tp.familyLabels?.[key] || key);
  }

  // Active scenarios after the family chip (membership, overlap ok) + the
  // case-insensitive title search (current language). The two combine (AND).
  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeScenarios.filter(s =>
      (activeFamily === 'all' || familiesOf(s).includes(activeFamily)) &&
      (!q || titleText(s).toLowerCase().includes(q)),
    );
  }, [activeScenarios, activeFamily, query, lang]);

  // Numéro: one flat list by ascending number.
  const numberSorted = useMemo(() => [...filteredActive].sort(byNumber), [filteredActive]);

  // Famille: grouped by primary family (FAMILY_ORDER), number-sorted within.
  const familyGroups = useMemo(() => {
    const byFam = new Map();
    for (const s of filteredActive) {
      const k = primaryFamily(s);
      if (!byFam.has(k)) byFam.set(k, []);
      byFam.get(k).push(s);
    }
    for (const list of byFam.values()) list.sort(byNumber);
    return FAMILY_ORDER.filter(k => byFam.has(k)).map(k => [k, byFam.get(k)]);
  }, [filteredActive]);

  const [showCompleted, setShowCompleted] = useState(false);

  const CHIP_KEYS = ['all', ...FAMILY_ORDER];

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
                {tp.scenariosToAnnotate(filteredActive.length)}
              </span>
            )}
          </div>

          {scenarios?.length > 0 && (
            <div className="training-toolbar">
              <div className="training-chip-row" role="tablist" aria-label={tp.title}>
                {CHIP_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeFamily === key}
                    className={'training-chip' + (activeFamily === key ? ' training-chip-active' : '')}
                    onClick={() => setActiveFamily(key)}
                  >
                    {familyLabel(key)}
                  </button>
                ))}
              </div>
              <div className="training-toolbar-row">
                <input
                  type="search"
                  className="training-search"
                  placeholder={tp.searchPlaceholder}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  aria-label={tp.searchPlaceholder}
                />
                <div className="training-sort" role="group" aria-label={`${tp.sortByNumber} / ${tp.sortByFamily}`}>
                  <button
                    type="button"
                    className={sortMode === 'number' ? 'training-sort-active' : ''}
                    aria-pressed={sortMode === 'number'}
                    onClick={() => setSortMode('number')}
                  >
                    {tp.sortByNumber}
                  </button>
                  <button
                    type="button"
                    className={sortMode === 'family' ? 'training-sort-active' : ''}
                    aria-pressed={sortMode === 'family'}
                    onClick={() => setSortMode('family')}
                  >
                    {tp.sortByFamily}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(!scenarios || scenarios.length === 0) ? (
            <p className="muted">{tp.empty}</p>
          ) : filteredActive.length === 0 ? (
            <p className="muted">{tp.emptyFiltered}</p>
          ) : sortMode === 'number' ? (
            <div className="training-scenario-list">
              {numberSorted.map(s => renderScenarioCard(s))}
            </div>
          ) : (
            familyGroups.map(([key, list]) => (
              <div key={key} className="training-scenario-group">
                <h3 className="training-section-heading">{familyLabel(key)}</h3>
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

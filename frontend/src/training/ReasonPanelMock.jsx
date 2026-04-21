// Mock harness — renders ReasonPanel against hardcoded data so the UX can
// be reviewed in isolation before sockets are wired. URL: ?mock=training-panel
// Remove this file after step 4 wiring is signed off.

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import ReasonPanel from './ReasonPanel';
import mockTags from './mockTags';

const MOCK_ACTIONS = [
  { label: 'Bid 90♠',        action: { type: 'bid',        value: 90, suit: 'S' } },
  { label: 'Pass',            action: { type: 'pass' } },
  { label: 'Coinche',         action: { type: 'coinche' } },
  { label: 'Surcoinche',      action: { type: 'surcoinche' } },
  { label: 'Play J♦',        action: { type: 'play-card', card: { value: 'J', suit: 'D' } } },
];

export default function ReasonPanelMock() {
  const { t } = useLang();
  const p = t.training.panel;
  const [idx, setIdx] = useState(0);
  const [lastSubmit, setLastSubmit] = useState(null);
  const [warningsOverride, setWarningsOverride] = useState(null);

  const action = MOCK_ACTIONS[idx].action;
  const actionType = action.type;
  const tagsForAction = {
    ...mockTags.actions[actionType],
    actionType, // so ReasonPanel can find i18n labels
  };

  function handleSubmit(tags, note, ackWarnings) {
    const submission = { action, tags, note, ackWarnings: !!ackWarnings };
    setLastSubmit(submission);
    console.log('[mock] submit:', submission);
    if (ackWarnings) setWarningsOverride(null);
  }

  function handleChangeAction() {
    console.log('[mock] change action clicked — would revert to AWAITING-ACTION');
    window.alert('(mock) Change-my-action would take the user back to the card/bid selection UI. Not simulated here.');
  }

  return (
    <div className="mock-harness">
      <div className="mock-harness-head">
        <h1>{p.mockHarnessHeading}</h1>
        <div className="mock-switcher">
          <span className="mock-switcher-label">{p.mockSwitcherLabel}:</span>
          {MOCK_ACTIONS.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`mock-switcher-btn${i === idx ? ' on' : ''}`}
              onClick={() => { setIdx(i); setLastSubmit(null); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mock-warning-toggle">
        <button
          type="button"
          className={`mock-switcher-btn${warningsOverride ? ' on' : ''}`}
          onClick={() => setWarningsOverride(
            warningsOverride
              ? null
              : ['Aucune étiquette "main d\'atout" — cette décision sera plus difficile à exploiter pour l\'extraction de règles.']
          )}
        >
          Preview soft-warning overlay
        </button>
      </div>

      <ReasonPanel
        key={idx} // remount on switch so internal state resets
        action={action}
        tagsForAction={tagsForAction}
        groupsMap={mockTags.groups}
        onSubmit={handleSubmit}
        onChangeAction={handleChangeAction}
        pendingWarnings={warningsOverride}
        onDismissWarnings={() => setWarningsOverride(null)}
      />

      {lastSubmit && (
        <div className="mock-submit-echo">
          <h3>Last submission</h3>
          <pre>{JSON.stringify(lastSubmit, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Mock harness for the v3 ReasonPanel. Activated via ?mock=training-panel.
// Lets the divergence-driven UI be reviewed without an authenticated
// session. Three preview states are toggled via a switcher in the harness
// header; each one drives the same ReasonPanel with different
// (action, expectedAnswer) pairs:
//
//   match        — user picked exactly what the rules suggest. The panel
//                  renders nothing in this state (parent auto-submits).
//                  We surface a placeholder line so the screenshot shows
//                  *something*.
//   divergent    — user picked 90 ♠; rules say pass. ReasonPanel asks
//                  "could pass also work?" + required note.
//   rule-silent  — user picked 110 ♦ on a competitive scenario. Rules
//                  don't cover it; ReasonPanel asks for a note only.

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import ReasonPanel from './ReasonPanel';

const MOCK_CASES = {
  match: {
    label:    (t) => t.training.panel.mockStateMatch,
    action:   { type: 'pass' },
    expected: { action: { type: 'pass' }, ruleReference: 'opening:pass-no-pattern-qualifies' },
  },
  divergent: {
    label:    (t) => t.training.panel.mockStateDivergent,
    action:   { type: 'bid', value: 90, suit: 'S' },
    expected: { action: { type: 'pass' }, ruleReference: 'opening:pass-no-pattern-qualifies' },
  },
  ruleSilent: {
    label:    (t) => t.training.panel.mockStateRuleSilent,
    action:   { type: 'bid', value: 110, suit: 'D' },
    expected: null, // rule-silent
  },
};

export default function ReasonPanelMock() {
  const { t } = useLang();
  const p = t.training.panel;
  const [stateKey, setStateKey] = useState('divergent');
  const current = MOCK_CASES[stateKey];

  return (
    <div>
      <div style={{
        padding: '10px 14px', background: '#0c1a25', color: '#8ea9bf',
        fontSize: '0.82em', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <strong>{p.mockHarnessHeading}</strong>
        <span>{p.mockSwitcherLabel}:</span>
        {Object.entries(MOCK_CASES).map(([key, def]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStateKey(key)}
            style={{
              background: stateKey === key ? 'var(--accent)' : 'transparent',
              color:      stateKey === key ? '#1a1a1a'       : 'var(--text)',
              border:     '1px solid rgba(255,255,255,0.22)',
              padding:    '4px 10px',
              borderRadius: '4px',
              fontSize:   '0.85em',
            }}
          >
            {def.label(t)}
          </button>
        ))}
      </div>

      {stateKey === 'match' ? (
        <div className="training-modal-backdrop">
          <div className="training-modal-content">
            <div className="training-reason-panel training-reason-v3">
              <div className="trp-action-head">
                <div className="trp-action-line">
                  {/* In the live flow this state is invisible to the user —
                      parent component auto-submits and the panel doesn't
                      mount. The harness shows a placeholder so reviewers
                      see what the match path looks like in transit. */}
                  ✓ {t.training.divergence.heading.userChoice('Pass')}
                  {' — '}
                  <em style={{ opacity: 0.7 }}>(submit silently — no UI)</em>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="training-modal-backdrop">
          <div className="training-modal-content">
            <ReasonPanel
              action={current.action}
              expectedAnswer={current.expected}
              onSubmit={(agreement, note) => console.log('[mock] submit:', { agreement, note })}
              onChangeAction={() => console.log('[mock] change-action clicked')}
              draftKey={`mock-${stateKey}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

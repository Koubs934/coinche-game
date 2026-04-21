// Mock harness for the TrainingPicker. Activated via ?mock=training-picker.
// Lets the UI be reviewed in isolation without an authenticated session —
// canned scenarios and a toggle to populate the exhausted list so the
// "show completed" path can be exercised without running a real session.

import { useState } from 'react';
import TrainingPicker from './TrainingPicker';

const MOCK_SCENARIOS = [
  {
    id: 'block-120-after-opp-overcall',
    title: { fr: 'Bloquer à 120 après surenchère adverse', en: 'Block at 120 after opponent overcall' },
    description: {
      fr: 'Partenaire ouvre 80♠, adversaire surenchérit à 100♥. Vous avez maître à l\'atout ♦. Bloquez-vous ?',
      en: 'Partner opens 80♠, opponent overcalls 100♥. You hold maître at ♦. Do you block?',
    },
  },
  {
    id: 'opening-petit-jeu-first-to-speak',
    title: { fr: 'Petit jeu d\'ouverture — premier à parler', en: 'Petit jeu opening — first to speak' },
    description: {
      fr: 'Vous êtes premier à parler avec valet troisième ♠ + As extérieur.',
      en: 'You are first to speak with J-third ♠ + outside Ace.',
    },
  },
  {
    id: 'petit-jeu-after-opp-80-spades',
    title: { fr: 'Petit jeu après 80♠ adverse', en: 'Petit jeu after opp 80♠' },
    description: {
      fr: 'Adversaire ouvre 80♠. Vous avez un petit jeu à ♦.',
      en: 'Opponent opens 80♠. You hold a petit-jeu at ♦.',
    },
  },
  {
    id: 'petit-jeu-after-partner-80-spades',
    title: { fr: 'Petit jeu après 80♠ partenaire', en: 'Petit jeu after partner 80♠' },
    description: {
      fr: 'Partenaire ouvre 80♠. Vous raisez ?',
      en: 'Partner opens 80♠. Do you raise?',
    },
  },
  {
    id: 'raise-partner-90-hearts',
    title: { fr: 'Relance de partenaire — 90♥', en: 'Partner raise — 90♥' },
    description: {
      fr: 'Partenaire ouvre 90♥. Vous avez la pièce manquante.',
      en: 'Partner opens 90♥. You hold the missing piece.',
    },
  },
];

const MOCK_EXHAUSTED = [
  {
    scenarioId:           'block-120-after-opp-overcall',
    sessionId:            '11111111-1111-1111-1111-111111111111',
    exhaustedAt:          '2026-04-21T03:00:00.000Z',
    alternativesRecorded: 3,
  },
  {
    scenarioId:           'raise-partner-90-hearts',
    sessionId:            '22222222-2222-2222-2222-222222222222',
    exhaustedAt:          '2026-04-21T04:30:00.000Z',
    alternativesRecorded: 1,
  },
];

export default function TrainingPickerMock() {
  const [withExhausted, setWithExhausted] = useState(true);

  return (
    <div>
      <div style={{ padding: '10px 14px', background: '#0c1a25', color: '#8ea9bf', fontSize: '0.82em', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span><strong>MOCK MODE — PICKER PREVIEW</strong></span>
        <button
          type="button"
          onClick={() => setWithExhausted(v => !v)}
          style={{
            background: withExhausted ? 'var(--accent)' : 'transparent',
            color:      withExhausted ? '#1a1a1a'       : 'var(--text)',
            border:     '1px solid rgba(255,255,255,0.22)',
            padding:    '4px 10px',
            borderRadius: '4px',
            fontSize:   '0.85em',
          }}
        >
          {withExhausted ? 'Exhausted: 2 entries (toggle)' : 'Exhausted: empty (toggle)'}
        </button>
      </div>
      <TrainingPicker
        scenarios={MOCK_SCENARIOS}
        resumablePartials={[]}
        exhaustedScenarios={withExhausted ? MOCK_EXHAUSTED : []}
        onStart={(id) => console.log('[mock] start scenario:', id)}
        onResume={() => {}}
        onDiscardPartial={() => {}}
        onBack={() => console.log('[mock] back clicked')}
      />
    </div>
  );
}

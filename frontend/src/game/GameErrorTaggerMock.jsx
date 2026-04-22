// Mock harness — renders GameErrorTagOverlay against a fake game state so
// the UX can be reviewed in isolation before sockets are wired. URL:
// ?mock=game-error-tagger. Parallels ReasonPanelMock / TrainingPickerMock.
//
// Seeded state:
//   - 3 completed tricks (trick index 0, 1, 2)
//   - trick index 3 in progress with 2 cards already played
//   - 4 named players (creator + 3 others) at seats 0, 1, 2, 3

import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import GameErrorTagOverlay from './GameErrorTagOverlay';

const c = (value, suit) => ({ value, suit });

// Cards chosen for visual variety (mix of suits + colours, includes trump 9 +
// a coeur sequence so the overlay is easy to scan on screenshot).
const MOCK_GAME = {
  gameId: 'mock-game-uuid',
  tricks: [
    {
      cards: [
        { card: c('9', 'H'), playerIndex: 1, playedAt: '2026-04-22T12:01:00Z' },
        { card: c('8', 'H'), playerIndex: 2, playedAt: '2026-04-22T12:01:03Z' },
        { card: c('Q', 'H'), playerIndex: 3, playedAt: '2026-04-22T12:01:06Z' },
        { card: c('A', 'H'), playerIndex: 0, playedAt: '2026-04-22T12:01:09Z' },
      ],
      winner: 0,
    },
    {
      cards: [
        { card: c('K', 'S'), playerIndex: 0, playedAt: '2026-04-22T12:02:00Z' },
        { card: c('7', 'S'), playerIndex: 1, playedAt: '2026-04-22T12:02:03Z' },
        { card: c('J', 'S'), playerIndex: 2, playedAt: '2026-04-22T12:02:06Z' },
        { card: c('10', 'S'), playerIndex: 3, playedAt: '2026-04-22T12:02:09Z' },
      ],
      winner: 2,
    },
    {
      cards: [
        { card: c('A', 'D'), playerIndex: 2, playedAt: '2026-04-22T12:03:00Z' },
        { card: c('9', 'D'), playerIndex: 3, playedAt: '2026-04-22T12:03:03Z' },
        { card: c('8', 'D'), playerIndex: 0, playedAt: '2026-04-22T12:03:06Z' },
        { card: c('7', 'D'), playerIndex: 1, playedAt: '2026-04-22T12:03:09Z' },
      ],
      winner: 2,
    },
  ],
  currentTrick: [
    { card: c('A', 'C'), playerIndex: 2, playedAt: '2026-04-22T12:04:00Z' },
    { card: c('10', 'C'), playerIndex: 3, playedAt: '2026-04-22T12:04:03Z' },
  ],
};

const MOCK_PLAYERS = [
  { userId: 'creator-1', username: 'AK7',  position: 0, team: 0, connected: true, isBot: false },
  { userId: 'user-2',    username: 'Rod',  position: 1, team: 1, connected: true, isBot: false },
  { userId: 'user-3',    username: 'Jeje', position: 2, team: 0, connected: true, isBot: false },
  { userId: 'user-4',    username: 'Bot',  position: 3, team: 1, connected: true, isBot: true  },
];

export default function GameErrorTaggerMock() {
  const { t, lang, toggleLang } = useLang();
  const [open, setOpen] = useState(true);
  const [lastSubmit, setLastSubmit] = useState(null);

  function handleSubmit(payload) {
    console.log('[mock] createGameErrorAnnotation →', payload);
    setLastSubmit(payload);
    setOpen(false);
  }

  return (
    <div className="mock-harness">
      <div className="mock-harness-head">
        <h1>Mock — {t.overlay.tagPlayError.heading}</h1>
        <div className="mock-switcher">
          <button
            type="button"
            className="mock-switcher-btn"
            onClick={toggleLang}
          >
            {lang.toUpperCase()}
          </button>
          <button
            type="button"
            className="mock-switcher-btn on"
            onClick={() => { setOpen(true); setLastSubmit(null); }}
          >
            Re-open overlay
          </button>
        </div>
      </div>

      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        {lang === 'fr'
          ? "3 plis complets + un pli en cours avec 2 cartes. Tous les plis sont sélectionnables."
          : '3 completed tricks + one in-progress trick with 2 cards played. All are selectable.'}
      </p>

      {lastSubmit && (
        <div className="mock-submit-echo">
          <h3>Last submission</h3>
          <pre>{JSON.stringify(lastSubmit, null, 2)}</pre>
        </div>
      )}

      {open && (
        <GameErrorTagOverlay
          game={MOCK_GAME}
          players={MOCK_PLAYERS}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

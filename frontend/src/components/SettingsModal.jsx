import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import HandSizeToggle from './HandSizeToggle';
import AdminPanel from './AdminPanel';

// "Réglages" overlay — consolidates the controls that used to be scattered across
// the Header and the in-game toolbar: language, Mode Delfino (in-game only), manage
// players (creator only), leave, and sign out. Rendered at App level so it has the
// socket + room state that leave/manage need, and so the gear is reachable from both
// lobby and game.
export default function SettingsModal({ open, onClose, socket, room, myPosition, onCycleHandSize }) {
  const { lang, toggleLang, t } = useLang();
  const { signOut } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  if (!open) return null;

  const myUserId  = room?.players?.find(p => p.position === myPosition)?.userId;
  const isCreator = !!room && myUserId === room.creatorId;
  const inGame    = !!room && ['PLAYING', 'ROUND_OVER', 'GAME_OVER', 'SHUFFLE', 'CUT'].includes(room.phase);

  function removePlayer(targetUserId) {
    socket?.emit('removePlayer', { code: room.code, targetUserId });
  }

  function leave() {
    if (!room) return;
    if (!window.confirm(t.leaveConfirmGame)) return;
    socket?.emit('leaveRoom', { code: room.code });
    onClose();
  }

  // Manage-players is its own full-screen overlay (reused as-is). When opened from
  // here, render it instead of the settings panel; closing it returns to settings.
  if (showAdmin && isCreator) {
    return (
      <AdminPanel
        players={room.players}
        creatorId={room.creatorId}
        myUserId={myUserId}
        phase={room.phase}
        onRemove={removePlayer}
        onClose={() => setShowAdmin(false)}
      />
    );
  }

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel settings-panel" onClick={e => e.stopPropagation()}>
        <div className="admin-panel-header">
          <span className="admin-panel-title">{t.settings}</span>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-rows">
          {/* Language */}
          <div className="settings-row">
            <span className="settings-row-label">{t.language}</span>
            <button className="btn-lang" onClick={toggleLang} title="Toggle language">
              {lang.toUpperCase()}
            </button>
          </div>

          {/* Mode Delfino — only in a live game (hidden in the lobby) */}
          {inGame && onCycleHandSize && (
            <div className="settings-row">
              <HandSizeToggle onCycle={onCycleHandSize} />
            </div>
          )}

          {/* Manage players — creator only */}
          {isCreator && (
            <div className="settings-row">
              <button className="btn-manage" onClick={() => setShowAdmin(true)} title={t.managePlayersTitle}>
                ⚙ {t.managePlayers}
              </button>
            </div>
          )}

          {/* Leave the table */}
          {room && (
            <div className="settings-row">
              <button className="btn-leave" onClick={leave}>
                ⎋ {t.leaveTable}
              </button>
            </div>
          )}

          {/* Sign out */}
          <div className="settings-row">
            <button className="btn-link btn-signout" onClick={signOut} title={t.signOut}>
              ⎋ {t.signOut}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

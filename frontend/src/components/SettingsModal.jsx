import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { useModeSacha } from '../context/ModeSachaContext';
import AdminPanel from './AdminPanel';

// Reusable pill switch (track + sliding knob). Teal/accent track when ON, muted when OFF.
function Switch({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`pref-switch${on ? ' on' : ''}`}
      onClick={onToggle}
    >
      <span className="pref-switch-knob" />
    </button>
  );
}

// "Réglages" overlay — consolidates language, Mode Delfino, Mode Sacha (preferences),
// plus manage / leave / sign-out (actions). Rendered at App level so it has the socket
// + room state that leave/manage need, and so the gear is reachable from lobby + game.
export default function SettingsModal({ open, onClose, socket, room, game, myPosition, handSize, onCycleHandSize }) {
  const { lang, toggleLang, t } = useLang();
  const { signOut } = useAuth();
  const { modeSacha, toggleModeSacha } = useModeSacha();
  const [showAdmin, setShowAdmin] = useState(false);

  if (!open) return null;

  const myUserId  = room?.players?.find(p => p.position === myPosition)?.userId;
  const isCreator = !!room && myUserId === room.creatorId;
  const inGame    = !!room && ['PLAYING', 'ROUND_OVER', 'GAME_OVER', 'SHUFFLE', 'CUT'].includes(room.phase);
  const delfinoOn = handSize === 'XL';

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
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">{t.settings}</span>
          <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="settings-section">{t.preferences}</div>

        {/* Language — segmented FR | EN */}
        <div className="settings-row">
          <span className="settings-row-label">{t.language}</span>
          <div className="seg-toggle" role="group" aria-label={t.language}>
            {['fr', 'en'].map(l => (
              <button
                key={l}
                type="button"
                className={`seg-opt${lang === l ? ' active' : ''}`}
                onClick={() => { if (lang !== l) toggleLang(); }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Delfino — in-game only; switch flips hand-card size */}
        {inGame && onCycleHandSize && (
          <div className="settings-row pref-row">
            <div className="pref-text">
              <span className="settings-row-label">Mode Delfino</span>
              <span className="pref-subtitle">{delfinoOn ? t.delfinoOn : t.delfinoOff}</span>
            </div>
            <Switch on={delfinoOn} onToggle={onCycleHandSize} label="Mode Delfino" />
          </div>
        )}

        {/* Mode Sacha — global sort preference */}
        <div className="settings-row pref-row">
          <div className="pref-text">
            <span className="settings-row-label">{t.modeSacha}</span>
            <span className="pref-subtitle">{modeSacha ? t.sachaOn : t.sachaOff}</span>
          </div>
          <Switch on={modeSacha} onToggle={toggleModeSacha} label={t.modeSacha} />
        </div>

        {/* Partner peek — server-gated: canPeek is true only for the two specific,
            partnered users. Emits the toggle; the reveal itself is server-driven. */}
        {game?.canPeek && (
          <div className="settings-row">
            <span className="settings-row-label">{t.partnerPeek}</span>
            <Switch
              on={!!game.peekOn}
              onToggle={() => socket?.emit('togglePartnerPeek', { code: room.code })}
              label={t.partnerPeek}
            />
          </div>
        )}

        {/* Manage players — creator only */}
        {isCreator && (
          <>
            <div className="settings-divider" />
            <button className="settings-action" onClick={() => setShowAdmin(true)}>
              <span>{t.managePlayers}</span>
              <span className="settings-chevron" aria-hidden="true">›</span>
            </button>
          </>
        )}

        <div className="settings-divider" />

        {/* Destructive actions — uniform red rows */}
        {room && (
          <button className="settings-action danger" onClick={leave}>
            {t.leaveTable}
          </button>
        )}
        <button className="settings-action danger" onClick={signOut}>
          {t.signOut}
        </button>
      </div>
    </div>
  );
}

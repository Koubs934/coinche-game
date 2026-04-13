import { useLang } from '../context/LanguageContext';

export default function AdminPanel({ players, creatorId, myUserId, phase, onRemove, onClose }) {
  const { t } = useLang();
  const inGame = phase !== 'LOBBY';

  function handleRemove(player) {
    const msg = inGame ? t.removeConfirm(player.username) : t.removeConfirmLobby(player.username);
    if (!window.confirm(msg)) return;
    onRemove(player.userId);
  }

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={e => e.stopPropagation()}>
        <div className="admin-panel-header">
          <span className="admin-panel-title">{t.managePlayersTitle}</span>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-panel-list">
          {players.map(p => (
            <div key={p.userId} className="admin-player-row">
              <div className="admin-player-info">
                <span className={`admin-player-name${!p.connected ? ' disconnected' : ''}`}>
                  {p.isBot ? '🤖 ' : ''}{p.username}
                  {p.userId === creatorId && (
                    <span className="admin-badge">{t.adminBadge}</span>
                  )}
                  {!p.connected && <span className="dc-indicator"> ⚠</span>}
                </span>
                <span className="admin-player-meta">
                  {t.team} {p.team + 1}
                  {inGame && p.position !== undefined && ` · ${t.seat} ${p.position + 1}`}
                </span>
              </div>
              {p.userId !== myUserId && (
                <button className="btn-remove-admin" onClick={() => handleRemove(p)}>
                  {t.removePlayer}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

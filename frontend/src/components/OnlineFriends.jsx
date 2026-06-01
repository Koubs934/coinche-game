import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import Avatar from './Avatar';

// Friends presence in the lobby, split into two sections:
//   • "Amis en ligne" — only en ligne / en partie friends (offline dropped).
//   • "Amis hors ligne (N)" — collapsible, collapsed by default; the offline
//     friends, dimmed. Not rendered at all when nobody is offline.
//
// Pure presentational: `friends` (already merged + self-excluded) comes from
// Lobby. Each friend: { id, username, status } where status ∈ 'online' |
// 'in-game' | 'offline'.
//
// Subtle per-user avatar tint: a deterministic hue from the userId so each
// person keeps a stable colour without needing a stored preference.
function hueFor(id) {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

const STATUS_ORDER = { online: 0, 'in-game': 1, offline: 2 };

export default function OnlineFriends({ friends }) {
  const { t } = useLang();
  const [offlineOpen, setOfflineOpen] = useState(false);

  const sorted = [...(friends || [])].sort((a, b) =>
    (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) ||
    a.username.localeCompare(b.username));

  const online  = sorted.filter(f => f.status !== 'offline');
  const offline = sorted.filter(f => f.status === 'offline');

  const statusLabel = (s) =>
    s === 'in-game' ? t.lobby.statusInGame
    : s === 'online' ? t.lobby.statusOnline
    : t.lobby.statusOffline;

  const renderChip = (f) => {
    const initial = (f.username?.[0] || '?').toUpperCase();
    const isOffline = f.status === 'offline';
    return (
      <li key={f.id} className={`friend${isOffline ? ' friend-offline' : ''}`}>
        <div className="friend-avatar-wrap">
          <Avatar
            config={f.avatarConfig}
            initial={initial}
            variant="head"
            circleClassName="friend-avatar"
            circleStyle={isOffline ? undefined : { background: `hsl(${hueFor(f.id)} 45% 32%)` }}
          />
          <span className={`friend-dot friend-dot-${f.status}`} aria-hidden="true" />
        </div>
        <span className="friend-name" title={f.username}>{f.username}</span>
        <span className="friend-status">{statusLabel(f.status)}</span>
      </li>
    );
  };

  return (
    <>
      <section className="friends-online">
        <div className="friends-head">
          <h2 className="friends-title">{t.lobby.friends}</h2>
          <span className="friends-count">{t.lobby.onlineCount(online.length)}</span>
        </div>

        {online.length === 0 ? (
          <p className="friends-empty">{t.lobby.noOneOnline}</p>
        ) : (
          <ul className="friends-row">{online.map(renderChip)}</ul>
        )}
      </section>

      {offline.length > 0 && (
        <section className="friends-offline">
          <button
            type="button"
            className="friends-offline-head"
            onClick={() => setOfflineOpen(o => !o)}
            aria-expanded={offlineOpen}
          >
            <span className={`friends-chevron${offlineOpen ? ' open' : ''}`} aria-hidden="true">▸</span>
            <span className="friends-title">{t.lobby.friendsOffline} ({offline.length})</span>
          </button>
          {offlineOpen && <ul className="friends-row">{offline.map(renderChip)}</ul>}
        </section>
      )}
    </>
  );
}

import { useLang } from '../context/LanguageContext';

// "Amis en ligne" — horizontal avatar row of every registered user with live
// presence. Pure presentational: `friends` (already merged + self-excluded) and
// the online count come from Lobby. Each friend: { id, username, status }
// where status ∈ 'online' | 'in-game' | 'offline'.
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

  const sorted = [...(friends || [])].sort((a, b) =>
    (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) ||
    a.username.localeCompare(b.username));

  const onlineCount = sorted.filter(f => f.status !== 'offline').length;

  const statusLabel = (s) =>
    s === 'in-game' ? t.lobby.statusInGame
    : s === 'online' ? t.lobby.statusOnline
    : t.lobby.statusOffline;

  return (
    <section className="friends-online">
      <div className="friends-head">
        <h2 className="friends-title">{t.lobby.friends}</h2>
        <span className="friends-count">{t.lobby.onlineCount(onlineCount)}</span>
      </div>

      {/* When nobody is online, show the subtle empty state rather than a row
          of dimmed avatars. Offline users appear (dimmed, at the end) only once
          at least one person is online. */}
      {onlineCount === 0 ? (
        <p className="friends-empty">{t.lobby.noOneOnline}</p>
      ) : (
        <ul className="friends-row">
          {sorted.map(f => {
            const initial = (f.username?.[0] || '?').toUpperCase();
            const offline = f.status === 'offline';
            return (
              <li key={f.id} className={`friend${offline ? ' friend-offline' : ''}`}>
                <div className="friend-avatar-wrap">
                  <div
                    className="friend-avatar"
                    style={{
                      background: offline
                        ? undefined
                        : `hsl(${hueFor(f.id)} 45% 32%)`,
                    }}
                  >
                    {initial}
                  </div>
                  <span className={`friend-dot friend-dot-${f.status}`} aria-hidden="true" />
                </div>
                <span className="friend-name" title={f.username}>{f.username}</span>
                <span className="friend-status">{statusLabel(f.status)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

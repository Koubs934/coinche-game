import { useLang } from '../context/LanguageContext';

// "Parties en cours" — the home-screen list of active rooms the user can join
// or rejoin. Pure presentational: rooms + handlers come from Lobby. Each room
// is already pre-filtered server-side (full rooms the user isn't in are hidden).
export default function ActiveGamesList({ rooms, onJoin, onRefresh }) {
  const { t } = useLang();

  const modeLabel = (mode) =>
    mode === 'belote' ? t.lobby.modeBelote : t.lobby.modeCoinche;

  // Seated humans first, then bots, capped to keep the line short.
  const namesLine = (players) => {
    const names = (players || []).map(p => (p.isBot ? `🤖 ${p.username}` : p.username));
    return names.join(', ');
  };

  return (
    <section className="active-games">
      <div className="active-games-head">
        <h2 className="active-games-title">{t.lobby.activeGames}</h2>
        <button
          className="active-games-refresh"
          onClick={onRefresh}
          title={t.lobby.refresh}
          aria-label={t.lobby.refresh}
        >
          ⟳
        </button>
      </div>

      {(!rooms || rooms.length === 0) ? (
        <p className="active-games-empty">{t.lobby.noActiveGames}</p>
      ) : (
        <ul className="active-games-list">
          {rooms.map(room => (
            <li key={room.code} className="game-card">
              <div className="game-card-info">
                <div className="game-card-top">
                  <span className="game-card-code">{room.code}</span>
                  <span className="game-card-meta">
                    {t.lobby.roomLine(room.playerCount, modeLabel(room.mode))}
                  </span>
                </div>
                <span className="game-card-players">{namesLine(room.players)}</span>
              </div>
              <button
                className={`btn-secondary game-card-join${room.canRejoin ? ' is-rejoin' : ''}`}
                onClick={() => onJoin(room)}
              >
                {room.canRejoin ? t.lobby.rejoin : t.lobby.join}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

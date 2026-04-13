import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

export default function Lobby({ socket, roomState, myPosition, pendingRoom, onCancelPending }) {
  const { user, username } = useAuth();
  const { t } = useLang();
  const [codeInput, setCodeInput] = useState('');
  const [targetInput, setTargetInput] = useState('2000');
  const [error, setError] = useState('');
  const [view, setView] = useState('home'); // 'home' | 'create' | 'join'

  function createRoom() {
    socket.emit('createRoom');
    setView('create');
  }

  function joinRoom(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    socket.emit('joinRoom', { code: codeInput.trim().toUpperCase() });
  }

  function assignTeam(targetUserId, team) {
    socket.emit('assignTeam', { code: roomState.code, targetUserId, team });
  }

  function updateTargetScore(val) {
    setTargetInput(val);
    const n = parseInt(val, 10);
    if (n >= 500) {
      socket.emit('setTargetScore', { code: roomState.code, targetScore: n });
    }
  }

  function startGame() {
    socket.emit('startGame', { code: roomState.code });
  }

  function fillWithBots() {
    socket.emit('fillWithBots', { code: roomState.code });
  }

  function leaveLobby() {
    if (!window.confirm(t.leaveConfirmLobby)) return;
    socket.emit('leaveRoom', { code: roomState.code });
  }

  // ── Error listener already handled in App ──

  // ── Waiting for admin approval ────────────────────────────────────────────
  if (pendingRoom) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <h2>{t.waitingApproval}</h2>
          <div className="room-code-display">{pendingRoom}</div>
          <p className="lobby-welcome">{t.waitingApprovalMsg}</p>
          <button className="btn-leave" onClick={onCancelPending}>← {t.cancelRequest}</button>
        </div>
      </div>
    );
  }

  // ── In-room lobby ─────────────────────────────────────────────────────────
  if (roomState) {
    const { code, players, creatorId, targetScore } = roomState;
    const isCreator = user?.id === creatorId;
    const team0 = players.filter(p => p.team === 0);
    const team1 = players.filter(p => p.team === 1);
    const canStart = players.length === 4 && team0.length === 2 && team1.length === 2;

    return (
      <div className="lobby">
        <div className="lobby-card">
          <h2>{t.shareCode}</h2>
          <div className="room-code-display">{code}</div>
          <p className="player-count">{t.playersJoined(players.length)}</p>

          <div className="teams-container">
            {[0, 1].map(teamIdx => (
              <div key={teamIdx} className="team-column">
                <h3>{teamIdx === 0 ? t.team1 : t.team2}</h3>
                {players.filter(p => p.team === teamIdx).map(p => (
                  <div key={p.userId} className="team-player">
                    <span className={p.connected ? '' : 'disconnected'}>
                      {p.isBot ? '🤖 ' : ''}{p.username}{p.userId === user?.id ? ' ★' : ''}
                    </span>
                    {isCreator && p.userId !== user?.id && (
                      <button
                        className="btn-small"
                        onClick={() => assignTeam(p.userId, 1 - teamIdx)}
                      >
                        → {teamIdx === 0 ? t.team2 : t.team1}
                      </button>
                    )}
                  </div>
                ))}
                {/* Empty slots */}
                {Array.from({ length: 2 - players.filter(p => p.team === teamIdx).length }).map((_, i) => (
                  <div key={`empty-${i}`} className="team-player empty">—</div>
                ))}
              </div>
            ))}
          </div>

          {isCreator && (
            <div className="target-score-row">
              <label>
                {t.targetScore}:
                <input
                  type="number"
                  min="500"
                  step="100"
                  value={targetInput}
                  onChange={e => updateTargetScore(e.target.value)}
                  className="target-input"
                />
              </label>
            </div>
          )}
          {!isCreator && (
            <p className="target-display">{t.targetScore}: {targetScore}</p>
          )}

          {isCreator && players.length < 4 && (
            <button className="btn-secondary" onClick={fillWithBots}>
              🤖 {t.fillWithBots}
            </button>
          )}

          {isCreator && (
            <button
              className="btn-primary"
              onClick={startGame}
              disabled={!canStart}
              title={!canStart ? (players.length < 4 ? t.needFourPlayers : t.needEqualTeams) : ''}
            >
              {t.startGame}
            </button>
          )}
          {!isCreator && (
            <p className="waiting-msg">{t.waitingForPlayers}</p>
          )}

          <button className="btn-leave" onClick={leaveLobby}>
            ← {t.leaveTable}
          </button>
        </div>
      </div>
    );
  }

  // ── Home screen ────────────────────────────────────────────────────────────
  if (view === 'join') {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <h2>{t.joinRoom}</h2>
          <form onSubmit={joinRoom}>
            <label>
              {t.roomCode}
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                maxLength={6}
                className="code-input"
                placeholder="ABC123"
                autoFocus
              />
            </label>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary">{t.join}</button>
          </form>
          <button className="btn-link" onClick={() => setView('home')}>←</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby lobby-home">
      <div className="lobby-card">
        <h1 className="lobby-title">♦ Belote ♣</h1>
        <p className="lobby-welcome">👋 {username}</p>
        <button className="btn-primary btn-large" onClick={createRoom}>{t.createRoom}</button>
        <button className="btn-secondary btn-large" onClick={() => setView('join')}>{t.joinRoom}</button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import AdminPanel from './AdminPanel';
import ActiveGamesList from './ActiveGamesList';
import OnlineFriends from './OnlineFriends';
import { supabase } from '../lib/supabase';

export default function Lobby({
  socket, roomState, myPosition, pendingRoom, onCancelPending,
  onOpenTraining, resumableCount = 0,
}) {
  const { user, username } = useAuth();
  const { t } = useLang();
  const [codeInput, setCodeInput] = useState('');
  const [targetInput, setTargetInput] = useState('2000');
  const [error, setError] = useState('');
  const [view, setView] = useState('home'); // 'home' | 'create' | 'join'
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);
  const [profiles, setProfiles] = useState([]);   // all registered users (Supabase)
  const [presence, setPresence] = useState({});   // userId → 'online' | 'in-game'

  // Whether the home/landing screen is showing (not in a room, not pending).
  const onHome = !roomState && !pendingRoom;

  // Active-rooms list ("Parties en cours"): fetch on mount + window focus, and
  // re-fetch whenever the server pings 'lobby:roomsChanged'. Only runs on the
  // home screen so we don't poll while inside a room. Listeners are scoped here
  // (App.jsx owns the room-state events; this owns the lobby-list events).
  useEffect(() => {
    if (!socket || !onHome) return;
    const fetchRooms = () => socket.emit('lobby:getRooms');
    const onRooms    = ({ rooms }) => setActiveRooms(Array.isArray(rooms) ? rooms : []);
    const onChanged  = () => fetchRooms();
    socket.on('lobby:rooms', onRooms);
    socket.on('lobby:roomsChanged', onChanged);
    window.addEventListener('focus', fetchRooms);
    fetchRooms();
    return () => {
      socket.off('lobby:rooms', onRooms);
      socket.off('lobby:roomsChanged', onChanged);
      window.removeEventListener('focus', fetchRooms);
    };
  }, [socket, onHome]);

  // Full registered-user roster ("Amis en ligne"). The backend has no Supabase
  // access, so the roster is read here from public.profiles (RLS allows any
  // authenticated user to select); presence (online/in-game) comes from the
  // backend below and is merged in render. Fetched once per home visit.
  useEffect(() => {
    if (!onHome || !user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, username')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[friends] profiles fetch failed:', error.message); return; }
        if (Array.isArray(data)) setProfiles(data);
      });
    return () => { cancelled = true; };
  }, [onHome, user]);

  // Presence map from the backend: fetch on mount + window focus, re-fetch on
  // the 'lobby:presenceChanged' ping. Mirrors the active-rooms effect above.
  useEffect(() => {
    if (!socket || !onHome) return;
    const fetchFriends = () => socket.emit('lobby:getFriends');
    const onFriends    = ({ presence: p }) => setPresence(p && typeof p === 'object' ? p : {});
    const onChanged    = () => fetchFriends();
    socket.on('lobby:friends', onFriends);
    socket.on('lobby:presenceChanged', onChanged);
    window.addEventListener('focus', fetchFriends);
    fetchFriends();
    return () => {
      socket.off('lobby:friends', onFriends);
      socket.off('lobby:presenceChanged', onChanged);
      window.removeEventListener('focus', fetchFriends);
    };
  }, [socket, onHome]);

  // Reuse the existing flows: REJOIN (user holds a seat) goes through rejoinRoom
  // / handleReconnect; JOIN (free seat) goes through joinRoom (which itself
  // routes lobby vs in-game / creator vs pending-approval server-side).
  function joinActiveRoom(room) {
    if (!socket) return;
    setError('');
    if (room.canRejoin) socket.emit('rejoinRoom', { code: room.code });
    else                socket.emit('joinRoom',   { code: room.code });
  }

  function createRoom() {
    socket.emit('createRoom');
    setView('create');
  }

  const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
  const trimmedCode = codeInput.trim().toUpperCase();
  const codeIsValid = ROOM_CODE_RE.test(trimmedCode);

  function joinRoom(e) {
    e.preventDefault();
    if (!codeIsValid) {
      setError(t.invalidRoomCode);
      return;
    }
    setError('');
    socket.emit('joinRoom', { code: trimmedCode });
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
        {showAdminPanel && isCreator && (
          <AdminPanel
            players={players} creatorId={creatorId} myUserId={user?.id}
            phase="LOBBY"
            onRemove={(targetUserId) => socket.emit('removePlayer', { code, targetUserId })}
            onClose={() => setShowAdminPanel(false)}
          />
        )}
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

          {isCreator && players.length > 1 && (
            <button className="btn-secondary btn-manage-lobby" onClick={() => setShowAdminPanel(true)}>
              ⚙ {t.managePlayers}
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
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); if (error) setError(''); }}
                maxLength={6}
                className={`code-input${codeInput && !codeIsValid ? ' input-invalid' : ''}`}
                placeholder="ABC123"
                autoFocus
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                pattern="[A-Za-z0-9]{6}"
              />
            </label>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary" disabled={!codeIsValid}>{t.join}</button>
          </form>
          <button className="btn-link" onClick={() => setView('home')}>←</button>
        </div>
      </div>
    );
  }

  const avatarInitial = (username?.[0] || '?').toUpperCase();

  // Merge the roster with live presence, excluding self. Anyone not in the
  // presence map is offline.
  const friends = profiles
    .filter(p => p.id !== user?.id)
    .map(p => ({ id: p.id, username: p.username || '?', status: presence[p.id] || 'offline' }));

  return (
    <div className="lobby lobby-home">
      <div className="home-wrap">
        {/* Profile strip */}
        <div className="home-profile">
          <div className="home-avatar">{avatarInitial}</div>
          <div className="home-profile-text">
            <span className="home-profile-name">{username}</span>
            <span className="home-profile-sub">{t.lobby.readyToPlay}</span>
          </div>
        </div>

        {/* Primary + secondary actions */}
        <div className="home-actions">
          <button className="btn-primary home-create" onClick={createRoom}>
            {t.createRoom}
          </button>
          <div className="home-actions-row">
            <button className="btn-secondary home-action-sm" onClick={() => setView('join')}>
              {t.joinRoom}
            </button>
            {onOpenTraining && (
              <button className="btn-secondary home-action-sm" onClick={onOpenTraining}>
                {t.lobbyTrainingBtn}
              </button>
            )}
          </div>
          {onOpenTraining && resumableCount > 0 && (
            <p className="lobby-training-hint">{t.lobbyResumableHint(resumableCount)}</p>
          )}
        </div>

        {/* Parties en cours */}
        <ActiveGamesList
          rooms={activeRooms}
          onJoin={joinActiveRoom}
          onRefresh={() => socket?.emit('lobby:getRooms')}
        />

        {/* Amis en ligne */}
        <OnlineFriends friends={friends} />
      </div>
    </div>
  );
}

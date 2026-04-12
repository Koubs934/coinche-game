import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LanguageContext';
import Auth from './components/Auth';
import Header from './components/Header';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function App() {
  const { user, username, loading } = useAuth();
  const { lang, toggleLang, t } = useLang();

  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(false);
  const [socketError, setSocketError] = useState('');

  // Game state synced from server
  const [roomState, setRoomState] = useState(null); // public room info
  const [gameState, setGameState] = useState(null); // filtered game info
  const [myPosition, setMyPosition] = useState(null);

  // ── Socket setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      auth: { userId: user.id, username },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketReady(true);
      setSocketError('');

      // Attempt to rejoin if we have a room code stored
      const savedCode = sessionStorage.getItem('coinche_room');
      if (savedCode) {
        socket.emit('rejoinRoom', { code: savedCode });
      }
    });

    socket.on('disconnect', () => {
      setSocketReady(false);
    });

    socket.on('connect_error', (err) => {
      setSocketError(`Connection error: ${err.message}`);
    });

    socket.on('roomJoined', ({ room, game, myPosition: pos }) => {
      setRoomState(room);
      setGameState(game);
      setMyPosition(pos);
      sessionStorage.setItem('coinche_room', room.code);
    });

    socket.on('roomUpdate', ({ room, game, myPosition: pos }) => {
      setRoomState(room);
      setGameState(game);
      if (pos !== undefined) setMyPosition(pos);
    });

    socket.on('error', ({ message }) => {
      setSocketError(message);
      setTimeout(() => setSocketError(''), 4000);
    });

    socket.on('leftRoom', () => {
      setRoomState(null);
      setGameState(null);
      setMyPosition(null);
      sessionStorage.removeItem('coinche_room');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-logo">♦ Belote ♣</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="lang-toggle-fixed">
          <button className="btn-lang" onClick={toggleLang}>{lang.toUpperCase()}</button>
        </div>
        <Auth />
      </>
    );
  }

  const inGame = roomState && (roomState.phase === 'PLAYING' || roomState.phase === 'ROUND_OVER' || roomState.phase === 'GAME_OVER');

  return (
    <div className="app">
      <Header
        roomCode={roomState?.code}
        scores={roomState?.scores}
        targetScore={roomState?.targetScore}
      />

      {socketError && (
        <div className="toast-error">{socketError}</div>
      )}

      {!socketReady && user && (
        <div className="toast-info">{t.reconnecting}</div>
      )}

      {inGame && gameState ? (
        <GameBoard
          socket={socketRef.current}
          roomCode={roomState.code}
          room={roomState}
          game={gameState}
          myPosition={myPosition}
        />
      ) : (
        <Lobby
          socket={socketRef.current}
          roomState={roomState?.phase === 'LOBBY' ? roomState : null}
          myPosition={myPosition}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LanguageContext';
import Auth from './components/Auth';
import Header from './components/Header';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Stable fallback used when game is null (SHUFFLE/CUT before first deal, or loading).
// dealer: -1 so that any real dealer (0-3) is always different, ensuring the
// dealer-change useEffect in GameBoard fires and re-evaluates the sort candidate.
const EMPTY_GAME = {
  dealer: -1, phase: null, currentBid: null, biddingTurn: null,
  consecutivePasses: 0, biddingActions: [null, null, null, null],
  biddingHistory: [], tricks: [], currentTrick: [], currentPlayer: null,
  trumpSuit: null, beloteInfo: { playerIndex: null, declared: null, rebeloteDone: false, complete: false },
  roundScores: [0, 0], contractMade: null, trickPoints: null,
  hands: [[], [], [], []], handCounts: [0, 0, 0, 0],
};

export default function App() {
  const { user, username, loading } = useAuth();
  const { lang, toggleLang, t } = useLang();

  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [socketInfo, setSocketInfo] = useState(''); // transient info toast (reconnect, etc.)
  const wasDisconnectedRef = useRef(false);

  // Game state synced from server
  const [roomState, setRoomState] = useState(null); // public room info
  const [gameState, setGameState] = useState(null); // filtered game info
  const [myPosition, setMyPosition] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null); // code when waiting for admin approval

  // Ref mirrors so the socket handler closure sees current state without re-subscribing
  const gameStateRef = useRef(null);
  const myPositionRef = useRef(null);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { myPositionRef.current = myPosition; }, [myPosition]);

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

      // If this is a reconnect (not the initial connect), show a transient
      // confirmation — mention the turn explicitly if the player was mid-action.
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        const g = gameStateRef.current;
        const myPos = myPositionRef.current;
        const myTurn = g && (
          (g.phase === 'BIDDING' && g.biddingTurn === myPos) ||
          (g.phase === 'PLAYING' && g.currentPlayer === myPos)
        );
        setSocketInfo(myTurn ? t.reconnectedYourTurn : t.reconnected);
        setTimeout(() => setSocketInfo(''), 3000);
      }
    });

    socket.on('disconnect', () => {
      setSocketReady(false);
      wasDisconnectedRef.current = true;
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

    socket.on('joinPending', ({ code }) => {
      setPendingRoom(code);
      sessionStorage.setItem('coinche_room', code);
    });

    socket.on('leftRoom', () => {
      setRoomState(null);
      setGameState(null);
      setMyPosition(null);
      setPendingRoom(null);
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

  const inGame = roomState && ['PLAYING', 'ROUND_OVER', 'GAME_OVER', 'SHUFFLE', 'CUT'].includes(roomState.phase);

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

      {socketReady && socketInfo && (
        <div className="toast-info">{socketInfo}</div>
      )}

      {inGame ? (
        <GameBoard
          socket={socketRef.current}
          roomCode={roomState.code}
          room={roomState}
          game={gameState ?? EMPTY_GAME}
          myPosition={myPosition}
        />
      ) : (
        <Lobby
          socket={socketRef.current}
          roomState={roomState?.phase === 'LOBBY' ? roomState : null}
          myPosition={myPosition}
          pendingRoom={pendingRoom}
          onCancelPending={() => {
            socketRef.current?.emit('cancelJoinRequest', { code: pendingRoom });
            setPendingRoom(null);
            sessionStorage.removeItem('coinche_room');
          }}
        />
      )}
    </div>
  );
}

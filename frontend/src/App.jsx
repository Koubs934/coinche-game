import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LanguageContext';
import Auth from './components/Auth';
import Header from './components/Header';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import ReasonPanelMock from './training/ReasonPanelMock';
import TrainingTable from './training/TrainingTable';
import CompletionSummary from './training/CompletionSummary';
import TrainingPicker from './training/TrainingPicker';
import TrainingPickerMock from './training/TrainingPickerMock';
import EnvBadge from './components/EnvBadge';
import { cleanupOldDrafts } from './training/noteDraft';

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

// URL flags (read once at module load; don't change during a session):
//   ?mock=training-panel  → reason-panel UX preview, no auth, no sockets
const URL_PARAMS = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();
const MOCK_MODE = URL_PARAMS.get('mock');

export default function App() {
  const { user, username, loading } = useAuth();
  const { lang, toggleLang, t } = useLang();

  // Mock short-circuit BEFORE any hooks below — static URL param, stable across
  // a single session, so hooks-count invariant holds.
  if (MOCK_MODE === 'training-panel') {
    return (
      <>
        <div className="lang-toggle-fixed">
          <button className="btn-lang" onClick={toggleLang}>{lang.toUpperCase()}</button>
        </div>
        <ReasonPanelMock />
        <EnvBadge />
      </>
    );
  }
  if (MOCK_MODE === 'training-picker') {
    return (
      <>
        <TrainingPickerMock />
        <EnvBadge />
      </>
    );
  }

  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [socketInfo, setSocketInfo] = useState('');
  const wasDisconnectedRef = useRef(false);

  // Normal-room state
  const [roomState, setRoomState] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);

  // Training-mode state (kept entirely separate from normal-room state)
  const [trainingView,       setTrainingView]       = useState(null); // 'picker' | 'run' | 'complete' | null
  const [trainingScenarios,  setTrainingScenarios]  = useState([]);
  const [trainingTags,       setTrainingTags]       = useState(null);
  const [trainingRun,        setTrainingRun]        = useState(null); // { trainingState, room, game, myPosition }
  const [trainingAnnotation, setTrainingAnnotation] = useState(null); // set by trainingCompleted
  const [trainingResumable,  setTrainingResumable]  = useState([]);
  const [trainingWarnings,   setTrainingWarnings]   = useState(null); // string[]|null — soft warnings awaiting ack
  const [trainingReviewPrompt, setTrainingReviewPrompt] = useState(null); // {runId,sessionId,alternativeIndex}|null
  const [trainingExhausted,  setTrainingExhausted]  = useState([]);   // list from exhaustedScenarios event

  // Ref mirrors so the socket handler closure sees current state without re-subscribing
  const gameStateRef = useRef(null);
  const myPositionRef = useRef(null);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { myPositionRef.current = myPosition; }, [myPosition]);

  // Housekeeping — drop any reason-panel drafts from localStorage older than
  // 24 h. Cheap, runs once per page load.
  useEffect(() => { cleanupOldDrafts(); }, []);

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

      // Reconnect toast (only on a non-initial connect)
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

      // Prime training data (cheap, gets cached server-side)
      socket.emit('getTrainingTags');
      socket.emit('listTrainingScenarios');
    });

    socket.on('disconnect', () => {
      setSocketReady(false);
      wasDisconnectedRef.current = true;
    });

    socket.on('connect_error', (err) => {
      setSocketError(`Connection error: ${err.message}`);
    });

    // ── Normal-room events ──────────────────────────────────────────────
    socket.on('roomJoined', ({ room, game, myPosition: pos }) => {
      setRoomState(room); setGameState(game); setMyPosition(pos);
      sessionStorage.setItem('coinche_room', room.code);
    });
    socket.on('roomUpdate', ({ room, game, myPosition: pos }) => {
      setRoomState(room); setGameState(game);
      if (pos !== undefined) setMyPosition(pos);
    });
    socket.on('joinPending', ({ code }) => {
      setPendingRoom(code);
      sessionStorage.setItem('coinche_room', code);
    });
    socket.on('leftRoom', () => {
      setRoomState(null); setGameState(null); setMyPosition(null); setPendingRoom(null);
      sessionStorage.removeItem('coinche_room');
    });

    // ── Training events ────────────────────────────────────────────────
    socket.on('trainingTags',          ({ tags })      => setTrainingTags(tags));
    socket.on('trainingScenariosList', ({ scenarios }) => setTrainingScenarios(scenarios));
    socket.on('trainingResumablePending', ({ partials }) => setTrainingResumable(partials));

    socket.on('trainingStarted', (payload) => {
      setTrainingRun(payload);
      setTrainingAnnotation(null);
      setTrainingView('run');
    });
    socket.on('trainingUpdate',         (payload) => setTrainingRun(payload));
    socket.on('trainingAwaitingReason', (payload) => setTrainingRun(payload));
    socket.on('trainingCompleted', ({ annotation }) => {
      setTrainingAnnotation(annotation);
      setTrainingWarnings(null);
      setTrainingView('complete');
    });
    socket.on('trainingReasonWarning', ({ warnings }) => {
      // Server accepted validation but wants a non-blocking confirmation
      // (e.g. no trump-hand tag). ReasonPanel renders the overlay and the
      // user either confirms (resubmits with ackWarnings) or edits.
      setTrainingWarnings(warnings);
    });
    // Exhaustion session events (Phase A/B). Review prompt lands on top of
    // the completion summary; yes → back to 'run' view with reset state;
    // no → back to 'picker' with the new exhaustion entry reflected.
    socket.on('trainingScenarioReviewPrompt', (payload) => {
      setTrainingReviewPrompt(payload);
    });
    socket.on('trainingScenarioReviewed', (payload) => {
      // Server has reset the run for the next alternative. Drop the old
      // annotation display; transition back to the run view so the user
      // can submit a different bid. `payload` is a full trainingSync.
      setTrainingAnnotation(null);
      setTrainingReviewPrompt(null);
      setTrainingRun(payload);
      setTrainingView('run');
    });
    socket.on('trainingScenarioExhausted', ({ exhaustedScenarios }) => {
      // User said "Non, c'est tout" — session concluded, scenario marked
      // exhausted in the user's `_exhausted.json`. Return to picker.
      if (Array.isArray(exhaustedScenarios)) setTrainingExhausted(exhaustedScenarios);
      setTrainingReviewPrompt(null);
      setTrainingAnnotation(null);
      setTrainingRun(null);
      setTrainingView('picker');
    });
    socket.on('exhaustedScenarios', ({ exhaustedScenarios }) => {
      // Auto-surfaced on connect and fetchable on demand. Used by the
      // picker in Phase C; stored here so the picker has it ready.
      setTrainingExhausted(exhaustedScenarios || []);
    });
    socket.on('trainingAbandoned', () => {
      setTrainingRun(null);
      setTrainingView('picker');
    });

    // Shared error channel (normal + training).
    //
    // Coded errors (see backend/src/socketEvents.js for the registry) are
    // translated into UX recoveries instead of leaking raw messages into
    // the UI. Everything else falls through to the generic toast.
    socket.on('error', ({ message, code }) => {
      if (code === 'UNKNOWN_TRAINING_RUN') {
        // The in-memory run is gone (server restarted, or GC'd). The
        // partial is still on disk if the user had submitted their action,
        // so route to the picker and refresh the resumable list so they
        // can pick up where they left off.
        setTrainingRun(null);
        setTrainingAnnotation(null);
        setTrainingReviewPrompt(null);
        setTrainingView('picker');
        socket.emit('getResumablePartials');
        setSocketInfo(t.training.errors.sessionInterrupted);
        setTimeout(() => setSocketInfo(''), 4500);
        return;
      }
      // Coded errors with a known i18n translation surface the localized
      // string instead of the server's English default.
      const localized = (code && t.training?.errors?.byCode?.[code]) || message;
      setSocketError(localized);
      setTimeout(() => setSocketError(''), 4000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  // ── Training control actions (called by child components) ──────────────

  function startTraining(scenarioId) {
    socketRef.current?.emit('startTrainingScenario', { scenarioId });
  }
  function resumeTraining(partialId) {
    socketRef.current?.emit('resumeTrainingScenario', { partialId });
  }
  function discardPartial(partialId) {
    socketRef.current?.emit('discardPartialTraining', { partialId });
    setTrainingResumable(list => list.filter(p => p.partialId !== partialId));
  }
  function backToPicker() {
    // If we arrived here from the completion screen we must tell the server
    // to GC the (COMPLETE-state) in-memory run now that the user is done
    // with the summary.
    if (trainingView === 'complete' && trainingRun?.trainingState?.runId) {
      socketRef.current?.emit('leaveTrainingSummary', { runId: trainingRun.trainingState.runId });
    }
    setTrainingRun(null);
    setTrainingAnnotation(null);
    setTrainingView('picker');
  }
  function goToPickerFromLobby() {
    setTrainingView('picker');
  }
  function exitTraining() {
    setTrainingRun(null);
    setTrainingAnnotation(null);
    setTrainingResumable(list => list); // keep resumable around; user may come back
    setTrainingView(null);
  }
  function nextScenario() {
    // Pick the next scenario alphabetically by id that isn't the one we just did
    if (!trainingScenarios?.length) { backToPicker(); return; }
    const currentId = trainingAnnotation?.scenarioId;
    const sorted = [...trainingScenarios].sort((a, b) => a.id.localeCompare(b.id));
    const idx = sorted.findIndex(s => s.id === currentId);
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
    if (!next) { backToPicker(); return; }
    setTrainingAnnotation(null);
    setTrainingRun(null);
    socketRef.current?.emit('startTrainingScenario', { scenarioId: next.id });
  }
  function reviewAnswer(answer) {
    if (!trainingReviewPrompt) return;
    const { runId, sessionId } = trainingReviewPrompt;
    socketRef.current?.emit('submitScenarioReviewAnswer', { runId, sessionId, answer });
    // Optimistic: hide the overlay immediately while we wait for the
    // server's trainingScenarioReviewed (yes) or trainingScenarioExhausted
    // (no) event. Both handlers clear any stale state.
    setTrainingReviewPrompt(null);
  }

  const hasNextScenario = (() => {
    if (!trainingAnnotation || !trainingScenarios?.length) return false;
    const sorted = [...trainingScenarios].sort((a, b) => a.id.localeCompare(b.id));
    const idx = sorted.findIndex(s => s.id === trainingAnnotation.scenarioId);
    return idx >= 0 && idx < sorted.length - 1;
  })();

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
        <EnvBadge />
      </>
    );
  }

  const inGame = roomState && ['PLAYING', 'ROUND_OVER', 'GAME_OVER', 'SHUFFLE', 'CUT'].includes(roomState.phase);
  const inTraining = trainingView !== null;

  // ── Training takes precedence over normal-room surfaces when active ────
  if (inTraining) {
    return (
      <div className="app">
        {socketError && <div className="toast-error">{socketError}</div>}
        {!socketReady && <div className="toast-info">{t.reconnecting}</div>}

        {trainingView === 'picker' && (
          <TrainingPicker
            scenarios={trainingScenarios}
            resumablePartials={trainingResumable}
            exhaustedScenarios={trainingExhausted}
            onStart={startTraining}
            onResume={resumeTraining}
            onDiscardPartial={discardPartial}
            onBack={exitTraining}
          />
        )}

        {trainingView === 'run' && trainingRun && (
          <TrainingTable
            socket={socketRef.current}
            runId={trainingRun.trainingState.runId}
            room={trainingRun.room}
            game={trainingRun.game}
            myPosition={trainingRun.myPosition}
            trainingState={trainingRun.trainingState}
            tagSchema={trainingTags}
            pendingWarnings={trainingWarnings}
            onDismissWarnings={() => setTrainingWarnings(null)}
          />
        )}

        {trainingView === 'complete' && trainingAnnotation && (
          <CompletionSummary
            annotation={trainingAnnotation}
            tagSchema={trainingTags}
            onBackToPicker={backToPicker}
            onNextScenario={nextScenario}
            hasNextScenario={hasNextScenario}
            pendingReview={trainingReviewPrompt}
            onReviewContinue={() => reviewAnswer('yes')}
            onReviewEnd={()     => reviewAnswer('no')}
          />
        )}
        <EnvBadge />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        roomCode={roomState?.code}
        scores={roomState?.scores}
        targetScore={roomState?.targetScore}
      />

      {socketError && <div className="toast-error">{socketError}</div>}
      {!socketReady && user && <div className="toast-info">{t.reconnecting}</div>}
      {socketReady && socketInfo && <div className="toast-info">{socketInfo}</div>}

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
          onOpenTraining={goToPickerFromLobby}
          resumableCount={trainingResumable?.length || 0}
        />
      )}
      <EnvBadge />
    </div>
  );
}

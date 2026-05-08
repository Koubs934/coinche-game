import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LanguageContext';
import Auth from './components/Auth';
import Header from './components/Header';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import GameErrorTaggerMock from './game/GameErrorTaggerMock';
import TrainingTable from './training/TrainingTable';
import CompletionSummary from './training/CompletionSummary';
import TrainingPicker from './training/TrainingPicker';
import TrainingPickerMock from './training/TrainingPickerMock';
import EnvBadge from './components/EnvBadge';
import { useHandCardSize } from './components/HandSizeToggle';
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
//   ?mock=training-picker    → picker UX preview, no auth, no sockets
//   ?mock=game-error-tagger  → Game Review tag overlay preview, no auth, no sockets
// (V2.2 Phase 2C: ?mock=training-panel was retired with ReasonPanel)
const URL_PARAMS = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();
const MOCK_MODE = URL_PARAMS.get('mock');

export default function App() {
  const { user, username, loading } = useAuth();
  const { lang, toggleLang, t } = useLang();
  const { size: handSize, cycle: cycleHandSize } = useHandCardSize();

  // Mock short-circuit BEFORE any hooks below — static URL param, stable across
  // a single session, so hooks-count invariant holds.
  if (MOCK_MODE === 'training-picker') {
    return (
      <>
        <TrainingPickerMock />
        <EnvBadge />
      </>
    );
  }
  if (MOCK_MODE === 'game-error-tagger') {
    return (
      <>
        <div className="lang-toggle-fixed">
          <button className="btn-lang" onClick={toggleLang}>{lang.toUpperCase()}</button>
        </div>
        <GameErrorTaggerMock />
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
  const [trainingRun,        setTrainingRun]        = useState(null); // { trainingState, room, game, myPosition }
  const [trainingAnnotation, setTrainingAnnotation] = useState(null); // set by trainingCompleted
  const [trainingAnnotationFilename, setTrainingAnnotationFilename] = useState(null);
  const [trainingCaseType, setTrainingCaseType] = useState(null); // 'match' | 'divergent' | 'rule-silent'
  const [trainingResumable,  setTrainingResumable]  = useState([]);
  const [trainingExhausted,  setTrainingExhausted]  = useState([]);   // list from exhaustedScenarios event
  // v3 (2026-05-04): the structured tag vocabulary was removed. The
  // getTrainingTags / trainingTags socket events still exist server-side
  // for contract continuity but the client no longer cares about the
  // payload — divergence flow is computed from scenario.expectedAction
  // delivered in trainingState.

  // Ref mirrors so the socket handler closure sees current state without re-subscribing
  const gameStateRef = useRef(null);
  const myPositionRef = useRef(null);
  const trainingScenariosRef = useRef([]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { myPositionRef.current = myPosition; }, [myPosition]);
  useEffect(() => { trainingScenariosRef.current = trainingScenarios; }, [trainingScenarios]);

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

      // Prime the scenario list (cheap, cached server-side). Tag vocabulary
      // is no longer fetched — v3 has none.
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

    // ── Game Review (creator-only) ────────────────────────────────────
    // Acknowledgement of a successful createGameErrorAnnotation. The overlay
    // is already closed on submit; no-op here beyond a debug log (the server
    // also emits a roomUpdate so publicGame.errorAnnotations stays fresh).
    socket.on('gameErrorAnnotationCreated', () => {
      // Intentionally silent — the server's roomUpdate broadcast is the
      // authoritative sync for publicGame.errorAnnotations; the overlay
      // reads that list to render the already-tagged badges.
    });
    // End-of-round GameRecord persisted to disk. Creator-only.
    socket.on('gameRecordSaved', () => {
      setSocketInfo(t.toast.gameRecordSaved);
      setTimeout(() => setSocketInfo(''), 4000);
    });

    // ── Training events ────────────────────────────────────────────────
    // v3: trainingTags handler dropped — server still emits but the payload
    // is null; client no longer reads it.
    socket.on('trainingScenariosList', ({ scenarios }) => setTrainingScenarios(scenarios));
    socket.on('trainingResumablePending', ({ partials }) => setTrainingResumable(partials));

    socket.on('trainingStarted', (payload) => {
      setTrainingRun(payload);
      setTrainingAnnotation(null);
      setTrainingAnnotationFilename(null);
      setTrainingCaseType(null);
      setTrainingView('run');
    });
    socket.on('trainingUpdate',         (payload) => setTrainingRun(payload));
    socket.on('trainingAwaitingReason', (payload) => setTrainingRun(payload));
    socket.on('trainingCompleted', ({ annotation, annotationFilename, caseType }) => {
      setTrainingAnnotation(annotation);
      setTrainingAnnotationFilename(annotationFilename ?? null);
      setTrainingCaseType(caseType ?? null);

      // V2.2 Phase 2C — match path skips the completion screen entirely
      // and auto-advances to the next scenario. Divergent and rule-silent
      // both surface the completion view (which now opens the Claude
      // conversation unconditionally; see CompletionSummary).
      if (caseType === 'match') {
        const sorted = [...trainingScenariosRef.current].sort((a, b) => a.id.localeCompare(b.id));
        const idx = sorted.findIndex(s => s.id === annotation.scenarioId);
        const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
        // Clear trainingRun so React doesn't briefly render the prior board
        // while the new scenario loads.
        setTrainingRun(null);
        setTrainingAnnotation(null);
        setTrainingAnnotationFilename(null);
        setTrainingCaseType(null);
        if (next) {
          socket.emit('startTrainingScenario', { scenarioId: next.id });
        } else {
          // No next scenario in the alphabetical sequence — bounce back to picker.
          setTrainingView('picker');
        }
        return;
      }

      setTrainingView('complete');
    });
    // v3.1 (2026-05-04): the post-submit "Autre stratégie possible ?"
    // overlay was removed. Every annotation auto-concludes server-side as
    // a single-alternative session, so trainingScenarioExhausted now fires
    // immediately after every successful submit and we just refresh the
    // picker's exhausted list. The trainingScenarioReviewPrompt /
    // trainingScenarioReviewed handlers were dropped — the underlying
    // socket events still exist on the server for contract continuity but
    // are unreachable from the new flow.
    socket.on('trainingScenarioExhausted', ({ exhaustedScenarios }) => {
      if (Array.isArray(exhaustedScenarios)) setTrainingExhausted(exhaustedScenarios);
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
        setTrainingView('picker');
        socket.emit('getResumablePartials');
        setSocketInfo(t.training.errors.sessionInterrupted);
        setTimeout(() => setSocketInfo(''), 4500);
        return;
      }
      // Coded errors with a known i18n translation surface the localized
      // string instead of the server's English default. Training-mode codes
      // live under t.training.errors.byCode; Game Review codes live under
      // the top-level t.errors.byCode.
      const localized = (code && (
        t.errors?.byCode?.[code] ||
        t.training?.errors?.byCode?.[code]
      )) || message;
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
    setTrainingAnnotationFilename(null);
    setTrainingCaseType(null);
    setTrainingView('picker');
  }
  function goToPickerFromLobby() {
    setTrainingView('picker');
  }
  function exitTraining() {
    setTrainingRun(null);
    setTrainingAnnotation(null);
    setTrainingAnnotationFilename(null);
    setTrainingCaseType(null);
    setTrainingResumable(list => list); // keep resumable around; user may come back
    setTrainingView(null);
  }
  function restartScenario() {
    // V2.2 Phase 2D — invoked by CompletionSummary's Back button when the
    // user backs out of the CardSelector phase to re-bid the same
    // scenario. Server discards the completed annotation, rolls back the
    // _exhausted entry, and emits trainingStarted on the fresh run; our
    // existing trainingStarted handler flips the view back to 'run'.
    //
    // We pass scenarioId + annotationFilename (not runId) because the
    // server GCs the run from memory as soon as submitTrainingReason
    // completes — by the time we get here the runId is stale.
    const scenarioId = trainingAnnotation?.scenarioId
      || trainingRun?.trainingState?.scenarioId;
    if (!scenarioId) { backToPicker(); return; }
    socketRef.current?.emit('restartTrainingScenario', {
      scenarioId,
      annotationFilename: trainingAnnotationFilename,
    });
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
    setTrainingAnnotationFilename(null);
    setTrainingCaseType(null);
    setTrainingRun(null);
    socketRef.current?.emit('startTrainingScenario', { scenarioId: next.id });
  }
  // v3.1: reviewAnswer() removed. Sessions auto-conclude server-side; the
  // user no longer chooses "Oui, autre stratégie / Non, c'est tout".

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
      <div className="app" data-hand-size={handSize}>
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
            onCycleHandSize={cycleHandSize}
          />
        )}

        {trainingView === 'complete' && trainingAnnotation && (
          <CompletionSummary
            annotation={trainingAnnotation}
            annotationFilename={trainingAnnotationFilename}
            caseType={trainingCaseType}
            userId={user?.id}
            userName={username}
            scenarioSnapshot={trainingRun}
            onBackToPicker={backToPicker}
            onNextScenario={nextScenario}
            onRestartScenario={restartScenario}
            hasNextScenario={hasNextScenario}
          />
        )}
        <EnvBadge />
      </div>
    );
  }

  return (
    <div className="app" data-hand-size={handSize}>
      <Header
        roomCode={roomState?.code}
        scores={roomState?.scores}
        targetScore={roomState?.targetScore}
        onCycleHandSize={cycleHandSize}
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

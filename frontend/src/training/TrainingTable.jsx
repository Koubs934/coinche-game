// Training-table view (V2.2 Phase 2C). Renders GameBoard. The reason-panel
// modal is gone — for every case (match, divergent, rule-silent) the client
// auto-fires submitTrainingReason as soon as the run enters AWAITING-REASON,
// with `note: ''` and no agreement field. The server canonicalises the
// stored divergenceAgreement (match → null, anything else → 'user-disagrees')
// and the FE branches on the resulting `caseType` returned in the
// trainingCompleted payload:
//   match       → App.jsx auto-advances to next scenario (no completion screen)
//   divergent   → App.jsx shows CompletionSummary + opens Claude conversation
//   rule-silent → App.jsx shows CompletionSummary + opens Claude conversation
//
// This component itself only needs to fire the submit and render the board;
// all UX choices live in App.jsx and CompletionSummary.

import { useEffect, useRef } from 'react';
import GameBoard from '../components/GameBoard';

export default function TrainingTable({
  socket, runId, room, game, myPosition, trainingState,
}) {
  const runState      = trainingState?.runState;
  const pendingAction = trainingState?.pendingAction;
  const partialId     = trainingState?.partialId ?? null;

  // Auto-fire submitTrainingReason as soon as the run enters AWAITING-REASON.
  // Track which (runId, partialId) we've fired for so React Strict Mode
  // double-renders don't double-submit.
  const autoFiredRef = useRef(null);
  useEffect(() => {
    if (runState !== 'AWAITING-REASON')   return;
    if (!pendingAction)                   return;
    const key = `${runId}::${partialId}`;
    if (autoFiredRef.current === key)     return;
    autoFiredRef.current = key;
    socket.emit('submitTrainingReason', { runId, note: '' });
  }, [runState, pendingAction, runId, partialId, socket]);

  return (
    <GameBoard
      socket={socket}
      trainingMode={{ runId }}
      roomCode={runId}
      room={room}
      game={game}
      myPosition={myPosition}
    />
  );
}

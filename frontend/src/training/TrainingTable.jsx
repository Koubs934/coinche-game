// Training-table view (v3). Renders GameBoard + the divergence-aware
// ReasonPanel when the run enters AWAITING-REASON.
//
// Match-path auto-submit: when the user's action matches the scenario's
// expectedAction, the server allows divergenceAgreement=null + empty note.
// We auto-emit submitTrainingReason so the user never sees a UI for the
// match case — that's the whole "low friction when you agree with the
// rules" point of the v3 design.

import { useEffect, useRef } from 'react';
import ReasonPanel from './ReasonPanel';
import GameBoard from '../components/GameBoard';
import { computeDivergenceType } from './divergence';

export default function TrainingTable({
  socket, runId, room, game, myPosition, trainingState,
}) {
  const runState       = trainingState?.runState;
  const pendingAction  = trainingState?.pendingAction;
  const expectedAction = trainingState?.expectedAction ?? null;
  const partialId      = trainingState?.partialId ?? null;

  // Compute client-side. Server recomputes on submit so this is just to
  // pick which UI to render (or whether to auto-submit).
  const divergenceType = pendingAction
    ? computeDivergenceType({ action: expectedAction }, pendingAction)
    : null;

  // Match-case auto-submit. Track which (runId, partialId) we've auto-fired
  // for so React Strict Mode double-renders don't double-submit.
  const autoFiredRef = useRef(null);
  useEffect(() => {
    if (runState !== 'AWAITING-REASON')          return;
    if (!pendingAction)                          return;
    if (divergenceType !== null)                 return; // only auto-fire on match
    const key = `${runId}::${partialId}`;
    if (autoFiredRef.current === key)            return;
    autoFiredRef.current = key;
    socket.emit('submitTrainingReason', {
      runId,
      divergenceAgreement: null,
      note: '',
    });
  }, [runState, pendingAction, divergenceType, runId, partialId, socket]);

  function handleSubmitReason(divergenceAgreement, note) {
    socket.emit('submitTrainingReason', { runId, divergenceAgreement, note });
  }

  function handleChangeAction() {
    socket.emit('undoTrainingAction', { runId });
  }

  // Build an `expectedAnswer`-shaped object for ReasonPanel from the
  // expectedAction we received. (The ruleReference / ambiguityFlags fields
  // intentionally never reach the client.)
  const expectedAnswer = expectedAction ? { action: expectedAction } : null;
  const showReasonModal = runState === 'AWAITING-REASON' && divergenceType !== null;

  return (
    <>
      <GameBoard
        socket={socket}
        trainingMode={{ runId }}
        roomCode={runId}
        room={room}
        game={game}
        myPosition={myPosition}
      />

      {showReasonModal && (
        <div className="training-modal-backdrop">
          <div className="training-modal-content">
            <ReasonPanel
              action={pendingAction}
              expectedAnswer={expectedAnswer}
              onSubmit={handleSubmitReason}
              onChangeAction={handleChangeAction}
              draftKey={partialId}
            />
          </div>
        </div>
      )}
    </>
  );
}

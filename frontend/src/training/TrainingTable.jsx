// Training-table view. Renders GameBoard in training mode (real-time
// playback of scripted seats + user action), overlays the ReasonPanel as a
// modal when the run enters AWAITING-REASON. Routing (back-to-picker,
// completion view) is owned by App.jsx; this component just surfaces events.

import ReasonPanel from './ReasonPanel';
import GameBoard from '../components/GameBoard';

export default function TrainingTable({
  socket,
  runId,
  room,
  game,
  myPosition,
  trainingState,
  tagSchema,          // loaded once via getTrainingTags; parent passes down
  pendingWarnings,    // string[]|null — soft warnings from the server
  onDismissWarnings,  // () => void — clear warnings on the parent
}) {
  const runState      = trainingState?.runState;
  const pendingAction = trainingState?.pendingAction;
  const actionType    = pendingAction?.type;

  // Server-authoritative schema is the source of truth for available tags.
  // If the schema hasn't arrived yet (fresh socket), skip the panel — the
  // runState shouldn't be AWAITING-REASON at that point anyway.
  const tagsForAction = tagSchema && actionType
    ? { ...tagSchema.actions[actionType], actionType }
    : null;

  function handleSubmitReason(tags, note, ackWarnings) {
    socket.emit('submitTrainingReason', { runId, tags, note, ackWarnings });
  }

  function handleChangeAction() {
    socket.emit('undoTrainingAction', { runId });
  }

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

      {runState === 'AWAITING-REASON' && tagsForAction && (
        <div className="training-modal-backdrop">
          <div className="training-modal-content">
            <ReasonPanel
              action={pendingAction}
              tagsForAction={tagsForAction}
              groupsMap={tagSchema.groups}
              onSubmit={handleSubmitReason}
              onChangeAction={handleChangeAction}
              draftKey={trainingState.partialId}
              pendingWarnings={pendingWarnings}
              onDismissWarnings={onDismissWarnings}
            />
          </div>
        </div>
      )}
    </>
  );
}

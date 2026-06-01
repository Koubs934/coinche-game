// Seat-anchored chat notification bubbles. Each incoming message from ANOTHER
// player (while the chat panel is closed) pops a short-lived speech bubble at
// that sender's on-screen seat.
//
// Seat mapping is the SAME viewer-relative formula GameBoard / TrickDisplay use:
//   slot = ((senderPosition - myPosition) + 4) % 4
//     0 → bottom (self — never shown; own messages don't bubble)
//     1 → right
//     2 → top
//     3 → left
// so a bubble always rises from the correct seat for each viewer (viewer is
// always the bottom seat).
//
// Tapping any bubble opens the conversation panel (onOpen).

const SLOT_CLASS = { 1: 'right', 2: 'top', 3: 'left' };

export default function ChatBubbles({ bubbles, myPosition, players, onOpen }) {
  if (myPosition == null) return null;

  const entries = Object.values(bubbles || {});
  if (entries.length === 0) return null;

  return (
    <div className="chat-bubble-layer" aria-live="polite">
      {entries.map(msg => {
        const slot = ((msg.position - myPosition) + 4) % 4;
        const place = SLOT_CLASS[slot];
        if (!place) return null; // self seat (0) never bubbles
        const team = players?.find(p => p.userId === msg.userId)?.team ?? null;
        return (
          <button
            key={msg.position}
            type="button"
            className={`chat-bubble chat-bubble-${place}`}
            onClick={onOpen}
          >
            <span className={`chat-bubble-author${team != null ? ` team${team}-col` : ''}`}>
              {msg.username}
            </span>
            <span className="chat-bubble-text">{msg.text}</span>
          </button>
        );
      })}
    </div>
  );
}

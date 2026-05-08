// Discreet back-arrow used during the V2.2 completion flow (CardSelector
// and ClaudeConversation phases). Top-left, no text label, ~32px tap
// target. The handler is owned by the parent (CompletionSummary) so the
// effects of "going back" stay co-located with the phase state.

export default function BackButton({ onClick, disabled = false, ariaLabel = 'Retour' }) {
  return (
    <button
      type="button"
      className="training-back-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      ←
    </button>
  );
}

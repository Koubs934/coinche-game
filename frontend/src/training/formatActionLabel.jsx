// v3.1 — short structured action labels for the divergence panel.
//
// Outputs JSX so the suit symbol can carry its own color span without
// every consumer needing to wire up className threading. Mobile-first
// sizing comes from the parent CSS (`.trp-action-large` etc.).
//
// Examples:
//   { type: 'bid', value: 80, suit: 'H' }    → "80 ♥" (heart in red)
//   { type: 'bid', value: 90, suit: null }   → "90 (couleur libre)"
//   { type: 'pass' }                         → "Pass"
//   { type: 'coinche' }                      → "Coinche"
//   { type: 'surcoinche' }                   → "Surcoinche"
//
// Pass / Coinche / Surcoinche are deliberately not translated — they're
// short coinche terminology that reads cleanly in both languages.

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

export default function formatActionLabel(action, t) {
  if (!action) return null;
  switch (action.type) {
    case 'pass':       return 'Pass';
    case 'coinche':    return 'Coinche';
    case 'surcoinche': return 'Surcoinche';
    case 'bid': {
      if (action.value === 'capot') return t.capot;
      if (action.suit === null || action.suit === undefined) {
        return (
          <>
            {action.value}
            {' '}
            <span className="trp-action-free-color">
              {t.training.divergence.freeColor}
            </span>
          </>
        );
      }
      const isRed = action.suit === 'H' || action.suit === 'D';
      return (
        <>
          {action.value}
          {' '}
          <span className={isRed ? 'trp-suit trp-suit-red' : 'trp-suit'}>
            {SUIT_SYM[action.suit] ?? action.suit}
          </span>
        </>
      );
    }
    default:
      return String(action.type);
  }
}

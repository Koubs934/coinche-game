// Render a training action as a short localized sentence for the reason-panel
// header: "Vous avez annoncé 90♠" / "You bid 90♠" / etc.

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function formatActionText(action, t) {
  if (!action) return '';
  const p = t.training.panel;
  switch (action.type) {
    case 'bid': {
      if (action.value === 'capot') return `${p.youBid} ${t.capot}`;
      return `${p.youBid} ${action.value}${SUIT_SYM[action.suit] ?? ''}`;
    }
    case 'pass':       return p.youPassed;
    case 'coinche':    return p.youCoinched;
    case 'surcoinche': return p.youSurcoinched;
    case 'play-card': {
      const c = action.card;
      if (!c) return p.youPlayed;
      return `${p.youPlayed} ${c.value}${SUIT_SYM[c.suit] ?? ''}`;
    }
    default:           return String(action.type);
  }
}

/** Returns true when the action suit should render in red (hearts/diamonds). */
export function actionIsRed(action) {
  if (!action) return false;
  if (action.type === 'bid')       return action.suit === 'H' || action.suit === 'D';
  if (action.type === 'play-card') return action.card?.suit === 'H' || action.card?.suit === 'D';
  return false;
}

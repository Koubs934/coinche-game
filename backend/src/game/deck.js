const SUITS  = ['S', 'H', 'D', 'C'];
const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reconstruct a 32-card deck from a completed round's tricks.
// winningTeam: 0 or 1 (team that won the round: contract team if contractMade, else defenders).
// Each team's pile is built with newest-won trick on top.
// Final deck: losing team pile on top, winning team pile below.
function buildDeckFromTricks(tricks, winningTeam) {
  let pile0 = [];
  let pile1 = [];
  for (const trick of tricks) {
    const cards = trick.cards.map(c => c.card); // play order preserved
    if (trick.winner % 2 === 0) pile0 = [...cards, ...pile0]; // prepend = on top
    else                         pile1 = [...cards, ...pile1];
  }
  const losingPile  = winningTeam === 0 ? pile1 : pile0;
  const winningPile = winningTeam === 0 ? pile0 : pile1;
  return [...losingPile, ...winningPile];
}

// Cut: move the top n cards to the bottom.
function cutDeck(deck, n) {
  return [...deck.slice(n), ...deck.slice(0, n)];
}

// Deal 3-2-3 to 4 players starting from firstPlayer (position order: +1 each time).
function dealFrom(deck, firstPlayer) {
  const hands = [[], [], [], []];
  let cursor = 0;
  for (const count of [3, 2, 3]) {
    for (let i = 0; i < 4; i++) {
      const p = (firstPlayer + i) % 4;
      for (let j = 0; j < count; j++) hands[p].push(deck[cursor++]);
    }
  }
  return hands;
}

module.exports = { createDeck, shuffle, buildDeckFromTricks, cutDeck, dealFrom };

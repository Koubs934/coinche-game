const SUITS = ['S', 'H', 'D', 'C'];
const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
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

function deal() {
  const deck = shuffle(createDeck());
  return [
    deck.slice(0, 8),
    deck.slice(8, 16),
    deck.slice(16, 24),
    deck.slice(24, 32),
  ];
}

module.exports = { deal };

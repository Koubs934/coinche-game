// Single source of truth for Coinche card values and ranks.
// Imported by rules.js, scoring, bot logic, and tests — do not duplicate.

const SUITS  = ['S', 'H', 'D', 'C'];
const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const TRUMP_RANK      = { J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1 };
const NON_TRUMP_RANK  = { A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1 };
const TRUMP_POINTS    = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const NON_TRUMP_POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

const VALID_BID_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot'];

module.exports = {
  SUITS,
  VALUES,
  TRUMP_RANK,
  NON_TRUMP_RANK,
  TRUMP_POINTS,
  NON_TRUMP_POINTS,
  VALID_BID_VALUES,
};

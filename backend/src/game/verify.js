/**
 * Standalone verification script for rules, scoring, and bot bidding logic.
 * Run with: node backend/src/game/verify.js
 */

const { getValidCards, getTrickWinner, TRUMP_RANK, cardPoints } = require('./rules');
const { calculateRoundScore } = require('./scoring');
const { bestOpeningBid, computeSuitFeatures,
        partnerResponseBid,
        isPetitJeu, qualifiesFor90, isStrictBicolore,
        getBotBidAction } = require('./botBidding');
const { getBotCardAction } = require('./botPlay');

let passed = 0;
let failed = 0;

function assert(condition, label, extra = '') {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${extra ? ' — ' + extra : ''}`);
    failed++;
  }
}

function cardIds(cards) {
  return cards.map(c => `${c.value}${c.suit}`).sort().join(', ');
}

// ─── helpers ────────────────────────────────────────────────────────────────

function card(value, suit) { return { value, suit }; }
function play(card, playerIndex) { return { card, playerIndex }; }

// ─── RULES SCENARIOS ────────────────────────────────────────────────────────

console.log('\n=== Card Play Rules ===\n');

// Scenario R1: no lead suit + partner winning + has trump
// Player 2's partner is player 0, who is winning the trick.
// Player 2 has no spades (lead suit) but has trumps (hearts).
// Expected: ALL cards in hand are valid — player is free.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('A', 'S'), 0), // player 0 leads ace of spades (winning)
    play(card('7', 'S'), 1), // player 1 plays 7 spades (losing)
    // player 2 to play — their partner (player 0) is winning
  ];
  const hand = [
    card('J', 'H'), // trump jack
    card('9', 'H'), // trump 9
    card('A', 'D'), // non-lead, non-trump
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2 /* playerIndex */);
  assert(valid.length === 3, 'R1: partner winning — all 3 cards valid', cardIds(valid));
  assert(valid.some(c => c.suit === 'D'), 'R1: non-trump discard allowed when partner winning');
  assert(valid.some(c => c.suit === 'H'), 'R1: trump allowed too when partner winning');
}

// Scenario R2: no lead suit + partner NOT winning + has trump
// Player 2's partner is player 0. Opponent player 1 is winning.
// Player 2 has no spades but has trumps — must play trump.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('7', 'S'), 0), // player 0 leads 7 spades (losing)
    play(card('A', 'S'), 1), // player 1 plays ace spades (winning)
    // player 2 to play — partner (0) is NOT winning
  ];
  const hand = [
    card('J', 'H'), // trump jack
    card('9', 'H'), // trump 9
    card('A', 'D'), // non-lead, non-trump
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2);
  assert(valid.length === 2, 'R2: opponent winning — must play trump (2 trumps)', cardIds(valid));
  assert(valid.every(c => c.suit === 'H'), 'R2: only trumps are valid');
  assert(!valid.some(c => c.suit === 'D'), 'R2: non-trump discards blocked');
}

// Scenario R3: no lead suit + opponent already trumped + can overtrump
// Player 1 cut with 9H. Player 2 (partner=0, who played first) has J and Q of trump.
// J is higher than 9, so only J is legal.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('A', 'S'), 0), // player 0 leads ace of spades
    play(card('9', 'H'), 1), // player 1 cuts with 9H (TRUMP_RANK=7)
    // player 2 to play, partner (0) not winning
  ];
  const hand = [
    card('J', 'H'), // TRUMP_RANK 8 — higher than 9H
    card('Q', 'H'), // TRUMP_RANK 3 — lower than 9H
    card('A', 'D'), // non-trump
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2);
  assert(valid.length === 1, 'R3: can overtrump — only JH is valid', cardIds(valid));
  assert(valid[0].value === 'J' && valid[0].suit === 'H', 'R3: JH is the only legal card');
}

// Scenario R4: no lead suit + opponent already trumped + cannot overtrump but has lower trump
// Player 1 cut with JH (best trump). Player 2 has only Q and 8 of trump — both lower. Any trump legal.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('A', 'S'), 0), // player 0 leads ace of spades
    play(card('J', 'H'), 1), // player 1 cuts with JH (TRUMP_RANK=8, highest)
    // player 2 to play, partner (0) not winning
  ];
  const hand = [
    card('Q', 'H'), // TRUMP_RANK 3 — lower
    card('8', 'H'), // TRUMP_RANK 2 — lower
    card('A', 'D'), // non-trump
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2);
  assert(valid.length === 2, 'R4: cannot overtrump — any trump allowed (pisser)', cardIds(valid));
  assert(valid.every(c => c.suit === 'H'), 'R4: only trumps, not non-trump');
}

// Scenario R5: no lead suit + no trump
// Player 2 has no spades and no trumps — any card in hand is valid.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('A', 'S'), 0),
    play(card('K', 'S'), 1),
  ];
  const hand = [
    card('A', 'D'),
    card('10', 'C'),
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2);
  assert(valid.length === 2, 'R5: no trump no suit — all cards valid', cardIds(valid));
}

// Scenario R6: trump is led — player must overtrump if possible
// Trump (H) is led with 9H. Player has JH (higher) and QH (lower). Must play JH only.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('9', 'H'), 0), // player 0 leads 9H (TRUMP_RANK=7)
    play(card('7', 'H'), 1), // player 1 plays 7H (lower)
    // player 2 to play — trump led, must overtrump
  ];
  const hand = [
    card('J', 'H'), // TRUMP_RANK 8 — higher than 9H
    card('Q', 'H'), // TRUMP_RANK 3 — lower than 9H
    card('A', 'D'), // non-trump
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2);
  assert(valid.length === 1, 'R6: trump led — must overtrump, only JH valid', cardIds(valid));
  assert(valid[0].value === 'J' && valid[0].suit === 'H', 'R6: JH is the only legal card');
}

// Scenario R7: trump is led — cannot overtrump, any trump allowed
// Trump led with JH (highest). Player has Q and 8 of trump — both lower. Any trump legal, no non-trump.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('J', 'H'), 0), // player 0 leads JH (TRUMP_RANK=8, highest)
  ];
  const hand = [
    card('Q', 'H'), // TRUMP_RANK 3 — lower
    card('8', 'H'), // TRUMP_RANK 2 — lower
    card('A', 'D'), // non-trump
  ];
  const valid = getValidCards(hand, trick, trumpSuit, 2);
  assert(valid.length === 2, 'R7: trump led, cannot overtrump — any trump (not non-trump)', cardIds(valid));
  assert(valid.every(c => c.suit === 'H'), 'R7: only trumps allowed');
}

// Scenario R8: non-trump led + no suit + trump in trick + partner winning the trump
// Player 1 cut with 9H. Player 2's partner (player 0) played the winning AH later.
// No exception for partner winning when trump is already in trick — must overtrump or play any trump.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('A', 'S'), 3), // player 3 leads AS (non-trump)
    play(card('9', 'H'), 1), // player 1 cuts with 9H (TRUMP_RANK=7)
    play(card('A', 'H'), 0), // player 0 (partner of 2) plays AH (TRUMP_RANK=6 — lower than 9H!)
    // player 2 to play — partner (0) is NOT currently winning (9H beats AH in trump rank)
  ];
  // Actually let's use a case where partner IS winning the trump to test the rule.
  // Player 0 (partner) plays JH (TRUMP_RANK=8, highest trump). Player 2 has QH and non-trump.
  const trick2 = [
    play(card('A', 'S'), 3), // player 3 leads AS
    play(card('9', 'H'), 1), // player 1 cuts with 9H
    play(card('J', 'H'), 0), // player 0 (partner) overtrumps with JH — now winning
    // player 2 to play — partner (0) IS currently winning, BUT trump is in trick
  ];
  const hand = [
    card('Q', 'H'), // TRUMP_RANK 3 — lower than JH
    card('8', 'H'), // TRUMP_RANK 2 — lower than JH
    card('A', 'D'), // non-trump
  ];
  const valid = getValidCards(hand, trick2, trumpSuit, 2);
  // Trump is already in trick — partner-maître exception does NOT apply.
  // Cannot overtrump (no trump higher than JH). Must play any trump.
  assert(valid.length === 2, 'R8: trump in trick + partner winning — still must play trump', cardIds(valid));
  assert(valid.every(c => c.suit === 'H'), 'R8: only trumps, not non-trump discard');
}

// ─── SCORING SCENARIOS ───────────────────────────────────────────────────────

console.log('\n=== Scoring ===\n');

// Build a minimal tricks array: all 8 tricks won by one team mix
function makeTricks(winner0count, winner1count, trumpSuit) {
  // Distribute 8 tricks: first `winner0count` go to player 0 (team 0), rest to player 1 (team 1)
  const tricks = [];
  const teams = [
    ...Array(winner0count).fill(0),
    ...Array(winner1count).fill(1),
  ];
  for (let i = 0; i < 8; i++) {
    // Each trick has 4 cards worth about 20 pts combined for simplicity
    // We'll use fixed cards: A♠ (11) + 10♠ (10) + K♠ (4) + Q♠ (3) = 28
    // Except last trick which adds dix de der
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: teams[i] },
        { card: card('10', 'S'), playerIndex: teams[i] },
        { card: card('K', 'S'), playerIndex: teams[i] },
        { card: card('Q', 'S'), playerIndex: teams[i] },
      ],
      winner: teams[i],
    });
  }
  return tricks;
}

// Scenario S1: contract team succeeds — both teams have nonzero trick points
// Team 0 wins 5 tricks (5×28=140 pts), team 1 wins 3 tricks (3×28=84 pts)
// But with dix de der on last trick, total = 140+84 + 10 = 234... let's use a real breakdown.
// Actually to keep it simple: use card points per trick.
// 8 tricks × 28 pts each = 224, + dix de der = 234 — doesn't match 162 exactly.
// Let's use the actual point cards so total = 162.
// Simplest: use non-trump deck: A=11, 10=10, K=4, Q=3, J=2 for each of 4 suits.
// For a quick test, just check the logic not exact total.
{
  const trumpSuit = 'H';
  const contract = { value: 100, team: 0, coinched: false, surcoinched: false };

  // Build tricks with known points: team 0 wins 5 tricks, team 1 wins 3 tricks
  // Use S (non-trump) cards only to avoid trump-points complexity
  // Each trick: A♠+10♠ = 21 pts for the winning team, 7♠+8♠ = 0 for others
  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = i < 5 ? 0 : 1;
    const winnerPlayer = winnerTeam; // player 0 (team 0) or player 1 (team 1)
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winnerPlayer },  // 11
        { card: card('10', 'S'), playerIndex: winnerPlayer }, // 10
        { card: card('7', 'S'), playerIndex: 1 - winnerPlayer }, // 0
        { card: card('8', 'S'), playerIndex: 1 - winnerPlayer }, // 0
      ],
      winner: winnerPlayer,
    });
  }

  const { scores, contractMade, trickPoints } = calculateRoundScore({
    tricks, trumpSuit, contract, beloteTeam: null,
  });

  assert(contractMade === true, 'S1: contractMade is true');
  // trickPoints[0] = 5 × 21 = 105; trickPoints[1] = 3 × 21 = 63; last trick gets +10 dix de der for team 1
  // So trickPoints[0] = 105, trickPoints[1] = 63 + 10 = 73
  // contract team (0) score = trickPoints[0] + contract.value = 105 + 100 = 205 → rounds to 210
  // defending team (1) score = trickPoints[1] = 73 → rounds to 70

  const expectedContractTeamScore = Math.round((trickPoints[0] + contract.value) / 10) * 10;
  const expectedDefendingScore = Math.round(trickPoints[1] / 10) * 10;

  assert(
    scores[0] === expectedContractTeamScore,
    `S1: contract team score = tricks(${trickPoints[0]}) + contract(${contract.value}) = ${expectedContractTeamScore}`,
    `got ${scores[0]}`
  );
  assert(
    scores[1] === expectedDefendingScore,
    `S1: defending team score = tricks only = ${expectedDefendingScore}`,
    `got ${scores[1]}`
  );
  assert(scores[0] > trickPoints[0], 'S1: contract team score exceeds raw trick points (contract bonus applied)');
}

// Scenario S2: contract fails — contract team gets 0, opposing gets (160 + contract) × 1
{
  const trumpSuit = 'H';
  const contract = { value: 120, team: 0, coinched: false, surcoinched: false };

  // Team 0 only wins 2 tricks (very little points), team 1 wins the other 6
  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = i < 2 ? 0 : 1;
    const winnerPlayer = winnerTeam;
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winnerPlayer },
        { card: card('10', 'S'), playerIndex: winnerPlayer },
        { card: card('7', 'S'), playerIndex: 1 - winnerPlayer },
        { card: card('8', 'S'), playerIndex: 1 - winnerPlayer },
      ],
      winner: winnerPlayer,
    });
  }

  const { scores, contractMade, trickPoints } = calculateRoundScore({
    tricks, trumpSuit, contract, beloteTeam: null,
  });

  assert(contractMade === false, 'S2: contractMade is false');
  assert(trickPoints[0] < contract.value, `S2: contract team had insufficient trick points (${trickPoints[0]} < ${contract.value})`);
  assert(scores[0] === 0, 'S2: contract team gets 0 on failure');
  assert(scores[1] === (160 + 120) * 1, `S2: defending team gets (160+120)×1=280 on contract failure, got ${scores[1]}`);
}

// Scenario S3: coinched failure — 160 + (contract × 2)
{
  const trumpSuit = 'H';
  const contract = { value: 100, team: 0, coinched: true, surcoinched: false };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = i < 2 ? 0 : 1; // team 0 wins only 2 tricks — fails 100
    const winnerPlayer = winnerTeam;
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winnerPlayer },
        { card: card('10', 'S'), playerIndex: winnerPlayer },
        { card: card('7', 'S'), playerIndex: 1 - winnerPlayer },
        { card: card('8', 'S'), playerIndex: 1 - winnerPlayer },
      ],
      winner: winnerPlayer,
    });
  }

  const { scores, contractMade } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  assert(contractMade === false, 'S3: coinched failure — contractMade is false');
  assert(scores[0] === 0, 'S3: coinched failure — contract team gets 0');
  assert(scores[1] === 160 + 100 * 2, `S3: coinched failure — defenders get 160+(100×2)=360, got ${scores[1]}`);
}

// Scenario S4: surcoinched failure — 160 + (contract × 4)
{
  const trumpSuit = 'H';
  const contract = { value: 90, team: 1, coinched: true, surcoinched: true };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = 0; // team 1 wins zero tricks — definite failure
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: 0 },
        { card: card('10', 'S'), playerIndex: 0 },
        { card: card('7', 'S'), playerIndex: 1 },
        { card: card('8', 'S'), playerIndex: 1 },
      ],
      winner: 0,
    });
  }

  const { scores, contractMade } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  assert(contractMade === false, 'S4: surcoinched failure — contractMade is false');
  assert(scores[1] === 0, 'S4: surcoinched failure — contract team (1) gets 0');
  assert(scores[0] === 160 + 90 * 4, `S4: surcoinched failure — defenders get 160+(90×4)=520, got ${scores[0]}`);
}

// Scenario S5: capot success — 500 flat, no belote bonus
{
  const trumpSuit = 'H';
  const contract = { value: 'capot', team: 0, coinched: false, surcoinched: false };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: 0 },
        { card: card('10', 'S'), playerIndex: 0 },
        { card: card('7', 'S'), playerIndex: 1 },
        { card: card('8', 'S'), playerIndex: 1 },
      ],
      winner: 0,
    });
  }

  const { scores, contractMade } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: 0 });
  assert(contractMade === true, 'S5: capot success — contractMade is true');
  assert(scores[0] === 500, 'S5: capot success — 500 flat (no belote added on capot)');
  assert(scores[1] === 0, 'S5: capot success — defenders get 0');
}

// Scenario S6: capot failure — defenders get 500 flat (not 160)
{
  const trumpSuit = 'H';
  const contract = { value: 'capot', team: 0, coinched: false, surcoinched: false };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winner = i < 7 ? 0 : 1; // team 1 wins last trick — capot fails
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winner },
        { card: card('10', 'S'), playerIndex: winner },
        { card: card('7', 'S'), playerIndex: 1 - winner },
        { card: card('8', 'S'), playerIndex: 1 - winner },
      ],
      winner,
    });
  }

  const { scores, contractMade } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  assert(contractMade === false, 'S6: capot failure — contractMade is false');
  assert(scores[0] === 0, 'S6: capot failure — contract team gets 0');
  assert(scores[1] === 500, `S6: capot failure — defenders get 500 flat, got ${scores[1]}`);
}

// Scenario S7: coinched capot failure — defenders get 1000
{
  const trumpSuit = 'H';
  const contract = { value: 'capot', team: 0, coinched: true, surcoinched: false };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winner = i < 7 ? 0 : 1;
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winner },
        { card: card('10', 'S'), playerIndex: winner },
        { card: card('7', 'S'), playerIndex: 1 - winner },
        { card: card('8', 'S'), playerIndex: 1 - winner },
      ],
      winner,
    });
  }

  const { scores, contractMade } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  assert(contractMade === false, 'S7: coinched capot failure — contractMade is false');
  assert(scores[1] === 1000, `S7: coinched capot failure — defenders get 1000, got ${scores[1]}`);
}

// Scenario S8: non-announced capot (all tricks to contract team, bid was 100) — normal scoring
{
  const trumpSuit = 'H';
  const contract = { value: 100, team: 0, coinched: false, surcoinched: false };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: 0 },
        { card: card('10', 'S'), playerIndex: 0 },
        { card: card('7', 'S'), playerIndex: 1 },
        { card: card('8', 'S'), playerIndex: 1 },
      ],
      winner: 0,
    });
  }

  const { scores, contractMade, trickPoints } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  // All tricks to team 0: trickPoints[0] = 8×21=168, dix de der → 168+10=178... wait
  // Each trick: A(11)+10(10)+7(0)+8(0) = 21 pts. 8 tricks = 168. Last trick +10 dix de der = 178 to team 0.
  // 178 >= 100 → success. scores[0] = 178 + 100 = 278 → rounds to 280. scores[1] = 0.
  assert(contractMade === true, 'S8: non-announced capot — contractMade is true (normal rules)');
  assert(scores[0] === Math.round((trickPoints[0] + 100) / 10) * 10,
    `S8: non-announced capot — normal scoring (${Math.round((trickPoints[0] + 100) / 10) * 10}), got ${scores[0]}`);
  assert(scores[1] === 0, 'S8: non-announced capot — defenders get 0 (no tricks)');
}

// Scenario S9: failed contract — belote does not add on top
{
  const trumpSuit = 'H';
  const contract = { value: 120, team: 0, coinched: false, surcoinched: false };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = i < 2 ? 0 : 1;
    const winnerPlayer = winnerTeam;
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winnerPlayer },
        { card: card('10', 'S'), playerIndex: winnerPlayer },
        { card: card('7', 'S'), playerIndex: 1 - winnerPlayer },
        { card: card('8', 'S'), playerIndex: 1 - winnerPlayer },
      ],
      winner: winnerPlayer,
    });
  }

  // Team 0 has belote but still fails
  const { scores, contractMade } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: 0 });
  assert(contractMade === false, 'S9: failed contract with belote — contractMade is false');
  assert(scores[0] === 0, 'S9: failed contract — contract team still gets 0 (belote ignored)');
  assert(scores[1] === (160 + 120) * 1, `S9: failed contract — defenders get (160+120)×1=280 (belote not added), got ${scores[1]}`);
}

// Scenario S10: coinched success — only contract value is multiplied, not tricks
{
  const trumpSuit = 'H';
  const contract = { value: 80, team: 0, coinched: true, surcoinched: false };

  // Same trick layout as S1: team 0 wins 5 tricks (105 pts), team 1 wins 3 (73 pts incl. dix de der)
  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = i < 5 ? 0 : 1;
    const winnerPlayer = winnerTeam;
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winnerPlayer },
        { card: card('10', 'S'), playerIndex: winnerPlayer },
        { card: card('7', 'S'), playerIndex: 1 - winnerPlayer },
        { card: card('8', 'S'), playerIndex: 1 - winnerPlayer },
      ],
      winner: winnerPlayer,
    });
  }

  const { scores, contractMade, trickPoints } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  // trickPoints[0]=105, trickPoints[1]=73. Contract 80 coinched:
  //   contract team: round((105 + 80×2) / 10) × 10 = round(265/10)×10 = 270
  //   defending team: round(73/10)×10 = 70
  const expectedContractTeam = Math.round((trickPoints[0] + contract.value * 2) / 10) * 10;
  const expectedDefending    = Math.round(trickPoints[1] / 10) * 10;
  assert(contractMade === true, 'S10: coinched success — contractMade is true');
  assert(scores[0] === expectedContractTeam, `S10: coinched success — contract team gets tricks + contract×2 = ${expectedContractTeam}, got ${scores[0]}`);
  assert(scores[1] === expectedDefending,    `S10: coinched success — defending team gets tricks only = ${expectedDefending}, got ${scores[1]}`);
}

// Scenario S11: surcoinched success — only contract value is multiplied ×4
{
  const trumpSuit = 'H';
  const contract = { value: 80, team: 0, coinched: true, surcoinched: true };

  const tricks = [];
  for (let i = 0; i < 8; i++) {
    const winnerTeam = i < 5 ? 0 : 1;
    const winnerPlayer = winnerTeam;
    tricks.push({
      cards: [
        { card: card('A', 'S'), playerIndex: winnerPlayer },
        { card: card('10', 'S'), playerIndex: winnerPlayer },
        { card: card('7', 'S'), playerIndex: 1 - winnerPlayer },
        { card: card('8', 'S'), playerIndex: 1 - winnerPlayer },
      ],
      winner: winnerPlayer,
    });
  }

  const { scores, contractMade, trickPoints } = calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam: null });
  // trickPoints[0]=105, trickPoints[1]=73. Contract 80 surcoinched:
  //   contract team: round((105 + 80×4) / 10) × 10 = round(425/10)×10 = 430
  //   defending team: round(73/10)×10 = 70
  const expectedContractTeam = Math.round((trickPoints[0] + contract.value * 4) / 10) * 10;
  const expectedDefending    = Math.round(trickPoints[1] / 10) * 10;
  assert(contractMade === true, 'S11: surcoinched success — contractMade is true');
  assert(scores[0] === expectedContractTeam, `S11: surcoinched success — contract team gets tricks + contract×4 = ${expectedContractTeam}, got ${scores[0]}`);
  assert(scores[1] === expectedDefending,    `S11: surcoinched success — defending team gets tricks only = ${expectedDefending}, got ${scores[1]}`);
}

// ─── BOT OPENING BIDS — La Feuille V2.1 ─────────────────────────────────────
//
// Convention (V2.1, see docs/la-feuille-v2.md):
//   120 bicolore : maître + ≥1 autre atout + cartes en STRICTEMENT 2 couleurs
//   110          : maître + ≥1 As extérieur
//   100          : maître seul
//   80           : EXACTEMENT 2 As + petit-jeu
//   90           : Pièce 4ème+1As OU V 3ème+belote+1As OU V+9+1+1As
//   pass         : sinon
// Hierarchy: 120 → 110 → 100 → 80 → 90 → pass.
console.log('\n=== Bot Opening Bids (V2.1) ===\n');


// ── B1: Pass — 0 Aces, no trump strength ────────────────────────────────────
{
  const hand = [
    card('K','S'), card('Q','S'),
    card('8','H'), card('7','H'),
    card('9','D'), card('8','D'),
    card('J','C'), card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid === null, 'B1: 0 Aces + no qualifying trump → pass');
}

// ── B2: Pass — 1 Ace, no qualifying trump ──────────────────────────────────
{
  const hand = [
    card('A','S'), card('K','S'),
    card('Q','H'), card('8','H'),
    card('10','D'), card('7','D'),
    card('8','C'), card('7','C'),
  ];
  assert(bestOpeningBid(hand) === null, 'B2: 1 Ace + no piece → pass');
}

// ── B3: Pass — 2 Aces but no petit-jeu (V2 strict) ─────────────────────────
{
  const hand = [
    card('A','S'), card('K','S'),
    card('A','H'), card('10','H'), card('8','H'),
    card('J','D'),                    // J♦ alone — only 1 trump in ♦
    card('8','C'), card('7','C'),     // ♣ no piece, just 2 cards
  ];
  assert(bestOpeningBid(hand) === null, 'B3: 2 Aces, V♦ alone → no petit-jeu → pass');
}

// ── B4: Pass — 3 Aces (80 needs EXACTLY 2) ────────────────────────────────
{
  const hand = [
    card('A','S'), card('K','S'),
    card('A','H'), card('10','H'), card('7','H'),
    card('A','D'),
    card('8','C'), card('7','C'),
  ];
  assert(bestOpeningBid(hand) === null, 'B4: 3 Aces, no piece → pass (80 strict-2-aces)');
}

// ── B5: 80 — 2 Aces + petit-jeu via piece+≥2 trumps ────────────────────────
{
  const hand = [
    card('A','S'), card('Q','S'),
    card('A','H'), card('10','H'), card('7','H'),
    card('J','D'), card('8','D'),     // J♦ + 8♦ → piece + 2 trumps → petit-jeu ♦
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 80,  'B5: 2 Aces + petit-jeu ♦ → 80');
  assert(bid?.suit  === 'D', 'B5: 80 in ♦');
}

// ── B6: 80 — 2 Aces + petit-jeu via 4 trumps + belote (no piece) ──────────
{
  const hand = [
    card('K','C'), card('Q','C'), card('10','C'), card('8','C'),  // 4 ♣, K+Q belote, no piece
    card('A','H'), card('7','H'),
    card('A','D'),
    card('9','S'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 80, 'B6: 2 Aces + 4-trumps-belote-no-piece → 80');
  assert(bid?.suit  === 'C', 'B6: 80 in ♣');
}

// ── B7: 80 — 2 Aces + petit-jeu via 5 trumps no piece ─────────────────────
{
  const hand = [
    card('K','D'), card('Q','D'), card('10','D'), card('8','D'), card('7','D'), // 5 ♦, no J/9
    card('A','H'),
    card('A','S'),
    card('9','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 80, 'B7: 2 Aces + 5-trumps-no-piece → 80');
  assert(bid?.suit  === 'D', 'B7: 80 in ♦');
}

// ── B8: 90 — piece-4th + 1 outside Ace ─────────────────────────────────────
{
  const hand = [
    card('J','S'), card('10','S'), card('8','S'), card('7','S'), // J + 3 other = piece-4th
    card('A','H'), card('Q','H'),
    card('K','D'),
    card('9','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 90,  'B8: piece-4th + 1 outside Ace → 90');
  assert(bid?.suit  === 'S', 'B8: 90 in ♠');
}

// ── B9: 90 — V 3rd + belote (K+Q) + 1 outside Ace ──────────────────────────
{
  const hand = [
    card('J','S'), card('K','S'), card('Q','S'), // V♠ + belote (K+Q♠)
    card('A','H'), card('10','H'), card('8','H'),
    card('7','D'),
    card('9','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 90,  'B9: V 3rd + belote + 1 outside Ace → 90');
  assert(bid?.suit  === 'S', 'B9: 90 in ♠');
}

// ── B10: 90 — V + 9 + 1 other trump + 1 outside Ace ────────────────────────
{
  const hand = [
    card('J','S'), card('9','S'), card('8','S'),
    card('A','H'), card('K','H'), card('Q','H'),
    card('7','D'),
    card('10','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 90,  'B10: V+9+1+1 outside Ace → 90');
  assert(bid?.suit  === 'S', 'B10: 90 in ♠');
}

// ── B11: 100 — maitre, no outside Ace ──────────────────────────────────────
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'), card('7','S'),
    card('K','H'), card('Q','H'),
    card('J','D'),
    card('10','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 100, 'B11: maître ♠, 0 outside Aces → 100');
  assert(bid?.suit  === 'S', 'B11: 100 in ♠');
}

// ── B12: 110 — maitre + 1 outside Ace ──────────────────────────────────────
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'), card('7','S'),
    card('A','H'), card('Q','H'),
    card('J','D'),
    card('10','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 110, 'B12: maître ♠ + 1 outside Ace → 110');
  assert(bid?.suit  === 'S', 'B12: 110 in ♠');
}

// ── B13: 120 — bicolore strict (maitre + ≥1 other trump, exactly 2 suits) ──
{
  const hand = [
    card('J','H'), card('9','H'), card('A','H'), card('K','H'), // maître ♥ + K♥ extra
    card('A','C'), card('10','C'), card('9','C'), card('8','C'), // 4 ♣, no other suit
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 120, 'B13: maître + ≥1 other + strictly 2 suits → 120 bicolore');
  assert(bid?.suit  === 'H', 'B13: bicolore opening in ♥');
}

// ── B14: 110 (NOT 120) — bicolore broken by a 3rd suit ────────────────────
{
  const hand = [
    card('J','H'), card('9','H'), card('A','H'), card('K','H'),
    card('A','C'), card('10','C'), card('9','C'),
    card('7','S'), // 3rd suit → not bicolore
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 110, 'B14: maître ♥ + 1 outside Ace, 3 suits → 110 not 120');
  assert(bid?.suit  === 'H', 'B14: 110 in ♥');
}

// ── B15: Hierarchy — qualifies for 80 AND 90 → 80 wins ────────────────────
{
  // J♠+9♠+8♠ + 2 As (A♥+A♣) + 90-pattern (V+9+1) + petit-jeu ♠ → both 80 & 90 qualify.
  const hand = [
    card('J','S'), card('9','S'), card('8','S'),
    card('A','H'), card('K','H'), card('Q','H'),
    card('8','D'),
    card('A','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 80, 'B15: 80 prioritaire sur 90 (qualifies for both)');
}

// ── B16: Hierarchy — qualifies for 80 AND 110 → 110 wins (100+ > 80) ──────
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'), card('8','S'), // maître ♠ + extra
    card('A','H'), card('Q','H'),
    card('J','D'),
    card('10','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 110, 'B16: 110 prioritaire sur 80 (100+ > 80 hierarchy)');
}

// ─── BOT PARTNER RESPONSE BIDS — La Feuille V2.1 ────────────────────────────
//
// Response tables per opening value:
//   On 80  → 90 / 100 / 110 / 120 / 130 / 140 (piece + 0..2 As)
//   On 90  → 100 / 110 / 120 / 130 (V2.1 piecewise table)
//   On 100 → +10 par As ext (cap 130)
//   On 110 → +10 par As ext (no cap)
//   On 120 → 130 on 3 As OR piece d'atout, else pass
//   Coinched bid → always pass

console.log('\n=== Bot Partner Response Bids (V2.1) ===\n');

// Helper: minimal game state for getBotBidAction tests
function mockBidGame(myHand, currentBid, myPos) {
  const hands = [[], [], [], []];
  hands[myPos] = myHand;
  return { hands, currentBid,
    biddingTurn: myPos, dealer: (myPos + 3) % 4,
    biddingHistory: [], biddingActions: [null, null, null, null],
    consecutivePasses: 0, phase: 'BIDDING', trumpSuit: null,
    beloteInfo: { playerIndex: null, declared: null, rebeloteDone: false, complete: false },
  };
}

// ── R1: On 80, 0 piece 0 As → null (rule-silent) ──────────────────────────
{
  const hand = [
    card('K','S'), card('Q','S'),
    card('8','H'), card('7','H'),
    card('9','D'), card('8','D'),
    card('Q','C'), card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r === null, 'R1: on 80♠, 0 piece + 0 As → null (V2.1 rule-silent)');
}

// ── R2: On 80, piece-2nd no aces → 90 ─────────────────────────────────────
{
  const hand = [
    card('J','S'), card('8','S'),  // V♠ + 1 other = piece 2nde
    card('K','H'), card('Q','H'),
    card('9','D'), card('7','D'),
    card('Q','C'), card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 90,  'R2: on 80♠, piece 2nde + 0 As → 90');
  assert(r?.suit  === 'S', 'R2: response in partner suit ♠');
}

// ── R3: On 80, piece-3rd no aces → 120 ────────────────────────────────────
{
  const hand = [
    card('J','S'), card('10','S'), card('8','S'), // piece 3rd
    card('K','H'), card('Q','H'),
    card('9','D'), card('7','D'),
    card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 120, 'R3: on 80♠, piece 3rd + 0 As → 120');
}

// ── R4: On 80, piece + 1 Ace → 100 ────────────────────────────────────────
{
  const hand = [
    card('J','S'), card('8','S'),     // piece 2nd
    card('A','H'), card('Q','H'),     // 1 outside Ace
    card('9','D'), card('7','D'),
    card('Q','C'), card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 100, 'R4: on 80♠, piece 2nd + 1 As → 100');
}

// ── R5: On 80, piece-3rd + 1 Ace → 130 ────────────────────────────────────
{
  const hand = [
    card('J','S'), card('10','S'), card('8','S'),
    card('A','H'), card('Q','H'),
    card('9','D'), card('7','D'),
    card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 130, 'R5: on 80♠, piece-3rd + 1 As → 130');
}

// ── R6: On 80, piece-3rd + 2 Aces → 140 ───────────────────────────────────
{
  const hand = [
    card('J','S'), card('10','S'), card('8','S'),
    card('A','H'), card('Q','H'),
    card('A','D'), card('7','D'),
    card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 140, 'R6: on 80♠, piece-3rd + 2 As → 140');
}

// ── R7: On 90, ≥1 trump + 1 Ace, no piece → 100 ──────────────────────────
{
  const hand = [
    card('Q','S'), card('7','S'),  // 2 ♠, no piece
    card('A','H'), card('10','H'), card('8','H'),
    card('K','D'), card('9','D'),
    card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'S' });
  assert(r?.value === 100, 'R7: on 90♠, ≥1 trump + 1 As (no piece) → 100');
}

// ── R8: On 90, piece-2nd + 1 Ace → 110 (V2.1 correction) ─────────────────
{
  const hand = [
    card('9','H'), card('10','H'),  // piece 2nde via 9♥
    card('A','D'),
    card('K','S'), card('Q','S'), card('8','S'),
    card('7','C'), card('8','C'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'H' });
  assert(r?.value === 110, 'R8: on 90♥, piece-2nde + 1 As → 110 (V2.1)');
}

// ── R9: On 90, piece-3rd + 1 Ace → 120 ────────────────────────────────────
{
  const hand = [
    card('J','S'), card('10','S'), card('8','S'), // piece-3rd
    card('A','H'), card('K','H'),
    card('9','D'), card('7','D'),
    card('Q','C'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'S' });
  assert(r?.value === 120, 'R9: on 90♠, piece-3rd + 1 As → 120');
}

// ── R10: On 90, 3 Aces (no piece) → 120 ───────────────────────────────────
{
  const hand = [
    card('Q','S'), card('7','S'),
    card('A','H'), card('10','H'),
    card('A','D'), card('8','D'),
    card('A','C'), card('9','C'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'S' });
  assert(r?.value === 120, 'R10: on 90♠, 3 As → 120');
}

// ── R11: On 90, piece-3rd + 2 Aces → 130 ──────────────────────────────────
{
  const hand = [
    card('J','S'), card('10','S'), card('8','S'),
    card('A','H'), card('K','H'),
    card('A','D'), card('7','D'),
    card('Q','C'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'S' });
  assert(r?.value === 130, 'R11: on 90♠, piece-3rd + 2 As → 130');
}

// ── R12: On 100, 1 outside Ace → 110 ──────────────────────────────────────
{
  const hand = [
    card('A','H'), card('10','H'), card('9','H'), card('8','H'),
    card('K','D'), card('9','D'), card('7','D'),
    card('10','C'),
  ];
  const r = partnerResponseBid(hand, { value: 100, suit: 'S' });
  assert(r?.value === 110, 'R12: on 100♠, 1 As ext → 110');
}

// ── R13: On 100, 2 outside Aces → 120 ─────────────────────────────────────
{
  const hand = [
    card('A','H'), card('10','H'),
    card('A','D'), card('K','D'), card('9','D'),
    card('9','C'), card('8','C'),
    card('8','S'),
  ];
  const r = partnerResponseBid(hand, { value: 100, suit: 'S' });
  assert(r?.value === 120, 'R13: on 100♠, 2 As ext → 120');
}

// ── R14: On 100, 0 outside Aces → null ────────────────────────────────────
{
  const hand = [
    card('K','H'), card('10','H'), card('9','H'), card('8','H'),
    card('K','D'), card('9','D'), card('7','D'),
    card('10','C'),
  ];
  const r = partnerResponseBid(hand, { value: 100, suit: 'S' });
  assert(r === null, 'R14: on 100♠, 0 As ext → null (rule-silent)');
}

// ── R15: On 110, 1 outside Ace → 120 ──────────────────────────────────────
{
  const hand = [
    card('A','D'), card('K','D'), card('8','D'),
    card('K','H'), card('Q','H'),
    card('9','C'), card('8','C'),
    card('7','S'),
  ];
  const r = partnerResponseBid(hand, { value: 110, suit: 'S' });
  assert(r?.value === 120, 'R15: on 110♠, 1 As ext → 120');
}

// ── R16: On 110, 2 outside Aces → 130 ─────────────────────────────────────
{
  const hand = [
    card('A','D'), card('9','D'), card('8','D'),
    card('A','C'), card('K','C'), card('8','C'),
    card('9','H'),
    card('7','S'),
  ];
  const r = partnerResponseBid(hand, { value: 110, suit: 'S' });
  assert(r?.value === 130, 'R16: on 110♠, 2 As ext → 130');
}

// ── R17: On 120 bicolore, 3 Aces → 130 ────────────────────────────────────
{
  const hand = [
    card('A','H'), card('10','H'), card('8','H'),
    card('A','D'), card('9','D'),
    card('A','C'), card('7','C'), card('8','C'),
  ];
  const r = partnerResponseBid(hand, { value: 120, suit: 'S' });
  assert(r?.value === 130, 'R17: on 120♠ bicolore, 3 As → 130');
}

// ── R18: On 120 bicolore, piece d'atout → 130 ────────────────────────────
{
  const hand = [
    card('K','S'), card('10','S'), card('8','S'), // K♠ + non-trump-piece slot
    card('A','H'), card('7','H'),                  // 1 As ext (not 3, not 0)
    card('A','D'), card('9','D'),                  // 2nd As ext
    card('8','C'),
  ];
  // Hand has 0 piece in ♠ — use a hand that has J♠ or 9♠.
  const handPiece = [
    card('J','S'),                                 // piece d'atout
    card('A','H'), card('7','H'), card('8','H'),
    card('A','D'), card('9','D'), card('8','D'),
    card('7','C'),
  ];
  const r = partnerResponseBid(handPiece, { value: 120, suit: 'S' });
  assert(r?.value === 130, 'R18: on 120♠ bicolore, J♠ (piece d\'atout) → 130');
}

// ── R19: On 120 bicolore, 2 As, no piece → null (pass) ───────────────────
{
  const hand = [
    card('A','H'), card('10','H'), card('8','H'),
    card('A','D'), card('9','D'), card('7','D'),
    card('8','C'), card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 120, suit: 'S' });
  assert(r === null, 'R19: on 120♠ bicolore, 2 As, no piece → null (pass per V2)');
}

// ── R20: Coinched bid → pass regardless of hand strength ──────────────────
{
  const strongHand = [
    card('J','S'), card('9','S'), card('A','S'),
    card('A','H'), card('K','H'),
    card('A','D'), card('A','C'), card('K','C'),
  ];
  const game = mockBidGame(
    strongHand,
    { value: 90, suit: 'H', playerIndex: 2, team: 0, coinched: true, surcoinched: false },
    0,
  );
  const action = getBotBidAction(game, 0);
  assert(action.type === 'pass', 'R20: coinched bid → always pass');
}

// ── R21: Helper-function spot checks (V2.1 internals) ────────────────────
{
  // isPetitJeu: piece + 2 trumps → true
  assert(isPetitJeu({ piece: true,  count: 2, hasBelote: false }) === true,  'R21a: piece+2 → petit-jeu');
  assert(isPetitJeu({ piece: false, count: 4, hasBelote: true  }) === true,  'R21b: 4-trumps-belote-no-piece → petit-jeu');
  assert(isPetitJeu({ piece: false, count: 5, hasBelote: false }) === true,  'R21c: 5-trumps-no-piece → petit-jeu');
  assert(isPetitJeu({ piece: true,  count: 1, hasBelote: false }) === false, 'R21d: piece alone → NOT petit-jeu');
  assert(isPetitJeu({ piece: false, count: 4, hasBelote: false }) === false, 'R21e: 4-trumps-no-belote-no-piece → NOT petit-jeu');

  // qualifiesFor90 — outsideAces required
  assert(qualifiesFor90({ piece: true,  count: 4, outsideAces: 0 }) === false, 'R21f: piece-4th + 0 As ext → NOT 90');
  assert(qualifiesFor90({ piece: true,  count: 4, outsideAces: 1, hasJ: true,  hasBelote: false, has9: false }) === true, 'R21g: piece-4th + 1 As ext → 90');

  // isStrictBicolore
  assert(isStrictBicolore(
    [card('J','H'), card('9','H'), card('A','H'), card('K','H'),
     card('A','C'), card('10','C'), card('9','C'), card('8','C')],
    'H',
  ) === true,  'R21h: 4♥ + 4♣ → strict bicolore');
  assert(isStrictBicolore(
    [card('J','H'), card('9','H'), card('A','H'), card('K','H'),
     card('A','C'), card('10','C'), card('9','C'), card('7','S')],
    'H',
  ) === false, 'R21i: 4♥ + 3♣ + 1♠ → not bicolore');
}

// ─── Bot Card Play ────────────────────────────────────────────────────────────

console.log('\n=== Bot Card Play ===\n');

// Helper to build a minimal game object for getBotCardAction
function mockCardGame({ hand, trick = [], trumpSuit = 'H', tricks = [], contractTeam = 0, biddingHistory = [] }) {
  // Build hands: position 0 is the bot under test; others get dummy single cards
  const hands = {
    0: hand,
    1: [card('7', 'S')],
    2: [card('8', 'S')],
    3: [card('9', 'S')],
  };
  return {
    hands,
    currentTrick: trick,
    trumpSuit,
    tricks,
    currentBid: { team: contractTeam, value: 80, suit: trumpSuit, playerIndex: 1, coinched: false, surcoinched: false },
    biddingHistory,
    beloteInfo: { declared: null },
  };
}

// C1: Bot last-to-act, cannot win — partner NOT winning, trump J winning.
// Hand: non-trump A♠ + non-trump 7♠. Must dump 7, not A.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('J', 'H'), 1),  // trump J — unbeatable
    play(card('A', 'S'), 2),  // non-trump, loses to trump
    play(card('K', 'S'), 3),  // non-trump, loses to trump
  ];
  const hand = [card('A', 'S'), card('7', 'S')];
  const game = mockCardGame({ hand, trick, trumpSuit, tricks: [] });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  assert(chosen.value === '7' && chosen.suit === 'S', 'C1: cannot win — dumps 7♠, not A♠');
}

// C2: Partner winning with trump J, bot has trump Q + non-trump A + non-trump 8.
// Bot should SUPPORT (partner winning) → dumps cheapest loser → non-trump 8.
// Lead suit is D — bot has no D → partner winning → all cards valid (R1).
{
  const trumpSuit = 'H';
  const trick = [
    play(card('7', 'D'), 1),  // opponent leads 7♦
    play(card('J', 'H'), 2),  // partner (pos 2) plays trump J — winning
  ];
  const hand = [card('Q', 'H'), card('A', 'S'), card('8', 'C')];
  const game = mockCardGame({ hand, trick, trumpSuit, tricks: [] });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  // partner is winning → SUPPORT → dump cheapest loser = non-trump 8♣ (dumpScore 1)
  assert(chosen.value === '8', 'C2: partner winning — SUPPORT, dumps 8♣ not A♠ or Q♥');
  assert(chosen.suit === 'C', 'C2: confirms dump is 8♣');
}

// C3: Bot attacking, leading, holds J+9 of trump, early game → leads highest trump (J).
{
  const trumpSuit = 'H';
  const hand = [card('J', 'H'), card('9', 'H'), card('A', 'D'), card('K', 'S')];
  const game = mockCardGame({ hand, trick: [], trumpSuit, tricks: [], contractTeam: 0 });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  // B-rule: attacking + J+9 + early → lead highest trump
  assert(chosen.suit === 'H', 'C3: attacking with J+9 — leads trump');
  assert(chosen.value === 'J', 'C3: leads trump J (highest trump)');
}

// C4: Bot leading, holds non-trump Ace, tricks < 5 → leads the Ace.
// Does NOT hold J+9 of trump, so rule B doesn't fire.
{
  const trumpSuit = 'H';
  const hand = [card('J', 'H'), card('A', 'S'), card('K', 'D')];  // J but no 9 of trump
  const game = mockCardGame({ hand, trick: [], trumpSuit, tricks: [], contractTeam: 0 });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  // B doesn't fire (no trump 9). A fires: has non-trump Ace → lead it.
  assert(chosen.value === 'A' && chosen.suit === 'S', 'C4: no J+9 combo — leads non-trump A♠');
}

// C5: Bot can win with trump Q or trump J → should play trump Q (cheapestWinner avoids J).
{
  const trumpSuit = 'H';
  // Trick: opponent led 7♠, partner played 8♠, opponent played 9♠. Bot holds trump Q + trump J.
  // Both trump cards would win (trump beats non-trump).
  const trick = [
    play(card('7', 'S'), 1),
    play(card('8', 'S'), 2),
    play(card('9', 'S'), 3),
  ];
  const hand = [card('Q', 'H'), card('J', 'H')];
  const game = mockCardGame({ hand, trick, trumpSuit, tricks: [] });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  assert(chosen.suit === 'H' && chosen.value === 'Q', 'C5: both trumps win — plays Q♥ not J♥ (cheapestWinner guard)');
}

// C6: Trick has 0 points, bot's only winning move costs ≥10 pts → ABANDON.
// Trick: three 7/8 non-trump cards (0 pts). Bot holds non-trump A (11 pts, winning) + non-trump 7.
{
  const trumpSuit = 'H';
  const trick = [
    play(card('7', 'S'), 1),
    play(card('8', 'S'), 2),
    play(card('9', 'S'), 3),
  ];
  // Bot (pos 0) must follow suit S; it has A♠ (wins, 11 pts) and 7♠ (loses, 0 pts)
  const hand = [card('A', 'S'), card('7', 'S')];
  const game = mockCardGame({ hand, trick, trumpSuit, tricks: [] });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  // trickValue = 0, winCost = 11 ≥ 10 → ABANDON → dumps 7♠
  assert(chosen.value === '7' && chosen.suit === 'S', 'C6: 0-pt trick, cheapest win costs 11 pts → ABANDON, dumps 7♠');
}

// C7: dumpScore ordering — non-trump 7 dumps before non-trump 9, before trump 8, before non-trump J.
// Lead suit D — bot has no D; partner (pos 2) winning with A♦ → all cards valid (R1).
{
  const trumpSuit = 'H';
  const trick = [
    play(card('7', 'D'), 1),  // opponent leads 7♦
    play(card('A', 'D'), 2),  // partner (pos 2) plays A♦ — winning
  ];
  const cards = [
    card('J', 'S'),  // non-trump J — dumpScore 4
    card('8', 'H'),  // trump 8     — dumpScore 3
    card('9', 'S'),  // non-trump 9 — dumpScore 2
    card('7', 'S'),  // non-trump 7 — dumpScore 1  ← should be first
  ];
  const game = mockCardGame({ hand: cards, trick, trumpSuit, tricks: [] });
  game.hands[0] = cards;
  const { card: chosen } = getBotCardAction(game, 0);
  assert(chosen.value === '7' && chosen.suit === 'S', 'C7: dumpScore — non-trump 7♠ dumps before 9♠, before 8♥(trump), before J♠');
}

// C8: Bot holding trump A + non-trump 8 — partner winning → SUPPORT, protects trump A.
// Lead suit D — bot has no D; partner (pos 2) winning → all cards valid (R1).
{
  const trumpSuit = 'H';
  const trick = [
    play(card('7', 'D'), 1),  // opponent leads 7♦
    play(card('A', 'D'), 2),  // partner (pos 2) plays A♦ — winning
  ];
  const hand = [card('A', 'H'), card('8', 'C')];
  const game = mockCardGame({ hand, trick, trumpSuit, tricks: [] });
  game.hands[0] = hand;
  const { card: chosen } = getBotCardAction(game, 0);
  // SUPPORT → cheapestLoser → 8♣ (dumpScore 1) before trump A♥ (dumpScore 11).
  assert(chosen.value === '8' && chosen.suit === 'C', 'C8: partner winning — dumps 8♣ not trump A♥');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

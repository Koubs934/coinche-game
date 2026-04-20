/**
 * Standalone verification script for rules, scoring, and bot bidding logic.
 * Run with: node backend/src/game/verify.js
 */

const { getValidCards, getTrickWinner, TRUMP_RANK, cardPoints } = require('./rules');
const { calculateRoundScore } = require('./scoring');
const { bestOpeningBid, computeSuitFeatures,
        partnerResponseBid, myContributionToPartner } = require('./botBidding');
const { getBotBidAction, getBotCardAction } = require('./botLogic');

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

// ─── BOT OPENING BIDS ────────────────────────────────────────────────────────
//
// Convention (V1):
//   pass → < 2 Aces AND no qualifying trump suit
//   80   → 2+ Aces, no qualifying trump suit  — bid in suit with highest trump potential
//   90   → petit jeu  (J+3rd  OR  9+4th + outside Ace)
//   100  → maître à l'atout  (J + 9 + A in suit)
//   110  → maître + 1 outside Ace
//   120  → bicolore  (maître + exploitable side suit)

console.log('\n=== Bot Opening Bids ===\n');

// ── B1: Pass — 0 Aces, no trump strength ────────────────────────────────────
// K♠ Q♠ 8♥ 7♥ 9♦ 8♦ J♣ 7♣
// No Ace anywhere. Clubs has J but only 2 cards (needs 3+). Diamonds has 9 but only 2 (needs 4+).
{
  const hand = [
    card('K','S'), card('Q','S'),
    card('8','H'), card('7','H'),
    card('9','D'), card('8','D'),
    card('J','C'), card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid === null, 'B1: 0 Aces + no trump strength → pass');
}

// ── B2: Pass — 1 Ace only, no trump strength ────────────────────────────────
// A♠ K♠ Q♥ 8♥ 10♦ 7♦ 8♣ 7♣
// Spades has A but not J or 9 for any trump pattern. Total Aces = 1 < 2 → no 80 fallback.
{
  const hand = [
    card('A','S'), card('K','S'),
    card('Q','H'), card('8','H'),
    card('10','D'), card('7','D'),
    card('8','C'), card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid === null, 'B2: 1 Ace + no trump strength → pass');
}

// ── B3: 80 — 2 Aces, no qualifying trump suit ───────────────────────────────
// A♠ 8♠  A♥ Q♥  K♦ 7♦  7♣ 8♣
// trumpPtsSum: ♠=11, ♥=14 (A+Q), ♦=4, ♣=0  →  bid 80 in ♥ (highest potential)
{
  const hand = [
    card('A','S'), card('8','S'),
    card('A','H'), card('Q','H'),
    card('K','D'), card('7','D'),
    card('7','C'), card('8','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 80,  'B3: 2 Aces, no trump strength → 80');
  assert(bid?.suit  === 'H', 'B3: 80 in ♥ — highest trump potential (A+Q=14 vs A=11)');
}

// ── B4: 90 — petit jeu via Jack-third ───────────────────────────────────────
// J♠ K♠ 8♠  A♥ Q♥  9♦ 7♦  7♣
// Spades: J + 2 others = Jack-third → petit jeu. No master anywhere.
{
  const hand = [
    card('J','S'), card('K','S'), card('8','S'),
    card('A','H'), card('Q','H'),
    card('9','D'), card('7','D'),
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 90,  'B4: Jack-third → petit jeu 90');
  assert(bid?.suit  === 'S', 'B4: petit jeu in ♠');
}

// ── B5: 90 — petit jeu via 9-fourth + outside Ace ───────────────────────────
// 9♠ K♠ 8♠ 7♠  A♥ Q♥  J♦  8♣
// Spades: 9 + 3 others = 9-fourth; outsideAces = 1 (A♥) → petit jeu.
{
  const hand = [
    card('9','S'), card('K','S'), card('8','S'), card('7','S'),
    card('A','H'), card('Q','H'),
    card('J','D'),
    card('8','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 90,  'B5: 9-fourth + outside Ace → petit jeu 90');
  assert(bid?.suit  === 'S', 'B5: petit jeu in ♠');
}

// ── B5b: 90 does NOT fire when 9-fourth but NO outside Ace ──────────────────
// 9♠ K♠ 8♠ 7♠  Q♥ J♥  K♦  8♣
// Spades: 9-fourth but outsideAces = 0.  No other suit qualifies.
// Total Aces = 0 → pass.
{
  const hand = [
    card('9','S'), card('K','S'), card('8','S'), card('7','S'),
    card('Q','H'), card('J','H'),
    card('K','D'),
    card('8','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid === null, 'B5b: 9-fourth but 0 outside Aces → pass (not petit jeu)');
}

// ── B6: 100 — maître (J+9+A), no outside Ace, no exploitable side suit ──────
// J♠ 9♠ A♠ K♠  Q♥ 8♥  7♦  7♣
// Spades: master. Hearts: Q+8 (count=2, no Ace → not exploitable). outsideAces=0 → 100.
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'), card('K','S'),
    card('Q','H'), card('8','H'),
    card('7','D'),
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 100, 'B6: maître, no outside Ace → 100');
  assert(bid?.suit  === 'S', 'B6: maître in ♠');
}

// ── B7: 110 — maître + isolated outside Ace (not exploitable as side suit) ───
// J♠ 9♠ A♠ K♠  A♥ 8♥  7♦  7♣
// Spades: master. Hearts: A+8 (count=2, hasA=true, but 8∉HONORS → not exploitable).
// outsideAces=1 (A♥) but no bicolore → 110.
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'), card('K','S'),
    card('A','H'), card('8','H'),
    card('7','D'),
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 110, 'B7: maître + outside Ace (no exploitable side) → 110');
  assert(bid?.suit  === 'S', 'B7: 110 in ♠');
  // Verify hearts is NOT exploitable (A+8 with 8∉HONORS, count=2)
  const hFeatures = computeSuitFeatures(hand, 'H');
  assert(hFeatures.isExploitable === false, 'B7: A+8♥ not exploitable (8 is not an honour)');
}

// ── B8a: 120 — bicolore via Ace + honour in side suit ───────────────────────
// J♠ 9♠ A♠ K♠  A♥ K♥ Q♥  7♣
// Spades: master. Hearts: A+K+Q (count=3, hasA=true, K∈HONORS → exploitable) → bicolore.
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'), card('K','S'),
    card('A','H'), card('K','H'), card('Q','H'),
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 120, 'B8a: bicolore (maître ♠ + A+K+Q♥) → 120');
  assert(bid?.suit  === 'S', 'B8a: bicolore opening in ♠');
  const hFeatures = computeSuitFeatures(hand, 'H');
  assert(hFeatures.isExploitable === true, 'B8a: A+K+Q♥ is exploitable (A+honour, count=3)');
}

// ── B8b: 120 — bicolore via 4+ cards in side suit (no Ace needed) ───────────
// J♠ 9♠ A♠  K♥ Q♥ 8♥ 7♥  7♣
// Spades: master (count=3). Hearts: K+Q+8+7 (count=4 → exploitable, no Ace needed) → bicolore.
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'),
    card('K','H'), card('Q','H'), card('8','H'), card('7','H'),
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 120, 'B8b: bicolore (maître ♠ + 4-card ♥) → 120');
  assert(bid?.suit  === 'S', 'B8b: bicolore opening in ♠');
  const hFeatures = computeSuitFeatures(hand, 'H');
  assert(hFeatures.isExploitable === true, 'B8b: 4-card ♥ is exploitable (length)');
}

// ── B9: Tie-break — two suits at same level, higher trumpPtsSum wins ─────────
// J♠ 9♠ A♠  J♥ 9♥ A♥  7♦  7♣
// Both ♠ and ♥ are master (trumpPtsSum=45 each). Each suit's partner (the other) has
// J+9+A → isExploitable (hasA+hasHonor). Both reach 120. Canonical tie-break: ♠ < ♥ → ♠.
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'),
    card('J','H'), card('9','H'), card('A','H'),
    card('7','D'),
    card('7','C'),
  ];
  const bid = bestOpeningBid(hand);
  assert(bid?.value === 120, 'B9: two bicolore suits → 120');
  assert(bid?.suit  === 'S', 'B9: tie-break by canonical order → ♠ over ♥');
}

// ─── BOT PARTNER RESPONSE BIDS ───────────────────────────────────────────────
//
// Convention (V1) — response when partner is currently the highest bidder:
//
//   SUPPORT  → raise in partner's suit:  partnerBid + outsideAces×10
//              + trump Ace bonus of +10 when partner bid 90 (might lack A of trump)
//   SWITCH   → bid own opening in suit Y ≠ partner's, only when value > partnerBid
//              Tie (switch = support): prefer switch (own trump certainty wins)
//   PASS     → no Ace contribution AND no valid switch
//   CAP      → responses capped at 120 in V1

console.log('\n=== Bot Partner Response Bids ===\n');

// Helper: minimal game state for getBotBidAction tests (R18)
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

// ── R1: Partner bid 80 ♠ — no Aces, no trump → pass ─────────────────────────
// 0 outside Aces. No qualifying trump suit. Pass.
{
  const hand = [
    card('K','S'), card('Q','S'),
    card('8','H'), card('7','H'),
    card('9','D'), card('8','D'),
    card('J','C'), card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r === null, 'R1: partner 80♠, 0 Aces, no trump → pass');
}

// ── R2: Partner bid 80 ♠ — 1 outside Ace → support 90 ♠ ─────────────────────
{
  const hand = [
    card('A','H'), card('8','H'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('8','S'), card('7','S'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 90,  'R2: partner 80♠, 1 outside Ace → support 90');
  assert(r?.suit  === 'S', 'R2: support stays in partner\'s suit ♠');
}

// ── R3: Partner bid 80 ♠ — 2 outside Aces → support 100 ♠ ───────────────────
{
  const hand = [
    card('A','H'), card('8','H'),
    card('A','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('8','S'), card('7','S'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 100, 'R3: partner 80♠, 2 outside Aces → support 100');
  assert(r?.suit  === 'S', 'R3: support in ♠');
}

// ── R4: Partner bid 80 ♠ — petit jeu ♥ (J-third), 0 outside Aces → switch 90 ♥
{
  const hand = [
    card('J','H'), card('K','H'), card('8','H'),
    card('Q','D'), card('7','D'),
    card('8','C'), card('7','C'),
    card('9','S'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 90,  'R4: partner 80♠, petit jeu ♥ → switch 90');
  assert(r?.suit  === 'H', 'R4: switch to own suit ♥');
}

// ── R5: Partner bid 80 ♠ — petit jeu ♥ AND 1 outside Ace → switch 90 ♥ ──────
// Switch = 90, support = 90 → tie → switch preferred.
{
  const hand = [
    card('J','H'), card('K','H'), card('8','H'),
    card('A','D'), card('7','D'),
    card('8','C'), card('7','C'),
    card('9','S'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 90,  'R5: switch 90♥ = support 90♠ → tie → switch preferred');
  assert(r?.suit  === 'H', 'R5: tie-break: switch to ♥');
}

// ── R6: Partner bid 80 ♠ — master ♥ (J+9+A), no outside Ace → switch 100 ♥ ─
{
  const hand = [
    card('J','H'), card('9','H'), card('A','H'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('9','S'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 100, 'R6: partner 80♠, master ♥ → switch 100');
  assert(r?.suit  === 'H', 'R6: switch to master suit ♥');
}

// ── R7: Partner bid 80 ♠ — 3 outside Aces + petit jeu ♥ → support 110 ♠ ────
// Support = 80+30 = 110. Switch (petit jeu ♥) = 90. 110 > 90 → support wins.
{
  const hand = [
    card('J','H'), card('A','H'), card('K','H'),
    card('A','D'), card('7','D'),
    card('A','C'), card('8','C'),
    card('7','S'),
  ];
  const r = partnerResponseBid(hand, { value: 80, suit: 'S' });
  assert(r?.value === 110, 'R7: partner 80♠, 3 outside Aces + petit jeu ♥ → support 110');
  assert(r?.suit  === 'S', 'R7: 110 support beats 90 switch');
}

// ── R8: Partner bid 90 ♥ — I hold A♥ (trump Ace bonus) → support 100 ♥ ──────
// Partner bid 90 (petit jeu, may lack A of trump). I hold A♥ → +10 bonus. 90+10=100.
{
  const hand = [
    card('A','H'), card('8','H'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('8','S'), card('7','S'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'H' });
  assert(r?.value === 100, 'R8: partner 90♥, I hold A♥ (trump Ace bonus) → support 100');
  assert(r?.suit  === 'H', 'R8: support in ♥');
  // Verify contribution counts: trump Ace bonus applies
  const c = myContributionToPartner(hand, { value: 90, suit: 'H' });
  assert(c === 1, 'R8: contribution = 1 (trump Ace bonus for 90, no outside Aces)');
}

// ── R9: Partner bid 90 ♥ — 1 outside Ace ♠, no trump complement → support 100 ♥
{
  const hand = [
    card('A','S'), card('8','S'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('8','H'), card('7','H'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'H' });
  assert(r?.value === 100, 'R9: partner 90♥, 1 outside Ace ♠ → support 100');
  assert(r?.suit  === 'H', 'R9: support in ♥');
}

// ── R10: Partner bid 90 ♥ — master ♠ (J+9+A) → switch 100 ♠ ─────────────────
// Switch = 100♠. Support = 90+10 = 100♥ (A♠ is outside Ace). Tie at 100 → switch.
{
  const hand = [
    card('J','S'), card('9','S'), card('A','S'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('7','H'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'H' });
  assert(r?.value === 100, 'R10: partner 90♥, master ♠ → 100 (switch tie-breaks support)');
  assert(r?.suit  === 'S', 'R10: tie at 100 → switch to own master suit ♠');
}

// ── R11: Partner bid 90 ♥ — 0 Aces, no trump complement → pass ───────────────
{
  const hand = [
    card('K','S'), card('Q','S'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('8','H'), card('7','H'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'H' });
  assert(r === null, 'R11: partner 90♥, 0 Aces, no trump → pass');
}

// ── R12: Partner bid 100 ♠ — 0 outside Aces → pass ───────────────────────────
// Even with petit jeu in ♦ (90), 90 is not > 100 → no valid switch. No Aces → pass.
{
  const hand = [
    card('K','S'),
    card('Q','D'), card('J','D'), card('7','D'),
    card('8','H'), card('7','H'),
    card('9','C'), card('8','C'),
  ];
  const r = partnerResponseBid(hand, { value: 100, suit: 'S' });
  assert(r === null, 'R12: partner 100♠, 0 outside Aces, petit jeu ♦ → pass (90 can\'t outbid 100)');
}

// ── R13: Partner bid 100 ♠ — 1 outside Ace ♥ → support 110 ♠ ────────────────
{
  const hand = [
    card('A','H'), card('8','H'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('K','S'), card('8','S'),
  ];
  const r = partnerResponseBid(hand, { value: 100, suit: 'S' });
  assert(r?.value === 110, 'R13: partner 100♠, 1 outside Ace → support 110');
  assert(r?.suit  === 'S', 'R13: support in ♠');
  // Verify trump Ace bonus does NOT apply for 100 (partner already owns A♠)
  const c = myContributionToPartner(hand, { value: 100, suit: 'S' });
  assert(c === 1, 'R13: contribution = 1 outside Ace only (no trump Ace bonus when partner bid 100)');
}

// ── R14: Partner bid 100 ♠ — 2 outside Aces → support 120 ♠ ─────────────────
{
  const hand = [
    card('A','H'), card('8','H'),
    card('A','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('K','S'), card('8','S'),
  ];
  const r = partnerResponseBid(hand, { value: 100, suit: 'S' });
  assert(r?.value === 120, 'R14: partner 100♠, 2 outside Aces → support 120');
  assert(r?.suit  === 'S', 'R14: support in ♠');
}

// ── R15: Partner bid 110 ♠ — 1 outside Ace → support 120 ♠ ──────────────────
{
  const hand = [
    card('A','H'), card('8','H'),
    card('K','D'), card('7','D'),
    card('Q','C'), card('8','C'),
    card('K','S'), card('8','S'),
  ];
  const r = partnerResponseBid(hand, { value: 110, suit: 'S' });
  assert(r?.value === 120, 'R15: partner 110♠, 1 outside Ace → support 120 (cap applied)');
  assert(r?.suit  === 'S', 'R15: support in ♠');
}

// ── R16: Partner bid 110 ♠ — 0 outside Aces → pass ──────────────────────────
{
  const hand = [
    card('K','S'),
    card('Q','D'), card('J','D'), card('7','D'),
    card('8','H'), card('7','H'),
    card('9','C'), card('8','C'),
  ];
  const r = partnerResponseBid(hand, { value: 110, suit: 'S' });
  assert(r === null, 'R16: partner 110♠, 0 outside Aces → pass');
}

// ── R17: Partner bid 120 ♠ — always pass (V1 cap) ───────────────────────────
// Even a very strong hand should pass — 120 is the V1 ceiling.
{
  const hand = [
    card('J','H'), card('9','H'), card('A','H'),
    card('A','D'), card('K','D'), card('Q','D'),
    card('A','C'), card('K','C'),
  ];
  const r = partnerResponseBid(hand, { value: 120, suit: 'S' });
  assert(r === null, 'R17: partner 120♠ → always pass (V1 response cap)');
}

// ── R18: Coinched bid — getBotBidAction returns pass regardless of hand ───────
// After a coinche only surcoinche is legal (a separate event). Bot must pass.
{
  const strongHand = [
    card('J','S'), card('9','S'), card('A','S'),
    card('A','H'), card('K','H'),
    card('A','D'), card('A','C'), card('K','C'),
  ];
  // Position 0; partner is position 2; partner's 90♥ is now coinched by opponent
  const game18 = mockBidGame(
    strongHand,
    { value: 90, suit: 'H', playerIndex: 2, team: 0, coinched: true, surcoinched: false },
    0
  );
  const bid18 = getBotBidAction(game18, 0);
  assert(bid18.type === 'pass', 'R18: coinched bid → getBotBidAction always passes');
}

// ── R19: Partner bid 90 ♥ — A♥ (trump Ace) + 1 outside Ace ♠ → support 110 ♥
// Trump Ace bonus (+10) stacks with outside Ace (+10) → total contribution = 2 → 90+20=110.
{
  const hand = [
    card('A','H'), card('K','H'),
    card('A','S'), card('8','S'),
    card('7','D'), card('8','D'),
    card('Q','C'), card('7','C'),
  ];
  const r = partnerResponseBid(hand, { value: 90, suit: 'H' });
  assert(r?.value === 110, 'R19: partner 90♥, A♥ + outside Ace ♠ → support 110 (stacked contribution)');
  assert(r?.suit  === 'H', 'R19: support in ♥');
  const c = myContributionToPartner(hand, { value: 90, suit: 'H' });
  assert(c === 2, 'R19: contribution = 2 (trump Ace bonus + outside Ace ♠)');
}

// ── R20: Trump Ace bonus does NOT apply when partner bid 100+ ────────────────
// Partner bid 100 in ♥ → already declared J+9+A♥; they own A♥.
// I hold A♥ (impossible in a real game, but tests the rule logic):
// the bonus should be 0 when partnerBid.value = 100.
{
  const hand = [
    card('A','H'), card('8','H'),    // A♥ held — bonus must be 0 (partner bid 100)
    card('A','S'), card('8','S'),    // outside Ace ♠ → +10
    card('7','D'), card('8','D'),
    card('Q','C'), card('7','C'),
  ];
  const c = myContributionToPartner(hand, { value: 100, suit: 'H' });
  assert(c === 1, 'R20: trump Ace bonus is 0 when partner bid 100 (bonus only applies at 90)');
  // The outside Ace ♠ still counts as normal contribution
  const r = partnerResponseBid(hand, { value: 100, suit: 'H' });
  assert(r?.value === 110, 'R20: partner 100♥, 1 outside Ace ♠ → support 110 (no trump Ace bonus)');
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

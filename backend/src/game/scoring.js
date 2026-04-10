const { cardPoints } = require('./rules');

/**
 * Calculate scores for a completed round.
 *
 * @param {object} params
 * @param {Array}  params.tricks      - [{cards:[{card,playerIndex}], winner:playerIndex}]
 * @param {string} params.trumpSuit   - 'S'|'H'|'D'|'C'
 * @param {object} params.contract    - {team, value, coinched, surcoinched}
 * @param {number|null} params.beloteTeam - 0|1|null
 * @returns {{ scores:[number,number], contractMade:boolean, trickPoints:[number,number] }}
 */
function calculateRoundScore({ tricks, trumpSuit, contract, beloteTeam }) {
  const contractTeam = contract.team;
  const opposingTeam = 1 - contractTeam;

  // Tally raw trick points + dix de der
  const trickPoints = [0, 0];
  for (let i = 0; i < tricks.length; i++) {
    const trick = tricks[i];
    const team = trick.winner % 2;
    for (const { card } of trick.cards) {
      trickPoints[team] += cardPoints(card, trumpSuit);
    }
    if (i === tricks.length - 1) {
      trickPoints[team] += 10; // dix de der
    }
  }

  const allTricksToContract = tricks.every(t => t.winner % 2 === contractTeam);

  let scores = [0, 0];
  let contractMade = false;

  if (contract.value === 'capot') {
    if (allTricksToContract) {
      contractMade = true;
      scores[contractTeam] = 500;
    } else {
      // Failed capot
      scores[contractTeam] = 0;
      scores[opposingTeam] = 160;
    }
  } else if (allTricksToContract) {
    // Accidental capot (not bid): 250 flat
    contractMade = true;
    scores[contractTeam] = 250;
    scores[opposingTeam] = 0;
  } else if (trickPoints[contractTeam] >= contract.value) {
    contractMade = true;
    scores[0] = trickPoints[0];
    scores[1] = trickPoints[1];
    scores[contractTeam] += contract.value; // contract bonus added to trick points
  } else {
    // Contract failed
    scores[contractTeam] = 0;
    scores[opposingTeam] = 160;
  }

  // Belote/Rebelote: 20 pts to declaring team, always
  if (beloteTeam !== null && beloteTeam !== undefined) {
    scores[beloteTeam] += 20;
  }

  // Coinche / Surcoinche multiplier applied to winning team
  const multiplier = contract.surcoinched ? 4 : contract.coinched ? 2 : 1;
  if (multiplier > 1) {
    const winningTeam = contractMade ? contractTeam : opposingTeam;
    scores[winningTeam] *= multiplier;
  }

  // Round each team's total to nearest 10 (5 rounds up)
  scores[0] = Math.round(scores[0] / 10) * 10;
  scores[1] = Math.round(scores[1] / 10) * 10;

  return { scores, contractMade, trickPoints };
}

module.exports = { calculateRoundScore };

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
  const multiplier = contract.surcoinched ? 4 : contract.coinched ? 2 : 1;

  // Tally raw trick points + dix de der (informational; not used on flat-score outcomes)
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

  // ── Announced Capot ─────────────────────────────────────────────────────────
  if (contract.value === 'capot') {
    if (allTricksToContract) {
      contractMade = true;
      scores[contractTeam] = 500 * multiplier;
    } else {
      scores[opposingTeam] = 500 * multiplier;
    }
    // Belote/Rebelote does NOT add on capot outcomes (spec: flat score only)
    return { scores, contractMade, trickPoints };
  }

  // ── Normal contract ──────────────────────────────────────────────────────────
  // Belote counts toward making the contract when it belongs to the contract team
  const contractTeamBelote = beloteTeam === contractTeam ? 20 : 0;
  const contractTeamTotal = trickPoints[contractTeam] + contractTeamBelote;

  if (contractTeamTotal >= contract.value) {
    contractMade = true;

    // Contract team: trick points + (announced value × multiplier). Only the
    // announced value is multiplied — trick points are always added as-is.
    scores[contractTeam] = trickPoints[contractTeam] + contractTeamBelote + contract.value * multiplier;
    scores[opposingTeam] = trickPoints[opposingTeam] + (beloteTeam === opposingTeam ? 20 : 0);

    // Round both scores to nearest 10
    scores[0] = Math.round(scores[0] / 10) * 10;
    scores[1] = Math.round(scores[1] / 10) * 10;
  } else {
    // Contract failed — defending team scores 160 + (contract × multiplier)
    scores[opposingTeam] = 160 + contract.value * multiplier;
    // scores[contractTeam] stays 0
  }

  return { scores, contractMade, trickPoints };
}

module.exports = { calculateRoundScore };

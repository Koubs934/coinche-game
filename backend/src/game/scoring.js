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

    // Each team scores their trick points; contract team also earns contract bonus
    scores[contractTeam] = trickPoints[contractTeam] + contractTeamBelote + contract.value;
    scores[opposingTeam] = trickPoints[opposingTeam] + (beloteTeam === opposingTeam ? 20 : 0);

    // Round once, then apply multiplier to contract team (the winner of coinche)
    scores[0] = Math.round(scores[0] / 10) * 10;
    scores[1] = Math.round(scores[1] / 10) * 10;
    if (multiplier > 1) {
      scores[contractTeam] *= multiplier;
    }
  } else {
    // Contract failed — flat score; bonuses do not add on top
    if (multiplier === 1) {
      scores[opposingTeam] = 160;
    } else {
      // coinche: (contract × 2) + 160; surcoinche: (contract × 4) + 160
      scores[opposingTeam] = (contract.value * multiplier) + 160;
    }
    // scores[contractTeam] stays 0
  }

  return { scores, contractMade, trickPoints };
}

module.exports = { calculateRoundScore };

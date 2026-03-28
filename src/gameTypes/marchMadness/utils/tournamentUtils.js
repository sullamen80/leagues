// src/gameTypes/marchMadness/utils/tournamentUtils.js

/**
 * Format team name with seed for display
 * @param {string} team - Team name
 * @param {number} seed - Team seed number
 */
export const formatTeamWithSeed = (team, seed) => {
  if (!team) return "TBD";
  if (!seed) return team;
  return `(${seed}) ${team}`;
};

/**
 * Get display name for tournament round
 * @param {string} roundName - Internal round name
 */
export const getDisplayName = (roundName) => {
  switch(roundName) {
    case 'RoundOf64': return 'Round of 64';
    case 'RoundOf32': return 'Round of 32';
    case 'Sweet16': return 'Sweet 16';
    case 'Elite8': return 'Elite 8';
    case 'FinalFour': return 'Final Four';
    case 'Championship': return 'Championship';
    default: return roundName;
  }
};

/**
 * Get region name based on round and index
 * @param {string} round - Tournament round name
 * @param {number} index - Matchup index
 */
export const getRegionName = (round, index) => {
  const regions = ["East", "West", "Midwest", "South"];
  
  if (round === 'RoundOf64' || round === 'RoundOf32' || round === 'Sweet16') {
    // Distribute matchup indices across regions
    // Each region has 8 teams for RoundOf64, 4 for RoundOf32, etc.
    const matchupsPerRegion = {
      'RoundOf64': 8,
      'RoundOf32': 4,
      'Sweet16': 2,
      'Elite8': 1
    };
    
    const count = matchupsPerRegion[round] || 1;
    return regions[Math.floor(index / count)];
  }
  
  if (round === 'Elite8') {
    // For Elite 8, each region has one matchup
    return regions[index];
  }
  
  // FinalFour and Championship don't have regions
  return "";
};

/**
 * Get the seed pairs for the Round of 64
 * Standard NCAA tournament seeding pairs
 */
export const getSeedPairs = () => {
  return [
    [1, 16],
    [8, 9],
    [5, 12],
    [4, 13],
    [6, 11],
    [3, 14],
    [7, 10],
    [2, 15]
  ];
};

/**
 * Calculate the next matchup index when advancing to the next round
 * @param {number} currentIndex - Current matchup index
 */
export const getNextRoundMatchupIndex = (currentIndex) => {
  return Math.floor(currentIndex / 2);
};

/**
 * Determine if a team will be team1 or team2 in the next round
 * @param {number} currentIndex - Current matchup index
 */
export const isTeam1InNextRound = (currentIndex) => {
  return currentIndex % 2 === 0;
};
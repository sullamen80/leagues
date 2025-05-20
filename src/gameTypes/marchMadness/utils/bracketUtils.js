// src/gameTypes/marchMadness/utils/bracketUtils.js
import { POINT_VALUES } from '../services/scoringService';

/**
 * Format team name with seed for display (e.g., "Duke (1)")
 * @param {string} teamName - The team name
 * @param {number} teamSeed - The team seed
 * @returns {string} Formatted team name with seed
 */
export const formatTeamWithSeed = (teamName, teamSeed) => {
  if (!teamName) return "TBD";
  
  if (teamName && teamSeed) {
    return `${teamName} (${teamSeed})`;
  }
  
  return teamName;
};

/**
 * Get human-readable round name
 * @param {string} roundName - Internal round name
 * @returns {string} Display name for the round
 */
export const getDisplayName = (roundName) => {
  const displayNames = {
    'RoundOf64': 'Round of 64',
    'RoundOf32': 'Round of 32',
    'Sweet16': 'Sweet 16',
    'Elite8': 'Elite 8',
    'FinalFour': 'Final Four',
    'Championship': 'National Championship'
  };
  
  return displayNames[roundName] || roundName;
};

/**
 * Get region name based on round and index
 * @param {string} round - Round name
 * @param {number} index - Matchup index
 * @returns {string} Region name
 */
export const getRegionName = (round, index) => {
  if (round === 'RoundOf64') {
    if (index < 8) return "East";
    if (index < 16) return "West";
    if (index < 24) return "Midwest";
    return "South";
  } else if (round === 'RoundOf32') {
    if (index < 4) return "East";
    if (index < 8) return "West";
    if (index < 12) return "Midwest";
    return "South";
  } else if (round === 'Sweet16') {
    if (index < 2) return "East";
    if (index < 4) return "West";
    if (index < 6) return "Midwest";
    return "South";
  } else if (round === 'Elite8') {
    if (index === 0) return "East";
    if (index === 1) return "West";
    if (index === 2) return "Midwest";
    return "South";
  }
  
  return "";
};

/**
 * Determine which Final Four matchup a region goes to based on configuration
 * @param {string} region - Region name (East, West, Midwest, South)
 * @param {Object} config - Final Four configuration object
 * @returns {Object} Object with matchupIndex and isFirstTeam properties
 */
export const getFinalFourMatchup = (region, config) => {
  // Default configuration if none provided
  const finalFourConfig = config || {
    semifinal1: { region1: 'South', region2: 'West' },
    semifinal2: { region1: 'East', region2: 'Midwest' }
  };
  
  // Check semifinal 1
  if (region === finalFourConfig.semifinal1.region1) {
    return { matchupIndex: 0, isFirstTeam: true };
  }
  if (region === finalFourConfig.semifinal1.region2) {
    return { matchupIndex: 0, isFirstTeam: false };
  }
  
  // Check semifinal 2
  if (region === finalFourConfig.semifinal2.region1) {
    return { matchupIndex: 1, isFirstTeam: true };
  }
  if (region === finalFourConfig.semifinal2.region2) {
    return { matchupIndex: 1, isFirstTeam: false };
  }
  
  // Fallback to traditional pattern if region not found
  switch(region) {
    case 'South':
      return { matchupIndex: 0, isFirstTeam: true };
    case 'West':
      return { matchupIndex: 0, isFirstTeam: false };
    case 'East':
      return { matchupIndex: 1, isFirstTeam: true };
    case 'Midwest':
      return { matchupIndex: 1, isFirstTeam: false };
    default:
      // Fallback if region is unknown
      return null;
  }
};

/**
 * Get next round name
 * @param {string} currentRound - Current round name
 * @returns {string|null} Next round name or null if there is no next round
 */
export const getNextRound = (currentRound) => {
  const roundOrder = {
    'RoundOf64': 'RoundOf32',
    'RoundOf32': 'Sweet16',
    'Sweet16': 'Elite8',
    'Elite8': 'FinalFour',
    'FinalFour': 'Championship'
  };
  
  return roundOrder[currentRound] || null;
};

/**
 * Safely compare strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} Whether the strings are equal
 */
export const stringsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  
  const strA = String(a).trim();
  const strB = String(b).trim();
  
  return strA === strB;
};

/**
 * Compute matches for the next round based on current round winners
 * @param {Array} currentRound - Current round matchups
 * @returns {Array} Next round matchups
 */
export const computeNextRound = (currentRound) => {
  if (!Array.isArray(currentRound)) return [];
  
  const nextRound = [];
  
  for (let i = 0; i < currentRound.length; i += 2) {
    if (i + 1 < currentRound.length) {
      nextRound.push({
        team1: currentRound[i].winner || "",
        team1Seed: currentRound[i].winnerSeed || null,
        team2: currentRound[i + 1].winner || "",
        team2Seed: currentRound[i + 1].winnerSeed || null,
        winner: "",
        winnerSeed: null
      });
    }
  }
  
  return nextRound;
};

/**
 * Compute matches for Final Four based on Elite 8 winners using configuration
 * @param {Array} elite8Round - Elite 8 matchups
 * @param {Object} config - Final Four configuration object
 * @returns {Array} Final Four matchups
 */
export const computeFinalFour = (elite8Round, config) => {
  if (!Array.isArray(elite8Round) || elite8Round.length !== 4) {
    return [
      { team1: "", team1Seed: null, team2: "", team2Seed: null, winner: "", winnerSeed: null },
      { team1: "", team1Seed: null, team2: "", team2Seed: null, winner: "", winnerSeed: null }
    ];
  }
  
  // Create empty Final Four matchups
  const finalFour = [
    { team1: "", team1Seed: null, team2: "", team2Seed: null, winner: "", winnerSeed: null },
    { team1: "", team1Seed: null, team2: "", team2Seed: null, winner: "", winnerSeed: null }
  ];
  
  // Process each Elite 8 winner
  elite8Round.forEach((matchup, index) => {
    if (!matchup || !matchup.winner) return;
    
    // Get the region for this Elite 8 matchup
    const region = getRegionName('Elite8', index);
    
    // Determine which Final Four matchup this region goes to based on config
    const finalFourPlacement = getFinalFourMatchup(region, config);
    
    if (finalFourPlacement) {
      const { matchupIndex, isFirstTeam } = finalFourPlacement;
      
      // Update the correct spot in the Final Four matchup
      if (isFirstTeam) {
        finalFour[matchupIndex].team1 = matchup.winner;
        finalFour[matchupIndex].team1Seed = matchup.winnerSeed;
      } else {
        finalFour[matchupIndex].team2 = matchup.winner;
        finalFour[matchupIndex].team2Seed = matchup.winnerSeed;
      }
    }
  });
  
  return finalFour;
};

/**
 * Compute round of 64 matchups from team lists
 * @param {Array} eastTeams - East region teams
 * @param {Array} westTeams - West region teams
 * @param {Array} midwestTeams - Midwest region teams
 * @param {Array} southTeams - South region teams
 * @param {Array} existingRoundOf64 - Existing round of 64 to preserve winners (optional)
 * @returns {Array} Round of 64 matchups
 */
export const computeRoundOf64 = (eastTeams, westTeams, midwestTeams, southTeams, existingRoundOf64 = []) => {
  // Standard seeding matchups for NCAA tournament: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
  const seedPairs = [[0, 15], [7, 8], [4, 11], [3, 12], [5, 10], [2, 13], [6, 9], [1, 14]];
  
  // Helper to compute pairings for a region
  const computeRegionPairings = (teams, startIndex) => {
    return seedPairs.map(([seed1, seed2], idx) => {
      const team1 = teams[seed1] || {};
      const team2 = teams[seed2] || {};
      
      // Check for existing winner
      let winner = "";
      let winnerSeed = null;
      
      if (existingRoundOf64[startIndex + idx]?.winner) {
        if (existingRoundOf64[startIndex + idx].winner === team1.name) {
          winner = team1.name;
          winnerSeed = team1.seed;
        } else if (existingRoundOf64[startIndex + idx].winner === team2.name) {
          winner = team2.name;
          winnerSeed = team2.seed;
        }
      }
      
      return {
        team1: team1.name || "",
        team1Seed: team1.seed || null,
        team2: team2.name || "",
        team2Seed: team2.seed || null,
        winner: winner,
        winnerSeed: winnerSeed
      };
    });
  };
  
  // Compute pairings for each region
  const eastPairings = computeRegionPairings(eastTeams, 0);
  const westPairings = computeRegionPairings(westTeams, 8);
  const midwestPairings = computeRegionPairings(midwestTeams, 16);
  const southPairings = computeRegionPairings(southTeams, 24);
  
  return [...eastPairings, ...westPairings, ...midwestPairings, ...southPairings];
};

/**
 * Generate default game data structure
 * @returns {Object} Default game data structure
 */
export const getDefaultGameData = () => ({
  SetTeams: { 
    eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
  },
  finalFourConfig: {
    semifinal1: { region1: 'South', region2: 'West' },
    semifinal2: { region1: 'East', region2: 'Midwest' }
  },
  RoundOf64: [],
  RoundOf32: [],
  Sweet16: [],
  Elite8: [],
  FinalFour: [],
  Championship: { team1: "", team2: "", winner: "" },
  Champion: "",
  ChampionSeed: null
});

/**
 * Check if a bracket is complete (all matchups have winners)
 * @param {Object} bracket - Bracket data
 * @returns {boolean} Whether the bracket is complete
 */
export const isBracketComplete = (bracket) => {
  if (!bracket) return false;
  
  // Check all rounds except Championship
  const rounds = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour'];
  
  for (const round of rounds) {
    if (!Array.isArray(bracket[round])) return false;
    
    // For each matchup in this round, check if it has a winner
    for (const matchup of bracket[round]) {
      if (!matchup?.winner) return false;
    }
  }
  
  // Check Championship
  if (!bracket.Championship?.winner) return false;
  
  // Check Champion
  if (!bracket.Champion) return false;
  
  return true;
};

/**
 * Count correct picks in a user bracket compared to the official bracket
 * @param {Object} userBracket - User's bracket
 * @param {Object} officialBracket - Official bracket
 * @returns {Object} Counts of correct picks by round
 */
export const countCorrectPicks = (userBracket, officialBracket) => {
  if (!userBracket || !officialBracket) return { total: 0, byRound: {} };

  const byRound = {
    RoundOf64: 0,
    RoundOf32: 0,
    Sweet16: 0,
    Elite8: 0,
    FinalFour: 0,
    Championship: 0
  };
  let total = 0;

  // Check each round
  const rounds = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour'];
  
  rounds.forEach(round => {
    if (!Array.isArray(userBracket[round]) || !Array.isArray(officialBracket[round])) return;
    
    // Only count rounds that have been played in official bracket
    const roundPlayedCount = officialBracket[round].filter(m => m && m.winner).length;
    if (roundPlayedCount === 0) return;
    
    // For each matchup, check if user's pick matches official result
    for (let i = 0; i < Math.min(userBracket[round].length, officialBracket[round].length); i++) {
      const userPick = userBracket[round][i]?.winner;
      const officialWinner = officialBracket[round][i]?.winner;
      
      if (userPick && officialWinner && stringsEqual(userPick, officialWinner)) {
        byRound[round]++;
        total++;
      }
    }
  });
  
  // Process Championship
  if (userBracket.Championship?.winner && officialBracket.Championship?.winner) {
    if (stringsEqual(userBracket.Championship.winner, officialBracket.Championship.winner)) {
      byRound.Championship++;
      total++;
    }
  }
  
  return { total, byRound };
};

/**
 * Calculate bracket score using detailed scoring system with round breakdown
 * @param {Object} userBracket - User's bracket
 * @param {Object} officialBracket - Official bracket 
 * @param {Object} scoringSettings - Optional custom scoring settings
 * @returns {Object} Detailed score breakdown
 */
export function calculateBracketScore(userBracket, officialBracket, scoringSettings = null) {
  if (!userBracket || !officialBracket) {
    return { 
      total: 0, 
      basePoints: 0, 
      bonusPoints: 0, 
      correctPicks: { 
        total: 0, 
        byRound: {} 
      }, 
      roundBreakdown: {} 
    };
  }
  
  // Use provided scoring settings or default point values
  const roundPoints = {
    'RoundOf64': scoringSettings?.roundOf64 ?? POINT_VALUES.RoundOf64,
    'RoundOf32': scoringSettings?.roundOf32 ?? POINT_VALUES.RoundOf32,
    'Sweet16': scoringSettings?.sweet16 ?? POINT_VALUES.Sweet16,
    'Elite8': scoringSettings?.elite8 ?? POINT_VALUES.Elite8,
    'FinalFour': scoringSettings?.finalFour ?? POINT_VALUES.FinalFour,
    'Championship': scoringSettings?.championship ?? POINT_VALUES.Championship
  };
  
  // Upset bonus settings
  const bonusEnabled = scoringSettings?.bonusEnabled ?? false;
  const bonusType = scoringSettings?.bonusType ?? 'seedDifference';
  const bonusPerSeedDifference = scoringSettings?.bonusPerSeedDifference ?? 0.5;
  const flatBonusValue = scoringSettings?.flatBonusValue ?? 0.5;
  
  let total = 0;
  let basePoints = 0;
  let bonusPoints = 0;
  let correctPicks = 0;
  const roundBreakdown = {};
  
  // Calculate points for each round
  for (const [round, pointValue] of Object.entries(roundPoints)) {
    // Initialize round breakdown
    roundBreakdown[round] = {
      correct: 0,
      base: 0,
      bonus: 0,
      total: 0,
      possible: 0
    };
    
    // Championship is handled differently
    if (round === 'Championship') {
      if (officialBracket[round] && userBracket[round]) {
        const officialWinner = officialBracket[round].winner || '';
        const userPick = userBracket[round].winner || '';
        
        // Only count as possible if official result exists
        if (officialWinner) {
          roundBreakdown[round].possible = pointValue;
        }
        
        if (officialWinner && userPick && stringsEqual(officialWinner, userPick)) {
          // Base points for correct pick
          const basePointsForMatch = pointValue;
          basePoints += basePointsForMatch;
          roundBreakdown[round].base = basePointsForMatch;
          roundBreakdown[round].correct = 1;
          correctPicks += 1;
          
          // Calculate bonus if enabled
          if (bonusEnabled) {
            const officialWinnerSeed = officialBracket[round].winnerSeed;
            const officialTeam1Seed = officialBracket[round].team1Seed;
            const officialTeam2Seed = officialBracket[round].team2Seed;
            
            if (officialWinnerSeed && officialTeam1Seed && officialTeam2Seed) {
              const expectedWinnerSeed = Math.min(officialTeam1Seed, officialTeam2Seed);
              if (officialWinnerSeed > expectedWinnerSeed) {
                let bonus = bonusType === 'seedDifference' ? 
                  (officialWinnerSeed - expectedWinnerSeed) * bonusPerSeedDifference : 
                  flatBonusValue;
                
                bonusPoints += bonus;
                roundBreakdown[round].bonus = bonus;
              }
            }
          }
        }
        
        // Calculate round total
        roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
      }
    } 
    // Regular rounds
    else if (Array.isArray(officialBracket[round]) && Array.isArray(userBracket[round])) {
      // Count only completed games in official bracket
      const completedGames = officialBracket[round].filter(m => m && m.winner).length;
      
      // If no games completed in this round, just initialize and continue
      if (completedGames === 0) {
        roundBreakdown[round].possible = 0;
        continue;
      }
      
      for (let i = 0; i < Math.min(userBracket[round].length, officialBracket[round].length); i++) {
        const officialMatchup = officialBracket[round][i];
        const userMatchup = userBracket[round][i];
        
        if (officialMatchup && userMatchup) {
          const officialWinner = officialMatchup.winner || '';
          const userPick = userMatchup.winner || '';
          
          // Add to possible points if official result exists
          if (officialWinner) {
            roundBreakdown[round].possible += pointValue;
          } else {
            // Skip if no official winner yet
            continue;
          }
          
          if (stringsEqual(officialWinner, userPick)) {
            // Base points for correct pick
            const basePointsForMatch = pointValue;
            basePoints += basePointsForMatch;
            roundBreakdown[round].base += basePointsForMatch;
            roundBreakdown[round].correct += 1;
            correctPicks += 1;
            
            // Calculate bonus if enabled
            if (bonusEnabled) {
              const officialWinnerSeed = officialMatchup.winnerSeed;
              const officialTeam1Seed = officialMatchup.team1Seed;
              const officialTeam2Seed = officialMatchup.team2Seed;
              
              if (officialWinnerSeed && officialTeam1Seed && officialTeam2Seed) {
                const expectedWinnerSeed = Math.min(officialTeam1Seed, officialTeam2Seed);
                if (officialWinnerSeed > expectedWinnerSeed) {
                  let bonus = bonusType === 'seedDifference' ? 
                    (officialWinnerSeed - expectedWinnerSeed) * bonusPerSeedDifference : 
                    flatBonusValue;
                  
                  bonusPoints += bonus;
                  roundBreakdown[round].bonus += bonus;
                }
              }
            }
          }
        }
      }
      
      // Calculate round total
      roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
    }
  }
  
  // Calculate total score
  total = basePoints + bonusPoints;
  
  return {
    total,
    basePoints,
    bonusPoints,
    correctPicks: {
      total: correctPicks,
      byRound: Object.entries(roundBreakdown).reduce((acc, [round, data]) => {
        acc[round] = data.correct;
        return acc;
      }, {})
    },
    roundBreakdown
  };
}

/**
 * Calculate similarity between two brackets
 * @param {Object} bracket1 - First bracket
 * @param {Object} bracket2 - Second bracket
 * @returns {Object} Similarity metrics
 */
export function calculateBracketSimilarity(bracket1, bracket2) {
  if (!bracket1 || !bracket2) {
    return { 
      totalMatches: 0,
      totalPossible: 0,
      percentage: 0,
      byRound: {}
    };
  }

  let totalMatches = 0;
  let totalPossible = 0;
  const byRound = {};
  
  // Check each round
  const rounds = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
  
  rounds.forEach(round => {
    byRound[round] = {
      matches: 0,
      possible: 0,
      percentage: 0
    };
    
    if (round === 'Championship') {
      if (bracket1[round] && bracket2[round]) {
        const pick1 = bracket1[round].winner || '';
        const pick2 = bracket2[round].winner || '';
        
        if (pick1 && pick2) {
          byRound[round].possible += 1;
          totalPossible += 1;
          
          if (pick1 === pick2) {
            byRound[round].matches += 1;
            totalMatches += 1;
          }
        }
      }
    } else if (Array.isArray(bracket1[round]) && Array.isArray(bracket2[round])) {
      const matchupCount = Math.min(bracket1[round].length, bracket2[round].length);
      
      for (let i = 0; i < matchupCount; i++) {
        const matchup1 = bracket1[round][i];
        const matchup2 = bracket2[round][i];
        
        if (matchup1 && matchup2) {
          const pick1 = matchup1.winner || '';
          const pick2 = matchup2.winner || '';
          
          if (pick1 && pick2) {
            byRound[round].possible += 1;
            totalPossible += 1;
            
            if (pick1 === pick2) {
              byRound[round].matches += 1;
              totalMatches += 1;
            }
          }
        }
      }
    }
    
    // Calculate percentage for this round
    byRound[round].percentage = byRound[round].possible > 0 ? 
      byRound[round].matches / byRound[round].possible : 0;
  });
  
  return {
    totalMatches,
    totalPossible,
    percentage: totalPossible > 0 ? totalMatches / totalPossible : 0,
    byRound
  };
}

/**
 * Get the total number of games in a bracket
 * @returns {number} Total games in a full bracket
 */
export function getTotalBracketGames() {
  return 63; // 32 + 16 + 8 + 4 + 2 + 1
}

/**
 * Validate bracket structure and data integrity
 * @param {Object} bracket - Bracket to validate
 * @returns {Object} Validation result with success flag and any errors
 */
export const validateBracket = (bracket) => {
  if (!bracket) return { success: false, errors: ['Bracket data is missing'] };
  
  const errors = [];
  
  // Check if required rounds exist
  const requiredRounds = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
  
  for (const round of requiredRounds) {
    if (round === 'Championship') {
      if (!bracket[round] || typeof bracket[round] !== 'object') {
        errors.push(`Missing ${getDisplayName(round)} round data`);
      }
    } else {
      if (!Array.isArray(bracket[round])) {
        errors.push(`Missing ${getDisplayName(round)} round data`);
      }
    }
  }
  
  // Check Champion field
  if (!('Champion' in bracket)) {
    errors.push('Missing Champion field');
  }
  
  // Check round sizes
  const expectedSizes = {
    RoundOf64: 32,
    RoundOf32: 16,
    Sweet16: 8,
    Elite8: 4,
    FinalFour: 2
  };
  
  for (const [round, size] of Object.entries(expectedSizes)) {
    if (Array.isArray(bracket[round]) && bracket[round].length !== size) {
      errors.push(`${getDisplayName(round)} should have ${size} matchups`);
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
};

/**
 * Repair a damaged bracket to ensure it has the correct structure
 * @param {Object} bracket - Bracket to repair
 * @returns {Object} Repaired bracket
 */
export const repairBracket = (bracket) => {
  if (!bracket) return getDefaultGameData();
  
  const repairedBracket = { ...bracket };
  
  // Fix all array rounds
  const roundSizes = {
    RoundOf64: 32,
    RoundOf32: 16,
    Sweet16: 8,
    Elite8: 4,
    FinalFour: 2
  };
  
  for (const [round, size] of Object.entries(roundSizes)) {
    if (!Array.isArray(repairedBracket[round])) {
      repairedBracket[round] = [];
    }
    
    // Ensure correct number of matchups
    if (repairedBracket[round].length < size) {
      // Add missing matchups
      const missingCount = size - repairedBracket[round].length;
      const emptyMatchups = Array(missingCount).fill().map(() => ({
        team1: "", team1Seed: null,
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null
      }));
      
      repairedBracket[round] = [...repairedBracket[round], ...emptyMatchups];
    } else if (repairedBracket[round].length > size) {
      // Trim excess matchups
      repairedBracket[round] = repairedBracket[round].slice(0, size);
    }
    
    // Repair each matchup
    repairedBracket[round] = repairedBracket[round].map(matchup => ({
      team1: matchup?.team1 || "",
      team1Seed: matchup?.team1Seed !== undefined ? matchup.team1Seed : null,
      team2: matchup?.team2 || "",
      team2Seed: matchup?.team2Seed !== undefined ? matchup.team2Seed : null,
      winner: matchup?.winner || "",
      winnerSeed: matchup?.winnerSeed !== undefined ? matchup.winnerSeed : null
    }));
  }
  
  // Fix Championship
  if (!repairedBracket.Championship || typeof repairedBracket.Championship !== 'object') {
    repairedBracket.Championship = { 
      team1: "", team1Seed: null,
      team2: "", team2Seed: null,
      winner: "", winnerSeed: null
    };
  } else {
    repairedBracket.Championship = {
      team1: repairedBracket.Championship.team1 || "",
      team1Seed: repairedBracket.Championship.team1Seed !== undefined 
        ? repairedBracket.Championship.team1Seed : null,
      team2: repairedBracket.Championship.team2 || "",
      team2Seed: repairedBracket.Championship.team2Seed !== undefined 
        ? repairedBracket.Championship.team2Seed : null,
      winner: repairedBracket.Championship.winner || "",
      winnerSeed: repairedBracket.Championship.winnerSeed !== undefined 
        ? repairedBracket.Championship.winnerSeed : null
    };
  }
  
  // Fix Champion
  if (!('Champion' in repairedBracket)) {
    repairedBracket.Champion = "";
  }
  
  if (!('ChampionSeed' in repairedBracket)) {
    repairedBracket.ChampionSeed = null;
  }
  
  return repairedBracket;
};

export default {
  formatTeamWithSeed,
  getDisplayName,
  getRegionName,
  getFinalFourMatchup,
  getNextRound,
  stringsEqual,
  computeNextRound,
  computeFinalFour,
  computeRoundOf64,
  getDefaultGameData,
  isBracketComplete,
  countCorrectPicks,
  calculateBracketScore,
  calculateBracketSimilarity,
  getTotalBracketGames,
  validateBracket,
  repairBracket
};
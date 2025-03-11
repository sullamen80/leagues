// src/gameTypes/marchMadness/utils/bracketUtils.js

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
    if (!userBracket || !officialBracket) return null;
    
    const result = {
      RoundOf64: 0,
      RoundOf32: 0,
      Sweet16: 0,
      Elite8: 0,
      FinalFour: 0,
      Championship: 0,
      total: 0
    };
    
    // Process each round except Championship
    const rounds = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour'];
    
    for (const round of rounds) {
      if (!Array.isArray(userBracket[round]) || !Array.isArray(officialBracket[round])) continue;
      
      // Only count rounds that have been played in official bracket
      const roundPlayedCount = officialBracket[round].filter(m => m?.winner).length;
      if (roundPlayedCount === 0) continue;
      
      // For each matchup, check if user's pick matches official result
      for (let i = 0; i < Math.min(userBracket[round].length, officialBracket[round].length); i++) {
        const userPick = userBracket[round][i]?.winner;
        const officialWinner = officialBracket[round][i]?.winner;
        
        if (userPick && officialWinner && stringsEqual(userPick, officialWinner)) {
          result[round]++;
          result.total++;
        }
      }
    }
    
    // Process Championship
    if (userBracket.Championship?.winner && officialBracket.Championship?.winner) {
      if (stringsEqual(userBracket.Championship.winner, officialBracket.Championship.winner)) {
        result.Championship++;
        result.total++;
      }
    }
    
    return result;
  };
  
  /**
   * Calculate bracket score using standard scoring system
   * @param {Object} userBracket - User's bracket
   * @param {Object} officialBracket - Official bracket
   * @returns {Object} Score details
   */
  export const calculateBracketScore = (userBracket, officialBracket) => {
    if (!userBracket || !officialBracket) return { total: 0 };
    
    const correctCounts = countCorrectPicks(userBracket, officialBracket);
    if (!correctCounts) return { total: 0 };
    
    // Standard scoring: Round of 64: 1pt, Round of 32: 2pts, Sweet 16: 4pts, 
    // Elite 8: 8pts, Final Four: 16pts, Championship: 32pts
    const pointValues = {
      RoundOf64: 1,
      RoundOf32: 2,
      Sweet16: 4,
      Elite8: 8,
      FinalFour: 16,
      Championship: 32
    };
    
    const result = {
      correctPicks: { ...correctCounts },
      points: {},
      total: 0
    };
    
    // Calculate points for each round
    for (const [round, count] of Object.entries(correctCounts)) {
      if (round !== 'total') {
        result.points[round] = count * pointValues[round];
        result.total += result.points[round];
      }
    }
    
    return result;
  };
  
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
    
    // Check for logical consistency in bracket
    if (errors.length === 0) {
      // Verify that winners in earlier rounds appear in later rounds
      // This would be more complex and would require comparing each matchup
      // across rounds to ensure proper advancement
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
// src/gameTypes/nbaPlayoffs/services/scoringService.js
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { calculateBracketScore, countCorrectPicks } from '../utils/bracketUtils';
import { fetchPlayoffsData } from './playoffsService';
import { getAllUserBrackets } from './bracketService';
import {
  ROUND_KEYS,
  ROUND_DISPLAY_NAMES,
  DEFAULT_POINT_VALUES,
  DEFAULT_SERIES_BONUS,
  SERIES_LENGTH_KEYS
} from '../constants/playoffConstants';

/**
 * Export constants for backward compatibility
 */
export const POINT_VALUES = DEFAULT_POINT_VALUES;
export const SERIES_BONUS = DEFAULT_SERIES_BONUS;

/**
 * Get the point value for a specific round, using custom settings if provided
 * @param {string} round - The round key
 * @param {object} settings - Optional custom scoring settings
 * @returns {number} The point value for the round
 */
export const getPointValue = (round, settings = null) => {
  if (!settings) return DEFAULT_POINT_VALUES[round];
  
  // Check if the setting exists for this round
  if (settings[round] !== undefined) {
    return settings[round];
  }
  
  // Fall back to default if no custom setting
  return DEFAULT_POINT_VALUES[round];
};

/**
 * Get the series length bonus for a specific round, using custom settings if provided
 * @param {string} round - The round key 
 * @param {object} settings - Optional custom scoring settings
 * @returns {number} The series length bonus for the round
 */
export const getSeriesBonus = (round, settings = null) => {
  // If settings not provided or series length bonuses not enabled, return 0 or default
  if (!settings) return DEFAULT_SERIES_BONUS[round] || 0;
  if (!settings.seriesLengthBonusEnabled) return 0;
  
  // Map round to series length setting key
  const settingKey = SERIES_LENGTH_KEYS[round];
  if (!settingKey) return 0;
  
  // Return the custom setting value if it exists
  if (settings[settingKey] !== undefined) {
    return settings[settingKey];
  }
  
  // Fall back to default
  return DEFAULT_SERIES_BONUS[round] || 0;
};

/**
 * Convert service values to UI display values for presentational purposes
 * @param {Object} customSettings - Custom scoring settings to apply
 * @returns {Object} UI-friendly point values
 */
export const getUIPointValues = (customSettings = null) => {
  // Start with default values
  const baseValues = { ...DEFAULT_POINT_VALUES };
  
  // Apply custom settings if provided
  if (customSettings) {
    // Update base values with custom settings
    Object.keys(baseValues).forEach(key => {
      if (customSettings[key] !== undefined) {
        baseValues[key] = customSettings[key];
      }
    });
    
    return baseValues;
  }
  
  return baseValues;
};

/**
 * Flexible team matching function for series length bonus
 * @param {Object} matchup1 - First matchup to compare
 * @param {Object} matchup2 - Second matchup to compare
 * @returns {boolean} True if teams match (in any order)
 */
export const teamsMatch = (matchup1, matchup2) => {
  if (!matchup1 || !matchup2) return false;
  
  // Extract team names without seed numbers
  const normalizeTeamName = (teamStr) => {
    if (!teamStr) return '';
    // Remove seed number format like "(1) " and normalize
    return teamStr.replace(/^\(\d+\)\s*/, '').trim().toLowerCase();
  };
  
  const team1A = normalizeTeamName(matchup1.team1);
  const team1B = normalizeTeamName(matchup1.team2);
  const team2A = normalizeTeamName(matchup2.team1);
  const team2B = normalizeTeamName(matchup2.team2);
  
  if (!team1A || !team1B || !team2A || !team2B) return false;
  
  const exactMatch = (team1A === team2A && team1B === team2B);
  const reversedMatch = (team1A === team2B && team1B === team2A);
  return exactMatch || reversedMatch;
};

/**
 * Extract team seed from team name
 * @param {string} teamName - Team name including seed
 * @returns {number} Extracted seed or 0 if not found
 */
export const getTeamSeed = (teamName) => {
  if (!teamName) return 0;
  
  // Team names are typically in format "(1) Milwaukee" or similar
  const match = teamName.match(/^\((\d+)\)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  
  return 0; // Default if we can't extract the seed
};

/**
 * Calculate score for Play-In Tournament games
 * @param {Object} userBracket - User's bracket data
 * @param {Object} officialBracket - Official playoffs data
 * @param {Object} customSettings - Custom scoring settings
 * @returns {Object} Score details for Play-In Tournament
 */
export const calculatePlayInScore = (userBracket, officialBracket, customSettings = null) => {
  if (!userBracket || !officialBracket) return { points: 0, correctPicks: 0 };
  
  const playInPoints = customSettings?.playInCorrectPrediction || 1;
  let totalPoints = 0;
  let correctPicks = 0;
  
  // Get Play-In data from both brackets
  const userPlayIn = userBracket[ROUND_KEYS.PLAY_IN];
  const officialPlayIn = officialBracket[ROUND_KEYS.PLAY_IN];
  
  if (!userPlayIn || !officialPlayIn) return { points: 0, correctPicks: 0 };
  
  // Check East Conference games
  if (userPlayIn.east && officialPlayIn.east) {
    // 7/8 Game
    if (userPlayIn.east.seventhEighthWinner?.team && 
        officialPlayIn.east.seventhEighthWinner?.team && 
        userPlayIn.east.seventhEighthWinner.team === officialPlayIn.east.seventhEighthWinner.team) {
      totalPoints += playInPoints;
      correctPicks++;
    }
    
    // 9/10 Game
    if (userPlayIn.east.ninthTenthWinner?.team && 
        officialPlayIn.east.ninthTenthWinner?.team && 
        userPlayIn.east.ninthTenthWinner.team === officialPlayIn.east.ninthTenthWinner.team) {
      totalPoints += playInPoints;
      correctPicks++;
    }
    
    // Final Play-In Game
    if (userPlayIn.east.finalWinner?.team && 
        officialPlayIn.east.finalWinner?.team && 
        userPlayIn.east.finalWinner.team === officialPlayIn.east.finalWinner.team) {
      totalPoints += playInPoints;
      correctPicks++;
    }
  }
  
  // Check West Conference games - same structure as East
  if (userPlayIn.west && officialPlayIn.west) {
    // 7/8 Game
    if (userPlayIn.west.seventhEighthWinner?.team && 
        officialPlayIn.west.seventhEighthWinner?.team && 
        userPlayIn.west.seventhEighthWinner.team === officialPlayIn.west.seventhEighthWinner.team) {
      totalPoints += playInPoints;
      correctPicks++;
    }
    
    // 9/10 Game
    if (userPlayIn.west.ninthTenthWinner?.team && 
        officialPlayIn.west.ninthTenthWinner?.team && 
        userPlayIn.west.ninthTenthWinner.team === officialPlayIn.west.ninthTenthWinner.team) {
      totalPoints += playInPoints;
      correctPicks++;
    }
    
    // Final Play-In Game
    if (userPlayIn.west.finalWinner?.team && 
        officialPlayIn.west.finalWinner?.team && 
        userPlayIn.west.finalWinner.team === officialPlayIn.west.finalWinner.team) {
      totalPoints += playInPoints;
      correctPicks++;
    }
  }
  
  return { points: totalPoints, correctPicks: correctPicks };
};

/**
 * Calculate score for a single user's bracket
 * @param {Object} userBracket - User's bracket data
 * @param {Object} officialBracket - Official playoffs data
 * @param {Object} customSettings - Custom scoring settings
 * @returns {Object} Score details
 */
export const calculateUserScore = (userBracket, officialBracket, customSettings = null) => {
  if (!userBracket || !officialBracket) {
    return { 
      points: 0, 
      correctPicks: 0, 
      seriesLengthPoints: 0,
      finalsMVPPoints: 0,
      upsetPoints: 0,
      possiblePoints: 0, 
      maxPossible: 0,
      roundBreakdown: {}
    };
  }

  // Get upset bonus settings
  const upsetBonusEnabled = customSettings?.upsetBonusEnabled !== false;
  const upsetBonusValue = customSettings?.upsetBonus || 2;
  
  // Get series length bonus settings
  const seriesLengthBonusEnabled = customSettings?.seriesLengthBonusEnabled !== false;
  
  // Calculate scores for each round
  let totalPoints = 0;
  let totalCorrectPicks = 0;
  let totalSeriesLengthPoints = 0;
  let totalUpsetPoints = 0;
  let finalsMVPPoints = 0;
  let roundBreakdown = {};
  
  // Handle Play-In Tournament scoring
  const playInEnabled = customSettings?.playInTournamentEnabled !== false;
  if (playInEnabled && officialBracket[ROUND_KEYS.PLAY_IN] && userBracket[ROUND_KEYS.PLAY_IN]) {
    const playInScore = calculatePlayInScore(userBracket, officialBracket, customSettings);
    const playInPointValue = customSettings?.playInCorrectPrediction || 1;
    
    totalPoints += playInScore.points;
    totalCorrectPicks += playInScore.correctPicks;
    
    // Calculate possible points for Play-In round
    let possiblePlayInPoints = 0;
    
    // East Conference
    if (officialBracket[ROUND_KEYS.PLAY_IN]?.east) {
      if (officialBracket[ROUND_KEYS.PLAY_IN].east.seventhEighthWinner?.team) {
        possiblePlayInPoints += playInPointValue;
      }
      if (officialBracket[ROUND_KEYS.PLAY_IN].east.ninthTenthWinner?.team) {
        possiblePlayInPoints += playInPointValue;
      }
      if (officialBracket[ROUND_KEYS.PLAY_IN].east.finalWinner?.team) {
        possiblePlayInPoints += playInPointValue;
      }
    }
    
    // West Conference
    if (officialBracket[ROUND_KEYS.PLAY_IN]?.west) {
      if (officialBracket[ROUND_KEYS.PLAY_IN].west.seventhEighthWinner?.team) {
        possiblePlayInPoints += playInPointValue;
      }
      if (officialBracket[ROUND_KEYS.PLAY_IN].west.ninthTenthWinner?.team) {
        possiblePlayInPoints += playInPointValue;
      }
      if (officialBracket[ROUND_KEYS.PLAY_IN].west.finalWinner?.team) {
        possiblePlayInPoints += playInPointValue;
      }
    }
    
    roundBreakdown[ROUND_KEYS.PLAY_IN] = {
      correctPicks: playInScore.correctPicks,
      basePoints: playInScore.points,
      seriesLengthPoints: 0,
      seriesLengthCorrect: 0,
      upsetPoints: 0,
      totalPoints: playInScore.points,
      possiblePoints: possiblePlayInPoints
    };
  }
  
  // Process each regular round
  for (const [round, pointValue] of Object.entries(DEFAULT_POINT_VALUES)) {
    // Skip Finals MVP as it's handled separately
    if (round === ROUND_KEYS.FINALS_MVP) continue;
    // Skip Champion as it's calculated as part of NBA Finals
    if (round === ROUND_KEYS.CHAMPION) continue;
    // Skip Play-In as it's already handled
    if (round === ROUND_KEYS.PLAY_IN) continue;
    
    roundBreakdown[round] = {
      correctPicks: 0,
      basePoints: 0,
      seriesLengthPoints: 0,
      seriesLengthCorrect: 0,
      upsetPoints: 0,
      totalPoints: 0,
      possiblePoints: 0
    };
    
    // NBA Finals is a special case - single matchup object instead of array
    if (round === ROUND_KEYS.NBA_FINALS) {
      const officialMatchup = officialBracket[round];
      const userMatchup = userBracket[round];
      
      if (officialMatchup?.winner && userMatchup?.winner) {
        // Set possible points
        roundBreakdown[round].possiblePoints += getPointValue(round, customSettings);
        
        // Check if winner is correct
        if (officialMatchup.winner === userMatchup.winner) {
          const basePoints = getPointValue(round, customSettings);
          totalPoints += basePoints;
          totalCorrectPicks++;
          roundBreakdown[round].correctPicks++;
          roundBreakdown[round].basePoints += basePoints;
          
          // Add champion bonus points if applicable
          if (customSettings && customSettings[ROUND_KEYS.CHAMPION] !== undefined) {
            totalPoints += customSettings[ROUND_KEYS.CHAMPION];
            roundBreakdown[round].basePoints += customSettings[ROUND_KEYS.CHAMPION];
          }
          
          // Check for series length bonus - only if winner is correct AND teams match
          if (seriesLengthBonusEnabled) {
            if (officialMatchup.numGames && 
                userMatchup.numGames && 
                officialMatchup.numGames === userMatchup.numGames) {
              
              // Check if teams match
              const teamsDoMatch = teamsMatch(officialMatchup, userMatchup);
              
              if (teamsDoMatch) {
                // Get the series bonus with helper function
                const seriesBonus = getSeriesBonus(round, customSettings);
                
                totalSeriesLengthPoints += seriesBonus;
                roundBreakdown[round].seriesLengthPoints += seriesBonus;
                roundBreakdown[round].seriesLengthCorrect = (roundBreakdown[round].seriesLengthCorrect || 0) + 1;
              }
            }
          }
        }
      }
    } 
    // Regular rounds - arrays of matchups
    else if (Array.isArray(officialBracket[round]) && Array.isArray(userBracket[round])) {
      // For each matchup in the round
      for (let i = 0; i < Math.min(officialBracket[round].length, userBracket[round].length); i++) {
        const officialMatchup = officialBracket[round][i];
        const userMatchup = userBracket[round][i];
        
        if (officialMatchup?.winner && userMatchup?.winner) {
          // Set possible points
          roundBreakdown[round].possiblePoints += getPointValue(round, customSettings);
          
          // Check if winner is correct
          if (officialMatchup.winner === userMatchup.winner) {
            const basePoints = getPointValue(round, customSettings);
            totalPoints += basePoints;
            totalCorrectPicks++;
            roundBreakdown[round].correctPicks++;
            roundBreakdown[round].basePoints += basePoints;
            
            // Check for series length bonus - only if winner is correct AND teams match
            if (seriesLengthBonusEnabled) {
              if (officialMatchup.numGames && 
                  userMatchup.numGames && 
                  officialMatchup.numGames === userMatchup.numGames) {
                
                // Check if teams match
                const teamsDoMatch = teamsMatch(officialMatchup, userMatchup);
                
                if (teamsDoMatch) {
                  // Get the series bonus with helper function
                  const seriesBonus = getSeriesBonus(round, customSettings);
                  
                  totalSeriesLengthPoints += seriesBonus;
                  roundBreakdown[round].seriesLengthPoints += seriesBonus;
                  roundBreakdown[round].seriesLengthCorrect = (roundBreakdown[round].seriesLengthCorrect || 0) + 1;
                }
              }
            }
            
            // Check for upset bonus if enabled
            if (upsetBonusEnabled) {
              // Check if it's an upset (lower seed beats higher seed)
              const winnerSeed = getTeamSeed(officialMatchup.winner);
              const loserTeamName = officialMatchup.team1 === officialMatchup.winner ? 
                               officialMatchup.team2 : officialMatchup.team1;
              const loserSeed = getTeamSeed(loserTeamName);
              
              // If winner seed is higher number than loser seed, it's an upset
              if (winnerSeed > loserSeed) {
                totalUpsetPoints += upsetBonusValue;
                roundBreakdown[round].upsetPoints += upsetBonusValue;
              }
            }
          }
        }
      }
    }
    
    // Calculate total for the round
    roundBreakdown[round].totalPoints = 
      roundBreakdown[round].basePoints + 
      roundBreakdown[round].seriesLengthPoints + 
      roundBreakdown[round].upsetPoints;
  }
  
  // Check Finals MVP pick
  if (officialBracket[ROUND_KEYS.FINALS_MVP] && userBracket[ROUND_KEYS.FINALS_MVP]) {
    const mvpPointValue = getPointValue(ROUND_KEYS.FINALS_MVP, customSettings);
    
    if (officialBracket[ROUND_KEYS.FINALS_MVP] === userBracket[ROUND_KEYS.FINALS_MVP]) {
      finalsMVPPoints = mvpPointValue;
      roundBreakdown[ROUND_KEYS.FINALS_MVP] = {
        correctPrediction: true,
        basePoints: finalsMVPPoints,
        totalPoints: finalsMVPPoints
      };
    } else {
      roundBreakdown[ROUND_KEYS.FINALS_MVP] = {
        correctPrediction: false,
        basePoints: 0,
        totalPoints: 0
      };
    }
  }
  
  // Calculate possible remaining points
  const maxPossible = calculateMaxPossiblePoints(userBracket, officialBracket, customSettings);
  
  // Total points including all bonuses
  const totalWithBonuses = totalPoints + totalSeriesLengthPoints + totalUpsetPoints + finalsMVPPoints;
  
  return {
    points: totalWithBonuses,
    basePoints: totalPoints,
    seriesLengthPoints: totalSeriesLengthPoints,
    upsetPoints: totalUpsetPoints,
    finalsMVPPoints: finalsMVPPoints,
    correctPicks: totalCorrectPicks,
    possiblePoints: totalWithBonuses + maxPossible,
    maxPossible: maxPossible,
    roundBreakdown: roundBreakdown
  };
};

/**
 * Calculate maximum possible remaining points
 * @param {Object} userBracket - User's bracket data
 * @param {Object} officialBracket - Official playoffs data
 * @param {Object} settings - Scoring settings
 * @returns {number} Maximum possible remaining points
 */
export const calculateMaxPossiblePoints = (userBracket, officialBracket, settings = null) => {
  if (!userBracket || !officialBracket) return 0;
  
  let maxPossible = 0;
  
  // Add Play-In Tournament possible points
  const playInEnabled = settings?.playInTournamentEnabled !== false;
  if (playInEnabled && userBracket[ROUND_KEYS.PLAY_IN] && officialBracket[ROUND_KEYS.PLAY_IN]) {
    const playInPointValue = settings?.playInCorrectPrediction || 1;
    
    // East Conference
    if (userBracket[ROUND_KEYS.PLAY_IN]?.east && officialBracket[ROUND_KEYS.PLAY_IN]?.east) {
      // 7/8 Game
      if (userBracket[ROUND_KEYS.PLAY_IN].east.seventhEighthWinner?.team && 
         !officialBracket[ROUND_KEYS.PLAY_IN].east.seventhEighthWinner?.team) {
        maxPossible += playInPointValue;
      }
      
      // 9/10 Game
      if (userBracket[ROUND_KEYS.PLAY_IN].east.ninthTenthWinner?.team && 
         !officialBracket[ROUND_KEYS.PLAY_IN].east.ninthTenthWinner?.team) {
        maxPossible += playInPointValue;
      }
      
      // Final Game
      if (userBracket[ROUND_KEYS.PLAY_IN].east.finalWinner?.team && 
         !officialBracket[ROUND_KEYS.PLAY_IN].east.finalWinner?.team) {
        maxPossible += playInPointValue;
      }
    }
    
    // West Conference
    if (userBracket[ROUND_KEYS.PLAY_IN]?.west && officialBracket[ROUND_KEYS.PLAY_IN]?.west) {
      // 7/8 Game
      if (userBracket[ROUND_KEYS.PLAY_IN].west.seventhEighthWinner?.team && 
         !officialBracket[ROUND_KEYS.PLAY_IN].west.seventhEighthWinner?.team) {
        maxPossible += playInPointValue;
      }
      
      // 9/10 Game
      if (userBracket[ROUND_KEYS.PLAY_IN].west.ninthTenthWinner?.team && 
         !officialBracket[ROUND_KEYS.PLAY_IN].west.ninthTenthWinner?.team) {
        maxPossible += playInPointValue;
      }
      
      // Final Game
      if (userBracket[ROUND_KEYS.PLAY_IN].west.finalWinner?.team && 
         !officialBracket[ROUND_KEYS.PLAY_IN].west.finalWinner?.team) {
        maxPossible += playInPointValue;
      }
    }
  }
  
  // Check each round
  for (const [round, defaultPointValue] of Object.entries(DEFAULT_POINT_VALUES)) {
    // Skip Finals MVP for now
    if (round === ROUND_KEYS.FINALS_MVP) continue;
    // Skip Champion as it's calculated as part of NBA Finals
    if (round === ROUND_KEYS.CHAMPION) continue;
    // Skip Play-In as we've already handled it
    if (round === ROUND_KEYS.PLAY_IN) continue;
    
    const pointValue = (settings && settings[round] !== undefined) ? settings[round] : defaultPointValue;
    
    // NBA Finals is special case - object instead of array
    if (round === ROUND_KEYS.NBA_FINALS) {
      // If no official winner yet, check if user made a pick
      if (!officialBracket[round]?.winner && userBracket[round]?.winner) {
        // Basic points for winner
        maxPossible += pointValue;
        
        // Add champion bonus if applicable
        if (settings && settings[ROUND_KEYS.CHAMPION] !== undefined) {
          maxPossible += settings[ROUND_KEYS.CHAMPION];
        }
        
        // Potential series length bonus if teams would match
        if (userBracket[round].numGames &&
            teamsMatch(userBracket[round], officialBracket[round])) {
          
          // Get the appropriate series length bonus
          const seriesLengthKey = SERIES_LENGTH_KEYS[round];
          let seriesBonus = DEFAULT_SERIES_BONUS[round];
          
          if (settings && settings[seriesLengthKey] !== undefined) {
            seriesBonus = settings[seriesLengthKey];
          }
          
          maxPossible += seriesBonus;
        }
      }
    } 
    // Regular rounds (arrays)
    else if (Array.isArray(officialBracket[round]) && Array.isArray(userBracket[round])) {
      // For each matchup in the round
      for (let i = 0; i < Math.min(officialBracket[round].length, userBracket[round].length); i++) {
        const officialMatchup = officialBracket[round][i];
        const userMatchup = userBracket[round][i];
        
        // If official bracket has no winner yet but user made a pick
        if ((!officialMatchup?.winner || officialMatchup.winner === '') && 
            userMatchup?.winner && userMatchup.winner !== '') {
          // Basic points for winner
          maxPossible += pointValue;
          
          // Potential series length bonus if teams would match
          if (userMatchup.numGames && teamsMatch(userMatchup, officialMatchup)) {
            // Get the appropriate series length bonus
            const seriesLengthKey = SERIES_LENGTH_KEYS[round];
            let seriesBonus = DEFAULT_SERIES_BONUS[round];
            
            if (settings && settings[seriesLengthKey] !== undefined) {
              seriesBonus = settings[seriesLengthKey];
            }
            
            maxPossible += seriesBonus;
          }
        }
      }
    }
  }
  
  // Add possible Finals MVP points if applicable
  if (!officialBracket[ROUND_KEYS.FINALS_MVP] && userBracket[ROUND_KEYS.FINALS_MVP]) {
    const mvpPointValue = (settings && settings[ROUND_KEYS.FINALS_MVP] !== undefined) ? 
                        settings[ROUND_KEYS.FINALS_MVP] : DEFAULT_POINT_VALUES[ROUND_KEYS.FINALS_MVP];
    maxPossible += mvpPointValue;
  }
  
  return maxPossible;
};

/**
 * Count the number of correct series predictions (winner and exact games)
 * @param {Object} userBracket - User bracket data
 * @param {Object} officialBracket - Official bracket data
 * @returns {number} Count of correct series predictions
 */
export const countCorrectSeries = (userBracket, officialBracket) => {
  if (!userBracket || !officialBracket) return 0;
  
  let count = 0;
  const rounds = [
    ROUND_KEYS.FIRST_ROUND, 
    ROUND_KEYS.CONF_SEMIS, 
    ROUND_KEYS.CONF_FINALS, 
    ROUND_KEYS.NBA_FINALS
  ];
  
  rounds.forEach(round => {
    if (round === ROUND_KEYS.NBA_FINALS) {
      // Special case for NBA Finals (object, not array)
      const officialMatchup = officialBracket[round];
      const userMatchup = userBracket[round];
      
      if (officialMatchup?.winner && userMatchup?.winner &&
          officialMatchup.winner === userMatchup.winner &&
          officialMatchup.numGames && userMatchup.numGames &&
          officialMatchup.numGames === userMatchup.numGames) {
        
        const teamsDoMatch = teamsMatch(officialMatchup, userMatchup);
        
        if (teamsDoMatch) {
          count++;
        }
      }
    }
    // Handle regular rounds (arrays)
    else if (Array.isArray(officialBracket[round]) && Array.isArray(userBracket[round])) {
      for (let i = 0; i < Math.min(officialBracket[round].length, userBracket[round].length); i++) {
        const officialMatchup = officialBracket[round][i];
        const userMatchup = userBracket[round][i];
        
        if (officialMatchup?.winner && userMatchup?.winner &&
            officialMatchup.winner === userMatchup.winner &&
            officialMatchup.numGames && userMatchup.numGames &&
            officialMatchup.numGames === userMatchup.numGames) {
          
          const teamsDoMatch = teamsMatch(officialMatchup, userMatchup);
          
          if (teamsDoMatch) {
            count++;
          }
        }
      }
    }
  });
  
  return count;
};

/**
 * Calculate scores for all users in a league
 * @param {string} leagueId - League ID
 * @param {Object} customSettings - Custom scoring settings
 * @returns {Promise<Array>} Array of user scores
 */
export const calculateLeagueScores = async (leagueId, customSettings = null) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Get official playoffs data
    const officialBracket = await fetchPlayoffsData(leagueId);
    if (!officialBracket) {
      throw new Error("Playoffs data not found");
    }
    
    // Get all user brackets
    const userBrackets = await getAllUserBrackets(leagueId);
    
    // Get league metadata for user details
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueSnap = await getDoc(leagueRef);
    const leagueData = leagueSnap.exists() ? leagueSnap.data() : {};
    const usersMap = {};
    
    // Create a map of user IDs to user data
    if (Array.isArray(leagueData.users)) {
      leagueData.users.forEach(user => {
        if (typeof user === 'string') {
          usersMap[user] = { id: user };
        } else if (user && user.id) {
          usersMap[user.id] = user;
        }
      });
    }
    
    // Calculate scores for each user
    const scores = [];
    
    for (const bracket of userBrackets) {
      const userId = bracket.id;
      const scoreData = calculateUserScore(bracket, officialBracket, customSettings);
      
      // Get user data from map or fetch if needed
      let userData = usersMap[userId] || { id: userId };
      
      if (!userData.username) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            userData = {
              ...userData,
              username: userSnap.data().username || userSnap.data().displayName || "Unknown User",
              photoURL: userSnap.data().photoURL
            };
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
      
      scores.push({
        userId,
        userName: userData.username || userData.displayName || "Unknown User",
        userPhoto: userData.photoURL,
        score: scoreData.points,
        basePoints: scoreData.basePoints,
        seriesLengthPoints: scoreData.seriesLengthPoints,
        upsetPoints: scoreData.upsetPoints,
        finalsMVPPoints: scoreData.finalsMVPPoints,
        correctPicks: scoreData.correctPicks,
        correctSeries: countCorrectSeries(bracket, officialBracket),
        possiblePoints: scoreData.possiblePoints,
        maxPossible: scoreData.maxPossible,
        championPick: bracket[ROUND_KEYS.NBA_FINALS]?.winner || "None Selected",
        championCorrect: bracket[ROUND_KEYS.NBA_FINALS]?.winner === officialBracket[ROUND_KEYS.NBA_FINALS]?.winner,
        finalsMVPPick: bracket[ROUND_KEYS.FINALS_MVP] || "None Selected",
        finalsMVPCorrect: bracket[ROUND_KEYS.FINALS_MVP] === officialBracket[ROUND_KEYS.FINALS_MVP],
        roundBreakdown: scoreData.roundBreakdown
      });
    }
    
    // Sort by score (descending)
    return scores.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Error calculating league scores:", error);
    throw error;
  }
};

/**
 * Update and save scores for all users
 * @param {string} leagueId - League ID
 * @param {Object} customSettings - Custom scoring settings
 * @returns {Promise<boolean>} Success status
 */
export const updateLeagueScores = async (leagueId, customSettings = null) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Calculate scores for all users
    const scores = await calculateLeagueScores(leagueId, customSettings);
    
    // Save scores to leaderboard
    const leaderboardRef = doc(db, "leagues", leagueId, "leaderboard", "current");
    await setDoc(leaderboardRef, {
      rankings: scores,
      updatedAt: new Date().toISOString()
    });
    
    // For each user, save their individual score data
    for (const userScore of scores) {
      const userScoreRef = doc(db, "leagues", leagueId, "scores", userScore.userId);
      await setDoc(userScoreRef, {
        ...userScore,
        updatedAt: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error updating league scores:", error);
    throw error;
  }
};

/**
 * Fetch leaderboard data
 * @param {string} leagueId - League ID
 * @param {boolean} [forceRecalculate=false] - Whether to force recalculation
 * @param {Object} customSettings - Custom scoring settings
 * @returns {Promise<Object>} Leaderboard data
 */
export const fetchLeaderboard = async (leagueId, forceRecalculate = false, customSettings = null) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // If forceRecalculate is true, recalculate scores
    if (forceRecalculate) {
      await updateLeagueScores(leagueId, customSettings);
    }
    
    // Get leaderboard data
    const leaderboardRef = doc(db, "leagues", leagueId, "leaderboard", "current");
    const leaderboardSnap = await getDoc(leaderboardRef);
    
    if (leaderboardSnap.exists()) {
      return leaderboardSnap.data();
    } else {
      // No leaderboard yet, calculate and save
      await updateLeagueScores(leagueId, customSettings);
      
      // Try again
      const updatedSnap = await getDoc(leaderboardRef);
      return updatedSnap.exists() ? updatedSnap.data() : { rankings: [] };
    }
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }
};

/**
 * Get the top N users by score
 * @param {string} leagueId - League ID
 * @param {number} [limit=10] - Number of users to return
 * @returns {Promise<Array>} Array of top users
 */
export const getTopUsers = async (leagueId, limit = 10) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Try to get from scores collection (faster than recalculating)
    const scoresRef = collection(db, "leagues", leagueId, "scores");
    const scoresQuery = query(scoresRef, orderBy("score", "desc"), limit(limit));
    const scoresSnap = await getDocs(scoresQuery);
    
    if (!scoresSnap.empty) {
      const topUsers = [];
      scoresSnap.forEach(doc => {
        topUsers.push(doc.data());
      });
      return topUsers;
    }
    
    // Fallback: Calculate scores
    const scores = await calculateLeagueScores(leagueId);
    return scores.slice(0, limit);
  } catch (error) {
    console.error("Error getting top users:", error);
    throw error;
  }
};

/**
 * Get a single user's score
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @param {boolean} [forceRecalculate=false] - Whether to force recalculation
 * @param {Object} customSettings - Custom scoring settings
 * @returns {Promise<Object>} User's score data
 */
export const getUserScore = async (leagueId, userId, forceRecalculate = false, customSettings = null) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }
    
    // If we don't need to recalculate, try to get from saved scores
    if (!forceRecalculate) {
      const userScoreRef = doc(db, "leagues", leagueId, "scores", userId);
      const userScoreSnap = await getDoc(userScoreRef);
      
      if (userScoreSnap.exists()) {
        return userScoreSnap.data();
      }
    }
    
    // Need to calculate
    // Get official bracket
    const officialBracket = await fetchPlayoffsData(leagueId);
    if (!officialBracket) {
      throw new Error("Playoffs data not found");
    }
    
    // Get user bracket
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    
    if (!userBracketSnap.exists()) {
      throw new Error("User bracket not found");
    }
    
    const userBracket = userBracketSnap.data();
    
    // Calculate score
    const scoreData = calculateUserScore(userBracket, officialBracket, customSettings);
    
    // Get user data
    let userName = "Unknown User";
    let userPhoto = null;
    
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        userName = userSnap.data().username || userSnap.data().displayName || "Unknown User";
        userPhoto = userSnap.data().photoURL;
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
    
    // Create score object
    const userScore = {
      userId,
      userName,
      userPhoto,
      score: scoreData.points,
      basePoints: scoreData.basePoints,
      seriesLengthPoints: scoreData.seriesLengthPoints,
      upsetPoints: scoreData.upsetPoints,
      finalsMVPPoints: scoreData.finalsMVPPoints,
      correctPicks: scoreData.correctPicks,
      correctSeries: countCorrectSeries(userBracket, officialBracket),
      possiblePoints: scoreData.possiblePoints,
      maxPossible: scoreData.maxPossible,
      championPick: userBracket[ROUND_KEYS.NBA_FINALS]?.winner || "None Selected",
      championCorrect: userBracket[ROUND_KEYS.NBA_FINALS]?.winner === officialBracket[ROUND_KEYS.NBA_FINALS]?.winner,
      finalsMVPPick: userBracket[ROUND_KEYS.FINALS_MVP] || "None Selected",
      finalsMVPCorrect: userBracket[ROUND_KEYS.FINALS_MVP] === officialBracket[ROUND_KEYS.FINALS_MVP],
      roundBreakdown: scoreData.roundBreakdown,
      updatedAt: new Date().toISOString()
    };
    
    // Save the score
    const userScoreRef = doc(db, "leagues", leagueId, "scores", userId);
    await setDoc(userScoreRef, userScore);
    
    return userScore;
  } catch (error) {
    console.error("Error getting user score:", error);
    throw error;
  }
};

export default {
  calculateUserScore,
  calculateLeagueScores,
  updateLeagueScores,
  fetchLeaderboard,
  getTopUsers,
  getUserScore,
  teamsMatch,
  getUIPointValues,
  countCorrectSeries,
  getTeamSeed,
  getPointValue,
  getSeriesBonus,
  calculatePlayInScore,
  POINT_VALUES,
  SERIES_BONUS
};
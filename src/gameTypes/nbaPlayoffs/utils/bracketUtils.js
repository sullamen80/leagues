// src/gameTypes/nbaPlayoffs/utils/bracketUtils.js

import {
  ROUND_KEYS,
  ROUND_DISPLAY_NAMES,
  DEFAULT_POINT_VALUES,
  DEFAULT_SERIES_BONUS
} from '../constants/playoffConstants';

/**
 * Format team name with seed for display (e.g., "Boston Celtics (1)")
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
  // Return the display name or the original if not found
  return ROUND_DISPLAY_NAMES[roundName] || roundName;
};

/**
 * Get conference name based on round and index
 * @param {string} round - Round name
 * @param {number} index - Matchup index
 * @returns {string} Conference name
 */
export const getConferenceName = (round, index) => {
  if (round === ROUND_KEYS.FIRST_ROUND) {
    if (index < 4) return "East";
    return "West";
  } else if (round === ROUND_KEYS.CONF_SEMIS) {
    if (index < 2) return "East";
    return "West";
  } else if (round === ROUND_KEYS.CONF_FINALS) {
    if (index === 0) return "East";
    return "West";
  }
  
  return "";
};

/**
 * Get next round name
 * @param {string} currentRound - Current round name
 * @returns {string|null} Next round name or null if there is no next round
 */
export const getNextRound = (currentRound) => {
  // Define round progression using standard keys
  const roundOrder = {
    [ROUND_KEYS.FIRST_ROUND]: ROUND_KEYS.CONF_SEMIS,
    [ROUND_KEYS.CONF_SEMIS]: ROUND_KEYS.CONF_FINALS,
    [ROUND_KEYS.CONF_FINALS]: ROUND_KEYS.NBA_FINALS
  };
  
  return roundOrder[currentRound] || null;
};

/**
 * Format series result (e.g., "Celtics win 4-2")
 * @param {string} winner - Winner team name
 * @param {string} loser - Loser team name
 * @param {number} gamesPlayed - Total games played in series
 * @returns {string} Formatted series result
 */
export const formatSeriesResult = (winner, loser, gamesPlayed) => {
  if (!winner || !loser || !gamesPlayed) return "";
  
  const winnerGames = Math.ceil(gamesPlayed / 2);
  const loserGames = gamesPlayed - winnerGames;
  
  return `${winner} win ${winnerGames}-${loserGames}`;
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
        team1Seed: currentRound[i].team1Seed || null,
        team2: currentRound[i + 1].winner || "",
        team2Seed: currentRound[i + 1].team2Seed || null,
        winner: "",
        gamesPlayed: null
      });
    }
  }
  
  return nextRound;
};

/**
 * Generate first round matchups from conference teams with proper NBA seeding
 * @param {Array} eastTeams - Eastern Conference teams
 * @param {Array} westTeams - Western Conference teams
 * @returns {Array} First round matchups
 */
export const generateFirstRoundMatchups = (eastTeams, westTeams) => {
  // NBA Playoff seeding pairs: 1v8, 4v5, 3v6, 2v7
  const seedPairs = [
    [0, 7], // 1 seed vs 8 seed (0-indexed array)
    [3, 4], // 4 seed vs 5 seed
    [2, 5], // 3 seed vs 6 seed
    [1, 6]  // 2 seed vs 7 seed
  ];
  
  // Helper to compute pairings for a conference
  const computeConferencePairings = (teams, startIndex) => {
    return seedPairs.map(([seed1Index, seed2Index], idx) => {
      // Find the teams by seed
      const team1 = teams.find(t => t.seed === seed1Index + 1) || {};
      const team2 = teams.find(t => t.seed === seed2Index + 1) || {};
      
      return {
        team1: team1.teamId || "",
        team1Seed: team1.seed || null,
        team2: team2.teamId || "",
        team2Seed: team2.seed || null,
        winner: "",
        gamesPlayed: null,
        conference: startIndex === 0 ? "East" : "West"
      };
    });
  };
  
  // Compute pairings for each conference
  const eastPairings = computeConferencePairings(eastTeams, 0);
  const westPairings = computeConferencePairings(westTeams, 4);
  
  return [...eastPairings, ...westPairings];
};

/**
 * Generate default game data structure for NBA Playoffs
 * @returns {Object} Default game data structure
 */
export const getDefaultGameData = () => {
  const defaultData = {
    allTeams: {
      eastConference: {
        atlantic: [
          { id: "BOS", name: "Boston Celtics", shortName: "Celtics", city: "Boston", colors: ["#007A33", "#FFFFFF"] },
          { id: "BKN", name: "Brooklyn Nets", shortName: "Nets", city: "Brooklyn", colors: ["#000000", "#FFFFFF"] },
          { id: "NYK", name: "New York Knicks", shortName: "Knicks", city: "New York", colors: ["#006BB6", "#F58426"] },
          { id: "PHI", name: "Philadelphia 76ers", shortName: "76ers", city: "Philadelphia", colors: ["#006BB6", "#ED174C"] },
          { id: "TOR", name: "Toronto Raptors", shortName: "Raptors", city: "Toronto", colors: ["#CE1141", "#000000"] }
        ],
        central: [
          { id: "CHI", name: "Chicago Bulls", shortName: "Bulls", city: "Chicago", colors: ["#CE1141", "#000000"] },
          { id: "CLE", name: "Cleveland Cavaliers", shortName: "Cavaliers", city: "Cleveland", colors: ["#860038", "#FDBB30"] },
          { id: "DET", name: "Detroit Pistons", shortName: "Pistons", city: "Detroit", colors: ["#C8102E", "#1D42BA"] },
          { id: "IND", name: "Indiana Pacers", shortName: "Pacers", city: "Indiana", colors: ["#002D62", "#FDBB30"] },
          { id: "MIL", name: "Milwaukee Bucks", shortName: "Bucks", city: "Milwaukee", colors: ["#00471B", "#EEE1C6"] }
        ],
        southeast: [
          { id: "ATL", name: "Atlanta Hawks", shortName: "Hawks", city: "Atlanta", colors: ["#E03A3E", "#C1D32F"] },
          { id: "CHA", name: "Charlotte Hornets", shortName: "Hornets", city: "Charlotte", colors: ["#1D1160", "#00788C"] },
          { id: "MIA", name: "Miami Heat", shortName: "Heat", city: "Miami", colors: ["#98002E", "#F9A01B"] },
          { id: "ORL", name: "Orlando Magic", shortName: "Magic", city: "Orlando", colors: ["#0077C0", "#C4CED4"] },
          { id: "WAS", name: "Washington Wizards", shortName: "Wizards", city: "Washington", colors: ["#002B5C", "#E31837"] }
        ]
      },
      westConference: {
        northwest: [
          { id: "DEN", name: "Denver Nuggets", shortName: "Nuggets", city: "Denver", colors: ["#0E2240", "#FEC524"] },
          { id: "MIN", name: "Minnesota Timberwolves", shortName: "Timberwolves", city: "Minnesota", colors: ["#0C2340", "#78BE20"] },
          { id: "OKC", name: "Oklahoma City Thunder", shortName: "Thunder", city: "Oklahoma City", colors: ["#007AC1", "#EF3B24"] },
          { id: "POR", name: "Portland Trail Blazers", shortName: "Trail Blazers", city: "Portland", colors: ["#E03A3E", "#000000"] },
          { id: "UTA", name: "Utah Jazz", shortName: "Jazz", city: "Utah", colors: ["#002B5C", "#00471B"] }
        ],
        pacific: [
          { id: "GSW", name: "Golden State Warriors", shortName: "Warriors", city: "Golden State", colors: ["#1D428A", "#FFC72C"] },
          { id: "LAC", name: "Los Angeles Clippers", shortName: "Clippers", city: "LA", colors: ["#C8102E", "#1D428A"] },
          { id: "LAL", name: "Los Angeles Lakers", shortName: "Lakers", city: "LA", colors: ["#552583", "#FDB927"] },
          { id: "PHX", name: "Phoenix Suns", shortName: "Suns", city: "Phoenix", colors: ["#1D1160", "#E56020"] },
          { id: "SAC", name: "Sacramento Kings", shortName: "Kings", city: "Sacramento", colors: ["#5A2D81", "#63727A"] }
        ],
        southwest: [
          { id: "DAL", name: "Dallas Mavericks", shortName: "Mavericks", city: "Dallas", colors: ["#00538C", "#002B5E"] },
          { id: "HOU", name: "Houston Rockets", shortName: "Rockets", city: "Houston", colors: ["#CE1141", "#000000"] },
          { id: "MEM", name: "Memphis Grizzlies", shortName: "Grizzlies", city: "Memphis", colors: ["#5D76A9", "#12173F"] },
          { id: "NOP", name: "New Orleans Pelicans", shortName: "Pelicans", city: "New Orleans", colors: ["#0C2340", "#C8102E"] },
          { id: "SAS", name: "San Antonio Spurs", shortName: "Spurs", city: "San Antonio", colors: ["#C4CED4", "#000000"] }
        ]
      }
    },
    playoffTeams: {
      eastConference: Array(8).fill().map((_, i) => ({ 
        seed: i + 1, 
        teamId: null, 
        eliminated: false 
      })),
      westConference: Array(8).fill().map((_, i) => ({ 
        seed: i + 1, 
        teamId: null, 
        eliminated: false 
      }))
    },
    status: "setup",
    seasonYear: new Date().getFullYear()
  };
  
  // Add round data using standardized keys
  defaultData[ROUND_KEYS.FIRST_ROUND] = [];
  defaultData[ROUND_KEYS.CONF_SEMIS] = [];
  defaultData[ROUND_KEYS.CONF_FINALS] = [];
  defaultData[ROUND_KEYS.NBA_FINALS] = { team1: "", team2: "", winner: "", gamesPlayed: null };
  defaultData[ROUND_KEYS.FINALS_MVP] = "";
  
  return defaultData;
};

/**
 * Check if a bracket is complete (all matchups have winners)
 * @param {Object} bracket - Bracket data
 * @returns {boolean} Whether the bracket is complete
 */
export const isBracketComplete = (bracket) => {
  if (!bracket) return false;
  
  // Check all rounds except NBAFinals
  const rounds = [ROUND_KEYS.FIRST_ROUND, ROUND_KEYS.CONF_SEMIS, ROUND_KEYS.CONF_FINALS];
  
  for (const round of rounds) {
    if (!Array.isArray(bracket[round])) return false;
    
    // For each matchup in this round, check if it has a winner
    for (const matchup of bracket[round]) {
      if (!matchup?.winner) return false;
    }
  }
  
  // Check NBAFinals
  if (!bracket[ROUND_KEYS.NBA_FINALS]?.winner) return false;
  
  // Check Finals MVP (optional)
  // if (!bracket[ROUND_KEYS.FINALS_MVP]) return false;
  
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
    [ROUND_KEYS.FIRST_ROUND]: 0,
    [ROUND_KEYS.CONF_SEMIS]: 0,
    [ROUND_KEYS.CONF_FINALS]: 0,
    [ROUND_KEYS.NBA_FINALS]: 0,
    [ROUND_KEYS.FINALS_MVP]: 0,
    total: 0
  };
  
  // Process each round except NBAFinals
  const rounds = [ROUND_KEYS.FIRST_ROUND, ROUND_KEYS.CONF_SEMIS, ROUND_KEYS.CONF_FINALS];
  
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
  
  // Process NBAFinals
  if (userBracket[ROUND_KEYS.NBA_FINALS]?.winner && officialBracket[ROUND_KEYS.NBA_FINALS]?.winner) {
    if (stringsEqual(userBracket[ROUND_KEYS.NBA_FINALS].winner, officialBracket[ROUND_KEYS.NBA_FINALS].winner)) {
      result[ROUND_KEYS.NBA_FINALS]++;
      result.total++;
    }
  }
  
  // Process Finals MVP
  if (userBracket[ROUND_KEYS.FINALS_MVP] && officialBracket[ROUND_KEYS.FINALS_MVP]) {
    if (stringsEqual(userBracket[ROUND_KEYS.FINALS_MVP], officialBracket[ROUND_KEYS.FINALS_MVP])) {
      result[ROUND_KEYS.FINALS_MVP]++;
      result.total++;
    }
  }
  
  return result;
};

/**
 * Count correct series length predictions
 * @param {Object} userBracket - User's bracket
 * @param {Object} officialBracket - Official bracket
 * @returns {Object} Counts of correct series length predictions by round
 */
export const countCorrectSeriesLengths = (userBracket, officialBracket) => {
  if (!userBracket || !officialBracket) return null;
  
  const result = {
    [ROUND_KEYS.FIRST_ROUND]: 0,
    [ROUND_KEYS.CONF_SEMIS]: 0,
    [ROUND_KEYS.CONF_FINALS]: 0,
    [ROUND_KEYS.NBA_FINALS]: 0,
    total: 0
  };
  
  // Process each round except NBAFinals
  const rounds = [ROUND_KEYS.FIRST_ROUND, ROUND_KEYS.CONF_SEMIS, ROUND_KEYS.CONF_FINALS];
  
  for (const round of rounds) {
    if (!Array.isArray(userBracket[round]) || !Array.isArray(officialBracket[round])) continue;
    
    // Only count rounds that have been played in official bracket
    const roundPlayedCount = officialBracket[round].filter(m => m?.winner && m?.gamesPlayed).length;
    if (roundPlayedCount === 0) continue;
    
    // For each matchup, check if user's pick matches official result
    for (let i = 0; i < Math.min(userBracket[round].length, officialBracket[round].length); i++) {
      const userPick = userBracket[round][i]?.winner;
      const userGames = userBracket[round][i]?.gamesPlayed;
      const officialWinner = officialBracket[round][i]?.winner;
      const officialGames = officialBracket[round][i]?.gamesPlayed;
      
      const userTeam1 = userBracket[round][i]?.team1;
      const userTeam2 = userBracket[round][i]?.team2;
      const officialTeam1 = officialBracket[round][i]?.team1;
      const officialTeam2 = officialBracket[round][i]?.team2;
      
      // Only count series length points if the user got the winner right
      // AND both teams in the matchup are correct
      if (userPick && officialWinner && userGames && officialGames &&
          stringsEqual(userPick, officialWinner) &&
          stringsEqual(userTeam1, officialTeam1) &&
          stringsEqual(userTeam2, officialTeam2) &&
          userGames === officialGames) {
        result[round]++;
        result.total++;
      }
    }
  }
  
  // Process NBAFinals
  if (userBracket[ROUND_KEYS.NBA_FINALS]?.winner && 
      officialBracket[ROUND_KEYS.NBA_FINALS]?.winner &&
      userBracket[ROUND_KEYS.NBA_FINALS]?.gamesPlayed && 
      officialBracket[ROUND_KEYS.NBA_FINALS]?.gamesPlayed) {
    
    // Only count series length points if the user got the winner right
    // AND both teams in the finals are correct
    if (stringsEqual(userBracket[ROUND_KEYS.NBA_FINALS].winner, officialBracket[ROUND_KEYS.NBA_FINALS].winner) &&
        stringsEqual(userBracket[ROUND_KEYS.NBA_FINALS].team1, officialBracket[ROUND_KEYS.NBA_FINALS].team1) &&
        stringsEqual(userBracket[ROUND_KEYS.NBA_FINALS].team2, officialBracket[ROUND_KEYS.NBA_FINALS].team2) &&
        userBracket[ROUND_KEYS.NBA_FINALS].gamesPlayed === officialBracket[ROUND_KEYS.NBA_FINALS].gamesPlayed) {
      result[ROUND_KEYS.NBA_FINALS]++;
      result.total++;
    }
  }
  
  return result;
};

/**
 * Calculate bracket score using standard scoring system for NBA Playoffs
 * @param {Object} userBracket - User's bracket
 * @param {Object} officialBracket - Official bracket
 * @returns {Object} Score details
 */
export const calculateBracketScore = (userBracket, officialBracket) => {
  if (!userBracket || !officialBracket) return { total: 0 };
  
  // Count correct winners
  const correctWinners = countCorrectPicks(userBracket, officialBracket);
  if (!correctWinners) return { total: 0 };
  
  // Count correct series lengths
  const correctSeriesLengths = countCorrectSeriesLengths(userBracket, officialBracket);
  
  // Use standard point values from constants
  const winnerPoints = DEFAULT_POINT_VALUES;
  
  // Use standard series length bonus values from constants
  const seriesLengthBonus = DEFAULT_SERIES_BONUS;
  
  const result = {
    correctPicks: { ...correctWinners },
    correctSeriesLengths: correctSeriesLengths ? { ...correctSeriesLengths } : { total: 0 },
    winnerPoints: {},
    seriesLengthPoints: {},
    total: 0
  };
  
  // Calculate points for correct winners
  for (const [round, count] of Object.entries(correctWinners)) {
    if (round !== 'total' && winnerPoints[round]) {
      result.winnerPoints[round] = count * winnerPoints[round];
      result.total += result.winnerPoints[round];
    }
  }
  
  // Calculate points for correct series lengths
  if (correctSeriesLengths) {
    for (const [round, count] of Object.entries(correctSeriesLengths)) {
      if (round !== 'total' && seriesLengthBonus[round]) {
        result.seriesLengthPoints[round] = count * seriesLengthBonus[round];
        result.total += result.seriesLengthPoints[round];
      }
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
  const requiredRounds = [
    ROUND_KEYS.FIRST_ROUND, 
    ROUND_KEYS.CONF_SEMIS, 
    ROUND_KEYS.CONF_FINALS, 
    ROUND_KEYS.NBA_FINALS
  ];
  
  for (const round of requiredRounds) {
    if (round === ROUND_KEYS.NBA_FINALS) {
      if (!bracket[round] || typeof bracket[round] !== 'object') {
        errors.push(`Missing ${getDisplayName(round)} round data`);
      }
    } else {
      if (!Array.isArray(bracket[round])) {
        errors.push(`Missing ${getDisplayName(round)} round data`);
      }
    }
  }
  
  // Check Finals MVP field
  if (!(ROUND_KEYS.FINALS_MVP in bracket)) {
    errors.push('Missing Finals MVP field');
  }
  
  // Check round sizes
  const expectedSizes = {
    [ROUND_KEYS.FIRST_ROUND]: 8,   // 4 matchups per conference
    [ROUND_KEYS.CONF_SEMIS]: 4,    // 2 matchups per conference
    [ROUND_KEYS.CONF_FINALS]: 2    // 1 matchup per conference
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
    [ROUND_KEYS.FIRST_ROUND]: 8,
    [ROUND_KEYS.CONF_SEMIS]: 4,
    [ROUND_KEYS.CONF_FINALS]: 2
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
        winner: "", gamesPlayed: null
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
      gamesPlayed: matchup?.gamesPlayed !== undefined ? matchup.gamesPlayed : null
    }));
  }
  
  // Fix NBAFinals
  if (!repairedBracket[ROUND_KEYS.NBA_FINALS] || typeof repairedBracket[ROUND_KEYS.NBA_FINALS] !== 'object') {
    repairedBracket[ROUND_KEYS.NBA_FINALS] = { 
      team1: "", team1Seed: null,
      team2: "", team2Seed: null,
      winner: "", gamesPlayed: null
    };
  } else {
    repairedBracket[ROUND_KEYS.NBA_FINALS] = {
      team1: repairedBracket[ROUND_KEYS.NBA_FINALS].team1 || "",
      team1Seed: repairedBracket[ROUND_KEYS.NBA_FINALS].team1Seed !== undefined 
        ? repairedBracket[ROUND_KEYS.NBA_FINALS].team1Seed : null,
      team2: repairedBracket[ROUND_KEYS.NBA_FINALS].team2 || "",
      team2Seed: repairedBracket[ROUND_KEYS.NBA_FINALS].team2Seed !== undefined 
        ? repairedBracket[ROUND_KEYS.NBA_FINALS].team2Seed : null,
      winner: repairedBracket[ROUND_KEYS.NBA_FINALS].winner || "",
      gamesPlayed: repairedBracket[ROUND_KEYS.NBA_FINALS].gamesPlayed !== undefined 
        ? repairedBracket[ROUND_KEYS.NBA_FINALS].gamesPlayed : null
    };
  }
  
  // Fix Finals MVP
  if (!(ROUND_KEYS.FINALS_MVP in repairedBracket)) {
    repairedBracket[ROUND_KEYS.FINALS_MVP] = "";
  }
  
  return repairedBracket;
};
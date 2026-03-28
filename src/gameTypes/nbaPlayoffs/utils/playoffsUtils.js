// src/gameTypes/nbaPlayoffs/utils/playoffsUtils.js

import { 
  ROUND_KEYS, 
  ROUND_DISPLAY_NAMES
} from '../constants/playoffConstants';

/**
 * Format team name with seed for display
 * @param {string} team - Team name or ID
 * @param {number} seed - Team seed number
 */
export const formatTeamWithSeed = (team, seed) => {
  if (!team) return "TBD";
  if (!seed) return team;
  return `${team} (${seed})`;
};

/**
 * Get display name for playoff round
 * @param {string} roundName - Internal round name
 */
export const getDisplayName = (roundName) => {
  // Return the display name or the original if not found
  return ROUND_DISPLAY_NAMES[roundName] || roundName;
};

/**
 * Get conference name based on round and index
 * @param {string} round - Playoff round name
 * @param {number} index - Matchup index
 */
export const getConferenceName = (round, index) => {
  // For NBA, first half of matchups are East, second half are West
  if (round === ROUND_KEYS.FIRST_ROUND) {
    // First Round: 8 matchups (4 East, 4 West)
    return index < 4 ? "East" : "West";
  } else if (round === ROUND_KEYS.CONF_SEMIS) {
    // Conference Semifinals: 4 matchups (2 East, 2 West)
    return index < 2 ? "East" : "West";
  } else if (round === ROUND_KEYS.CONF_FINALS) {
    // Conference Finals: 2 matchups (1 East, 1 West)
    return index === 0 ? "East" : "West";
  }
  
  // NBA Finals doesn't have a specific conference
  return "";
};

/**
 * Get color for conference display
 * @param {string} conference - Conference name
 */
export const getConferenceColor = (conference) => {
  switch(conference) {
    case 'East': return '#006BB6'; // NBA Eastern Conference blue
    case 'West': return '#ED174C'; // NBA Western Conference red
    default: return '#000000';
  }
};

/**
 * Get the seed pairs for the First Round
 * Standard NBA playoffs seeding pairs
 */
export const getSeedPairs = () => {
  // NBA First Round matchups: 1v8, 4v5, 3v6, 2v7
  return [
    [1, 8],
    [4, 5],
    [3, 6],
    [2, 7]
  ];
};

/**
 * Calculate the next matchup index when advancing to the next round
 * @param {number} currentIndex - Current matchup index
 * @param {string} currentRound - Current round name
 */
export const getNextRoundMatchupIndex = (currentIndex, currentRound) => {
  if (currentRound === ROUND_KEYS.CONF_FINALS) {
    // Both conference finals winners go to the NBA Finals
    return 0; // There's only one NBA Finals matchup
  }
  
  // For other rounds, standard halving applies
  return Math.floor(currentIndex / 2);
};

/**
 * Determine if a team will be team1 or team2 in the next round
 * @param {number} currentIndex - Current matchup index
 * @param {string} currentRound - Current round name
 */
export const isTeam1InNextRound = (currentIndex, currentRound) => {
  if (currentRound === ROUND_KEYS.CONF_FINALS) {
    // East champion is team1, West champion is team2 in NBA Finals
    return currentIndex === 0; // Index 0 is East Conference Final
  }
  
  // For other rounds, even indices are team1 in next round
  return currentIndex % 2 === 0;
};

/**
 * Format series result for display
 * @param {string} winner - Winner team
 * @param {number} winnerGames - Winner's games won (typically 4)
 * @param {number} loserGames - Loser's games won
 */
export const formatSeriesResult = (winner, winnerGames, loserGames) => {
  if (!winner) return "";
  if (!winnerGames) winnerGames = 4; // Default for NBA playoffs
  
  return `${winner} ${winnerGames}-${loserGames}`;
};

/**
 * Get possible series outcomes based on best-of-7 format
 */
export const getSeriesOptions = () => {
  return [
    { value: 4, label: '4-0 (Sweep)' },
    { value: 5, label: '4-1' },
    { value: 6, label: '4-2' },
    { value: 7, label: '4-3' }
  ];
};

/**
 * Calculate games needed to win a series
 * @param {number} seriesLength - Total length of series (typically 7)
 */
export const getGamesToWin = (seriesLength = 7) => {
  return Math.ceil(seriesLength / 2);
};

/**
 * Get team full name from team ID using allTeams data
 * @param {string} teamId - Team identifier (e.g., "BOS", "LAL")
 * @param {Object} allTeams - Complete teams data object
 */
export const getTeamName = (teamId, allTeams) => {
  if (!teamId || !allTeams) return "";
  
  // Search in both conferences
  for (const conference of ['eastConference', 'westConference']) {
    if (!allTeams[conference]) continue;
    
    // Search in each division within the conference
    for (const division in allTeams[conference]) {
      const team = allTeams[conference][division].find(t => t.id === teamId);
      if (team) return team.name;
    }
  }
  
  return teamId; // Return the ID if no name found
};

/**
 * Get team colors from team ID using allTeams data
 * @param {string} teamId - Team identifier (e.g., "BOS", "LAL")
 * @param {Object} allTeams - Complete teams data object
 */
export const getTeamColors = (teamId, allTeams) => {
  if (!teamId || !allTeams) return ["#000000", "#FFFFFF"];
  
  // Search in both conferences
  for (const conference of ['eastConference', 'westConference']) {
    if (!allTeams[conference]) continue;
    
    // Search in each division within the conference
    for (const division in allTeams[conference]) {
      const team = allTeams[conference][division].find(t => t.id === teamId);
      if (team && team.colors) return team.colors;
    }
  }
  
  return ["#000000", "#FFFFFF"]; // Default colors if not found
};

/**
 * Get seed for a team in the playoff bracket
 * @param {string} teamId - Team identifier
 * @param {Object} playoffTeams - Playoff teams data
 */
export const getTeamSeed = (teamId, playoffTeams) => {
  if (!teamId || !playoffTeams) return null;
  
  // Search in both conferences
  for (const conference of ['eastConference', 'westConference']) {
    if (!playoffTeams[conference]) continue;
    
    const team = playoffTeams[conference].find(t => t.teamId === teamId);
    if (team) return team.seed;
  }
  
  return null;
};

/**
 * Check if a team has been eliminated from the playoffs
 * @param {string} teamId - Team identifier
 * @param {Object} playoffTeams - Playoff teams data
 */
export const isTeamEliminated = (teamId, playoffTeams) => {
  if (!teamId || !playoffTeams) return false;
  
  // Search in both conferences
  for (const conference of ['eastConference', 'westConference']) {
    if (!playoffTeams[conference]) continue;
    
    const team = playoffTeams[conference].find(t => t.teamId === teamId);
    if (team) return team.eliminated === true;
  }
  
  return false;
};

/**
 * Get the next round name
 * @param {string} currentRound - Current round name
 */
export const getNextRound = (currentRound) => {
  // Define round progression using standard keys
  const rounds = {
    [ROUND_KEYS.FIRST_ROUND]: ROUND_KEYS.CONF_SEMIS,
    [ROUND_KEYS.CONF_SEMIS]: ROUND_KEYS.CONF_FINALS,
    [ROUND_KEYS.CONF_FINALS]: ROUND_KEYS.NBA_FINALS
  };
  
  return rounds[currentRound] || null;
};
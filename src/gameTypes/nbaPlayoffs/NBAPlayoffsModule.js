import React, { useEffect } from 'react';
import { FaBasketballBall } from 'react-icons/fa';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation } from 'react-router-dom';
import BaseGameModule, { useUrlParams, ParameterComponent, ParameterRouter } from '../common/BaseGameModule';

// Import components
import BracketDashboard from './components/BracketDashboard.js';
import BracketView from './components/BracketView';
import BracketEdit from './components/BracketEdit.js';
import UserPlayInPanel from './components/UserPlayInPanel';
import AdminDashboard from './components/AdminDashboard';
import AdminSettings from './components/AdminSettings';
import AdminTeams from './components/AdminTeams.js';
import AdminMVPManagement from './components/AdminMVPManagement.js';
import AdminScoringSettings from './components/AdminScoringSettings.js';
import LeagueSetup from './components/LeagueSetup.js';
import Leaderboard from './components/Leaderboard';
import TournamentIcon from './components/TournamentIcon';

// Import services and constants
import initializeLeagueGameData from './services/bracketService';
import { 
  ROUND_KEYS, 
  ROUND_DISPLAY_NAMES, 
  DEFAULT_POINT_VALUES,
  DEFAULT_SERIES_BONUS,
  SERIES_LENGTH_KEYS
} from './constants/playoffConstants';
import { getDefaultGameData } from './utils/bracketUtils';

/**
 * Enhanced parameter-based router for NBA Playoffs
 */
const NBAPlayoffsRouter = (props) => {
  const location = useLocation();
  const params = useUrlParams();

  // Extract the view parameter to determine the active tab
  const view = params.view || 'edit'; // Default to 'edit' if no view is specified
  const subview = params.subview || '';
  const bracketId = params.bracketId;

  // Render different components based on the view parameter
  if (view === 'admin') {
    // When view=admin, check for subviews
    if (subview === 'settings') {
      return (
        <AdminSettings
          {...props}
          urlParams={params}
        />
      );
    } else if (subview === 'teams') {
      return (
        <AdminTeams
          {...props}
          urlParams={params}
        />
      );
    } else if (subview === 'scoring') {
      return (
        <AdminScoringSettings
          {...props}
          urlParams={params}
        />
      );
    } else if (subview === 'mvp') {
      return (
        <AdminMVPManagement
          leagueId={props.leagueId}
          gameData={props.gameData}
          isArchived={props.isArchived || false}
          urlParams={params}
        />
      );
    } else {
      // Default admin view when no subview is specified
      return (
        <AdminDashboard
          {...props}
          urlParams={params}
          subview={subview}
        />
      );
    }
  }

  // For all other views (view, edit, play-in, leaderboard), render BracketDashboard
  return (
    <BracketDashboard
      {...props}
      urlParams={params}
      activeTab={view} // Pass the view as the activeTab to control which tab is shown
    />
  );
};

/**
 * NBAPlayoffsModule - Implements the game type interface for NBA Playoffs tournament
 * Extends the BaseGameModule with basketball-specific functionality
 */
class NBAPlayoffsModule extends BaseGameModule {
  constructor() {
    super(); // Initialize base class
    
    // Override base properties with NBA Playoffs specific values
    this.id = 'nbaPlayoffs';
    this.name = 'NBA Playoffs';
    this.description = 'NBA Playoffs Bracket Challenge';
    this.icon = <FaBasketballBall />;
    this.color = '#C9082A'; // NBA Red color
    this.bracketIcon = TournamentIcon;
  }

  /**
   * Get routes for NBA Playoffs module
   * @param {string} baseUrl - Base URL for routes
   * @returns {Array} Array of route objects
   */
  getRoutes(baseUrl) {
    return [
      {
        path: `${baseUrl}`,
        element: BracketDashboard,
        exact: true
      },
      {
        path: `${baseUrl}/view`,
        element: BracketView,
      },
      {
        path: `${baseUrl}/edit`,
        element: BracketEdit,
      },
      {
        path: `${baseUrl}/play-in`,
        element: UserPlayInPanel,
      },
      {
        path: `${baseUrl}/admin`,
        element: AdminDashboard,
      },
      {
        path: `${baseUrl}/admin/settings`,
        element: AdminSettings,
      },
      {
        path: `${baseUrl}/admin/teams`,
        element: AdminTeams
      },
      {
        path: `${baseUrl}/admin/scoring`,
        element: AdminScoringSettings,
      },
      {
        path: `${baseUrl}/leaderboard`,
        element: Leaderboard,
      }
    ];
  }

  /**
   * Override to provide parameter-based routes
   * @param {string} baseUrl - Base URL for routes
   * @returns {Array} Array of parameter-based route objects
   */
  getParameterRoutes(baseUrl) {
    console.log(`Creating parameter routes for ${baseUrl}`);
    // Return a single route with parameter-based component switching
    return [
      {
        path: baseUrl,
        element: NBAPlayoffsRouter
      }
    ];
  }

  /**
   * Generate URL for viewing a specific bracket
   * @param {string} baseUrl - Base URL
   * @param {string} bracketId - ID of the bracket to view
   * @returns {string} URL with parameters
   */
  getBracketViewUrl(baseUrl, bracketId) {
    return this.generateParameterUrl(baseUrl, {
      view: 'view',
      bracketId
    });
  }

  /**
   * Generate URL for editing a bracket
   * @param {string} baseUrl - Base URL
   * @returns {string} URL with parameters
   */
  getBracketEditUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, {
      view: 'edit'
    });
  }

  /**
   * Generate URL for Play-In Tournament view
   * @param {string} baseUrl - Base URL
   * @returns {string} URL with parameters
   */
  getPlayInUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, {
      view: 'play-in'
    });
  }

  /**
   * Generate URL for admin dashboard
   * @param {string} baseUrl - Base URL
   * @param {string} subview - Optional subview
   * @returns {string} URL with parameters
   */
  getAdminUrl(baseUrl, subview = null) {
    const params = {
      view: 'admin'
    };
    
    if (subview) {
      params.subview = subview;
    }
    
    return this.generateParameterUrl(baseUrl, params);
  }

  /**
   * Generate URL for leaderboard
   * @param {string} baseUrl - Base URL
   * @returns {string} URL with parameters
   */
  getLeaderboardUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, {
      view: 'leaderboard'
    });
  }

  /**
   * Get setup component for creating a new NBA Playoffs league
   * @returns {React.Component} League setup component
   */
  getSetupComponent() {
    return LeagueSetup;
  }

  /**
   * Initialize a new league with NBA Playoffs data
   * @param {string} leagueId - ID of the new league
   * @param {Object} setupData - Data from the setup component
   * @returns {Promise} Promise that resolves when initialization is complete
   */
  async initializeLeague(leagueId, setupData = {}) {
    try {
      console.log(`Initializing NBA Playoffs league: ${leagueId}`, setupData);
      
      // Get the default game data structure that includes all teams
      const defaultData = getDefaultGameData();
      
      // Setup playoff teams - empty template with seeds
      const playoffTeams = {
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
      };
      
      // Setup firstRoundEast structure
      const firstRoundEast = Array(4).fill().map((_, i) => {
        // Create matchups: 1v8, 2v7, 3v6, 4v5 for East conference
        const seedPairs = [[1, 8], [4, 5], [3, 6], [2, 7]];
        const [seed1, seed2] = seedPairs[i];
        
        return {
          team1: "",
          team1Seed: seed1,
          team2: "",
          team2Seed: seed2,
          winner: "",
          winnerSeed: null,
          gamesPlayed: 0,
          seriesLength: 0
        };
      });
      
      // Setup firstRoundWest structure
      const firstRoundWest = Array(4).fill().map((_, i) => {
        // Create matchups: 1v8, 2v7, 3v6, 4v5 for West conference
        const seedPairs = [[1, 8], [4, 5], [3, 6], [2, 7]];
        const [seed1, seed2] = seedPairs[i];
        
        return {
          team1: "",
          team1Seed: seed1,
          team2: "",
          team2Seed: seed2,
          winner: "",
          winnerSeed: null,
          gamesPlayed: 0,
          seriesLength: 0
        };
      });
      
    // Create the tournament data document with bracket structure
      const tournamentData = {
        allTeams: defaultData.allTeams, // Use teams from the default data
        playoffTeams: playoffTeams,
        
        // First round (using standardized key)
        [ROUND_KEYS.FIRST_ROUND]: [
          // East conference matchups (1v8, 4v5, 3v6, 2v7)
          ...firstRoundEast.map(matchup => ({
            ...matchup,
            conference: 'East'
          })),
          // West conference matchups (1v8, 4v5, 3v6, 2v7)
          ...firstRoundWest.map(matchup => ({
            ...matchup,
            conference: 'West'
          }))
        ],
        
        // Conference Semifinals (using standardized key)
        [ROUND_KEYS.CONF_SEMIS]: [
          // East matchups
          {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null,
            conference: "East",
            gamesPlayed: 0,
            seriesLength: 0
          },
          {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null,
            conference: "East",
            gamesPlayed: 0,
            seriesLength: 0
          },
          // West matchups
          {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null,
            conference: "West",
            gamesPlayed: 0,
            seriesLength: 0
          },
          {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null,
            conference: "West",
            gamesPlayed: 0,
            seriesLength: 0
          }
        ],
        
        // Conference Finals (using standardized key)
        [ROUND_KEYS.CONF_FINALS]: [
          {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null,
            conference: "East",
            gamesPlayed: 0,
            seriesLength: 0
          },
          {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null,
            conference: "West",
            gamesPlayed: 0,
            seriesLength: 0
          }
        ],
        
        // NBA Finals (using standardized key)
        [ROUND_KEYS.NBA_FINALS]: { 
          team1: "",
          team1Seed: null,
          team1Conference: "East",
          team2: "",
          team2Seed: null,
          team2Conference: "West",
          winner: "",
          winnerSeed: null,
          winnerConference: "",
          gamesPlayed: 0,
          seriesLength: 0,
          mvp: ""
        },
        
        // Championship data (using standardized keys)
        [ROUND_KEYS.CHAMPION]: '',
        'ChampionSeed': null,
        [ROUND_KEYS.FINALS_MVP]: '',
        
        // Initialize Play-In Tournament structure but disabled by default
        playInTournamentEnabled: false,
        playInComplete: false,
        
        seasonYear: setupData.seasonYear || new Date().getFullYear(),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      // 1. Update the main league document with metadata
      const leagueRef = doc(db, "leagues", leagueId);
      await updateDoc(leagueRef, {
        gameType: "nbaPlayoffs",
        lastUpdated: new Date().toISOString()
      });
      
      // 2. Create the gameData document in the correct subcollection location
      const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
      await setDoc(gameDataRef, tournamentData);
      
      // 3. Initialize default scoring settings using standardized keys
      const defaultScoring = {
        // Use the standardized point values from constants
        [ROUND_KEYS.FIRST_ROUND]: DEFAULT_POINT_VALUES[ROUND_KEYS.FIRST_ROUND],
        [ROUND_KEYS.CONF_SEMIS]: DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_SEMIS],
        [ROUND_KEYS.CONF_FINALS]: DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_FINALS],
        [ROUND_KEYS.NBA_FINALS]: DEFAULT_POINT_VALUES[ROUND_KEYS.NBA_FINALS],
        [ROUND_KEYS.FINALS_MVP]: DEFAULT_POINT_VALUES[ROUND_KEYS.FINALS_MVP],
        
        // Series length bonuses using standardized keys
        [SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.FIRST_ROUND],
        [SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_SEMIS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_SEMIS],
        [SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_FINALS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_FINALS],
        [SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.NBA_FINALS],
        
        // Upset bonus settings
        bonusPerSeedDifference: 0.5,
        bonusEnabled: false,
        
        // Series length settings
        seriesLength: 7,
        exactSeriesLengthEnabled: true,
        createdAt: new Date().toISOString()
      };
      
      // Save default scoring settings
      const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
      await setDoc(scoringRef, defaultScoring);
      
      // 4. Create an empty lock document with standardized keys
      const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
      await setDoc(locksRef, {
        [ROUND_KEYS.FIRST_ROUND]: { locked: false },
        [ROUND_KEYS.CONF_SEMIS]: { locked: false },
        [ROUND_KEYS.CONF_FINALS]: { locked: false },
        [ROUND_KEYS.NBA_FINALS]: { locked: false },
        'playIn': { locked: false } // Add Play-In lock status
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing NBA Playoffs league:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to initialize tournament data'
      };
    }
  }

  /**
   * Handle a user joining an NBA Playoffs league
   * @param {string} leagueId - ID of the league
   * @param {string} userId - ID of the user joining
   * @returns {Promise} Promise that resolves when join process is complete
   */
  async onUserJoin(leagueId, userId) {
    // For now, use the base implementation
    return super.onUserJoin(leagueId, userId);
  }

  /**
   * Get metadata for display in league listings
   * @param {Object} gameData - The league's game data
   * @returns {Object} Metadata for display
   */
  getMetadata(gameData) {
    let status = 'Not Started';
    let teams = 0;
    let champion = 'TBD';
    let finalsMVP = 'TBD';
    let playInEnabled = false;
    
    if (gameData) {
      // Check if Play-In Tournament is enabled
      playInEnabled = gameData.playInTournamentEnabled || false;
      
      // Count number of teams with names
      if (gameData.playoffTeams) {
        const conferences = ['eastConference', 'westConference'];
        let teamCount = 0;
        
        conferences.forEach(conference => {
          if (Array.isArray(gameData.playoffTeams[conference])) {
            teamCount += gameData.playoffTeams[conference].filter(team => team && team.teamId).length;
          }
        });
        
        teams = teamCount;
      }
      
      // Get current tournament status
      if (gameData.status === "completed") {
        status = 'Completed';
        champion = gameData[ROUND_KEYS.CHAMPION] || 'TBD';
        finalsMVP = gameData[ROUND_KEYS.FINALS_MVP] || 'TBD';
      } else if (gameData.status === "active") {
        status = 'In Progress';
      }
    }
    
    return {
      status,
      teams,
      champion,
      playInEnabled,
      customFields: [
        { label: 'Teams', value: teams > 0 ? `${teams}/16` : 'Not Set' },
        { label: 'Status', value: status },
        { label: 'Champion', value: champion },
        { label: 'Finals MVP', value: finalsMVP },
        { label: 'Play-In Tournament', value: playInEnabled ? 'Enabled' : 'Disabled' }
      ]
    };
  }

  /**
  * Calculate scores for a user bracket compared to official playoffs results
 * @param {Object} userBracket - User's bracket
 * @param {Object} playoffsResults - Official playoffs results
 * @param {Object} scoringSettings - Custom scoring settings
 * @returns {Object} Score information
 */
calculateScore(userBracket, playoffsResults, scoringSettings = null) {
  // Use the standardized keys from our constants
  const roundKeys = Object.values(ROUND_KEYS);
  
  // Use provided scoring settings or default point values from constants
  const roundPoints = {
    [ROUND_KEYS.FIRST_ROUND]: scoringSettings?.[ROUND_KEYS.FIRST_ROUND] ?? DEFAULT_POINT_VALUES[ROUND_KEYS.FIRST_ROUND],
    [ROUND_KEYS.CONF_SEMIS]: scoringSettings?.[ROUND_KEYS.CONF_SEMIS] ?? DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_SEMIS],
    [ROUND_KEYS.CONF_FINALS]: scoringSettings?.[ROUND_KEYS.CONF_FINALS] ?? DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_FINALS],
    [ROUND_KEYS.NBA_FINALS]: scoringSettings?.[ROUND_KEYS.NBA_FINALS] ?? DEFAULT_POINT_VALUES[ROUND_KEYS.NBA_FINALS],
    [ROUND_KEYS.FINALS_MVP]: scoringSettings?.[ROUND_KEYS.FINALS_MVP] ?? DEFAULT_POINT_VALUES[ROUND_KEYS.FINALS_MVP],
    [ROUND_KEYS.PLAY_IN]: scoringSettings?.[ROUND_KEYS.PLAY_IN] ?? DEFAULT_POINT_VALUES[ROUND_KEYS.PLAY_IN] ?? 1 // Add Play-In round
  };
  
  // Series length bonus points using standardized keys
  const seriesBonusPoints = {
    [ROUND_KEYS.FIRST_ROUND]: scoringSettings?.[SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]] ?? DEFAULT_SERIES_BONUS[ROUND_KEYS.FIRST_ROUND],
    [ROUND_KEYS.CONF_SEMIS]: scoringSettings?.[SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_SEMIS]] ?? DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_SEMIS],
    [ROUND_KEYS.CONF_FINALS]: scoringSettings?.[SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_FINALS]] ?? DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_FINALS],
    [ROUND_KEYS.NBA_FINALS]: scoringSettings?.[SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]] ?? DEFAULT_SERIES_BONUS[ROUND_KEYS.NBA_FINALS]
  };
  
  const bonusEnabled = scoringSettings?.bonusEnabled ?? false;
  const bonusPerSeedDifference = scoringSettings?.bonusPerSeedDifference ?? 0.5;
  const exactSeriesLengthEnabled = scoringSettings?.exactSeriesLengthEnabled ?? true;
  
  let points = 0;
  let correctPicks = 0;
  let bonusPoints = 0;
  let seriesLengthPoints = 0;
  let finalsMVPPoints = 0;
  let playInPoints = 0;
  let roundBreakdown = {};
  
  // Check each round
  for (const [round, pointValue] of Object.entries(roundPoints)) {
    roundBreakdown[round] = { 
      base: 0, 
      bonus: 0, 
      seriesLength: 0, 
      total: 0, 
      correct: 0, 
      possible: 0 
    };
    
    // Special handling for Play-In Tournament
    if (round === ROUND_KEYS.PLAY_IN && 
        playoffsResults[round] && userBracket[round] &&
        playoffsResults.playInTournamentEnabled) {
      
      // Calculate points for East conference Play-In games
      if (playoffsResults[round].east && userBracket[round].east) {
        const eastGames = [
          { official: playoffsResults[round].east.seventhEighthWinner, user: userBracket[round].east.seventhEighthWinner },
          { official: playoffsResults[round].east.ninthTenthWinner, user: userBracket[round].east.ninthTenthWinner },
          { official: playoffsResults[round].east.finalWinner, user: userBracket[round].east.finalWinner }
        ];
        
        eastGames.forEach(game => {
          if (game.official?.team && game.user?.team && game.official.team === game.user.team) {
            roundBreakdown[round].base += pointValue;
            roundBreakdown[round].correct += 1;
            roundBreakdown[round].total += pointValue;
            points += pointValue;
            playInPoints += pointValue;
            correctPicks += 1;
          }
          roundBreakdown[round].possible += pointValue;
        });
      }
      
      // Calculate points for West conference Play-In games
      if (playoffsResults[round].west && userBracket[round].west) {
        const westGames = [
          { official: playoffsResults[round].west.seventhEighthWinner, user: userBracket[round].west.seventhEighthWinner },
          { official: playoffsResults[round].west.ninthTenthWinner, user: userBracket[round].west.ninthTenthWinner },
          { official: playoffsResults[round].west.finalWinner, user: userBracket[round].west.finalWinner }
        ];
        
        westGames.forEach(game => {
          if (game.official?.team && game.user?.team && game.official.team === game.user.team) {
            roundBreakdown[round].base += pointValue;
            roundBreakdown[round].correct += 1;
            roundBreakdown[round].total += pointValue;
            points += pointValue;
            playInPoints += pointValue;
            correctPicks += 1;
          }
          roundBreakdown[round].possible += pointValue;
        });
      }
      
      // Skip the regular round processing for Play-In round
      continue;
    }
    
    if (playoffsResults[round] && userBracket[round]) {
      // Handle NBA Finals round (object)
      if (round === ROUND_KEYS.NBA_FINALS) {
        const officialWinner = playoffsResults[ROUND_KEYS.NBA_FINALS]?.winner;
        const officialWinnerSeed = playoffsResults[ROUND_KEYS.NBA_FINALS]?.winnerSeed;
        const officialSeriesLength = playoffsResults[ROUND_KEYS.NBA_FINALS]?.gamesPlayed;
        const userPick = userBracket[ROUND_KEYS.NBA_FINALS]?.winner;
        const userSeriesLength = userBracket[ROUND_KEYS.NBA_FINALS]?.gamesPlayed;
        
        roundBreakdown[round].possible = pointValue;
        
        // If official winner exists and matches user pick
        if (officialWinner && userPick && officialWinner === userPick) {
          const basePoints = pointValue;
          roundBreakdown[round].base = basePoints;
          roundBreakdown[round].correct = 1;
          
          points += basePoints;
          correctPicks += 1;
          
          // Add bonus points for upset (if enabled)
          if (bonusEnabled && officialWinnerSeed) {
            // For NBA, lower seed number is better (1 is better than 8)
            // So 8 seed beating 1 seed is an upset (reverse of NCAA seeding logic)
            const seedDifference = (9 - officialWinnerSeed) - (9 - 1); // Compare to 1 seed as favorite
            
            if (seedDifference > 0) {
              const roundBonus = seedDifference * bonusPerSeedDifference;
              bonusPoints += roundBonus;
              roundBreakdown[round].bonus = roundBonus;
            }
          }
          
          // Add bonus for exact series length prediction
          if (exactSeriesLengthEnabled && officialSeriesLength && userSeriesLength && 
              officialSeriesLength === userSeriesLength) {
            const seriesBonus = seriesBonusPoints[round];
            roundBreakdown[round].seriesLength = seriesBonus;
            seriesLengthPoints += seriesBonus;
          }
          
          // Calculate total for final round
          roundBreakdown[round].total = roundBreakdown[round].base + 
                                       roundBreakdown[round].bonus +
                                       roundBreakdown[round].seriesLength;
        }
      } 
      // Handle array rounds
      else if (Array.isArray(playoffsResults[round]) && Array.isArray(userBracket[round])) {
        // Check each matchup
        playoffsResults[round].forEach((officialMatchup, idx) => {
          const userMatchup = userBracket[round][idx];
          
          // Count total possible points for this round
          roundBreakdown[round].possible += pointValue;
          
          if (officialMatchup && userMatchup) {
            const officialWinner = officialMatchup.winner;
            const officialWinnerSeed = officialMatchup.winnerSeed;
            const officialSeriesLength = officialMatchup.gamesPlayed;
            const userPick = userMatchup.winner;
            const userSeriesLength = userMatchup.gamesPlayed;
            
            // Correct pick
            if (officialWinner && userPick && officialWinner === userPick) {
              const basePoints = pointValue;
              roundBreakdown[round].base += basePoints;
              roundBreakdown[round].correct += 1;
              
              points += basePoints;
              correctPicks += 1;
              
              // Add bonus points for upset (if enabled)
              if (bonusEnabled && officialWinnerSeed) {
                // For NBA, lower seed number is better (1 is better than 8)
                // So 8 seed beating 1 seed is an upset with difference of 7
                const seedDifference = (9 - officialWinnerSeed) - (9 - 1); // Compare to 1 seed as favorite
                
                if (seedDifference > 0) {
                  const matchupBonus = seedDifference * bonusPerSeedDifference;
                  bonusPoints += matchupBonus;
                  roundBreakdown[round].bonus += matchupBonus;
                }
              }
              
              // Add bonus for exact series length prediction
              if (exactSeriesLengthEnabled && officialSeriesLength && userSeriesLength && 
                  officialSeriesLength === userSeriesLength) {
                const seriesBonus = seriesBonusPoints[round];
                roundBreakdown[round].seriesLength += seriesBonus;
                seriesLengthPoints += seriesBonus;
              }
            }
          }
        });
        
        // Calculate total for the round
        roundBreakdown[round].total = roundBreakdown[round].base + 
                                     roundBreakdown[round].bonus +
                                     roundBreakdown[round].seriesLength;
      }
    }
  }
  
  // Check Finals MVP prediction using standardized key
  if (playoffsResults[ROUND_KEYS.FINALS_MVP] && userBracket[ROUND_KEYS.FINALS_MVP] && 
      playoffsResults[ROUND_KEYS.FINALS_MVP] === userBracket[ROUND_KEYS.FINALS_MVP]) {
    finalsMVPPoints = roundPoints[ROUND_KEYS.FINALS_MVP];
    
    // Add to breakdown
    if (!roundBreakdown.Other) {
      roundBreakdown.Other = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
    }
    roundBreakdown.Other.base += finalsMVPPoints;
    roundBreakdown.Other.total += finalsMVPPoints;
    roundBreakdown.Other.correct += 1;
    roundBreakdown.Other.possible += roundPoints[ROUND_KEYS.FINALS_MVP];
  } else if (playoffsResults[ROUND_KEYS.FINALS_MVP]) {
    // Finals MVP has been announced but user didn't get it right
    if (!roundBreakdown.Other) {
      roundBreakdown.Other = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
    }
    roundBreakdown.Other.possible += roundPoints[ROUND_KEYS.FINALS_MVP];
  }
  
  // Calculate total points from all sources
  const totalPoints = points + bonusPoints + seriesLengthPoints + finalsMVPPoints;
  
  return { 
    points: totalPoints, 
    basePoints: points, 
    bonusPoints: bonusPoints,
    seriesLengthPoints: seriesLengthPoints,
    finalsMVPPoints: finalsMVPPoints,
    playInPoints: playInPoints,
    correctPicks,
    roundBreakdown 
  };
}
  
  /**
   * Handle actions when a league is ended
   * @param {string} leagueId - The league ID
   * @param {Array} winners - Array of winner objects
   * @returns {Promise<boolean>} Success indicator
   */
  async onLeagueEnd(leagueId, winners) {
    try {
      // Any additional cleanup or processing specific to NBA Playoffs
      console.log(`NBA Playoffs league ${leagueId} ended with winners:`, winners);
      
      return true;
    } catch (error) {
      console.error("Error in onLeagueEnd:", error);
      throw error;
    }
  }
}

export default NBAPlayoffsModule;
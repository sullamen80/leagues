import React, { useEffect } from 'react';
import { FaBasketballBall } from 'react-icons/fa';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation } from 'react-router-dom';
import BaseGameModule, { useUrlParams, ParameterComponent, ParameterRouter } from '../common/BaseGameModule';

// Import components
import BracketDashboard from './components/BracketDashboard.js';
import BracketView from './components/BracketView';
import BracketEdit from './components/BracketEdit.js';
import AdminDashboard from './components/AdminDashboard';
import AdminSettings from './components/AdminSettings';
import AdminTeams from './components/AdminTeams.js';
import AdminScoringSettings from './components/AdminScoringSettings.js';
import AdminStats from './components/AdminStats';
import LeagueSetup from './components/LeagueSetup.js';
import LeagueSettings from './components/LeagueSettings';
import Leaderboard from './components/Leaderboard';
import Rules from './components/Rules';
import TournamentIcon from './components/TournamentIcon';

// Import services
import initializeLeagueGameData from './services/bracketService';

/**
 * Enhanced parameter-based router for March Madness
 */
const MarchMadnessRouter = (props) => {
  const location = useLocation();
  const params = useUrlParams();

  // Extract the view parameter to determine the active tab
  const view = params.view || 'edit'; // Default to 'edit' if no view is specified
  const subview = params.subview || '';
  const bracketId = params.bracketId;

  // Debug logging to trace the issue
  console.log("MarchMadnessRouter rendering with:", {
    view,
    subview,
    bracketId,
    rawSearch: location.search,
    allParams: params,
    props,
  });

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
    } else if (subview === 'stats') {
      // New route for AdminStats
      return (
        <AdminStats
          {...props}
          urlParams={params}
          leagueId={props.leagueId}
          isEmbedded={true}
          onComplete={(data) => {
            // Notification or redirect could happen here
            console.log("Stats updated successfully:", data);
          }}
          onNavigate={(destination) => {
            // Handle navigation within the module
            const baseUrl = props.baseUrl || `/league/${props.leagueId}`;
            let url;
            
            if (destination === 'leaderboard') {
              url = props.module.getLeaderboardUrl(baseUrl);
            } else if (destination.startsWith('admin/')) {
              url = props.module.getAdminUrl(baseUrl, destination.split('/')[1]);
            } else {
              url = props.module.generateParameterUrl(baseUrl, { view: destination });
            }
            
            props.navigate(url);
          }}
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

  // For all other views (view, edit, leaderboard), render BracketDashboard
  return (
    <BracketDashboard
      {...props}
      urlParams={params}
      activeTab={view} // Pass the view as the activeTab to control which tab is shown
    />
  );
};

/**
 * MarchMadnessModule - Implements the game type interface for NCAA March Madness tournament
 * Extends the BaseGameModule with basketball-specific functionality
 */
class MarchMadnessModule extends BaseGameModule {
  constructor() {
    super(); // Initialize base class
    
    // Override base properties with March Madness specific values
    this.id = 'marchMadness';
    this.name = 'March Madness';
    this.description = 'NCAA Basketball Tournament Bracket Challenge';
    this.icon = <FaBasketballBall />;
    this.color = '#FF7F00'; // Orange color for basketball
    this.rules = Rules;
    this.bracketIcon = TournamentIcon;
  }

  /**
   * Get routes for March Madness module
   * @param {string} baseUrl - Base URL for routes
   * @returns {Array} Array of route objects
   */
  getRoutes(baseUrl) {
    return [
      {
        path: `${baseUrl}`,
        // Return the component itself, not a JSX element
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
        path: `${baseUrl}/admin/stats`,
        element: AdminStats,
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
        element: MarchMadnessRouter
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
   * Generate URL for accessing admin stats
   * @param {string} baseUrl - Base URL
   * @returns {string} URL with parameters
   */
  getAdminStatsUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, {
      view: 'admin',
      subview: 'stats'
    });
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
   * Get setup component for creating a new March Madness league
   * @returns {React.Component} League setup component
   */
  getSetupComponent() {
    return LeagueSetup;
  }

  /**
   * Get settings component for managing a March Madness league
   * @returns {React.Component} League settings component
   */
  getSettingsComponent() {
    return LeagueSettings;
  }

  /**
   * Get the admin stats component
   * @returns {React.Component} Admin stats component
   */
  getAdminStatsComponent() {
    return AdminStats;
  }

  /**
   * Initialize a new league with March Madness data
   * @param {string} leagueId - ID of the new league
   * @param {Object} setupData - Data from the setup component
   * @returns {Promise} Promise that resolves when initialization is complete
   */
  async initializeLeague(leagueId, setupData = {}) {
    try {
      console.log(`Initializing March Madness league: ${leagueId}`, setupData);
      
      // Extract teams data from the setup data if available
      const teamsData = setupData.teamsData || null;
      
      // Call the service function with the teams data
      await initializeLeagueGameData(leagueId, teamsData);
      
      // Initialize default scoring settings
      const defaultScoring = {
        roundOf64: 1,
        roundOf32: 2,
        sweet16: 4,
        elite8: 8,
        finalFour: 16,
        championship: 32,
        bonusPerSeedDifference: 0.5,
        bonusEnabled: true,
        createdAt: new Date().toISOString()
      };
      
      // Save default scoring settings
      const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
      await setDoc(scoringRef, defaultScoring);
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing March Madness league:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to initialize tournament data'
      };
    }
  }

  /**
   * Handle a user joining a March Madness league
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
    
    if (gameData) {
      // Count number of teams with names
      if (gameData.SetTeams) {
        const regions = ['eastRegion', 'westRegion', 'midwestRegion', 'southRegion'];
        let teamCount = 0;
        
        regions.forEach(region => {
          if (Array.isArray(gameData.SetTeams[region])) {
            teamCount += gameData.SetTeams[region].filter(team => team && team.name).length;
          }
        });
        
        teams = teamCount;
      }
      
      // Get current tournament status
      if (gameData.Champion) {
        status = 'Completed';
        champion = gameData.Champion;
      } else if (gameData.RoundOf64 && gameData.RoundOf64.some(match => match && match.winner)) {
        status = 'In Progress';
      }
    }
    
    return {
      status,
      teams,
      champion,
      customFields: [
        { label: 'Teams', value: teams > 0 ? `${teams}/64` : 'Not Set' },
        { label: 'Status', value: status },
        { label: 'Champion', value: champion }
      ]
    };
  }

  /**
   * Calculate scores for a user bracket compared to official tournament results
   * @param {Object} userBracket - User's bracket
   * @param {Object} tournamentResults - Official tournament results
   * @param {Object} scoringSettings - Custom scoring settings
   * @returns {Object} Score information
   */
  calculateScore(userBracket, tournamentResults, scoringSettings = null) {
    // Use provided scoring settings or default point system
    const defaultPoints = {
      'RoundOf64': 1,
      'RoundOf32': 2,
      'Sweet16': 4,
      'Elite8': 8,
      'FinalFour': 16,
      'Championship': 32
    };
    
    // Map scoring settings fields to round names
    const roundPoints = {
      'RoundOf64': scoringSettings?.roundOf64 ?? defaultPoints.RoundOf64,
      'RoundOf32': scoringSettings?.roundOf32 ?? defaultPoints.RoundOf32,
      'Sweet16': scoringSettings?.sweet16 ?? defaultPoints.Sweet16,
      'Elite8': scoringSettings?.elite8 ?? defaultPoints.Elite8,
      'FinalFour': scoringSettings?.finalFour ?? defaultPoints.FinalFour,
      'Championship': scoringSettings?.championship ?? defaultPoints.Championship
    };
    
    const bonusEnabled = scoringSettings?.bonusEnabled ?? false;
    const bonusPerSeedDifference = scoringSettings?.bonusPerSeedDifference ?? 0.5;
    
    let points = 0;
    let correctPicks = 0;
    let bonusPoints = 0;
    let roundBreakdown = {};
    
    // Check each round
    Object.entries(roundPoints).forEach(([round, pointValue]) => {
      roundBreakdown[round] = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
      
      if (tournamentResults[round] && userBracket[round]) {
        // Handle Championship round (object)
        if (round === 'Championship') {
          const officialWinner = tournamentResults.Championship?.winner;
          const officialWinnerSeed = tournamentResults.Championship?.winnerSeed;
          const userPick = userBracket.Championship?.winner;
          
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
              // Championship is a special case - the higher seed number is considered
              // the underdog (e.g., a 16 seed beating a 1 seed is a big upset)
              const seedDifference = officialWinnerSeed - 1; // 1 seed is favorite
              
              if (seedDifference > 0) {
                const roundBonus = seedDifference * bonusPerSeedDifference;
                bonusPoints += roundBonus;
                roundBreakdown[round].bonus = roundBonus;
                roundBreakdown[round].total = basePoints + roundBonus;
              } else {
                roundBreakdown[round].total = basePoints;
              }
            } else {
              roundBreakdown[round].total = basePoints;
            }
          }
        } 
        // Handle array rounds
        else if (Array.isArray(tournamentResults[round]) && Array.isArray(userBracket[round])) {
          // Check each matchup
          tournamentResults[round].forEach((officialMatchup, idx) => {
            const userMatchup = userBracket[round][idx];
            
            // Count total possible points for this round
            roundBreakdown[round].possible += pointValue;
            
            if (officialMatchup && userMatchup) {
              const officialWinner = officialMatchup.winner;
              const officialWinnerSeed = officialMatchup.winnerSeed;
              const userPick = userMatchup.winner;
              
              // Correct pick
              if (officialWinner && userPick && officialWinner === userPick) {
                const basePoints = pointValue;
                roundBreakdown[round].base += basePoints;
                roundBreakdown[round].correct += 1;
                
                points += basePoints;
                correctPicks += 1;
                
                // Add bonus points for upset (if enabled)
                if (bonusEnabled && officialWinnerSeed) {
                  // For NCAA tournament, higher seed number is the underdog
                  // So 12 seed beating 5 seed is an upset with difference of 7
                  const seedDifference = officialWinnerSeed - 1; // Compare to 1 seed as favorite
                  
                  if (seedDifference > 0) {
                    const matchupBonus = seedDifference * bonusPerSeedDifference;
                    bonusPoints += matchupBonus;
                    roundBreakdown[round].bonus += matchupBonus;
                  }
                }
              }
            }
          });
          
          // Calculate total for the round
          roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
        }
      }
    });
    
    // Add bonus points to total
    const totalPoints = points + bonusPoints;
    
    return { 
      points: totalPoints, 
      basePoints: points, 
      bonusPoints: bonusPoints, 
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
      console.log(`March Madness league ${leagueId} ended with winners:`, winners);
      
      // Import the EndLeagueStats service
      const EndLeagueStats = require('./services/EndLeagueStatsService').default;
      
      // Create a stats collector instance
      const statsCollector = new EndLeagueStats(leagueId);
      
      // Generate and save end-of-tournament statistics
      const result = await statsCollector.captureStats(null, winners);
      
      if (!result || !result.success) {
        console.error("Error capturing stats:", result?.error || "Unknown error");
        throw new Error(result?.error || "Failed to capture end of league statistics");
      }
      
      console.log("Successfully captured end of league statistics");
      return true;
    } catch (error) {
      console.error("Error in onLeagueEnd:", error);
      throw error;
    }
  }
}

export default MarchMadnessModule;
// src/gameTypes/marchMadness/MarchMadnessModule.js
import React from 'react';
import { FaBasketballBall } from 'react-icons/fa';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

// Import components
import BracketDashboard from './components/BracketDashboard.js';
import BracketView from './components/BracketView';
import BracketEdit from './components/BracketEdit.js';
import AdminDashboard from './components/AdminDashboard';
import AdminSettings from './components/AdminSettings';
import LeagueSetup from './components/LeagueSetup.js';
import LeagueSettings from './components/LeagueSettings';
import Leaderboard from './components/Leaderboard';
import Rules from './components/Rules';
import TournamentIcon from './components/TournamentIcon';

// Import services
import initializeLeagueGameData from './services/bracketService';

/**
 * MarchMadnessModule - Implements the game type interface for NCAA March Madness tournament
 */
class MarchMadnessModule {
  constructor() {
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
        path: `${baseUrl}/leaderboard`,
        element: Leaderboard,
      }
    ];
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
    // Implementation to be filled in
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
   * @returns {Object} Score information
   */
  calculateScore(userBracket, tournamentResults) {
    // Points system:
    // Round of 64: 1pt, Round of 32: 2pts, Sweet 16: 4pts, 
    // Elite 8: 8pts, Final Four: 16pts, Championship: 32pts
    const roundPoints = {
      'RoundOf64': 1,
      'RoundOf32': 2,
      'Sweet16': 4,
      'Elite8': 8,
      'FinalFour': 16,
      'Championship': 32
    };
    
    let points = 0;
    let correctPicks = 0;
    
    // Check each round
    Object.entries(roundPoints).forEach(([round, pointValue]) => {
      if (tournamentResults[round] && userBracket[round]) {
        // Handle Championship round (object)
        if (round === 'Championship') {
          const officialWinner = tournamentResults.Championship?.winner;
          const userPick = userBracket.Championship?.winner;
          
          // If official winner exists and matches user pick
          if (officialWinner && userPick && officialWinner === userPick) {
            points += pointValue;
            correctPicks += 1;
          }
        } 
        // Handle array rounds
        else if (Array.isArray(tournamentResults[round]) && Array.isArray(userBracket[round])) {
          // Check each matchup
          tournamentResults[round].forEach((officialMatchup, idx) => {
            const userMatchup = userBracket[round][idx];
            
            if (officialMatchup && userMatchup) {
              const officialWinner = officialMatchup.winner;
              const userPick = userMatchup.winner;
              
              // Correct pick
              if (officialWinner && userPick && officialWinner === userPick) {
                points += pointValue;
                correctPicks += 1;
              }
            }
          });
        }
      }
    });
    
    return { points, correctPicks };
  }
  
  /**
   * Determine the winners of a March Madness league
   * @param {string} leagueId - The league ID
   * @returns {Promise<Array>} Array of winner objects
   */
  async determineLeagueWinners(leagueId) {
    try {
      // Get all user brackets
      const userBracketsRef = collection(db, "leagues", leagueId, "userData");
      const userBracketsSnap = await getDocs(userBracketsRef);
      
      if (userBracketsSnap.empty) {
        throw new Error("No user brackets found to determine winners");
      }
      
      // Get official tournament data
      const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (!tournamentSnap.exists()) {
        throw new Error("Tournament data not found");
      }
      
      const tournamentResults = tournamentSnap.data();
      
      // Calculate scores for each player
      const playerScores = [];
      
      for (const bracketDoc of userBracketsSnap.docs) {
        const userId = bracketDoc.id;
        const bracketData = bracketDoc.data();
        
        // Calculate score using the module's scoring system
        const score = this.calculateScore(bracketData, tournamentResults);
        
        // Get user info
        let userName = "Unknown User";
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            userName = userData.displayName || userData.username || userData.email || "Unknown User";
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
        
        playerScores.push({
          userId,
          userName,
          score: score.points
        });
      }
      
      // Sort players by score (highest first)
      playerScores.sort((a, b) => b.score - a.score);
      
      // Determine winner(s) - could be multiple in case of a tie
      const winningScore = playerScores[0]?.score || 0;
      const winners = playerScores.filter(player => player.score === winningScore);
      
      return winners;
    } catch (error) {
      console.error("Error determining league winners:", error);
      throw error;
    }
  }
  
  /**
   * Handle actions when a league is ended
   * @param {string} leagueId - The league ID
   * @param {Array} winners - Array of winner objects
   * @returns {Promise<boolean>} Success indicator
   */
  async onLeagueEnd(leagueId, winners) {
    try {
      // Any additional cleanup or processing specific to March Madness
      console.log(`March Madness league ${leagueId} ended with winners:`, winners);
      
      return true;
    } catch (error) {
      console.error("Error in onLeagueEnd:", error);
      throw error;
    }
  }
}

export default MarchMadnessModule;
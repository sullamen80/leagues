// src/gameTypes/common/BaseGameModule.js
import React from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * BaseGameModule - Base class for all game type modules
 * This provides a standard interface and shared functionality for all game types
 */
class BaseGameModule {
  constructor() {
    // Basic properties all game types should override
    this.id = 'base';
    this.name = 'Base Game';
    this.description = 'Base game type - extend this class';
    this.icon = null;
    this.color = '#666666'; // Default gray color
    this.rules = null;
  }

  /**
   * Get routes for this game type
   * @param {string} baseUrl - Base URL for routes
   * @returns {Array} Array of route objects
   */
  getRoutes(baseUrl) {
    // This should be overridden by each game type
    return [];
  }

  /**
   * Get setup component for creating a new league of this game type
   * @returns {React.Component} League setup component
   */
  getSetupComponent() {
    // This should be overridden by each game type
    return null;
  }

  /**
   * Get settings component for managing a league of this game type
   * @returns {React.Component} League settings component
   */
  getSettingsComponent() {
    // This should be overridden by each game type
    return null;
  }

  /**
   * Initialize a new league with game data
   * @param {string} leagueId - ID of the new league
   * @param {Object} setupData - Data from the setup component
   * @returns {Promise} Promise that resolves when initialization is complete
   */
  async initializeLeague(leagueId, setupData = {}) {
    try {
      console.log(`Initializing league: ${leagueId}`, setupData);
      
      // Base implementation just returns success
      // Specific game types should override this with their initialization logic
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing league:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to initialize game data'
      };
    }
  }

  /**
   * Handle a user joining a league
   * @param {string} leagueId - ID of the league
   * @param {string} userId - ID of the user joining
   * @returns {Promise} Promise that resolves when join process is complete
   */
  async onUserJoin(leagueId, userId) {
    // Base implementation does nothing
    // Game types can override this to handle user joining
    return { success: true };
  }

  /**
   * Get metadata for display in league listings
   * @param {Object} gameData - The league's game data
   * @returns {Object} Metadata for display
   */
  getMetadata(gameData) {
    // Base implementation returns minimal metadata
    // Game types should override this to provide relevant metadata
    return {
      status: 'Unknown',
      customFields: []
    };
  }

  /**
   * Calculate scores for a user entry compared to official results
   * @param {Object} userEntry - User's entry data
   * @param {Object} officialResults - Official results data
   * @param {Object} scoringSettings - Custom scoring settings
   * @returns {Object} Score information
   */
  calculateScore(userEntry, officialResults, scoringSettings = null) {
    // Base implementation returns a zero score
    // Game types should override this with their specific scoring logic
    return { 
      points: 0, 
      basePoints: 0, 
      bonusPoints: 0, 
      correctPicks: 0,
      roundBreakdown: {} 
    };
  }
  
  /**
   * Determine the winners of a league
   * @param {string} leagueId - The league ID
   * @returns {Promise<Array>} Array of winner objects
   */
  async determineLeagueWinners(leagueId) {
    try {
      // Get all user entries
      const userEntriesRef = collection(db, "leagues", leagueId, "userData");
      const userEntriesSnap = await getDocs(userEntriesRef);
      
      if (userEntriesSnap.empty) {
        throw new Error("No user entries found to determine winners");
      }
      
      // Get official results data
      const resultsRef = doc(db, "leagues", leagueId, "gameData", "current");
      const resultsSnap = await getDoc(resultsRef);
      
      if (!resultsSnap.exists()) {
        throw new Error("Official results data not found");
      }
      
      const officialResults = resultsSnap.data();
      
      // Get custom scoring settings if they exist
      let scoringSettings = null;
      try {
        const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
        const scoringSnap = await getDoc(scoringRef);
        
        if (scoringSnap.exists()) {
          scoringSettings = scoringSnap.data();
        }
      } catch (err) {
        console.warn("Could not load custom scoring settings, using defaults", err);
      }
      
      // Calculate scores for each player
      const playerScores = [];
      
      for (const entryDoc of userEntriesSnap.docs) {
        const userId = entryDoc.id;
        const entryData = entryDoc.data();
        
        // Calculate score using the game type's scoring system with custom settings
        const scoreResult = this.calculateScore(entryData, officialResults, scoringSettings);
        
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
          score: scoreResult.points
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
      // Base implementation just logs the winners
      console.log(`League ${leagueId} ended with winners:`, winners);
      
      return true;
    } catch (error) {
      console.error("Error in onLeagueEnd:", error);
      throw error;
    }
  }
  
  /**
   * Get user-friendly name for this game type
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.name;
  }
  
  /**
   * Get a renderer for this game type's icon
   * @param {Object} props - Props to pass to the icon component
   * @returns {React.Element} Icon element
   */
  renderIcon(props = {}) {
    return this.icon ? React.cloneElement(this.icon, props) : null;
  }
}

export default BaseGameModule;
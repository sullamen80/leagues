// src/gameTypes/common/services/BaseEndLeagueStatsService.js
import { doc, getDoc, collection, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';

/**
 * Debug helper to log progress and inspect objects
 */
class DebugLogger {
  constructor(enabled = true, prefix = "EndLeagueStats") {
    this.enabled = enabled;
    this.prefix = prefix;
    this.logs = [];
  }

  log(message, data = null) {
    const logEntry = {
      timestamp: new Date(),
      message: message
    };
    
    if (data) {
      try {
        // Try to stringify the data, but handle circular references
        const seen = new WeakSet();
        logEntry.data = JSON.stringify(data, (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        }, 2);
      } catch (err) {
        logEntry.data = "[Data could not be stringified]";
      }
    }
    
    this.logs.push(logEntry);
    
    if (this.enabled) {
      if (data) {
        console.log(`[${this.prefix}] ${message}`, data);
      } else {
        console.log(`[${this.prefix}] ${message}`);
      }
    }
  }

  error(message, error) {
    const logEntry = {
      timestamp: new Date(),
      message: message,
      error: error.message,
      stack: error.stack
    };
    
    this.logs.push(logEntry);
    
    if (this.enabled) {
      console.error(`[${this.prefix}] ERROR: ${message}`, error);
    }
  }

  getLogs() {
    return this.logs;
  }
}

/**
 * Base class for ending leagues and collecting stats
 * This can be extended by game-specific implementations
 */
class BaseEndLeagueStats {
  /**
   * Initialize the stats collector
   * @param {string} leagueId - The league ID
   * @param {string} gameTypeId - The game type ID (e.g., "nbaPlayoffs", "nfl", "mlb")
   */
  constructor(leagueId, gameTypeId) {
    this.leagueId = leagueId;
    this.gameTypeId = gameTypeId;
    this.gameData = null;
    this.userScores = null;
    this.settings = null;
    
    // Root document reference
    this.rootDocRef = doc(db, "gameStats", "root");
    
    // Only two collection references
    this.leaguesCollRef = collection(this.rootDocRef, "leagues");
    this.userStatsCollRef = collection(this.rootDocRef, "userStats");
    
    this.debug = new DebugLogger(true, `EndLeagueStats-${gameTypeId}`);
    this.debug.log(`Initialized ${gameTypeId} EndLeagueStats for league ${leagueId}`);
  }

  /**
   * Capture and store stats when ending a league
   * @param {Object} gameData - The official game data
   * @param {Array} winners - The league winners (optional)
   * @param {Object} previewData - Preprocessed preview data with calculated stats (optional)
   * @returns {Promise<Object>} - Stats information
   */
  async captureStats(gameData, winners = null, previewData = null) {
    try {
      this.debug.log("Starting captureStats", { 
        leagueId: this.leagueId, 
        hasGameData: !!gameData,
        hasWinners: Array.isArray(winners) && winners.length > 0,
        hasPreviewData: !!previewData
      });
      
      if (!gameData) {
        // If gameData isn't provided, fetch it from Firestore directly
        this.debug.log("Game data not provided, fetching from Firestore");
        const gameDataRef = doc(db, "leagues", this.leagueId, "gameData", "current");
        const gameDataSnap = await getDoc(gameDataRef);
        
        if (!gameDataSnap.exists()) {
          throw new Error("Game data not found in Firestore");
        }
        
        this.gameData = gameDataSnap.data();
        this.debug.log("Game data fetched successfully", { gameDataKeys: Object.keys(this.gameData) });
      } else {
        this.gameData = gameData;
        this.debug.log("Using provided game data");
      }

      // If preview data is provided, use those calculated scores directly
      if (previewData) {
        this.debug.log("Using provided preview data");
        // Set scores and settings from preview data
        this.userScores = previewData.playerScores;
        this.settings = previewData.scoringSettings;
        
        // Store additional preview calculated data to include in stats
        this.previewData = previewData;
      } else {
        // Otherwise calculate scores from scratch
        this.debug.log("Getting scoring settings");
        await this.getScoringSettings();
        this.debug.log("Scoring settings loaded", { 
          settingsFound: !!this.settings,
          settingsKeys: this.settings ? Object.keys(this.settings) : []
        });

        // Calculate user scores
        this.debug.log("Calculating user scores");
        await this.calculateScores();
        this.debug.log(`Calculated scores for ${this.userScores?.length || 0} users`);
      }

      // Ensure gameStats collections exist
      this.debug.log("Ensuring collection structure exists");
      const collectionsExist = await this.ensureCollectionsExist();
      this.debug.log(`Collections existence check: ${collectionsExist ? 'Success' : 'Failed'}`);

      // Prepare and store the stats
      this.debug.log("Preparing and storing league stats");
      const statsDoc = await this.prepareAndStoreStats(winners);
      this.debug.log(`Stored league stats with ID: ${statsDoc.id}`);
      
      // Store individual user stats (now also handles aggregation)
      this.debug.log("Storing and aggregating user stats");
      await this.storeUserStats();
      this.debug.log("User stats stored and aggregated successfully");

      return {
        success: true,
        statsId: statsDoc.id,
        stats: statsDoc.data,
        debugInfo: this.debug.getLogs()
      };
    } catch (error) {
      this.debug.error("Error capturing stats", error);
      console.error("Error capturing stats:", error);
      return {
        success: false,
        error: error.message,
        debugInfo: this.debug.getLogs()
      };
    }
  }

  /**
   * Get scoring settings for the league
   * This should be implemented by game-specific classes
   */
  async getScoringSettings() {
    try {
      const settingsRef = doc(db, "leagues", this.leagueId, "settings", "scoring");
      this.debug.log(`Getting scoring settings from ${settingsRef.path}`);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        this.settings = settingsSnap.data();
        this.debug.log("Scoring settings found", this.settings);
      } else {
        this.settings = null;
        this.debug.log("No scoring settings found, using defaults");
      }
    } catch (err) {
      this.debug.error("Error getting scoring settings", err);
      console.error("Error getting scoring settings:", err);
      this.settings = null;
    }
  }

  /**
   * Calculate scores for all users
   * This should be implemented by game-specific classes
   */
  async calculateScores() {
    throw new Error("calculateScores must be implemented by game-specific classes");
  }

  /**
   * Generate a preview of stats without saving to database
   * This should be implemented by game-specific classes
   */
  async generateStatsPreview(gameData) {
    throw new Error("generateStatsPreview must be implemented by game-specific classes");
  }

  /**
   * Ensure that required collections exist in Firestore
   */
  async ensureCollectionsExist() {
    try {
      this.debug.log("Ensuring collections exist");
      
      // Make sure the root document exists
      await setDoc(this.rootDocRef, {
        _metadata: {
          created: new Date(),
          description: "Root document for gameStats collections",
          lastUpdated: new Date()
        }
      }, { merge: true });
      
      // Create subcollections with temporary documents if needed
      const collections = ["leagues", "userStats"];
      const batch = writeBatch(db);
      let needsCommit = false;
      
      for (const collName of collections) {
        const collRef = collection(this.rootDocRef, collName);
        const snapshot = await getDocs(collRef);
        
        if (snapshot.empty) {
          const tempDocRef = doc(collRef, `temp-${Date.now()}`);
          batch.set(tempDocRef, {
            _metadata: {
              collectionCreated: new Date(),
              description: `Auto-created ${collName} collection for game statistics`,
              isTemporary: true
            }
          });
          needsCommit = true;
        }
      }
      
      if (needsCommit) {
        await batch.commit();
      }
      
      return true;
    } catch (err) {
      this.debug.error("Error ensuring collections exist", err);
      return false;
    }
  }

  /**
   * Prepare and store the league stats
   * This should be implemented by game-specific classes
   */
  async prepareAndStoreStats(winners) {
    throw new Error("prepareAndStoreStats must be implemented by game-specific classes");
  }

  /**
   * Store individual user stats and handle aggregation
   * This is a common implementation that preserves multiple game types
   */
  async storeUserStats() {
    this.debug.log(`Updating stats for ${this.userScores.length} users`);
    
    // Create a batch for Firestore operations
    let batch = writeBatch(db);
    let count = 0;
    
    // Get current season ID
    const currentYear = new Date().getFullYear();
    const seasonId = `${currentYear-1}-${currentYear}`;
    
    // Check if current league is completed
    const isCurrentLeagueCompleted = this.isLeagueCompleted();
    
    this.debug.log(`League completion status: ${isCurrentLeagueCompleted ? 'Completed' : 'Not Completed'}`);
    
    // Process each user's stats
    for (const user of this.userScores) {
      try {
        // Use userId as the document ID in userStats collection
        const userStatsRef = doc(this.userStatsCollRef, user.userId);
        const userStatsSnap = await getDoc(userStatsRef);
        
        // Calculate user's rank
        const userRank = this.userScores.findIndex(u => u.userId === user.userId) + 1;
        
        // Prepare common league summary fields
        const leagueSummary = {
          leagueId: this.leagueId,
          seasonId,
          timestamp: new Date(),
          gameTypeId: this.gameTypeId,
          rank: userRank,
          score: user.score || 0,
          correctPicks: user.correctPicks || 0,
          totalPossible: user.totalPossible || 0,
          percentage: user.correctPickPercentage || 0,
          // Additional fields may be added by game-specific implementations
          ...this.getGameSpecificUserStats(user)
        };
        
        if (userStatsSnap.exists()) {
          // Update existing user stats document
          const userData = userStatsSnap.data();
          
          // Get existing leagues or initialize empty array
          const leagues = userData.leagues || [];
          
          // Check if this league already exists in the user's data
          const existingLeagueIndex = leagues.findIndex(l => l.leagueId === this.leagueId);
          
          if (existingLeagueIndex >= 0) {
            // Update existing league entry
            leagues[existingLeagueIndex] = leagueSummary;
          } else {
            // Add new league entry
            leagues.push(leagueSummary);
          }
          
          // Calculate aggregate statistics
          const totalLeagues = leagues.length;
          
          // Count only completed leagues for wins
          let totalWins = leagues.filter(l => 
            l.rank === 1 && (l.leagueId !== this.leagueId || isCurrentLeagueCompleted)
          ).length;
          
          let totalSecondPlace = leagues.filter(l => 
            l.rank === 2 && (l.leagueId !== this.leagueId || isCurrentLeagueCompleted)
          ).length;
          
          // Calculate other aggregate statistics
          const bestScore = Math.max(...leagues.map(l => l.score || 0), 0);
          const totalScore = leagues.reduce((sum, l) => sum + (l.score || 0), 0);
          const averageScore = totalLeagues > 0 ? totalScore / totalLeagues : 0;
          
          // Calculate game-type specific stats
          // Filter leagues by this game type
          const gameTypeLeagues = leagues.filter(l => l.gameTypeId === this.gameTypeId);
          const gameTypeStats = {
            leagues: gameTypeLeagues.length,
            wins: gameTypeLeagues.filter(l => 
              l.rank === 1 && (l.leagueId !== this.leagueId || isCurrentLeagueCompleted)
            ).length,
            bestScore: gameTypeLeagues.length > 0 ? 
              Math.max(...gameTypeLeagues.map(l => l.score || 0), 0) : 0,
            totalScore: gameTypeLeagues.reduce((sum, l) => sum + (l.score || 0), 0),
            averageScore: gameTypeLeagues.length > 0 ? 
              gameTypeLeagues.reduce((sum, l) => sum + (l.score || 0), 0) / gameTypeLeagues.length : 0
          };
          
          // Calculate season year stats
          const bySeasonYear = userData.bySeasonYear || {};
          leagues.forEach(league => {
            if (!bySeasonYear[league.seasonId]) {
              bySeasonYear[league.seasonId] = { leagues: 0, wins: 0 };
            }
            
            // Ensure this league is only counted once
            if (!bySeasonYear[league.seasonId][league.leagueId]) {
              bySeasonYear[league.seasonId].leagues++;
              bySeasonYear[league.seasonId][league.leagueId] = true;
              
              // Count wins only for completed leagues or if not the current league
              if (league.rank === 1 && (league.leagueId !== this.leagueId || isCurrentLeagueCompleted)) {
                bySeasonYear[league.seasonId].wins++;
              }
            }
          });
          
          // Get existing byGameType or initialize empty object
          const existingByGameType = userData.byGameType || {};
          
          // Update user stats document
          const updateData = {
            userName: user.userName,
            lastUpdated: new Date(),
            leagues,
            stats: {
              // ONLY include truly universal metrics in cross-game aggregation:
              // - Counts of leagues participated in
              // - Counts of wins and placements
              totalLeagues,
              totalWins,
              totalSecondPlace
              // No score-based metrics or game-specific metrics like picks/accuracy
            },
            bySeasonYear,
            // Preserve existing game types and update only the current one
            byGameType: {
              ...existingByGameType,
              [this.gameTypeId]: gameTypeStats
            }
          };
          
          // Add any game-specific stats from subclasses
          const gameSpecificStats = this.getGameSpecificUserDocStats(user, leagues);
          if (gameSpecificStats) {
            Object.assign(updateData, gameSpecificStats);
          }
          
          batch.update(userStatsRef, updateData);
        } else {
          // Create new user stats document
          const newUserStatsData = {
            userId: user.userId,
            userName: user.userName,
            lastUpdated: new Date(),
            leagues: [leagueSummary],
            stats: {
              // ONLY include truly universal metrics in cross-game aggregation
              totalLeagues: 1,
              totalWins: isCurrentLeagueCompleted && userRank === 1 ? 1 : 0,
              totalSecondPlace: isCurrentLeagueCompleted && userRank === 2 ? 1 : 0
              // No score-based or game-specific metrics like picks/accuracy
            },
            byGameType: {
              [this.gameTypeId]: {
                leagues: 1,
                wins: isCurrentLeagueCompleted && userRank === 1 ? 1 : 0,
                bestScore: user.score || 0,
                totalScore: user.score || 0,
                averageScore: user.score || 0
              }
            },
            bySeasonYear: {
              [seasonId]: {
                leagues: 1,
                wins: isCurrentLeagueCompleted && userRank === 1 ? 1 : 0,
                [this.leagueId]: true
              }
            },
            _metadata: {
              isTemporary: false,
              createdAt: new Date(),
              dataType: "userStats",
              version: "1.1"
            }
          };
          
          // Add any game-specific stats from subclasses
          const gameSpecificStats = this.getGameSpecificUserDocStats(user, [leagueSummary]);
          if (gameSpecificStats) {
            Object.assign(newUserStatsData, gameSpecificStats);
          }
          
          batch.set(userStatsRef, newUserStatsData);
        }
        
        count++;
        
        // Commit batch in chunks to avoid Firestore limits
        if (count >= 400) {
          this.debug.log(`Committing batch of ${count} user stats`);
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      } catch (err) {
        this.debug.error(`Error updating stats for user ${user.userId}`, err);
      }
    }
    
    // Commit any remaining operations
    if (count > 0) {
      try {
        this.debug.log(`Committing final batch of ${count} user stats`);
        await batch.commit();
      } catch (err) {
        this.debug.error("Error committing final batch", err);
        throw err;
      }
    }
    
    this.debug.log("Successfully stored and aggregated all user stats");
  }

  /**
   * Get game-specific user stats for a league entry
   * This can be overridden by game-specific implementations
   * @param {Object} user - User score data
   * @returns {Object} - Game-specific stats
   */
  getGameSpecificUserStats(user) {
    // Base implementation returns empty object
    // This should be overridden by game-specific implementations
    return {};
  }

  /**
   * Get game-specific user document stats
   * This can be overridden by game-specific implementations
   * @param {Object} user - User score data
   * @param {Array} leagues - All user leagues
   * @returns {Object} - Game-specific document stats
   */
  getGameSpecificUserDocStats(user, leagues) {
    // Base implementation returns empty object
    // This should be overridden by game-specific implementations
    return null;
  }

  /**
   * Check if the league is completed
   * This should be implemented by game-specific classes
   */
  isLeagueCompleted() {
    // Base implementation, subclasses should override this
    return false;
  }
}

export default BaseEndLeagueStats;
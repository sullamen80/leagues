// src/gameTypes/nbaPlayoffs/services/EndLeagueStats.js
import BaseEndLeagueStats from '../../common/services/BaseEndLeagueStatsService';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  calculateUserScore, 
  getUIPointValues, 
  countCorrectSeries
} from './scoringService';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

/**
 * NBA Playoffs specific implementation of EndLeagueStats
 */
class EndLeagueStats extends BaseEndLeagueStats {
  /**
   * Initialize the NBA Playoffs stats collector
   * @param {string} leagueId - The league ID
   */
  constructor(leagueId) {
    super(leagueId, "nbaPlayoffs");
  }

  /**
   * Calculate scores for all users
   */
  async calculateScores() {
    try {
      this.debug.log("Getting user brackets");
      const userBracketsRef = collection(db, "leagues", this.leagueId, "userData");
      const userBracketsSnap = await getDocs(userBracketsRef);
      
      if (userBracketsSnap.empty) {
        this.debug.log("No user brackets found");
        this.userScores = [];
        return;
      }
      
      this.debug.log(`Found ${userBracketsSnap.size} user brackets`);
      
      // Calculate total possible picks for percentage calculations
      const totalPossiblePicks = this.getTotalPossiblePicks();
      this.debug.log(`Total possible picks: ${totalPossiblePicks}`);
      
      // Process each user's bracket
      const scores = [];
      
      for (const bracketDoc of userBracketsSnap.docs) {
        try {
          const userId = bracketDoc.id;
          const bracketData = bracketDoc.data();
          
          // Get user name
          let userName = "Unknown User";
          let photoURL = null;
          try {
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName = userData.displayName || userData.username || userData.email || "Unknown User";
              photoURL = userData.photoURL;
            }
          } catch (userErr) {
            this.debug.error(`Error fetching user data for ${userId}`, userErr);
          }
          
          // Calculate score using scoring service
          const scoreData = calculateUserScore(bracketData, this.gameData, this.settings);
          const correctSeries = countCorrectSeries(bracketData, this.gameData);
          
          // Calculate the player's individual pick accuracy percentage
          const correctPickPercentage = totalPossiblePicks > 0 ? 
            scoreData.correctPicks / totalPossiblePicks : 0;
            
          scores.push({
            userId,
            userName,
            userPhoto: photoURL,
            score: scoreData.points,
            basePoints: scoreData.basePoints,
            seriesLengthPoints: scoreData.seriesLengthPoints,
            upsetPoints: scoreData.upsetPoints,
            finalsMVPPoints: scoreData.finalsMVPPoints,
            correctPicks: scoreData.correctPicks,
            correctSeries,
            correctPickPercentage, // Add individual percentage
            totalPossible: totalPossiblePicks,
            possiblePoints: scoreData.possiblePoints,
            maxPossible: scoreData.maxPossible,
            championPick: bracketData[ROUND_KEYS.NBA_FINALS]?.winner || "None Selected",
            championCorrect: bracketData[ROUND_KEYS.NBA_FINALS]?.winner === this.gameData[ROUND_KEYS.NBA_FINALS]?.winner,
            finalsMVPPick: bracketData[ROUND_KEYS.FINALS_MVP] || "None Selected",
            finalsMVPCorrect: bracketData[ROUND_KEYS.FINALS_MVP] === this.gameData[ROUND_KEYS.FINALS_MVP],
            roundBreakdown: scoreData.roundBreakdown
          });
        } catch (err) {
          this.debug.error(`Error processing bracket for user ${bracketDoc.id}`, err);
        }
      }
      
      // Sort by score (descending)
      scores.sort((a, b) => b.score - a.score);
      this.userScores = scores;
      
      this.debug.log(`Processed ${scores.length} user scores`);
    } catch (error) {
      this.debug.error("Error calculating user scores", error);
      throw error;
    }
  }

  /**
   * Add game-specific stats to a user's league summary
   * @param {Object} user - User score data
   * @returns {Object} - NBA Playoffs specific stats
   */
  getGameSpecificUserStats(user) {
    return {
      championPick: user.championPick || null,
      championCorrect: user.championCorrect || false,
      finalsMVPPick: user.finalsMVPPick || null,
      finalsMVPCorrect: user.finalsMVPCorrect || false,
      roundAccuracy: this.getRoundAccuracy(user)
    };
  }

  /**
   * Get round accuracy percentages for a user
   * @param {Object} user - User score data
   * @returns {Object} - Round accuracy data
   */
  getRoundAccuracy(user) {
    const roundAccuracy = {};
    if (user.roundBreakdown) {
      Object.entries(user.roundBreakdown).forEach(([round, data]) => {
        if (round !== ROUND_KEYS.FINALS_MVP) {  // Skip Finals MVP as it's a single pick
          const possiblePicks = this.getRoundPossiblePicks(round);
          if (possiblePicks > 0) {
            roundAccuracy[round] = {
              correctPicks: data.correctPicks || 0,
              possiblePicks: possiblePicks,
              percentage: (data.correctPicks || 0) / possiblePicks
            };
          }
        }
      });
    }
    return roundAccuracy;
  }

  /**
   * Prepare and store the league stats with NBA Playoffs specific data
   * @param {Array} winners - League winners array (optional) 
   * @returns {Object} - Stats document
   */
  async prepareAndStoreStats(winners) {
    // Use a direct reference to the league document by leagueId
    const statsRef = doc(this.leaguesCollRef, this.leagueId);
    
    this.debug.log(`Preparing league stats for league ID: ${this.leagueId}`);
    
    // Get the current season (e.g., "2023-2024")
    const currentYear = new Date().getFullYear();
    const seasonId = `${currentYear-1}-${currentYear}`;
    
    // Prepare the top winners (use passed winners or top 3 from scores)
    const topWinners = winners || this.userScores.slice(0, 3).map((user, index) => ({
      userId: user.userId,
      userName: user.userName,
      score: user.score,
      rank: index + 1
    }));
    
    this.debug.log(`Top winners prepared: ${topWinners.length}`);
  
    // Calculate basic stats
    const avgScore = this.userScores.reduce((sum, user) => sum + user.score, 0) / this.userScores.length;
    const highestScore = this.userScores[0]?.score || 0;
    const lowestScore = this.userScores[this.userScores.length - 1]?.score || 0;
    const medianScore = this.userScores[Math.floor(this.userScores.length / 2)]?.score || 0;
    
    // Calculate overall pick percentage
    const overallPickPercentage = this.calculateAverageCorrectPickPercentage();
    
    // Calculate round-by-round accuracy percentages
    const roundStats = {};
    const rounds = Object.values(ROUND_KEYS).filter(key => 
      key !== ROUND_KEYS.CHAMPION && 
      key !== ROUND_KEYS.FINALS_MVP
    );
    
    rounds.forEach(round => {
      let totalCorrectPicks = 0;
      let totalPossiblePicks = 0;
      
      if (round === ROUND_KEYS.PLAY_IN) {
        // Special handling for Play-In Tournament
        const playInPicks = this.getRoundPossiblePicks(round);
        totalPossiblePicks = playInPicks * this.userScores.length;
        
        // Sum all user correct picks for this round
        this.userScores.forEach(user => {
          if (user.roundBreakdown && user.roundBreakdown[round]) {
            totalCorrectPicks += user.roundBreakdown[round].correctPicks || 0;
          }
        });
      } else {
        // Regular round handling
        const roundPicks = this.getRoundPossiblePicks(round);
        totalPossiblePicks = roundPicks * this.userScores.length;
        
        // Sum all user correct picks for this round
        this.userScores.forEach(user => {
          if (user.roundBreakdown && user.roundBreakdown[round]) {
            totalCorrectPicks += user.roundBreakdown[round].correctPicks || 0;
          }
        });
      }
      
      // Store round stats
      roundStats[round] = {
        correctPicks: totalCorrectPicks,
        possiblePicks: totalPossiblePicks,
        percentage: totalPossiblePicks > 0 ? totalCorrectPicks / totalPossiblePicks : 0
      };
    });
    
    // Create enhanced player data with all UI-needed info
    const players = this.userScores.map((user, index) => {
      // Calculate correctPickPercentage if not already calculated
      const totalPossiblePicks = this.getTotalPossiblePicks();
      const correctPickPercentage = user.correctPickPercentage || 
        (totalPossiblePicks > 0 ? user.correctPicks / totalPossiblePicks : 0);
        
      return {
        userId: user.userId,
        userName: user.userName,
        rank: index + 1,
        score: user.score,
        correctPicks: user.correctPicks,
        totalPossible: totalPossiblePicks,
        percentage: correctPickPercentage,
        // Include these additional fields for the UI
        championPick: user.championPick || null,
        championCorrect: user.championCorrect || false,
        finalsMVPPick: user.finalsMVPPick || null,
        finalsMVPCorrect: user.finalsMVPCorrect || false,
        // Include point breakdowns
        basePoints: user.basePoints || 0,
        seriesLengthPoints: user.seriesLengthPoints || 0,
        upsetPoints: user.upsetPoints || 0,
        finalsMVPPoints: user.finalsMVPPoints || 0,
        // Include round breakdown for detailed stats view
        roundBreakdown: user.roundBreakdown || {}
      };
    });
    
    // Prepare full stats document
    const statsData = {
      // Common stats fields
      leagueId: this.leagueId,
      gameTypeId: this.gameTypeId,
      timestamp: new Date(),
      seasonId,
      playerCount: this.userScores.length,
      winners: topWinners,
      
      // Include enhanced player data
      players,
      
      // For backwards compatibility, keep the existing stats structure
      stats: {
        averageScore: avgScore,
        highestScore,
        lowestScore,
        medianScore,
        correctPickPercentage: overallPickPercentage,
        // For backwards compatibility
        playerPercentages: players.map(player => ({
          userId: player.userId,
          userName: player.userName,
          correctPicks: player.correctPicks,
          totalPossible: player.totalPossible,
          percentage: player.percentage,
          championPick: player.championPick,
          championCorrect: player.championCorrect
        }))
      },
      
      // Round stats
      roundStats,
      
      // NBA Playoffs specific stats
      nbaPlayoffsStats: {
        champion: this.gameData[ROUND_KEYS.CHAMPION] || this.gameData[ROUND_KEYS.NBA_FINALS]?.winner || null,
        finalsMVP: this.gameData[ROUND_KEYS.FINALS_MVP] || null,
        hasPlayInTournament: !!this.gameData.playInTournamentEnabled
      },
      
      // Add metadata to distinguish from temporary documents
      _metadata: {
        isTemporary: false,
        createdAt: new Date(),
        dataType: "leagueStats",
        version: "1.1" // Bump version to indicate enhanced structure
      }
    };
  
    // Include additional data from preview if available
    if (this.previewData) {
      // Include round stats
      if (this.previewData.roundStats) {
        statsData.enhancedRoundStats = this.previewData.roundStats;
      }
      
      // Include cumulative stats
      if (this.previewData.cumulativeStats) {
        statsData.cumulativeStats = this.previewData.cumulativeStats;
      }
      
      // Include MVP stats
      if (this.previewData.mvpStats) {
        statsData.mvpStats = this.previewData.mvpStats;
      }
      
      // Include point distribution
      if (this.previewData.pointDistribution) {
        statsData.pointDistribution = this.previewData.pointDistribution;
      }
    }
  
    // Store the stats document
    this.debug.log("Storing league stats document", { path: statsRef.path });
    try {
      await setDoc(statsRef, statsData);
      this.debug.log("Successfully stored league stats");
    } catch (error) {
      this.debug.error("Error storing league stats", error);
      throw error;
    }
  
    return {
      id: statsRef.id,
      data: statsData
    };
  }

  /**
   * Calculate the average correct pick percentage across all users
   */
  calculateAverageCorrectPickPercentage() {
    if (!this.userScores || this.userScores.length === 0) return 0;
    
    const totalCorrectPicks = this.userScores.reduce((sum, user) => sum + user.correctPicks, 0);
    const totalPossiblePicks = this.getTotalPossiblePicks() * this.userScores.length;
    
    if (totalPossiblePicks === 0) return 0;
    
    return totalCorrectPicks / totalPossiblePicks;
  }

  /**
   * Check if the league is completed
   */
  isLeagueCompleted() {
    return !!(this.gameData[ROUND_KEYS.CHAMPION] || 
             (this.gameData[ROUND_KEYS.NBA_FINALS]?.winner && 
              this.gameData[ROUND_KEYS.FINALS_MVP]));
  }

  /**
   * Get total possible picks from game data
   */
  getTotalPossiblePicks() {
    let total = 0;
    
    // First Round
    if (this.gameData[ROUND_KEYS.FIRST_ROUND]) {
      total += this.gameData[ROUND_KEYS.FIRST_ROUND].filter(m => m && m.winner).length;
    }
    
    // Conference Semifinals
    if (this.gameData[ROUND_KEYS.CONF_SEMIS]) {
      total += this.gameData[ROUND_KEYS.CONF_SEMIS].filter(m => m && m.winner).length;
    }
    
    // Conference Finals
    if (this.gameData[ROUND_KEYS.CONF_FINALS]) {
      total += this.gameData[ROUND_KEYS.CONF_FINALS].filter(m => m && m.winner).length;
    }
    
    // NBA Finals
    if (this.gameData[ROUND_KEYS.NBA_FINALS] && this.gameData[ROUND_KEYS.NBA_FINALS].winner) {
      total += 1;
    }
    
    // Finals MVP
    if (this.gameData[ROUND_KEYS.FINALS_MVP]) {
      total += 1;
    }
    
    // Play-In Tournament
    if (this.gameData.playInTournamentEnabled && this.gameData[ROUND_KEYS.PLAY_IN]) {
      const playIn = this.gameData[ROUND_KEYS.PLAY_IN];
      
      // East
      if (playIn.east) {
        if (playIn.east.seventhEighthWinner?.team) total += 1;
        if (playIn.east.ninthTenthWinner?.team) total += 1;
        if (playIn.east.finalWinner?.team) total += 1;
      }
      
      // West
      if (playIn.west) {
        if (playIn.west.seventhEighthWinner?.team) total += 1;
        if (playIn.west.ninthTenthWinner?.team) total += 1;
        if (playIn.west.finalWinner?.team) total += 1;
      }
    }
    
    return total;
  }

  /**
   * Get the number of possible picks for a specific round
   * @param {string} round - Round key
   * @returns {number} Number of possible picks
   */
  getRoundPossiblePicks(round) {
    if (!this.gameData) return 0;
    
    if (round === ROUND_KEYS.NBA_FINALS) {
      return this.gameData[round]?.winner ? 1 : 0;
    }
    
    if (round === ROUND_KEYS.PLAY_IN && this.gameData[round]) {
      let count = 0;
      
      // East Conference
      if (this.gameData[round].east) {
        if (this.gameData[round].east.seventhEighthWinner?.team) count++;
        if (this.gameData[round].east.ninthTenthWinner?.team) count++;
        if (this.gameData[round].east.finalWinner?.team) count++;
      }
      
      // West Conference
      if (this.gameData[round].west) {
        if (this.gameData[round].west.seventhEighthWinner?.team) count++;
        if (this.gameData[round].west.ninthTenthWinner?.team) count++;
        if (this.gameData[round].west.finalWinner?.team) count++;
      }
      
      return count;
    }
    
    if (Array.isArray(this.gameData[round])) {
      return this.gameData[round].filter(m => m && m.winner).length;
    }
    
    return 0;
  }

  /**
   * Generate a preview of stats without saving to database
   * @param {Object} gameData - Current game data
   * @returns {Promise<Object>} Preview stats object
   */
  async generateStatsPreview(gameData) {
    try {
      this.debug.log("Starting generateStatsPreview", { 
        leagueId: this.leagueId, 
        hasGameData: !!gameData
      });
      
      // Set game data
      if (!gameData) {
        this.debug.log("Game data not provided, fetching from Firestore");
        const gameDataRef = doc(db, "leagues", this.leagueId, "gameData", "current");
        const gameDataSnap = await getDoc(gameDataRef);
        
        if (!gameDataSnap.exists()) {
          throw new Error("Game data not found in Firestore");
        }
        
        this.gameData = gameDataSnap.data();
        this.debug.log("Game data fetched successfully");
      } else {
        this.gameData = gameData;
        this.debug.log("Using provided game data");
      }

      // Get scoring settings
      await this.getScoringSettings();
      
      // Calculate user scores
      await this.calculateScores();
      this.debug.log(`Calculated preview scores for ${this.userScores?.length || 0} users`);
      
      // Get current season
      const currentYear = new Date().getFullYear();
      const seasonId = `${currentYear-1}-${currentYear}`;
      
      // Preview data processing is similar to prepareAndStoreStats but without saving
      // This is NBA Playoffs specific preview data
      
      return {
        leagueId: this.leagueId,
        gameTypeId: this.gameTypeId,
        seasonId,
        playerCount: this.userScores.length,
        playerScores: this.userScores,
        champion: this.gameData[ROUND_KEYS.CHAMPION] || this.gameData[ROUND_KEYS.NBA_FINALS]?.winner || null,
        finalsMVP: this.gameData[ROUND_KEYS.FINALS_MVP] || null,
        avgScore: this.userScores.length > 0 ? 
          this.userScores.reduce((sum, user) => sum + user.score, 0) / this.userScores.length : 0,
        highestScore: this.userScores[0]?.score || 0,
        lowestScore: this.userScores[this.userScores.length - 1]?.score || 0,
        medianScore: this.userScores[Math.floor(this.userScores.length / 2)]?.score || 0,
        topWinners: this.userScores.slice(0, 3).map((user, index) => ({
          userId: user.userId,
          userName: user.userName,
          score: user.score,
          rank: index + 1
        })),
        // Other NBA Playoffs specific preview data
        correctPickPercentage: this.calculateAverageCorrectPickPercentage(),
        tournamentStatus: this.isLeagueCompleted() ? 'Completed' : 'In Progress',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.debug.error("Error generating stats preview", error);
      throw error;
    }
  }
}

export default EndLeagueStats;
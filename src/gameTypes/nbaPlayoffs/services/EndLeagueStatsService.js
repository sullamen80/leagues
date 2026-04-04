// src/gameTypes/nbaPlayoffs/services/EndLeagueStats.js
import BaseEndLeagueStats from '../../common/services/BaseEndLeagueStatsService';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  calculateUserScore, 
  countCorrectSeries
} from './scoringService';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { statsAdapter } from '../stats/adapter';

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
    this.statsAdapter = statsAdapter;
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
    return super.prepareAndStoreStats(winners);
  }

  getSeasonId() {
    const currentYear = new Date().getFullYear();
    return `${currentYear - 1}-${currentYear}`;
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

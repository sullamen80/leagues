// src/gameTypes/marchMadness/services/EndLeagueStatsService.js
import BaseEndLeagueStats from '../../common/services/BaseEndLeagueStatsService';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { calculateUserScore, calculateMaxPossiblePoints } from './scoringService';

/**
 * March Madness rounds constants
 */
const ROUND_KEYS = {
  ROUND_OF_64: 'RoundOf64',
  ROUND_OF_32: 'RoundOf32',
  SWEET_16: 'Sweet16',
  ELITE_8: 'Elite8',
  FINAL_FOUR: 'FinalFour',
  CHAMPIONSHIP: 'Championship'
};

/**
 * Display names for rounds
 */
const ROUND_DISPLAY_NAMES = {
  RoundOf64: 'Round of 64',
  RoundOf32: 'Round of 32',
  Sweet16: 'Sweet 16',
  Elite8: 'Elite 8',
  FinalFour: 'Final Four',
  Championship: 'Championship'
};

/**
 * March Madness specific implementation of EndLeagueStats
 */
class EndLeagueStats extends BaseEndLeagueStats {
  /**
   * Initialize the March Madness stats collector
   * @param {string} leagueId - The league ID
   */
  constructor(leagueId) {
    super(leagueId, "marchMadness");
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
          
          // Calculate the player's individual pick accuracy percentage
          const correctPickPercentage = totalPossiblePicks > 0 ? 
            scoreData.correctPicks.total / totalPossiblePicks : 0;
          
          // Extract and process round breakdown data directly from scoring service
          const roundBreakdown = {};
          
          // Ensure each round has a proper data structure in the roundBreakdown
          Object.values(ROUND_KEYS).forEach(roundKey => {
            // Get round data from scoring service results
            const roundData = scoreData.roundBreakdown?.[roundKey] || {};
            
            // Store round data with consistent structure
            roundBreakdown[roundKey] = {
              correct: roundData.correct || 0,
              base: roundData.base || 0,
              bonus: roundData.bonus || 0,
              total: roundData.total || 0,
              possible: roundData.possible || 0
            };
          });
          
          scores.push({
            userId,
            userName,
            userPhoto: photoURL,
            score: scoreData.total,
            basePoints: scoreData.basePoints || 0,
            bonusPoints: scoreData.bonusPoints || 0,
            correctPicks: scoreData.correctPicks.total || 0,
            correctPickPercentage, 
            totalPossible: totalPossiblePicks,
            possiblePoints: scoreData.possiblePoints || 0,
            maxPossible: scoreData.maxPossible || 0,
            championPick: bracketData[ROUND_KEYS.CHAMPIONSHIP]?.winner || bracketData.Championship?.winner || "None Selected",
            championCorrect: (bracketData[ROUND_KEYS.CHAMPIONSHIP]?.winner === this.gameData[ROUND_KEYS.CHAMPIONSHIP]?.winner) ||
                             (bracketData.Championship?.winner === this.gameData.Championship?.winner),
            roundBreakdown: roundBreakdown
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
   * @returns {Object} - March Madness specific stats
   */
  getGameSpecificUserStats(user) {
    return {
      championPick: user.championPick || null,
      championCorrect: user.championCorrect || false,
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
        const possiblePicks = this.getRoundPossiblePicks(round);
        if (possiblePicks > 0) {
          roundAccuracy[round] = {
            correctPicks: data.correct || 0,
            possiblePicks: possiblePicks,
            percentage: (data.correct || 0) / possiblePicks
          };
        }
      });
    }
    return roundAccuracy;
  }

  /**
   * Prepare and store the league stats with March Madness specific data
   * @param {Array} winners - League winners array (optional) 
   * @returns {Object} - Stats document
   */
  async prepareAndStoreStats(winners) {
    // Use a direct reference to the league document by leagueId
    const statsRef = doc(this.leaguesCollRef, this.leagueId);
    
    this.debug.log(`Preparing league stats for league ID: ${this.leagueId}`);
    
    // Get the current season (just the current year for March Madness)
    const currentYear = new Date().getFullYear();
    const seasonId = currentYear.toString();
    
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
    const rounds = Object.values(ROUND_KEYS);
    
    rounds.forEach(round => {
      let totalCorrectPicks = 0;
      let totalPossiblePicks = 0;
      
      // Regular round handling
      const roundPicks = this.getRoundPossiblePicks(round);
      totalPossiblePicks = roundPicks * this.userScores.length;
      
      // Sum all user correct picks for this round
      this.userScores.forEach(user => {
        if (user.roundBreakdown && user.roundBreakdown[round]) {
          totalCorrectPicks += user.roundBreakdown[round].correct || 0;
        }
      });
      
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
        // Include point breakdowns
        basePoints: user.basePoints || 0,
        bonusPoints: user.bonusPoints || 0,
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
      
      // March Madness specific stats
      marchMadnessStats: {
        champion: this.gameData[ROUND_KEYS.CHAMPIONSHIP]?.winner || this.gameData.Championship?.winner || null,
        upsetCount: this.calculateTotalUpsets(),
        finalFourTeams: this.getFinalFourTeams()
      },
      
      // Add metadata to distinguish from temporary documents
      _metadata: {
        isTemporary: false,
        createdAt: new Date(),
        dataType: "leagueStats",
        version: "1.0"
      }
    };
  
    // Include additional data from preview if available
    if (this.previewData) {
      // Include round stats
      if (this.previewData.roundStats) {
        statsData.enhancedRoundStats = this.previewData.roundStats;
      }
      
      // Include upset stats
      if (this.previewData.upsetStats) {
        statsData.upsetStats = this.previewData.upsetStats;
      }
      
      // Include seed performance data
      if (this.previewData.seedPerformance) {
        statsData.seedPerformance = this.previewData.seedPerformance;
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
    
    const totalCorrectPicks = this.userScores.reduce((sum, user) => sum + (user.correctPicks || 0), 0);
    const totalPossiblePicks = this.getTotalPossiblePicks() * this.userScores.length;
    
    if (totalPossiblePicks <= 0) return 0;
    
    // Return a decimal between 0 and 1
    return totalCorrectPicks / totalPossiblePicks;
  }

  /**
   * Calculate total upsets in the tournament
   * An upset is when a higher-seeded team beats a lower-seeded team
   */
  calculateTotalUpsets() {
    if (!this.gameData) return 0;
    
    let totalUpsets = 0;
    
    // Check each round
    Object.values(ROUND_KEYS).forEach(round => {
      if (round === ROUND_KEYS.CHAMPIONSHIP) {
        // Championship is a single game
        const championship = this.gameData[round] || this.gameData.Championship;
        if (championship && championship.winner && championship.winnerSeed && championship.team1Seed && championship.team2Seed) {
          const expectedWinner = Math.min(championship.team1Seed, championship.team2Seed);
          if (championship.winnerSeed > expectedWinner) {
            totalUpsets++;
          }
        }
      } else if (Array.isArray(this.gameData[round])) {
        // Regular rounds
        this.gameData[round].forEach(matchup => {
          if (matchup && matchup.winner && matchup.winnerSeed && matchup.team1Seed && matchup.team2Seed) {
            const expectedWinner = Math.min(matchup.team1Seed, matchup.team2Seed);
            if (matchup.winnerSeed > expectedWinner) {
              totalUpsets++;
            }
          }
        });
      }
    });
    
    return totalUpsets;
  }

  /**
   * Get the Final Four teams from the gameData
   */
  getFinalFourTeams() {
    if (!this.gameData || !this.gameData[ROUND_KEYS.FINAL_FOUR] || !Array.isArray(this.gameData[ROUND_KEYS.FINAL_FOUR])) {
      return [];
    }
    
    const finalFourTeams = [];
    
    this.gameData[ROUND_KEYS.FINAL_FOUR].forEach(matchup => {
      if (matchup) {
        if (matchup.team1) finalFourTeams.push({
          name: matchup.team1,
          seed: matchup.team1Seed || null,
          region: matchup.team1Region || null
        });
        
        if (matchup.team2) finalFourTeams.push({
          name: matchup.team2,
          seed: matchup.team2Seed || null,
          region: matchup.team2Region || null
        });
      }
    });
    
    return finalFourTeams;
  }

  /**
   * Check if the league is completed
   */
  isLeagueCompleted() {
    return !!(this.gameData[ROUND_KEYS.CHAMPIONSHIP]?.winner || this.gameData.Championship?.winner);
  }

  /**
   * Get total possible picks from game data
   */
  getTotalPossiblePicks() {
    let total = 0;
    
    // Check each round
    Object.values(ROUND_KEYS).forEach(round => {
      if (round === ROUND_KEYS.CHAMPIONSHIP) {
        // Championship is a single game
        if (this.gameData[round]?.winner || this.gameData.Championship?.winner) {
          total += 1;
        }
      } else if (Array.isArray(this.gameData[round])) {
        // Count completed games in each round
        total += this.gameData[round].filter(m => m && m.winner).length;
      }
    });
    
    return total;
  }

  /**
   * Get the number of possible picks for a specific round
   * @param {string} round - Round key
   * @returns {number} Number of possible picks
   */
  getRoundPossiblePicks(round) {
    if (!this.gameData) return 0;
    
    if (round === ROUND_KEYS.CHAMPIONSHIP || round === 'Championship') {
      return (this.gameData[round]?.winner || this.gameData.Championship?.winner) ? 1 : 0;
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
      
      // Calculate round-by-round statistics
      const roundStats = {};
      
      Object.values(ROUND_KEYS).forEach(round => {
        let totalCorrectPicks = 0;
        let totalPossiblePicks = 0;
        
        // Round structure
        let roundStructure = {
          totalGames: 0,
          completedGames: 0,
          pointValue: this.getPointValueForRound(round)
        };
        
        if (round === ROUND_KEYS.CHAMPIONSHIP) {
          // Championship is a single game
          roundStructure.totalGames = 1;
          roundStructure.completedGames = (this.gameData[round]?.winner || this.gameData.Championship?.winner) ? 1 : 0;
        } else if (Array.isArray(this.gameData[round])) {
          // For regular rounds
          roundStructure.totalGames = this.gameData[round].length;
          roundStructure.completedGames = this.gameData[round].filter(m => m && m.winner).length;
        }
        
        // Calculate total possible picks for this round
        const roundPicks = this.getRoundPossiblePicks(round);
        totalPossiblePicks = roundPicks * this.userScores.length;
        
        // Sum all user correct picks for this round
        this.userScores.forEach(user => {
          if (user.roundBreakdown && user.roundBreakdown[round]) {
            totalCorrectPicks += user.roundBreakdown[round].correct || 0;
          }
        });
        
        // Store enhanced round stats
        roundStats[round] = {
          ...roundStructure,
          totalCorrectPicks,
          totalPossiblePicks,
          correctPickPercentage: totalPossiblePicks > 0 ? totalCorrectPicks / totalPossiblePicks : 0,
          avgPointsPerPlayer: this.userScores.length > 0 ? 
            this.userScores.reduce((sum, user) => {
              return sum + (user.roundBreakdown && user.roundBreakdown[round] ? 
                (user.roundBreakdown[round].total || 0) : 0);
            }, 0) / this.userScores.length : 0
        };
      });
      
      // Calculate upset statistics
      const upsetCount = this.calculateTotalUpsets();
      
      // Calculate total games completed vs total possible games (63 for standard bracket)
      const totalGames = 63; // Standard March Madness bracket has 63 games
      const completedGames = this.getTotalPossiblePicks();
      
      // Calculate seed performance
      const seedPerformance = this.calculateSeedPerformance();
      
      // Return preview data
      return {
        leagueId: this.leagueId,
        gameTypeId: this.gameTypeId,
        seasonId: currentYear.toString(),
        playerCount: this.userScores.length,
        playerScores: this.userScores,
        champion: this.gameData[ROUND_KEYS.CHAMPIONSHIP]?.winner || this.gameData.Championship?.winner || null,
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
        // March Madness specific preview data
        correctPickPercentage: this.calculateAverageCorrectPickPercentage(),
        tournamentStatus: this.isLeagueCompleted() ? 'Completed' : 'In Progress',
        tournamentProgress: {
          completedGames,
          totalGames,
          percentage: totalGames > 0 ? completedGames / totalGames : 0
        },
        roundStats,
        upsetStats: {
          totalUpsets: upsetCount,
          upsetsByRound: this.calculateUpsetsByRound()
        },
        seedPerformance,
        scoringSettings: this.settings,
        finalFourTeams: this.getFinalFourTeams(),
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.debug.error("Error generating stats preview", error);
      throw error;
    }
  }

  /**
   * Get the point value for a specific round
   * @param {string} round - Round key
   * @returns {number} Point value
   */
  getPointValueForRound(round) {
    if (!this.settings) {
      // Default point values
      const defaultValues = {
        [ROUND_KEYS.ROUND_OF_64]: 1,
        [ROUND_KEYS.ROUND_OF_32]: 2,
        [ROUND_KEYS.SWEET_16]: 4,
        [ROUND_KEYS.ELITE_8]: 8,
        [ROUND_KEYS.FINAL_FOUR]: 16,
        [ROUND_KEYS.CHAMPIONSHIP]: 32
      };
      return defaultValues[round] || 0;
    }
    
    // Convert round key to settings key format (e.g. RoundOf64 -> roundOf64)
    const settingsKey = round.charAt(0).toLowerCase() + round.slice(1);
    return this.settings[settingsKey] || 0;
  }

  /**
   * Calculate upsets by round
   * @returns {Object} Upsets by round
   */
  calculateUpsetsByRound() {
    if (!this.gameData) return {};
    
    const upsetsByRound = {};
    
    // Check each round
    Object.values(ROUND_KEYS).forEach(round => {
      let roundUpsets = 0;
      
      if (round === ROUND_KEYS.CHAMPIONSHIP) {
        // Championship is a single game
        const championship = this.gameData[round] || this.gameData.Championship;
        if (championship && championship.winner && championship.winnerSeed && championship.team1Seed && championship.team2Seed) {
          const expectedWinner = Math.min(championship.team1Seed, championship.team2Seed);
          if (championship.winnerSeed > expectedWinner) {
            roundUpsets++;
          }
        }
      } else if (Array.isArray(this.gameData[round])) {
        // Regular rounds
        this.gameData[round].forEach(matchup => {
          if (matchup && matchup.winner && matchup.winnerSeed && matchup.team1Seed && matchup.team2Seed) {
            const expectedWinner = Math.min(matchup.team1Seed, matchup.team2Seed);
            if (matchup.winnerSeed > expectedWinner) {
              roundUpsets++;
            }
          }
        });
      }
      
      upsetsByRound[round] = roundUpsets;
    });
    
    return upsetsByRound;
  }

  /**
   * Calculate seed performance statistics
   * @returns {Object} Seed performance data
   */
  calculateSeedPerformance() {
    if (!this.gameData) return {};
    
    const seedPerformance = {};
    
    // Initialize tracking for each seed (1-16)
    for (let i = 1; i <= 16; i++) {
      seedPerformance[i] = {
        wins: 0,
        losses: 0,
        roundsReached: {}
      };
    }
    
    // Track the furthest round each seed reached
    const seedFurthestRound = {};
    
    // Process each round to gather seed stats
    const processedRounds = [
      ROUND_KEYS.ROUND_OF_64,
      ROUND_KEYS.ROUND_OF_32,
      ROUND_KEYS.SWEET_16,
      ROUND_KEYS.ELITE_8,
      ROUND_KEYS.FINAL_FOUR,
      ROUND_KEYS.CHAMPIONSHIP
    ];
    
    // Track how many of each seed reached each round
    processedRounds.forEach(round => {
      if (round === ROUND_KEYS.CHAMPIONSHIP) {
        // Championship round
        const championship = this.gameData[round] || this.gameData.Championship;
        if (championship) {
          // Both teams in championship reached this round
          if (championship.team1Seed) {
            seedPerformance[championship.team1Seed].roundsReached[round] = 
              (seedPerformance[championship.team1Seed].roundsReached[round] || 0) + 1;
          }
          
          if (championship.team2Seed) {
            seedPerformance[championship.team2Seed].roundsReached[round] = 
              (seedPerformance[championship.team2Seed].roundsReached[round] || 0) + 1;
          }
          
          // Winner and loser
          if (championship.winner && championship.winnerSeed) {
            seedPerformance[championship.winnerSeed].wins += 1;
            
            // Champion - winners of championship
            seedPerformance[championship.winnerSeed].roundsReached["Champion"] = 1;
            
            // Determine loser seed
            const loserSeed = championship.team1 === championship.winner ? 
              championship.team2Seed : championship.team1Seed;
            
            if (loserSeed) {
              seedPerformance[loserSeed].losses += 1;
            }
          }
        }
      } else if (Array.isArray(this.gameData[round])) {
        // Regular rounds
        this.gameData[round].forEach(matchup => {
          if (matchup) {
            // Both teams in this matchup reached this round
            if (matchup.team1Seed) {
              seedPerformance[matchup.team1Seed].roundsReached[round] = 
                (seedPerformance[matchup.team1Seed].roundsReached[round] || 0) + 1;
            }
            
            if (matchup.team2Seed) {
              seedPerformance[matchup.team2Seed].roundsReached[round] = 
                (seedPerformance[matchup.team2Seed].roundsReached[round] || 0) + 1;
            }
            
            // Winner and loser tracking
            if (matchup.winner && matchup.winnerSeed) {
              seedPerformance[matchup.winnerSeed].wins += 1;
              
              // Determine loser seed
              const loserSeed = matchup.team1 === matchup.winner ? 
                matchup.team2Seed : matchup.team1Seed;
              
              if (loserSeed) {
                seedPerformance[loserSeed].losses += 1;
              }
            }
          }
        });
      }
    });
    
    // Calculate win rate for each seed
    Object.entries(seedPerformance).forEach(([seed, data]) => {
      const totalGames = data.wins + data.losses;
      seedPerformance[seed].winRate = totalGames > 0 ? data.wins / totalGames : 0;
      
      // Find the furthest round this seed reached
      const furthestRound = this.getFurthestRound(seed, data.roundsReached);
      seedPerformance[seed].furthestRound = furthestRound;
    });
    
    return seedPerformance;
  }

  /**
   * Determine the furthest round a seed reached
   * @param {number} seed - Team seed
   * @param {Object} roundsReached - Rounds this seed reached
   * @returns {string} The furthest round reached
   */
  getFurthestRound(seed, roundsReached) {
    const roundOrder = [
      ROUND_KEYS.ROUND_OF_64,
      ROUND_KEYS.ROUND_OF_32,
      ROUND_KEYS.SWEET_16,
      ROUND_KEYS.ELITE_8,
      ROUND_KEYS.FINAL_FOUR,
      ROUND_KEYS.CHAMPIONSHIP,
      "Champion"
    ];
    
    // Start from the end (Champion) and work backwards
    for (let i = roundOrder.length - 1; i >= 0; i--) {
      if (roundsReached[roundOrder[i]]) {
        return roundOrder[i];
      }
    }
    
    return null;
  }

  /**
   * Capture and store statistics
   * @param {Object} gameData - Current game data
   * @param {Array} winners - Optional winners array
   * @param {Object} previewData - Optional preview data to include
   * @returns {Promise<Object>} Result of the operation
   */
  async captureStats(gameData, winners, previewData) {
    try {
      this.debug.log("Starting captureStats");
      
      // Set game data
      if (gameData) {
        this.gameData = gameData;
      } else {
        // Fetch game data from Firestore
        const gameDataRef = doc(db, "leagues", this.leagueId, "gameData", "current");
        const gameDataSnap = await getDoc(gameDataRef);
        
        if (!gameDataSnap.exists()) {
          throw new Error("Game data not found in Firestore");
        }
        
        this.gameData = gameDataSnap.data();
      }
      
      // Set preview data if provided
      if (previewData) {
        this.previewData = previewData;
      }
      
      // Get scoring settings
      await this.getScoringSettings();
      
      // Calculate scores
      await this.calculateScores();
      
      // Prepare and store stats
      const statsDoc = await this.prepareAndStoreStats(winners);
      
      // THIS IS THE FIXED PART - Add the call to storeUserStats()
      // Store user stats which were missing in the original implementation
      await this.storeUserStats();
      this.debug.log("User stats stored successfully");
      
      return {
        success: true,
        data: statsDoc
      };
    } catch (error) {
      this.debug.error("Error capturing stats", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default EndLeagueStats;
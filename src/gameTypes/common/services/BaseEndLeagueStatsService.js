// src/gameTypes/common/services/BaseEndLeagueStatsService.js
import { doc, getDoc, collection, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';

export const CANONICAL_STATS_COLLECTIONS = Object.freeze({
  leagueSummaries: 'leagueSummaries',
  leagueDetails: 'leagueDetails',
  userSummaries: 'userSummaries',
  userDetails: 'userDetails'
});

export const CANONICAL_STATS_METADATA_VERSION = 1;
export const CANONICAL_STATS_SOURCE_VERSION = 'canonical-v1';

export const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

export const toDateObject = (value, fallback = new Date()) => {
  if (!value) {
    return fallback instanceof Date ? fallback : new Date(fallback);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? (fallback instanceof Date ? fallback : new Date(fallback)) : parsed;
};

export const toComparableTimestamp = (value, fallback = 0) => {
  const date = toDateObject(value, null);
  return date ? date.getTime() : fallback;
};

export const calculateMedian = (values = []) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (numericValues.length === 0) {
    return 0;
  }

  const middleIndex = Math.floor(numericValues.length / 2);
  if (numericValues.length % 2 === 0) {
    return (numericValues[middleIndex - 1] + numericValues[middleIndex]) / 2;
  }

  return numericValues[middleIndex];
};

export const calculateAverage = (values = []) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (numericValues.length === 0) {
    return 0;
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
};

export const buildLeagueMetrics = ({ leaders = [], totalPossiblePicks = 0 }) => {
  const scores = leaders.map((leader) => Number(leader.score || 0));
  const averageScore = calculateAverage(scores);
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
  const medianScore = calculateMedian(scores);
  const accuracy = totalPossiblePicks > 0
    ? leaders.reduce((sum, leader) => sum + Number(leader.correctPicks || 0), 0) / (totalPossiblePicks * Math.max(leaders.length, 1))
    : 0;

  return {
    averageScore,
    highestScore,
    lowestScore,
    medianScore,
    accuracy
  };
};

export const buildCanonicalLeagueSummary = ({
  leagueId,
  gameTypeId,
  seasonId,
  completedAt,
  playerCount = 0,
  winner = null,
  summary = {},
  status = 'completed',
  highlights = {},
  adapterVersion = CANONICAL_STATS_METADATA_VERSION,
  sourceVersion = CANONICAL_STATS_SOURCE_VERSION,
  _metadata = {}
}) => ({
  leagueId,
  gameTypeId,
  seasonId,
  completedAt: toDateObject(completedAt, new Date()),
  playerCount,
  winner,
  summary,
  status,
  highlights,
  adapterVersion,
  sourceVersion,
  _metadata: {
    dataType: 'leagueSummary',
    createdAt: new Date(),
    version: adapterVersion,
    ..._metadata
  }
});

export const buildCanonicalLeagueDetail = ({
  leagueId,
  gameTypeId,
  seasonId,
  completedAt,
  leaders = [],
  stats = {},
  playerCount = 0,
  winner = null,
  summary = {},
  highlights = {},
  adapterVersion = CANONICAL_STATS_METADATA_VERSION,
  sourceVersion = CANONICAL_STATS_SOURCE_VERSION,
  _metadata = {}
}) => ({
  leagueId,
  gameTypeId,
  seasonId,
  completedAt: toDateObject(completedAt, new Date()),
  leaders,
  stats,
  playerCount,
  winner,
  summary,
  highlights,
  adapterVersion,
  sourceVersion,
  _metadata: {
    dataType: 'leagueDetail',
    createdAt: new Date(),
    version: adapterVersion,
    ..._metadata
  }
});

export const buildCanonicalUserHistoryEntry = ({
  leagueId,
  gameTypeId,
  seasonId,
  completedAt,
  rank = 0,
  score = 0,
  accuracy = 0,
  correctPicks = 0,
  totalPossible = 0,
  specialPicks = {},
  roundBreakdown = {},
  detailPayload = {},
  adapterVersion = CANONICAL_STATS_METADATA_VERSION,
  sourceVersion = CANONICAL_STATS_SOURCE_VERSION,
  _metadata = {}
}) => ({
  leagueId,
  gameTypeId,
  seasonId,
  completedAt: toDateObject(completedAt, new Date()),
  rank,
  score,
  accuracy,
  correctPicks,
  totalPossible,
  specialPicks,
  roundBreakdown,
  detailPayload,
  adapterVersion,
  sourceVersion,
  _metadata: {
    dataType: 'userHistoryEntry',
    createdAt: new Date(),
    version: adapterVersion,
    ..._metadata
  }
});

export const buildCanonicalUserSummary = ({
  userId,
  userName,
  lastUpdated = new Date(),
  summary = {},
  byGameType = {},
  adapterVersion = CANONICAL_STATS_METADATA_VERSION,
  sourceVersion = CANONICAL_STATS_SOURCE_VERSION,
  _metadata = {}
}) => ({
  userId,
  userName,
  lastUpdated: toDateObject(lastUpdated, new Date()),
  summary,
  byGameType,
  adapterVersion,
  sourceVersion,
  _metadata: {
    dataType: 'userSummary',
    createdAt: new Date(),
    version: adapterVersion,
    ..._metadata
  }
});

export const buildCanonicalUserDetail = ({
  userId,
  userName,
  lastUpdated = new Date(),
  history = [],
  adapterVersion = CANONICAL_STATS_METADATA_VERSION,
  sourceVersion = CANONICAL_STATS_SOURCE_VERSION,
  _metadata = {}
}) => ({
  userId,
  userName,
  lastUpdated: toDateObject(lastUpdated, new Date()),
  history,
  adapterVersion,
  sourceVersion,
  _metadata: {
    dataType: 'userDetail',
    createdAt: new Date(),
    version: adapterVersion,
    ..._metadata
  }
});

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
    this.statsAdapter = null;
    
    // Root document reference
    this.rootDocRef = doc(db, "gameStats", "root");
    
    // Canonical stats collection references
    this.leagueSummariesCollRef = collection(this.rootDocRef, CANONICAL_STATS_COLLECTIONS.leagueSummaries);
    this.leagueDetailsCollRef = collection(this.rootDocRef, CANONICAL_STATS_COLLECTIONS.leagueDetails);
    this.userSummariesCollRef = collection(this.rootDocRef, CANONICAL_STATS_COLLECTIONS.userSummaries);
    this.userDetailsCollRef = collection(this.rootDocRef, CANONICAL_STATS_COLLECTIONS.userDetails);
    
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

      // Ensure canonical gameStats collections exist
      this.debug.log("Ensuring collection structure exists");
      const collectionsExist = await this.ensureCollectionsExist();
      this.debug.log(`Collections existence check: ${collectionsExist ? 'Success' : 'Failed'}`);

      // Prepare and store the stats
      this.debug.log("Preparing and storing league stats");
      const statsDoc = await this.prepareAndStoreStats(winners);
      this.debug.log(`Stored canonical league stats with ID: ${statsDoc.id}`);
      
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
    // Firestore creates collections implicitly when canonical documents are
    // written. Creating the parent/root or placeholder documents here would
    // require broader permissions than a league owner has, while every real
    // stats document carries its sourceLeagueId for the owner-scoped rule.
    this.debug.log("Canonical stats collections will be created by their first write");
    return true;
  }

  /**
   * Resolve the active stats adapter.
   * Subclasses are expected to assign `this.statsAdapter`.
   */
  getStatsAdapter() {
    return this.statsAdapter;
  }

  /**
   * Get the league season identifier.
   * Subclasses should override if they need a different season format.
   */
  getSeasonId() {
    return new Date().getFullYear().toString();
  }

  /**
   * Get the canonical completion timestamp for this league.
   */
  getCompletedAt() {
    return this.gameData?.completedAt || this.gameData?.lastUpdated || new Date();
  }

  /**
   * Build the canonical runtime context passed into adapter builders.
   */
  getCanonicalRuntimeContext(winners = null) {
    const adapter = this.getStatsAdapter();
    const seasonId = this.getSeasonId();
    const completedAt = this.getCompletedAt();
    const playerCount = Array.isArray(this.userScores) ? this.userScores.length : 0;
    const leaderScores = Array.isArray(this.userScores) ? [...this.userScores] : [];
    const winner = Array.isArray(winners) && winners.length > 0
      ? winners[0]
      : leaderScores[0]
        ? {
            userId: leaderScores[0].userId,
            userName: leaderScores[0].userName,
            score: leaderScores[0].score,
            rank: 1
          }
        : null;

    return {
      legacyLeagueDoc: this.gameData || {},
      leagueId: this.leagueId,
      gameTypeId: this.gameTypeId,
      seasonId,
      completedAt,
      playerCount,
      winners: Array.isArray(winners) && winners.length > 0 ? winners : leaderScores.slice(0, 3).map((user, index) => ({
        userId: user.userId,
        userName: user.userName,
        score: user.score,
        rank: index + 1
      })),
      winner,
      userScores: leaderScores,
      settings: this.settings || {},
      previewData: this.previewData || null,
      adapterVersion: adapter?.version || CANONICAL_STATS_METADATA_VERSION,
      sourceVersion: CANONICAL_STATS_SOURCE_VERSION
    };
  }

  /**
   * Build the canonical league summary/detail payloads using the active adapter.
   */
  buildCanonicalLeaguePayload(winners = null) {
    const adapter = this.getStatsAdapter();
    const context = this.getCanonicalRuntimeContext(winners);

    const fallbackSummary = this.buildFallbackLeagueSummary(context);
    const fallbackDetail = this.buildFallbackLeagueDetail(context);

    const leagueSummary = adapter?.buildLeagueSummary
      ? adapter.buildLeagueSummary(context) || fallbackSummary
      : fallbackSummary;

    const leagueDetail = adapter?.buildLeagueDetail
      ? adapter.buildLeagueDetail(context) || fallbackDetail
      : fallbackDetail;

    leagueSummary._metadata = {
      ...(leagueSummary._metadata || {}),
      sourceLeagueId: this.leagueId
    };
    leagueDetail._metadata = {
      ...(leagueDetail._metadata || {}),
      sourceLeagueId: this.leagueId
    };

    return { leagueSummary, leagueDetail, context };
  }

  /**
   * Prepare and store the canonical league summary/detail docs.
   */
  async prepareAndStoreStats(winners) {
    const { leagueSummary, leagueDetail, context } = this.buildCanonicalLeaguePayload(winners);
    const summaryRef = doc(this.leagueSummariesCollRef, this.leagueId);
    const detailRef = doc(this.leagueDetailsCollRef, this.leagueId);

    this.currentLeagueSummary = leagueSummary;
    this.currentLeagueDetail = leagueDetail;

    this.debug.log("Storing canonical league summary/detail", {
      summaryPath: summaryRef.path,
      detailPath: detailRef.path
    });

    await setDoc(summaryRef, leagueSummary);
    await setDoc(detailRef, leagueDetail);

    return {
      id: summaryRef.id,
      data: leagueSummary,
      detail: leagueDetail,
      context
    };
  }

  buildFallbackLeagueSummary(context) {
    const leaders = context.userScores || [];
    const totalPossiblePicks = this.getTotalPossiblePicks ? this.getTotalPossiblePicks() : 0;
    const winner = context.winner || null;
    const summary = buildLeagueMetrics({ leaders, totalPossiblePicks });

    return buildCanonicalLeagueSummary({
      leagueId: context.leagueId,
      gameTypeId: context.gameTypeId,
      seasonId: context.seasonId,
      completedAt: context.completedAt,
      playerCount: context.playerCount,
      winner,
      summary,
      status: this.isLeagueCompleted && this.isLeagueCompleted() ? 'completed' : 'inProgress',
      highlights: {
        previewData: context.previewData || null
      },
      adapterVersion: context.adapterVersion,
      sourceVersion: context.sourceVersion
    });
  }

  buildFallbackLeagueDetail(context) {
    const totalPossiblePicks = this.getTotalPossiblePicks ? this.getTotalPossiblePicks() : 0;
    const leaders = (context.userScores || []).map((user, index) => ({
      userId: user.userId,
      userName: user.userName,
      rank: index + 1,
      score: user.score || 0,
      accuracy: Number.isFinite(user.correctPickPercentage) ? user.correctPickPercentage : 0,
      correctPicks: user.correctPicks || 0,
      totalPossible: user.totalPossible || totalPossiblePicks,
      specialPicks: {},
      roundBreakdown: user.roundBreakdown || {},
      detailPayload: {
        basePoints: user.basePoints || 0,
        bonusPoints: user.bonusPoints || 0,
        possiblePoints: user.possiblePoints || 0,
        maxPossible: user.maxPossible || 0
      }
    }));

    const summary = buildLeagueMetrics({ leaders, totalPossiblePicks });
    const roundStats = this.previewData?.roundStats || {};

    return buildCanonicalLeagueDetail({
      leagueId: context.leagueId,
      gameTypeId: context.gameTypeId,
      seasonId: context.seasonId,
      completedAt: context.completedAt,
      leaders,
      stats: {
        cards: [
          { title: 'Players', value: context.playerCount },
          { title: 'Average Score', value: summary.averageScore },
          { title: 'Highest Score', value: summary.highestScore },
          { title: 'Pick Accuracy', value: summary.accuracy }
        ],
        sections: [],
        roundStats,
        modePayload: context.previewData || {}
      },
      playerCount: context.playerCount,
      winner: context.winner,
      summary,
      highlights: {
        previewData: context.previewData || null
      },
      adapterVersion: context.adapterVersion,
      sourceVersion: context.sourceVersion
    });
  }

  /**
   * Store individual user stats and handle aggregation
   * Canonical runtime path writes summary/detail docs only.
   */
  async storeUserStats() {
    this.debug.log(`Updating canonical stats for ${this.userScores.length} users`);
    
    // Create a batch for Firestore operations
    let batch = writeBatch(db);
    let count = 0;
    const adapter = this.getStatsAdapter();
    const context = this.getCanonicalRuntimeContext();
    const sourceLeagueId = this.leagueId;
    const leagueDetail = this.currentLeagueDetail || this.buildFallbackLeagueDetail(context);
    const leagueSummary = this.currentLeagueSummary || this.buildFallbackLeagueSummary(context);
    this.debug.log(`League completion status: ${(this.isLeagueCompleted ? this.isLeagueCompleted() : true) ? 'Completed' : 'Not Completed'}`);
    
    // Process each user's stats
    for (const user of this.userScores) {
      try {
        const userRank = this.userScores.findIndex((entry) => entry.userId === user.userId) + 1;
        const userSummaryRef = doc(this.userSummariesCollRef, user.userId);
        const userDetailRef = doc(this.userDetailsCollRef, user.userId);
        const userDetailSnap = await getDoc(userDetailRef);
        const existingHistory = userDetailSnap.exists() && Array.isArray(userDetailSnap.data()?.history)
          ? userDetailSnap.data().history
          : [];

        const fallbackHistoryEntry = buildCanonicalUserHistoryEntry({
          leagueId: this.leagueId,
          gameTypeId: this.gameTypeId,
          seasonId: context.seasonId,
          completedAt: context.completedAt,
          rank: userRank,
          score: user.score || 0,
          accuracy: Number.isFinite(user.correctPickPercentage) ? user.correctPickPercentage : 0,
          correctPicks: user.correctPicks || 0,
          totalPossible: user.totalPossible || 0,
          specialPicks: {},
          roundBreakdown: user.roundBreakdown || {},
          detailPayload: user
        });
        const historyEntry = adapter?.buildUserHistoryEntry
          ? adapter.buildUserHistoryEntry({
              userScore: user,
              leagueSummary,
              leagueDetail,
              legacyLeagueDoc: this.gameData || {},
              seasonId: context.seasonId,
              completedAt: context.completedAt,
              leagueId: this.leagueId,
              gameTypeId: this.gameTypeId,
              rank: userRank,
              adapterVersion: context.adapterVersion,
              sourceVersion: context.sourceVersion
            }) || fallbackHistoryEntry
          : fallbackHistoryEntry;

        const nextHistory = existingHistory.filter((entry) => entry.leagueId !== sourceLeagueId);
        nextHistory.push(historyEntry);
        nextHistory.sort((a, b) => toComparableTimestamp(b.completedAt) - toComparableTimestamp(a.completedAt));

        const userSummaryStats = (adapter?.buildUserSummaryStats
          ? adapter.buildUserSummaryStats({
              userHistoryEntries: nextHistory,
              userId: user.userId,
              userName: user.userName,
              gameTypeId: this.gameTypeId
            })
          : null) || this.buildFallbackUserSummaryStats(nextHistory);

        const userDetailData = buildCanonicalUserDetail({
          userId: user.userId,
          userName: user.userName,
          lastUpdated: new Date(),
          history: nextHistory,
          adapterVersion: context.adapterVersion,
          sourceVersion: context.sourceVersion,
          _metadata: { sourceLeagueId: this.leagueId }
        });

        const userSummaryData = buildCanonicalUserSummary({
          userId: user.userId,
          userName: user.userName,
          lastUpdated: new Date(),
          summary: userSummaryStats.summary || {},
          byGameType: userSummaryStats.byGameType || {},
          adapterVersion: context.adapterVersion,
          sourceVersion: context.sourceVersion,
          _metadata: { sourceLeagueId: this.leagueId }
        });

        batch.set(userDetailRef, userDetailData);
        batch.set(userSummaryRef, userSummaryData);

        count++;
        
        // Commit batch in chunks to avoid Firestore limits
        if (count >= 400) {
          this.debug.log(`Committing batch of ${count} canonical user stats`);
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
        this.debug.log(`Committing final batch of ${count} canonical user stats`);
        await batch.commit();
      } catch (err) {
        this.debug.error("Error committing final batch", err);
        throw err;
      }
    }
    
    this.debug.log("Successfully stored and aggregated all canonical user stats");
  }

  buildFallbackUserSummaryStats(userHistoryEntries = []) {
    const validEntries = userHistoryEntries.filter((entry) => isPlainObject(entry));
    const summary = {
      totalLeagues: validEntries.length,
      totalWins: validEntries.filter((entry) => entry.rank === 1).length,
      totalSecondPlace: validEntries.filter((entry) => entry.rank === 2).length
    };

    const byGameType = validEntries.reduce((acc, entry) => {
      const gameTypeId = entry.gameTypeId || 'unknown';
      const current = acc[gameTypeId] || {
        leagues: 0,
        wins: 0,
        bestScore: 0,
        averageScore: 0,
        bestAccuracy: 0,
        averageAccuracy: 0
      };

      const score = Number(entry.score || 0);
      const accuracy = Number(entry.accuracy || 0);
      current.leagues += 1;
      current.wins += entry.rank === 1 ? 1 : 0;
      current.bestScore = Math.max(current.bestScore, score);
      current.bestAccuracy = Math.max(current.bestAccuracy, accuracy);
      current.averageScore = calculateAverage([
        ...(current._scores || []),
        score
      ]);
      current.averageAccuracy = calculateAverage([
        ...(current._accuracies || []),
        accuracy
      ]);
      current._scores = [...(current._scores || []), score];
      current._accuracies = [...(current._accuracies || []), accuracy];
      acc[gameTypeId] = current;
      return acc;
    }, {});

    Object.values(byGameType).forEach((entry) => {
      delete entry._scores;
      delete entry._accuracies;
    });

    return { summary, byGameType };
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

import { normalizeGameTypeId } from '../../../gameTypes';
import {
  CANONICAL_STATS_COLLECTIONS,
  isCanonicalStatsGameType
} from './statsCollections';

const getTimestampValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    return value;
  }
  return value;
};

const normalizeNumber = (value, fallback = 0) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const normalizeAccuracy = (value, fallback = 0) => {
  const numericValue = normalizeNumber(value, fallback);
  return numericValue > 1 ? numericValue / 100 : numericValue;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const getWinnerLabel = (winner) => {
  if (!winner) return 'Not Available';
  if (typeof winner === 'string') return winner;
  return (
    winner.userName ||
    winner.displayName ||
    winner.name ||
    winner.label ||
    winner.userId ||
    'Unknown Winner'
  );
};

export const normalizeLeagueSummaryDoc = (snapshot) => {
  if (!snapshot || !snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() || {};
  const gameTypeId = normalizeGameTypeId(data.gameTypeId);

  if (!isCanonicalStatsGameType(gameTypeId)) {
    return null;
  }

  const completedAt = getTimestampValue(data.completedAt || data.timestamp || null);
  const winner = data.winner || null;
  const summary = normalizeObject(data.summary);

  return {
    id: snapshot.id,
    documentId: snapshot.id,
    collectionId: CANONICAL_STATS_COLLECTIONS.leagueSummaries,
    leagueId: data.leagueId || snapshot.id,
    gameTypeId,
    seasonId: data.seasonId || 'unknown',
    completedAt,
    timestamp: completedAt,
    playerCount: normalizeNumber(data.playerCount),
    winner,
    winners: winner ? [winner] : [],
    summary: {
      averageScore: normalizeNumber(summary.averageScore),
      highestScore: normalizeNumber(summary.highestScore),
      lowestScore: normalizeNumber(summary.lowestScore),
      medianScore: normalizeNumber(summary.medianScore),
      accuracy: normalizeNumber(summary.accuracy)
    },
    status: data.status || null,
    highlights: normalizeArray(data.highlights),
    adapterVersion: data.adapterVersion || null,
    sourceVersion: data.sourceVersion || null,
    metadata: {
      gameTypeId,
      seasonId: data.seasonId || 'unknown',
      winnerLabel: getWinnerLabel(winner),
      highestScore: normalizeNumber(summary.highestScore),
      completedAt
    }
  };
};

export const normalizeLeagueDetailDoc = (snapshot) => {
  if (!snapshot || !snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() || {};
  const gameTypeId = normalizeGameTypeId(data.gameTypeId);

  if (!isCanonicalStatsGameType(gameTypeId)) {
    return null;
  }

  const completedAt = getTimestampValue(data.completedAt || data.timestamp || null);
  const leaders = normalizeArray(data.leaders).map((leader, index) => ({
    ...leader,
    rank: normalizeNumber(leader?.rank, index + 1),
    score: normalizeNumber(leader?.score),
    accuracy: normalizeNumber(leader?.accuracy),
    correctPicks: normalizeNumber(leader?.correctPicks),
    totalPossible: normalizeNumber(leader?.totalPossible)
  }));

  const stats = normalizeObject(data.stats);

  return {
    id: snapshot.id,
    documentId: snapshot.id,
    collectionId: CANONICAL_STATS_COLLECTIONS.leagueDetails,
    leagueId: data.leagueId || snapshot.id,
    gameTypeId,
    seasonId: data.seasonId || 'unknown',
    completedAt,
    timestamp: completedAt,
    playerCount: normalizeNumber(data.playerCount),
    winner: data.winner || null,
    summary: normalizeObject(data.summary),
    highlights: normalizeObject(data.highlights),
    leaders,
    players: leaders,
    leaderboard: leaders,
    stats: {
      cards: normalizeArray(stats.cards),
      sections: normalizeArray(stats.sections),
      roundStats: normalizeObject(stats.roundStats),
      modePayload: normalizeObject(stats.modePayload)
    },
    details: normalizeObject(data.details),
    adapterVersion: data.adapterVersion || null,
    sourceVersion: data.sourceVersion || null,
    metadata: {
      gameTypeId,
      seasonId: data.seasonId || 'unknown',
      completedAt
    }
  };
};

export const normalizeUserSummaryDoc = (snapshot) => {
  if (!snapshot || !snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() || {};
  const lastUpdated = getTimestampValue(data.lastUpdated || data.timestamp || null);
  const byGameType = normalizeObject(data.byGameType);

  return {
    id: snapshot.id,
    documentId: snapshot.id,
    collectionId: CANONICAL_STATS_COLLECTIONS.userSummaries,
    userId: data.userId || snapshot.id,
    userName: data.userName || 'Unknown User',
    lastUpdated,
    timestamp: lastUpdated,
    summary: {
      totalLeagues: normalizeNumber(data.summary?.totalLeagues),
      totalWins: normalizeNumber(data.summary?.totalWins),
      totalSecondPlace: normalizeNumber(data.summary?.totalSecondPlace)
    },
    byGameType: Object.entries(byGameType).reduce((acc, [gameTypeId, stats]) => {
      const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);
      if (!isCanonicalStatsGameType(normalizedGameTypeId)) {
        return acc;
      }

      acc[normalizedGameTypeId] = {
        leagues: normalizeNumber(stats?.leagues),
        wins: normalizeNumber(stats?.wins),
        bestScore: normalizeNumber(stats?.bestScore),
        averageScore: normalizeNumber(stats?.averageScore),
        bestAccuracy: normalizeAccuracy(stats?.bestAccuracy ?? stats?.bestAccuracyPct),
        averageAccuracy: normalizeAccuracy(stats?.averageAccuracy ?? stats?.averageAccuracyPct)
      };
      return acc;
    }, {}),
    metadata: {
      gameTypes: Object.keys(byGameType).filter((gameTypeId) =>
        isCanonicalStatsGameType(normalizeGameTypeId(gameTypeId))
      ),
      lastUpdated
    }
  };
};

export const normalizeUserDetailDoc = (snapshot) => {
  if (!snapshot || !snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() || {};
  const lastUpdated = getTimestampValue(data.lastUpdated || data.timestamp || null);
  const history = normalizeArray(data.history).map((entry) => ({
    ...entry,
    gameTypeId: normalizeGameTypeId(entry?.gameTypeId),
    rank: normalizeNumber(entry?.rank),
    score: normalizeNumber(entry?.score),
    accuracy: normalizeAccuracy(entry?.accuracy ?? entry?.percentage),
    correctPicks: normalizeNumber(entry?.correctPicks),
    totalPossible: normalizeNumber(entry?.totalPossible)
  })).filter((entry) => isCanonicalStatsGameType(entry.gameTypeId));

  return {
    id: snapshot.id,
    documentId: snapshot.id,
    collectionId: CANONICAL_STATS_COLLECTIONS.userDetails,
    userId: data.userId || snapshot.id,
    userName: data.userName || 'Unknown User',
    lastUpdated,
    timestamp: lastUpdated,
    history,
    leagues: history,
    completedLeagues: history,
    processedLeagues: history,
    metadata: {
      lastUpdated,
      gameTypes: Array.from(new Set(history.map((entry) => entry.gameTypeId)))
    }
  };
};

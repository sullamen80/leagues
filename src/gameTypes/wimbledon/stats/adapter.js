import {
  buildCanonicalLeagueDetail,
  buildCanonicalLeagueSummary,
  buildCanonicalUserHistoryEntry,
  buildLeagueMetrics,
  calculateAverage
} from '../../common/services/BaseEndLeagueStatsService';
import { createStatsAdapter } from '../../common/stats';
import { WIMBLEDON_ROUNDS } from '../constants/wimbledonConstants';

const getScores = (context = {}) => Array.isArray(context.userScores) ? context.userScores : [];

const buildLeaders = (context = {}) => getScores(context).map((user, index) => ({
  userId: user.userId,
  userName: user.userName,
  rank: index + 1,
  score: Number(user.score || 0),
  accuracy: Number(user.accuracy || 0),
  correctPicks: Number(user.correctPicks || 0),
  totalPossible: Number(user.possiblePicks || 0),
  specialPicks: {
    championSlotId: user.championSlotId || null,
    championCorrect: Boolean(user.championCorrect),
    finalistHits: Number(user.finalistHits || 0),
    setPredictionHits: Number(user.setPredictionHits || 0),
    setPredictionAttempts: Number(user.setPredictionAttempts || 0)
  },
  roundBreakdown: user.roundBreakdown || {},
  detailPayload: {
    completedPicks: Number(user.completedPicks || 0),
    setPredictionAccuracy: Number(user.setPredictionAccuracy || 0)
  }
}));

const buildRoundStats = (leaders = []) =>
  Object.fromEntries(WIMBLEDON_ROUNDS.map((round) => {
    const correctPicks = leaders.reduce((sum, leader) => sum + Number(leader.roundBreakdown?.[round.key]?.correct || 0), 0);
    const possiblePicks = leaders.reduce((sum, leader) => sum + Number(leader.roundBreakdown?.[round.key]?.possible || 0), 0);
    return [round.key, {
      correctPicks,
      possiblePicks,
      percentage: possiblePicks > 0 ? correctPicks / possiblePicks : 0
    }];
  }));

const buildUserHistorySummary = (entries = []) => {
  const validEntries = entries.filter(Boolean);
  const grouped = validEntries.reduce((acc, entry) => {
    const gameTypeId = entry.gameTypeId || 'unknown';
    acc[gameTypeId] = [...(acc[gameTypeId] || []), entry];
    return acc;
  }, {});
  const byGameType = Object.fromEntries(
    Object.entries(grouped).map(([gameTypeId, gameEntries]) => [
      gameTypeId,
      {
        leagues: gameEntries.length,
        wins: gameEntries.filter((entry) => entry.rank === 1).length,
        bestScore: Math.max(0, ...gameEntries.map((entry) => Number(entry.score || 0))),
        averageScore: calculateAverage(gameEntries.map((entry) => entry.score)),
        bestAccuracy: Math.max(0, ...gameEntries.map((entry) => Number(entry.accuracy || 0))),
        averageAccuracy: calculateAverage(gameEntries.map((entry) => entry.accuracy)),
        ...(gameTypeId === 'wimbledon' ? {
          championPickSuccessRate: calculateAverage(gameEntries.map((entry) => entry.specialPicks?.championCorrect ? 1 : 0)),
          setPredictionAccuracy: calculateAverage(gameEntries.map((entry) => entry.detailPayload?.setPredictionAccuracy || 0))
        } : {})
      }
    ])
  );

  return {
    summary: {
      totalLeagues: validEntries.length,
      totalWins: validEntries.filter((entry) => entry.rank === 1).length,
      totalSecondPlace: validEntries.filter((entry) => entry.rank === 2).length
    },
    byGameType
  };
};

export const statsAdapter = createStatsAdapter({
  gameTypeId: 'wimbledon',
  getListBadge: () => ({ label: 'Wimbledon', tone: 'emerald' }),
  buildLeagueSummary: (context) => {
    const leaders = buildLeaders(context);
    const summary = buildLeagueMetrics({ leaders, totalPossiblePicks: 127 });
    const championSlotId = context.legacyLeagueDoc?.officialResultsByMatchId?.['final-1']?.winnerSlotId || null;
    const championName = context.legacyLeagueDoc?.entrantsBySlot?.[championSlotId]?.name || 'TBD';
    return buildCanonicalLeagueSummary({
      leagueId: context.leagueId,
      gameTypeId: 'wimbledon',
      seasonId: String(context.legacyLeagueDoc?.edition || context.seasonId),
      completedAt: context.completedAt,
      playerCount: context.playerCount,
      winner: context.winner,
      summary,
      status: championSlotId ? 'completed' : 'inProgress',
      highlights: {
        champion: championName,
        eventLabel: context.legacyLeagueDoc?.eventLabel || 'Singles Championship',
        setPredictionEnabled: Boolean(context.settings?.setPredictionEnabled)
      },
      adapterVersion: context.adapterVersion,
      sourceVersion: context.sourceVersion
    });
  },
  buildLeagueDetail: (context) => {
    const leaders = buildLeaders(context);
    const summary = buildLeagueMetrics({ leaders, totalPossiblePicks: 127 });
    const roundStats = buildRoundStats(leaders);
    const championSlotId = context.legacyLeagueDoc?.officialResultsByMatchId?.['final-1']?.winnerSlotId || null;
    const championName = context.legacyLeagueDoc?.entrantsBySlot?.[championSlotId]?.name || 'TBD';
    return buildCanonicalLeagueDetail({
      leagueId: context.leagueId,
      gameTypeId: 'wimbledon',
      seasonId: String(context.legacyLeagueDoc?.edition || context.seasonId),
      completedAt: context.completedAt,
      leaders,
      playerCount: context.playerCount,
      winner: context.winner,
      summary,
      highlights: {
        champion: championName,
        eventLabel: context.legacyLeagueDoc?.eventLabel || 'Singles Championship',
        setPredictionEnabled: Boolean(context.settings?.setPredictionEnabled)
      },
      stats: {
        cards: [
          { title: 'Players', value: context.playerCount },
          { title: 'Average Score', value: summary.averageScore },
          { title: 'Highest Score', value: summary.highestScore },
          { title: 'Pick Accuracy', value: summary.accuracy }
        ],
        roundStats,
        modePayload: {
          championSlotId,
          eventLabel: context.legacyLeagueDoc?.eventLabel,
          edition: context.legacyLeagueDoc?.edition,
          setPredictionEnabled: Boolean(context.settings?.setPredictionEnabled),
          auditCorrectionCount: Number(context.previewData?.auditCorrectionCount || 0)
        }
      },
      adapterVersion: context.adapterVersion,
      sourceVersion: context.sourceVersion
    });
  },
  buildUserHistoryEntry: ({ userScore, leagueId, seasonId, completedAt, rank, adapterVersion, sourceVersion }) =>
    buildCanonicalUserHistoryEntry({
      leagueId,
      gameTypeId: 'wimbledon',
      seasonId,
      completedAt,
      rank,
      score: userScore.score,
      accuracy: userScore.accuracy,
      correctPicks: userScore.correctPicks,
      totalPossible: userScore.possiblePicks,
      specialPicks: {
        championSlotId: userScore.championSlotId,
        championCorrect: userScore.championCorrect,
        finalistHits: userScore.finalistHits,
        setPredictionHits: userScore.setPredictionHits,
        setPredictionAttempts: userScore.setPredictionAttempts
      },
      roundBreakdown: userScore.roundBreakdown,
      detailPayload: {
        completedPicks: userScore.completedPicks,
        setPredictionAccuracy: userScore.setPredictionAccuracy
      },
      adapterVersion,
      sourceVersion
    }),
  buildUserSummaryStats: ({ userHistoryEntries }) => buildUserHistorySummary(userHistoryEntries)
});

export default statsAdapter;

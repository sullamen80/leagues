import {
  buildCanonicalLeagueDetail,
  buildCanonicalLeagueSummary,
  buildCanonicalUserHistoryEntry,
  buildLeagueMetrics,
  calculateAverage
} from '../../common/services/BaseEndLeagueStatsService';
import { createStatsAdapter } from '../../common/stats';
import { getTeamName } from '../services/worldCupService';

const getScores = (context = {}) => Array.isArray(context.userScores) ? context.userScores : [];

const buildLeaders = (context = {}) => getScores(context).map((user, index) => ({
  userId: user.userId,
  userName: user.userName,
  rank: index + 1,
  score: Number(user.score || 0),
  accuracy: Number(user.correctPickPercentage || 0),
  correctPicks: Number(user.correctPicks || 0),
  totalPossible: Number(user.totalPossible || 0),
  specialPicks: {
    championTeamId: user.championTeamId || null,
    championCorrect: Boolean(user.championCorrect),
    exactScoreHits: Number(user.exactScoreHits || 0)
  },
  roundBreakdown: user.roundBreakdown || {},
  detailPayload: {
    groupPoints: Number(user.groupPoints || 0),
    knockoutPoints: Number(user.knockoutPoints || 0),
    bonusPoints: Number(user.bonusPoints || 0),
    possiblePoints: Number(user.possiblePoints || 0),
    exactScoreHits: Number(user.exactScoreHits || 0)
  }
}));

const buildSummary = (leaders = []) => {
  const base = buildLeagueMetrics({ leaders, totalPossiblePicks: 0 });
  const correctPicks = leaders.reduce((total, leader) => total + Number(leader.correctPicks || 0), 0);
  const possiblePicks = leaders.reduce((total, leader) => total + Number(leader.totalPossible || 0), 0);

  return {
    ...base,
    accuracy: possiblePicks > 0 ? correctPicks / possiblePicks : 0
  };
};

const buildRoundStats = (leaders = []) => {
  const roundKeys = Array.from(new Set(leaders.flatMap((leader) => Object.keys(leader.roundBreakdown || {}))));

  return Object.fromEntries(roundKeys.map((roundKey) => {
    const totals = leaders.reduce((current, leader) => {
      const round = leader.roundBreakdown?.[roundKey] || {};
      return {
        correctPicks: current.correctPicks + Number(round.correctPicks ?? round.correct ?? 0),
        possiblePicks: current.possiblePicks + Number(round.possiblePicks || 0),
        points: current.points + Number(round.points ?? round.totalPoints ?? 0),
        possiblePoints: current.possiblePoints + Number(round.possiblePoints ?? round.possible ?? 0),
        exactScoreHits: current.exactScoreHits + Number(round.exactScoreHits || 0)
      };
    }, {
      correctPicks: 0,
      possiblePicks: 0,
      points: 0,
      possiblePoints: 0,
      exactScoreHits: 0
    });

    return [roundKey, {
      ...totals,
      accuracy: totals.possiblePicks > 0 ? totals.correctPicks / totals.possiblePicks : 0
    }];
  }));
};

const buildUserHistorySummary = (entries = []) => {
  const validEntries = entries.filter(Boolean);
  const grouped = validEntries.reduce((acc, entry) => {
    const gameTypeId = entry.gameTypeId || 'unknown';
    acc[gameTypeId] = [...(acc[gameTypeId] || []), entry];
    return acc;
  }, {});
  const byGameType = Object.fromEntries(Object.entries(grouped).map(([gameTypeId, gameEntries]) => [
    gameTypeId,
    {
      leagues: gameEntries.length,
      wins: gameEntries.filter((entry) => Number(entry.rank) === 1).length,
      bestScore: Math.max(0, ...gameEntries.map((entry) => Number(entry.score || 0))),
      averageScore: calculateAverage(gameEntries.map((entry) => entry.score)),
      bestAccuracy: Math.max(0, ...gameEntries.map((entry) => Number(entry.accuracy || 0))),
      averageAccuracy: calculateAverage(gameEntries.map((entry) => entry.accuracy)),
      ...(gameTypeId === 'worldCup' ? {
        championPickSuccessRate: calculateAverage(
          gameEntries.map((entry) => entry.specialPicks?.championCorrect ? 1 : 0)
        ),
        averageExactScoreHits: calculateAverage(
          gameEntries.map((entry) => entry.specialPicks?.exactScoreHits || 0)
        )
      } : {})
    }
  ]));

  return {
    summary: {
      totalLeagues: validEntries.length,
      totalWins: validEntries.filter((entry) => Number(entry.rank) === 1).length,
      totalSecondPlace: validEntries.filter((entry) => Number(entry.rank) === 2).length
    },
    byGameType
  };
};

const getTournamentContext = (context = {}) => {
  const gameData = context.legacyLeagueDoc || {};
  const championTeamId = gameData.knockoutRounds?.final?.[0]?.winnerTeamId || null;

  return {
    gameData,
    championTeamId,
    championName: getTeamName(championTeamId, gameData.groups || []),
    seasonId: String(gameData.edition || context.seasonId)
  };
};

export const statsAdapter = createStatsAdapter({
  gameTypeId: 'worldCup',
  getListBadge: () => ({
    label: 'World Cup',
    tone: 'emerald'
  }),
  buildLeagueSummary: (context) => {
    const leaders = buildLeaders(context);
    const summary = buildSummary(leaders);
    const tournament = getTournamentContext(context);

    return buildCanonicalLeagueSummary({
      leagueId: context.leagueId,
      gameTypeId: 'worldCup',
      seasonId: tournament.seasonId,
      completedAt: context.completedAt,
      playerCount: context.playerCount,
      winner: context.winner,
      summary,
      status: tournament.championTeamId ? 'completed' : 'inProgress',
      highlights: {
        champion: tournament.championName,
        championTeamId: tournament.championTeamId,
        edition: tournament.gameData.edition || context.seasonId,
        exactScoreBonusEnabled: Boolean(context.settings?.enableExactScoreBonus),
        thirdPlaceScored: Boolean(context.settings?.scoreThirdPlaceMatch)
      },
      adapterVersion: context.adapterVersion,
      sourceVersion: context.sourceVersion
    });
  },
  buildLeagueDetail: (context) => {
    const leaders = buildLeaders(context);
    const summary = buildSummary(leaders);
    const tournament = getTournamentContext(context);
    const roundStats = context.previewData?.roundStats || buildRoundStats(leaders);
    const exactScoreHits = leaders.reduce(
      (total, leader) => total + Number(leader.specialPicks?.exactScoreHits || 0),
      0
    );

    return buildCanonicalLeagueDetail({
      leagueId: context.leagueId,
      gameTypeId: 'worldCup',
      seasonId: tournament.seasonId,
      completedAt: context.completedAt,
      leaders,
      playerCount: context.playerCount,
      winner: context.winner,
      summary,
      highlights: {
        champion: tournament.championName,
        championTeamId: tournament.championTeamId,
        edition: tournament.gameData.edition || context.seasonId,
        exactScoreBonusEnabled: Boolean(context.settings?.enableExactScoreBonus),
        thirdPlaceScored: Boolean(context.settings?.scoreThirdPlaceMatch)
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
          championTeamId: tournament.championTeamId,
          championName: tournament.championName,
          edition: tournament.gameData.edition,
          exactScoreHits,
          exactScoreBonusEnabled: Boolean(context.settings?.enableExactScoreBonus),
          thirdPlaceScored: Boolean(context.settings?.scoreThirdPlaceMatch)
        }
      },
      adapterVersion: context.adapterVersion,
      sourceVersion: context.sourceVersion
    });
  },
  buildUserHistoryEntry: ({
    userScore,
    leagueId,
    seasonId,
    completedAt,
    rank,
    adapterVersion,
    sourceVersion
  }) => buildCanonicalUserHistoryEntry({
    leagueId,
    gameTypeId: 'worldCup',
    seasonId,
    completedAt,
    rank,
    score: userScore.score,
    accuracy: userScore.correctPickPercentage,
    correctPicks: userScore.correctPicks,
    totalPossible: userScore.totalPossible,
    specialPicks: {
      championTeamId: userScore.championTeamId || null,
      championCorrect: Boolean(userScore.championCorrect),
      exactScoreHits: Number(userScore.exactScoreHits || 0)
    },
    roundBreakdown: userScore.roundBreakdown || {},
    detailPayload: {
      groupPoints: Number(userScore.groupPoints || 0),
      knockoutPoints: Number(userScore.knockoutPoints || 0),
      bonusPoints: Number(userScore.bonusPoints || 0),
      possiblePoints: Number(userScore.possiblePoints || 0)
    },
    adapterVersion,
    sourceVersion
  }),
  buildUserSummaryStats: ({ userHistoryEntries }) => buildUserHistorySummary(userHistoryEntries),
  renderLeagueHeaderMeta: ({ leagueDetail }) => [
    { label: 'World Cup Champion', value: leagueDetail?.highlights?.champion || 'TBD' },
    { label: 'Edition', value: leagueDetail?.seasonId || '—' }
  ],
  renderLeagueSections: ({ leagueDetail }) => [
    { label: 'World Cup Champion', value: leagueDetail?.highlights?.champion || 'TBD' },
    { label: 'Exact Score Hits', value: Number(leagueDetail?.stats?.modePayload?.exactScoreHits || 0) },
    {
      label: 'Third Place Scoring',
      value: leagueDetail?.stats?.modePayload?.thirdPlaceScored ? 'Enabled' : 'Disabled'
    }
  ],
  renderLeagueColumns: () => [
    {
      key: 'groupPoints',
      label: 'Groups',
      render: (leader) => Number(leader?.detailPayload?.groupPoints || 0)
    },
    {
      key: 'knockoutPoints',
      label: 'Knockout',
      render: (leader) => Number(leader?.detailPayload?.knockoutPoints || 0)
    },
    {
      key: 'bonusPoints',
      label: 'Score Bonus',
      render: (leader) => Number(leader?.detailPayload?.bonusPoints || 0)
    }
  ],
  renderLeagueExpanded: ({ leader }) => ({
    title: 'World Cup Performance',
    details: {
      groupPoints: Number(leader?.detailPayload?.groupPoints || 0),
      knockoutPoints: Number(leader?.detailPayload?.knockoutPoints || 0),
      exactScoreBonusPoints: Number(leader?.detailPayload?.bonusPoints || 0),
      exactScoreHits: Number(leader?.specialPicks?.exactScoreHits || 0),
      championPickCorrect: Boolean(leader?.specialPicks?.championCorrect)
    },
    roundBreakdown: leader?.roundBreakdown || {}
  }),
  renderUserExpanded: ({ historyEntry }) => ({
    title: 'World Cup Performance',
    details: {
      groupPoints: Number(historyEntry?.detailPayload?.groupPoints || 0),
      knockoutPoints: Number(historyEntry?.detailPayload?.knockoutPoints || 0),
      exactScoreBonusPoints: Number(historyEntry?.detailPayload?.bonusPoints || 0),
      exactScoreHits: Number(historyEntry?.specialPicks?.exactScoreHits || 0),
      championPickCorrect: Boolean(historyEntry?.specialPicks?.championCorrect)
    },
    roundBreakdown: historyEntry?.roundBreakdown || {}
  })
});

export default statsAdapter;

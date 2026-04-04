import {
  buildCanonicalLeagueDetail,
  buildCanonicalLeagueSummary,
  buildCanonicalUserHistoryEntry,
  buildLeagueMetrics,
  calculateAverage
} from '../../common/services/BaseEndLeagueStatsService';

const VERSION = 1;
const ROUND_ORDER = [
  'RoundOf64',
  'RoundOf32',
  'Sweet16',
  'Elite8',
  'FinalFour',
  'Championship'
];
const ROUND_LABELS = {
  RoundOf64: 'Round of 64',
  RoundOf32: 'Round of 32',
  Sweet16: 'Sweet 16',
  Elite8: 'Elite 8',
  FinalFour: 'Final Four',
  Championship: 'Championship'
};
const ROUND_POINT_VALUES = {
  RoundOf64: 1,
  RoundOf32: 2,
  Sweet16: 4,
  Elite8: 8,
  FinalFour: 16,
  Championship: 32
};

const getUserScores = (context = {}) => (Array.isArray(context.userScores) ? context.userScores : []);

const getTotalPossiblePicks = (context = {}) => {
  const userScores = getUserScores(context);
  return Number(userScores[0]?.totalPossible || userScores[0]?.possiblePoints || 0);
};

const getRoundCorrect = (roundData = {}) => Number(roundData.correct ?? roundData.correctPicks ?? 0);

const getRoundPossible = (roundData = {}) => Number(roundData.possible ?? roundData.possiblePicks ?? roundData.total ?? 0);

const buildRoundStats = (userScores = []) => {
  const roundKeys = [...new Set(userScores.flatMap((user) => Object.keys(user.roundBreakdown || {})))];

  return roundKeys.reduce((acc, roundKey) => {
    const totals = userScores.reduce((sum, user) => {
      const roundData = user.roundBreakdown?.[roundKey] || {};
      return {
        correct: sum.correct + getRoundCorrect(roundData),
        possible: sum.possible + getRoundPossible(roundData)
      };
    }, { correct: 0, possible: 0 });

    acc[roundKey] = {
      correctPicks: totals.correct,
      possiblePicks: totals.possible,
      percentage: totals.possible > 0 ? totals.correct / totals.possible : 0
    };

    return acc;
  }, {});
};

const summarizeHistoryEntries = (historyEntries = []) => {
  const validEntries = historyEntries.filter((entry) => entry && typeof entry === 'object');

  const summary = {
    totalLeagues: validEntries.length,
    totalWins: validEntries.filter((entry) => entry.rank === 1).length,
    totalSecondPlace: validEntries.filter((entry) => entry.rank === 2).length
  };

  const byGameType = validEntries.reduce((acc, entry) => {
    const gameTypeId = entry.gameTypeId || 'unknown';
    const next = acc[gameTypeId] || {
      leagues: 0,
      wins: 0,
      bestScore: 0,
      averageScore: 0,
      bestAccuracy: 0,
      averageAccuracy: 0,
      _scores: [],
      _accuracies: []
    };

    next.leagues += 1;
    next.wins += entry.rank === 1 ? 1 : 0;
    next.bestScore = Math.max(next.bestScore, Number(entry.score || 0));
    next._scores.push(Number(entry.score || 0));
    next.averageScore = calculateAverage(next._scores);
    next.bestAccuracy = Math.max(next.bestAccuracy, Number(entry.accuracy || 0));
    next._accuracies.push(Number(entry.accuracy || 0));
    next.averageAccuracy = calculateAverage(next._accuracies);
    acc[gameTypeId] = next;
    return acc;
  }, {});

  Object.values(byGameType).forEach((entry) => {
    delete entry._scores;
    delete entry._accuracies;
  });

  return { summary, byGameType };
};

const getChampion = (legacyLeagueDoc = {}) => (
  legacyLeagueDoc.Championship?.winner ||
  legacyLeagueDoc.champion ||
  legacyLeagueDoc.championName ||
  null
);

const buildPickCard = ({ label, value, correct = null, helper = '' }) => ({
  label,
  value: value || 'No pick',
  badge: correct === null ? null : correct ? 'Correct' : 'Missed',
  status: correct === null ? 'neutral' : correct ? 'success' : 'neutral',
  helper
});

const buildMarchBreakdown = (entry = {}, leagueDetail = null) => {
  const roundBreakdown = entry.roundBreakdown || {};
  const specialPicks = entry.specialPicks || {};

  const rows = ROUND_ORDER
    .map((roundKey) => {
      const round = roundBreakdown[roundKey] || {};
      const hasData = Number(round.correct || 0) > 0 || Number(round.total || 0) > 0;

      if (!hasData) {
        return null;
      }

      return {
        id: roundKey,
        round: ROUND_LABELS[roundKey] || roundKey,
        correct: Number(round.correct || 0),
        possible: Math.round(Number(round.possible || 0) / Number(ROUND_POINT_VALUES[roundKey] || 1)),
        base: Number(round.base || 0),
        bonus: Number(round.bonus || 0),
        total: Number(round.total || 0)
      };
    })
    .filter(Boolean);

  return {
    layout: 'scoringBreakdown',
    title: 'March Madness Breakdown',
    summaryCards: [
      { label: 'Score', value: Number(entry.score || 0), meta: 'Total points', tone: 'slate' },
      { label: 'Accuracy', value: `${(Number(entry.accuracy || 0) * 100).toFixed(1)}%`, meta: 'Pick accuracy', tone: 'blue' },
      { label: 'Correct Picks', value: `${Number(entry.correctPicks || 0)} / ${Number(entry.totalPossible || 0)}`, meta: 'Correct matchups', tone: 'emerald' },
      { label: 'Rank', value: entry.rank ? `#${entry.rank}` : '—', meta: leagueDetail?.playerCount ? `of ${leagueDetail.playerCount}` : 'League finish', tone: 'amber' }
    ],
    scoringTitle: 'Scoring Breakdown',
    scoringCards: [
      { label: 'Base Points', value: Number(entry.detailPayload?.basePoints || 0), meta: 'Standard round scoring', tone: 'indigo' },
      { label: 'Bonus Points', value: Number(entry.detailPayload?.bonusPoints || 0), meta: 'Seed and upset bonuses', tone: 'purple' },
      { label: 'Upsets Called', value: Number(specialPicks.upsetCount || 0), meta: 'Tracked upset hits', tone: 'amber' }
    ],
    specialTitle: 'Key Picks',
    specialPickCards: [
      buildPickCard({
        label: 'Champion Pick',
        value: specialPicks.championPick,
        correct: specialPicks.championCorrect,
        helper: leagueDetail?.highlights?.champion ? `Actual champion: ${leagueDetail.highlights.champion}` : ''
      })
    ],
    table: {
      title: 'Round Breakdown',
      columns: [
        { key: 'round', label: 'Round' },
        { key: 'correct', label: 'Correct', align: 'center' },
        { key: 'possible', label: 'Possible', align: 'right' },
        { key: 'base', label: 'Base', align: 'right' },
        { key: 'bonus', label: 'Bonus', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' }
      ],
      rows
    }
  };
};

const buildLeaderRows = (context = {}) => {
  const userScores = getUserScores(context);
  const totalPossiblePicks = getTotalPossiblePicks(context);

  return userScores.map((user, index) => ({
    userId: user.userId,
    userName: user.userName,
    rank: index + 1,
    score: user.score || 0,
    accuracy: Number(user.correctPickPercentage || 0),
    correctPicks: Number(user.correctPicks || 0),
    totalPossible: Number(user.totalPossible || totalPossiblePicks),
    specialPicks: {
      championPick: user.championPick || null,
      championCorrect: !!user.championCorrect,
      upsetCount: user.upsetCount || 0
    },
    roundBreakdown: user.roundBreakdown || {},
    detailPayload: {
      userPhoto: user.userPhoto || null,
      basePoints: user.basePoints || 0,
      bonusPoints: user.bonusPoints || 0,
      roundBreakdown: user.roundBreakdown || {},
      seedPerformance: context.previewData?.seedPerformance || null
    }
  }));
};

const buildCanonicalDetail = (context = {}) => {
  const leaders = buildLeaderRows(context);
  const totalPossiblePicks = getTotalPossiblePicks(context);
  const summary = buildLeagueMetrics({ leaders, totalPossiblePicks });
  const roundStats = context.previewData?.roundStats || buildRoundStats(getUserScores(context));
  const champion = getChampion(context.legacyLeagueDoc);
  const finalFourTeams = context.previewData?.finalFourTeams || [];
  const upsetStats = context.previewData?.upsetStats || null;
  const playerCount = context.playerCount || leaders.length;

  return buildCanonicalLeagueDetail({
    leagueId: context.leagueId,
    gameTypeId: context.gameTypeId,
    seasonId: context.seasonId,
    completedAt: context.completedAt,
    leaders,
    stats: {
      cards: [
        { title: 'Players', value: playerCount },
        { title: 'Average Score', value: summary.averageScore },
        { title: 'Highest Score', value: summary.highestScore },
        { title: 'Median Score', value: summary.medianScore }
      ],
      sections: [
        { label: 'Champion', value: champion || 'TBD' },
        { label: 'Upsets', value: String(upsetStats?.totalUpsets ?? 0) },
        {
          label: 'Final Four',
          value: finalFourTeams.length > 0 ? finalFourTeams.map((team) => team.name).join(', ') : 'TBD'
        }
      ],
      roundStats,
      modePayload: {
        upsetStats,
        seedPerformance: context.previewData?.seedPerformance || null
      }
    },
    playerCount,
    winner: context.winner || leaders[0] || null,
    summary,
    highlights: {
      champion,
      upsetCount: upsetStats?.totalUpsets || 0,
      finalFourTeams
    },
    adapterVersion: VERSION
  });
};

export const statsAdapter = {
  gameTypeId: 'marchMadness',
  version: VERSION,

  buildLeagueSummary(context = {}) {
    const leaders = buildLeaderRows(context);
    const totalPossiblePicks = getTotalPossiblePicks(context);
    const summary = buildLeagueMetrics({ leaders, totalPossiblePicks });
    const champion = getChampion(context.legacyLeagueDoc);

    return buildCanonicalLeagueSummary({
      leagueId: context.leagueId,
      gameTypeId: context.gameTypeId,
      seasonId: context.seasonId,
      completedAt: context.completedAt,
      playerCount: context.playerCount || leaders.length,
      winner: context.winner || leaders[0] || null,
      summary,
      status: champion ? 'completed' : 'inProgress',
      highlights: {
        champion,
        upsetCount: context.previewData?.upsetStats?.totalUpsets || 0,
        finalFourTeams: context.previewData?.finalFourTeams || []
      },
      adapterVersion: VERSION
    });
  },

  buildLeagueDetail(context = {}) {
    return buildCanonicalDetail(context);
  },

  buildUserHistoryEntry(context = {}) {
    const userScore = context.userScore || {};
    return buildCanonicalUserHistoryEntry({
      leagueId: context.leagueId,
      gameTypeId: context.gameTypeId,
      seasonId: context.seasonId,
      completedAt: context.completedAt,
      rank: context.rank || 0,
      score: userScore.score || 0,
      accuracy: Number(userScore.correctPickPercentage || 0),
      correctPicks: Number(userScore.correctPicks || 0),
      totalPossible: Number(userScore.totalPossible || 0),
      specialPicks: {
        championPick: userScore.championPick || null,
        championCorrect: !!userScore.championCorrect,
        upsetCount: userScore.upsetCount || 0
      },
      roundBreakdown: userScore.roundBreakdown || {},
      detailPayload: {
        userPhoto: userScore.userPhoto || null,
        basePoints: userScore.basePoints || 0,
        bonusPoints: userScore.bonusPoints || 0,
        roundBreakdown: userScore.roundBreakdown || {}
      },
      adapterVersion: VERSION
    });
  },

  buildUserSummaryStats({ userHistoryEntries = [] } = {}) {
    return summarizeHistoryEntries(userHistoryEntries);
  },

  renderLeagueHeaderMeta({ leagueDetail } = {}) {
    if (!leagueDetail) return [];

    return [
      { label: 'Champion', value: leagueDetail.highlights?.champion || 'TBD' },
      { label: 'Players', value: leagueDetail.playerCount || 0 },
      { label: 'Upsets', value: leagueDetail.highlights?.upsetCount || 0 }
    ];
  },

  renderLeagueColumns() {
    return [
      {
        key: 'championPick',
        label: 'Champion Pick',
        render: (player) => (
          <span className={player.specialPicks?.championCorrect ? 'font-medium text-green-600' : 'text-gray-600'}>
            {player.specialPicks?.championPick || 'None'}
            {player.specialPicks?.championCorrect ? ' ✓' : ''}
          </span>
        )
      }
    ];
  },

  renderLeagueExpanded({ leader, leagueDetail } = {}) {
    return buildMarchBreakdown(leader, leagueDetail);
  },

  renderLeagueSections({ leagueDetail } = {}) {
    return leagueDetail?.stats?.sections || [];
  },

  renderUserColumns() {
    return [
      { key: 'rank', label: 'Rank' },
      { key: 'score', label: 'Score' },
      { key: 'accuracy', label: 'Accuracy' },
      { key: 'specialPicks', label: 'Champion' }
    ];
  },

  renderUserRow({ historyEntry } = {}) {
    return historyEntry?.specialPicks || {};
  },

  renderUserExpanded({ historyEntry } = {}) {
    return {
      ...buildMarchBreakdown(historyEntry),
      title: 'March Madness History'
    };
  },

  getListBadge() {
    return {
      label: 'March Madness',
      tone: 'amber',
      gameTypeId: 'marchMadness'
    };
  }
};

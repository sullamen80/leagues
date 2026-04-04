import {
  buildCanonicalLeagueDetail,
  buildCanonicalLeagueSummary,
  buildCanonicalUserHistoryEntry,
  buildLeagueMetrics,
  calculateAverage
} from '../../common/services/BaseEndLeagueStatsService';
import { ROUND_KEYS } from '../constants/playoffConstants';

const VERSION = 1;
const ROUND_ORDER = [
  ROUND_KEYS.PLAY_IN,
  ROUND_KEYS.FIRST_ROUND,
  ROUND_KEYS.CONF_SEMIS,
  ROUND_KEYS.CONF_FINALS,
  ROUND_KEYS.NBA_FINALS
];

const getUserScores = (context = {}) => (Array.isArray(context.userScores) ? context.userScores : []);

const getTotalPossiblePicks = (context = {}) => {
  const userScores = getUserScores(context);
  return Number(userScores[0]?.totalPossible || userScores[0]?.possiblePoints || 0);
};

const getRoundCorrect = (roundData = {}) => Number(roundData.correctPicks ?? roundData.correct ?? 0);

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
  legacyLeagueDoc?.[ROUND_KEYS.CHAMPION] ||
  legacyLeagueDoc?.[ROUND_KEYS.NBA_FINALS]?.winner ||
  legacyLeagueDoc?.champion ||
  null
);

const getFinalsMVP = (legacyLeagueDoc = {}) => (
  legacyLeagueDoc?.[ROUND_KEYS.FINALS_MVP] ||
  legacyLeagueDoc?.finalsMVP ||
  null
);

const buildPickCard = ({ label, value, correct = null, helper = '' }) => ({
  label,
  value: value || 'No pick',
  badge: correct === null ? null : correct ? 'Correct' : 'Missed',
  status: correct === null ? 'neutral' : correct ? 'success' : 'neutral',
  helper
});

const buildNBABreakdown = (entry = {}, leagueDetail = null) => {
  const roundBreakdown = entry.roundBreakdown || {};
  const specialPicks = entry.specialPicks || {};

  const rows = ROUND_ORDER
    .map((roundKey) => {
      const round = roundBreakdown[roundKey] || {};
      const correctPicks = Number(round.correctPicks || 0);
      const totalPoints = Number(round.totalPoints || 0);
      const hasData = correctPicks > 0 || totalPoints > 0;

      if (!hasData) {
        return null;
      }

      return {
        id: roundKey,
        round: roundKey,
        correct: correctPicks,
        base: Number(round.basePoints || 0),
        series: Number(round.seriesLengthPoints || 0),
        upset: Number(round.upsetPoints || 0),
        total: totalPoints
      };
    })
    .filter(Boolean);

  const finalsMVPPoints = Number(entry.detailPayload?.finalsMVPPoints || 0);
  if (finalsMVPPoints || specialPicks.finalsMVPPick) {
    rows.push({
      id: 'finals-mvp',
      round: 'Finals MVP',
      correct: specialPicks.finalsMVPCorrect ? 'Correct' : 'Missed',
      base: finalsMVPPoints,
      series: '—',
      upset: '—',
      total: finalsMVPPoints
    });
  }

  return {
    layout: 'scoringBreakdown',
    title: 'NBA Playoffs Breakdown',
    summaryCards: [
      { label: 'Score', value: Number(entry.score || 0), meta: 'Total points', tone: 'slate' },
      { label: 'Accuracy', value: `${(Number(entry.accuracy || 0) * 100).toFixed(1)}%`, meta: 'Series winners picked correctly', tone: 'blue' },
      { label: 'Correct Picks', value: `${Number(entry.correctPicks || 0)} / ${Number(entry.totalPossible || 0)}`, meta: 'Correct series winners', tone: 'emerald' },
      { label: 'Rank', value: entry.rank ? `#${entry.rank}` : '—', meta: leagueDetail?.playerCount ? `of ${leagueDetail.playerCount}` : 'League finish', tone: 'amber' }
    ],
    scoringTitle: 'Scoring Breakdown',
    scoringCards: [
      { label: 'Base Points', value: Number(entry.detailPayload?.basePoints || 0), meta: 'Correct series winners', tone: 'indigo' },
      { label: 'Series Length', value: Number(entry.detailPayload?.seriesLengthPoints || 0), meta: 'Series length bonuses', tone: 'emerald' },
      { label: 'Upset Bonus', value: Number(entry.detailPayload?.upsetPoints || 0), meta: 'Lower-seed bonus points', tone: 'purple' },
      { label: 'Finals MVP', value: finalsMVPPoints, meta: 'Bonus pick points', tone: 'amber' }
    ],
    specialTitle: 'Key Picks',
    specialPickCards: [
      buildPickCard({
        label: 'Champion Pick',
        value: specialPicks.championPick,
        correct: specialPicks.championCorrect,
        helper: leagueDetail?.highlights?.champion ? `Actual champion: ${leagueDetail.highlights.champion}` : ''
      }),
      buildPickCard({
        label: 'Finals MVP',
        value: specialPicks.finalsMVPPick,
        correct: specialPicks.finalsMVPCorrect,
        helper: leagueDetail?.highlights?.finalsMVP ? `Actual Finals MVP: ${leagueDetail.highlights.finalsMVP}` : ''
      })
    ],
    table: {
      title: 'Round Breakdown',
      columns: [
        { key: 'round', label: 'Round' },
        { key: 'correct', label: 'Correct', align: 'center' },
        { key: 'base', label: 'Base', align: 'right' },
        { key: 'series', label: 'Series', align: 'right' },
        { key: 'upset', label: 'Upset', align: 'right' },
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
      finalsMVPPick: user.finalsMVPPick || null,
      finalsMVPCorrect: !!user.finalsMVPCorrect
    },
    roundBreakdown: user.roundBreakdown || {},
    detailPayload: {
      userPhoto: user.userPhoto || null,
      basePoints: user.basePoints || 0,
      seriesLengthPoints: user.seriesLengthPoints || 0,
      upsetPoints: user.upsetPoints || 0,
      finalsMVPPoints: user.finalsMVPPoints || 0,
      roundBreakdown: user.roundBreakdown || {},
      playInTournamentEnabled: !!context.legacyLeagueDoc?.playInTournamentEnabled
    }
  }));
};

const buildCanonicalDetail = (context = {}) => {
  const leaders = buildLeaderRows(context);
  const totalPossiblePicks = getTotalPossiblePicks(context);
  const summary = buildLeagueMetrics({ leaders, totalPossiblePicks });
  const roundStats = context.previewData?.roundStats || buildRoundStats(getUserScores(context));
  const champion = getChampion(context.legacyLeagueDoc);
  const finalsMVP = getFinalsMVP(context.legacyLeagueDoc);
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
        { label: 'Finals MVP', value: finalsMVP || 'TBD' },
        { label: 'Play-In', value: context.legacyLeagueDoc?.playInTournamentEnabled ? 'Enabled' : 'Disabled' }
      ],
      roundStats,
      modePayload: {
        playInTournamentEnabled: !!context.legacyLeagueDoc?.playInTournamentEnabled,
        mvpStats: context.previewData?.mvpStats || null,
        cumulativeStats: context.previewData?.cumulativeStats || null
      }
    },
    playerCount,
    winner: context.winner || leaders[0] || null,
    summary,
    highlights: {
      champion,
      finalsMVP,
      hasPlayInTournament: !!context.legacyLeagueDoc?.playInTournamentEnabled
    },
    adapterVersion: VERSION
  });
};

export const statsAdapter = {
  gameTypeId: 'nbaPlayoffs',
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
        finalsMVP: getFinalsMVP(context.legacyLeagueDoc),
        hasPlayInTournament: !!context.legacyLeagueDoc?.playInTournamentEnabled
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
        finalsMVPPick: userScore.finalsMVPPick || null,
        finalsMVPCorrect: !!userScore.finalsMVPCorrect
      },
      roundBreakdown: userScore.roundBreakdown || {},
      detailPayload: {
        userPhoto: userScore.userPhoto || null,
        basePoints: userScore.basePoints || 0,
        seriesLengthPoints: userScore.seriesLengthPoints || 0,
        upsetPoints: userScore.upsetPoints || 0,
        finalsMVPPoints: userScore.finalsMVPPoints || 0,
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
      { label: 'Finals MVP', value: leagueDetail.highlights?.finalsMVP || 'TBD' },
      { label: 'Play-In', value: leagueDetail.highlights?.hasPlayInTournament ? 'Enabled' : 'Disabled' }
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
      },
      {
        key: 'finalsMVPPick',
        label: 'Finals MVP',
        render: (player) => (
          <span className={player.specialPicks?.finalsMVPCorrect ? 'font-medium text-green-600' : 'text-gray-600'}>
            {player.specialPicks?.finalsMVPPick || 'None'}
            {player.specialPicks?.finalsMVPCorrect ? ' ✓' : ''}
          </span>
        )
      }
    ];
  },

  renderLeagueExpanded({ leader, leagueDetail } = {}) {
    return buildNBABreakdown(leader, leagueDetail);
  },

  renderLeagueSections({ leagueDetail } = {}) {
    return leagueDetail?.stats?.sections || [];
  },

  renderUserColumns() {
    return [
      { key: 'rank', label: 'Rank' },
      { key: 'score', label: 'Score' },
      { key: 'accuracy', label: 'Accuracy' },
      { key: 'specialPicks', label: 'Special Picks' }
    ];
  },

  renderUserRow({ historyEntry } = {}) {
    return historyEntry?.specialPicks || {};
  },

  renderUserExpanded({ historyEntry } = {}) {
    return {
      ...buildNBABreakdown(historyEntry),
      title: 'NBA Playoffs History'
    };
  },

  getListBadge() {
    return {
      label: 'NBA Playoffs',
      tone: 'rose',
      gameTypeId: 'nbaPlayoffs'
    };
  }
};

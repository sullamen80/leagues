import React from 'react';
import { formatDate, formatNumber } from '../../../utils/formatters';
import ProgressChart from './visualizations/ProgressChart';
import DistributionChart from './visualizations/DistributionChart';
import ComparisonChart from './visualizations/ComparisonChart';

const ROUND_ORDER = Object.freeze([
  'RoundOf64',
  'RoundOf32',
  'Sweet16',
  'Elite8',
  'FinalFour',
  'Championship',
  'Play In Tournament',
  'First Round',
  'Conference Semifinals',
  'Conference Finals',
  'NBA Finals',
  'Wild Card Round',
  'Divisional Round',
  'Conference Championships',
  'Super Bowl',
  'Finals MVP',
  'Super Bowl MVP',
  'Super Winner Pick',
  'Prop Bets'
]);

const ROUND_ORDER_MAP = ROUND_ORDER.reduce((acc, key, index) => {
  acc[key] = index;
  return acc;
}, {});

const GAME_TYPE_LABELS = Object.freeze({
  marchMadness: 'March Madness',
  nbaPlayoffs: 'NBA Playoffs',
  nflPlayoffs: 'NFL Playoffs'
});

const MARCH_ROUND_LABELS = Object.freeze({
  RoundOf64: 'Round of 64',
  RoundOf32: 'Round of 32',
  Sweet16: 'Sweet 16',
  Elite8: 'Elite 8',
  FinalFour: 'Final Four',
  Championship: 'Championship'
});

const safeArray = (value) => (Array.isArray(value) ? value : []);

const formatPercentage = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const formatLabel = (value = '') => (
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const formatRoundLabel = (value = '') => (
  MARCH_ROUND_LABELS[value] || formatLabel(value)
);

const normalizeRoundStats = (roundStats = {}) => (
  Object.entries(roundStats)
    .map(([roundKey, value], index) => {
      const correctPicks = Number(value?.correctPicks ?? value?.correct ?? 0);
      const possiblePicks = Number(value?.possiblePicks ?? value?.possible ?? value?.totalPossible ?? 0);
      const accuracy = possiblePicks > 0 ? correctPicks / possiblePicks : Number(value?.percentage || 0);

      return {
        id: roundKey,
        name: formatRoundLabel(roundKey),
        correctPicks,
        possiblePicks,
        missedPicks: Math.max(possiblePicks - correctPicks, 0),
        accuracy,
        order: ROUND_ORDER_MAP[roundKey] ?? 100 + index
      };
    })
    .filter((row) => row.correctPicks > 0 || row.possiblePicks > 0 || row.accuracy > 0)
    .sort((left, right) => left.order - right.order)
);

const buildLeaderboardChartData = (leaders = []) => (
  safeArray(leaders)
    .slice(0, 8)
    .map((leader) => ({
      name: leader.userName || leader.userId || 'Unknown',
      score: Number(leader.score || 0),
      correctPicks: Number(leader.correctPicks || 0),
      accuracyPct: Number((leader.accuracy || 0) * 100).toFixed(1)
    }))
);

const buildSpecialPickData = (leaders = [], allowedKeys = null) => {
  const players = safeArray(leaders);

  if (!players.length) {
    return [];
  }

  const totals = players.reduce((acc, leader) => {
    Object.entries(leader.specialPicks || {}).forEach(([key, value]) => {
      if (!key.endsWith('Correct') || typeof value !== 'boolean') {
        return;
      }

      if (Array.isArray(allowedKeys) && allowedKeys.length > 0 && !allowedKeys.includes(key)) {
        return;
      }

      acc[key] = acc[key] || 0;
      if (value) {
        acc[key] += 1;
      }
    });

    return acc;
  }, {});

  return Object.entries(totals).map(([key, value]) => ({
    name: formatLabel(key.replace(/Correct$/, '')),
    value,
    percentage: value / players.length
  }));
};

const sumLeaderField = (leaders = [], accessor) => (
  safeArray(leaders).reduce((sum, leader) => sum + Number(accessor(leader) || 0), 0)
);

const getMarchModePayload = (leagueDetail = {}) => (
  leagueDetail?.stats?.modePayload || {}
);

const getMarchUpsetStats = (leagueDetail = {}) => {
  const modePayload = getMarchModePayload(leagueDetail);
  return modePayload.upsetStats || modePayload.marchMadnessStats?.upsetStats || {};
};

const getMarchSeedPerformance = (leagueDetail = {}) => {
  const modePayload = getMarchModePayload(leagueDetail);
  return modePayload.seedPerformance || modePayload.marchMadnessStats?.seedPerformance || {};
};

const buildUpsetsByRoundData = (leagueDetail = {}) => (
  Object.entries(getMarchUpsetStats(leagueDetail)?.upsetsByRound || {})
    .map(([roundKey, value], index) => ({
      id: roundKey,
      name: formatRoundLabel(roundKey),
      value: Number(value || 0),
      order: ROUND_ORDER_MAP[roundKey] ?? 100 + index
    }))
    .sort((left, right) => left.order - right.order)
);

const buildSeedResultsData = (leagueDetail = {}) => (
  Object.entries(getMarchSeedPerformance(leagueDetail))
    .map(([seed, value]) => ({
      name: `${seed} Seed`,
      wins: Number(value?.wins || 0),
      losses: Number(value?.losses || 0),
      winRatePct: Number(value?.winRate || 0) * 100
    }))
    .filter((entry) => entry.wins > 0 || entry.losses > 0)
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      return Number(left.name.split(' ')[0]) - Number(right.name.split(' ')[0]);
    })
    .slice(0, 8)
);

const buildMostCommonPickData = (mostCommonPicks = [], labelKey = 'player') => (
  safeArray(mostCommonPicks)
    .map((pick, index) => ({
      name: pick?.[labelKey] || pick?.name || `Pick ${index + 1}`,
      value: Number(pick?.count || 0),
      percentage: Number(pick?.percentage || 0)
    }))
    .filter((entry) => entry.value > 0)
    .slice(0, 8)
);

const buildNBAScoringMixData = (leagueDetail = {}) => {
  const leaders = safeArray(leagueDetail.leaders);
  const rows = [
    {
      name: 'Base Points',
      value: sumLeaderField(leaders, (leader) => leader.detailPayload?.basePoints)
    },
    {
      name: 'Series Length',
      value: sumLeaderField(leaders, (leader) => leader.detailPayload?.seriesLengthPoints)
    },
    {
      name: 'Upset Bonus',
      value: sumLeaderField(leaders, (leader) => leader.detailPayload?.upsetPoints)
    },
    {
      name: 'Finals MVP',
      value: sumLeaderField(leaders, (leader) => leader.detailPayload?.finalsMVPPoints)
    }
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      ...row,
      percentage: total > 0 ? row.value / total : 0
    }));
};

const sumRoundBreakdownField = (leaders = [], field) => (
  safeArray(leaders).reduce((sum, leader) => {
    const roundBreakdown = leader?.roundBreakdown || {};
    return sum + Object.values(roundBreakdown).reduce(
      (roundSum, round) => roundSum + Number(round?.[field] || 0),
      0
    );
  }, 0)
);

const buildNFLScoringMixData = (leagueDetail = {}) => {
  const leaders = safeArray(leagueDetail.leaders);
  const bonusRoundKeys = ['Super Winner Pick', 'Prop Bets'];
  const bonusPickPoints = safeArray(leaders).reduce((sum, leader) => {
    const roundBreakdown = leader?.roundBreakdown || {};
    const roundBonus = bonusRoundKeys.reduce(
      (roundSum, roundKey) => roundSum + Number(roundBreakdown?.[roundKey]?.totalPoints || 0),
      0
    );

    return sum + roundBonus + Number(leader?.detailPayload?.finalsMVPPoints || 0);
  }, 0);

  const rows = [
    { name: 'Winner Points', value: sumRoundBreakdownField(leaders, 'basePoints') },
    { name: 'Spread', value: sumRoundBreakdownField(leaders, 'spreadPoints') },
    { name: 'Totals', value: sumRoundBreakdownField(leaders, 'overUnderPoints') },
    { name: 'Score Bonus', value: sumRoundBreakdownField(leaders, 'scoreBonusPoints') },
    { name: 'Perfect Score', value: sumRoundBreakdownField(leaders, 'perfectScorePoints') },
    { name: 'Upset Bonus', value: sumRoundBreakdownField(leaders, 'upsetPoints') },
    { name: 'Bonus Picks', value: bonusPickPoints }
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      ...row,
      percentage: total > 0 ? row.value / total : 0
    }));
};

const resolveHistoryLeagueLabel = (entry = {}, index = 0) => {
  const completedAt = entry.completedAt?.toDate?.() || entry.completedAt || entry.timestamp || entry.lastUpdated || null;
  const labelDate = completedAt ? formatDate(completedAt, 'short') : null;
  const gameTypeLabel = GAME_TYPE_LABELS[entry.gameTypeId] || formatLabel(entry.gameTypeId || 'League');
  const seasonLabel = entry.seasonId || labelDate || `League ${index + 1}`;

  return `${gameTypeLabel} - ${seasonLabel}`;
};

const buildUserTrendData = (history = []) => (
  safeArray(history)
    .map((entry, index) => {
      const completedAt = entry.completedAt?.toDate?.() || entry.completedAt || entry.timestamp || entry.lastUpdated || null;
      const axisLabel = entry.seasonId || (completedAt ? formatDate(completedAt, 'short') : `League ${index + 1}`);

      return {
        label: resolveHistoryLeagueLabel(entry, index),
        axisLabel,
        score: Number(entry.score || 0),
        accuracy: Number(entry.accuracy || 0),
        rank: Number(entry.rank || 0),
        completedAt: completedAt ? new Date(completedAt).getTime() : index
      };
    })
    .sort((left, right) => left.completedAt - right.completedAt)
);

const buildGameTypeBreakdown = (byGameType = {}) => (
  Object.entries(byGameType).map(([gameTypeId, stats]) => ({
    name: GAME_TYPE_LABELS[gameTypeId] || formatLabel(gameTypeId),
    leagues: Number(stats?.leagues || 0),
    wins: Number(stats?.wins || 0),
    bestScore: Number(stats?.bestScore || 0),
    averageScore: Number(stats?.averageScore || 0),
    bestAccuracyPct: Number(stats?.bestAccuracy || 0) * 100,
    averageAccuracyPct: Number(stats?.averageAccuracy || 0) * 100
  }))
);

const buildFinishDistribution = (history = []) => {
  const players = safeArray(history);

  if (!players.length) {
    return [];
  }

  const buckets = players.reduce((acc, entry) => {
    const rank = Number(entry.rank || 0);
    const key = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(buckets).map(([name, value]) => ({
    name,
    value,
    percentage: value / players.length
  }));
};

const renderHighlightCards = (items = []) => {
  const rows = safeArray(items).filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">League Context</h3>
        <p className="mt-1 text-sm text-slate-500">Mode-specific results and settings pulled from the league detail.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {rows.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{String(item.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderSummaryRibbon = (items = []) => {
  const rows = safeArray(items).filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</div>
          {item.caption ? <div className="mt-1 text-sm text-slate-500">{item.caption}</div> : null}
        </div>
      ))}
    </div>
  );
};

const renderGenericLeagueCharts = ({ roundStats, leaderboardData, specialPickData }) => (
  <>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <ProgressChart
        data={roundStats}
        xAxisKey="name"
        type="line"
        title="Round Accuracy"
        subtitle="Correct picks and accuracy by stage of the bracket"
        series={[
          { dataKey: 'accuracy', name: 'Accuracy', color: '#F97316' }
        ]}
        percent
        height={340}
      />
      <ComparisonChart
        data={leaderboardData}
        type="horizontalBar"
        metrics={['score', 'correctPicks']}
        title="Top Performers"
        subtitle="Leaderboard leaders compared by score and correct picks"
        height={340}
      />
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <DistributionChart
        data={specialPickData}
        type="bar"
        dataKey="value"
        nameKey="name"
        title="Special Pick Accuracy"
        subtitle="How often the field nailed the bonus picks"
        height={320}
      />
    </div>
  </>
);

const renderMarchMadnessCharts = ({ leagueDetail, roundStats, leaderboardData }) => {
  const upsetsByRoundData = buildUpsetsByRoundData(leagueDetail);
  const seedResultsData = buildSeedResultsData(leagueDetail);
  const hasTopBracketsData = leaderboardData.length > 0;
  const hasRoundStatsData = roundStats.length > 0;
  const topRowHasCharts = hasRoundStatsData || upsetsByRoundData.length > 0;
  const bottomRowHasCharts = hasTopBracketsData || seedResultsData.length > 0;

  return (
    <>
      {topRowHasCharts ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {hasRoundStatsData ? (
            <ProgressChart
              data={roundStats}
              xAxisKey="name"
              type="line"
              title="Round Survival"
              subtitle="How well the field navigated each tournament round"
              series={[
                { dataKey: 'accuracy', name: 'Accuracy', color: '#D97706' }
              ]}
              percent
              height={340}
            />
          ) : null}
          {upsetsByRoundData.length ? (
            <DistributionChart
              data={upsetsByRoundData}
              type="bar"
              dataKey="value"
              nameKey="name"
              title="Upsets By Round"
              subtitle="Where the bracket actually broke from seed expectation"
              height={340}
            />
          ) : null}
        </div>
      ) : null}
      {bottomRowHasCharts ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {hasTopBracketsData ? (
            <ComparisonChart
              data={leaderboardData}
              type="horizontalBar"
              metrics={['score', 'correctPicks']}
              title="Top Brackets"
              subtitle="The highest-scoring entries and how many picks they converted"
              height={320}
            />
          ) : null}
          {seedResultsData.length ? (
            <ComparisonChart
              data={seedResultsData}
              type="horizontalBar"
              metrics={['wins']}
              title="Seed Results"
              subtitle="Which seeds actually piled up the most tournament wins"
              height={320}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
};

const renderNBAPlayoffsCharts = ({ leagueDetail, roundStats, leaderboardData }) => {
  const mvpPickData = buildMostCommonPickData(leagueDetail?.stats?.modePayload?.mvpStats?.mostCommonPicks || []);
  const fallbackPickAccuracy = buildSpecialPickData(leagueDetail.leaders, ['championCorrect', 'finalsMVPCorrect']);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProgressChart
          data={roundStats}
          xAxisKey="name"
          type="line"
          title="Series Accuracy"
          subtitle="How the league handled each playoff stage from play-in to Finals"
          series={[
            { dataKey: 'accuracy', name: 'Accuracy', color: '#2563EB' }
          ]}
          percent
          height={340}
        />
        <ComparisonChart
          data={leaderboardData}
          type="horizontalBar"
          metrics={['score', 'correctPicks']}
          title="Top Brackets"
          subtitle="Leaders by total score and correct series picks"
          height={340}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DistributionChart
          data={buildNBAScoringMixData(leagueDetail)}
          type="bar"
          dataKey="value"
          nameKey="name"
          title="Scoring Mix"
          subtitle="How the league's points split across base picks, series length, upsets, and Finals MVP"
          height={320}
        />
        <DistributionChart
          data={mvpPickData.length > 0 ? mvpPickData : fallbackPickAccuracy}
          type="bar"
          dataKey="value"
          nameKey="name"
          title={mvpPickData.length > 0 ? 'Finals MVP Pick Share' : 'Bonus Pick Accuracy'}
          subtitle={mvpPickData.length > 0
            ? 'Most common Finals MVP selections across the league'
            : 'How often the field converted champion and Finals MVP picks'}
          height={320}
        />
      </div>
    </>
  );
};

const renderNFLPlayoffsCharts = ({ leagueDetail, roundStats, leaderboardData }) => {
  const mvpPickData = buildMostCommonPickData(leagueDetail?.stats?.modePayload?.mvpStats?.mostCommonPicks || []);
  const fallbackPickAccuracy = buildSpecialPickData(leagueDetail.leaders, ['championCorrect', 'finalsMVPCorrect']);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProgressChart
          data={roundStats}
          xAxisKey="name"
          type="line"
          title="Round Accuracy"
          subtitle="How the field performed from Wild Card weekend through the Super Bowl"
          series={[
            { dataKey: 'accuracy', name: 'Accuracy', color: '#1D4ED8' }
          ]}
          percent
          height={340}
        />
        <ComparisonChart
          data={leaderboardData}
          type="horizontalBar"
          metrics={['score', 'correctPicks']}
          title="Top Cards"
          subtitle="Leaders by total score and correct winner picks"
          height={340}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DistributionChart
          data={buildNFLScoringMixData(leagueDetail)}
          type="bar"
          dataKey="value"
          nameKey="name"
          title="Point Distribution"
          subtitle="Where NFL scoring actually came from across winners, lines, bonuses, and prop layers"
          height={320}
        />
        <DistributionChart
          data={mvpPickData.length > 0 ? mvpPickData : fallbackPickAccuracy}
          type="bar"
          dataKey="value"
          nameKey="name"
          title={mvpPickData.length > 0 ? 'Super Bowl MVP Pick Share' : 'Bonus Pick Accuracy'}
          subtitle={mvpPickData.length > 0
            ? 'Most common Super Bowl MVP selections across the league'
            : 'How often the field hit champion and Super Bowl MVP bonus picks'}
          height={320}
        />
      </div>
    </>
  );
};

const renderLeagueCharts = ({ leagueDetail, roundStats, leaderboardData, specialPickData }) => {
  switch (leagueDetail?.gameTypeId) {
    case 'marchMadness':
      return renderMarchMadnessCharts({ leagueDetail, roundStats, leaderboardData });
    case 'nbaPlayoffs':
      return renderNBAPlayoffsCharts({ leagueDetail, roundStats, leaderboardData });
    case 'nflPlayoffs':
      return renderNFLPlayoffsCharts({ leagueDetail, roundStats, leaderboardData });
    default:
      return renderGenericLeagueCharts({ roundStats, leaderboardData, specialPickData });
  }
};

export const renderLeagueInsights = ({ leagueDetail, adapterSections = [] } = {}) => {
  if (!leagueDetail) {
    return null;
  }

  const roundStats = normalizeRoundStats(leagueDetail.stats?.roundStats || {});
  const leaderboardData = buildLeaderboardChartData(leagueDetail.leaders);
  const specialPickData = buildSpecialPickData(leagueDetail.leaders);
  const summaryCards = [
    {
      label: 'Champion',
      value: leagueDetail.highlights?.champion || leagueDetail.winner?.userName || 'TBD'
    },
    {
      label: 'Field Spread',
      value: formatNumber(
        Math.max(
          Number(leagueDetail.summary?.highestScore || 0) - Number(leagueDetail.summary?.lowestScore || 0),
          0
        )
      )
    },
    {
      label: 'Average Accuracy',
      value: formatPercentage(leagueDetail.summary?.accuracy || 0)
    },
    {
      label: 'Median Score',
      value: formatNumber(Number(leagueDetail.summary?.medianScore || 0))
    }
  ];

  return (
    <div className="space-y-6">
      {renderSummaryRibbon(summaryCards)}
      {renderHighlightCards(adapterSections)}
      {renderLeagueCharts({ leagueDetail, roundStats, leaderboardData, specialPickData })}
    </div>
  );
};

export const renderUserInsights = ({ userDetail } = {}) => {
  if (!userDetail) {
    return null;
  }

  const history = safeArray(userDetail.history);
  const gameTypeBreakdown = buildGameTypeBreakdown(userDetail.byGameType || {});
  const userTrendData = buildUserTrendData(history);
  const finishDistribution = buildFinishDistribution(history);
  const summary = userDetail.summary || {};
  const winRate = summary.totalLeagues > 0 ? summary.totalWins / summary.totalLeagues : 0;

  return (
    <div className="space-y-6">
      {renderSummaryRibbon([
        {
          label: 'Total Leagues',
          value: formatNumber(Number(summary.totalLeagues || 0)),
          caption: 'Completed canonical records'
        },
        {
          label: 'Wins',
          value: formatNumber(Number(summary.totalWins || 0)),
          caption: `${formatPercentage(winRate)} win rate`
        },
        {
          label: 'Runner-Up Finishes',
          value: formatNumber(Number(summary.totalSecondPlace || 0)),
          caption: 'Second-place appearances'
        },
        {
          label: 'Game Types',
          value: formatNumber(gameTypeBreakdown.length),
          caption: 'Tracked bracket formats'
        }
      ])}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProgressChart
          data={userTrendData}
          xAxisKey="axisLabel"
          tooltipLabelKey="label"
          type="line"
          title="Accuracy Trend"
          subtitle="Pick accuracy across completed leagues, normalized across formats"
          series={[
            { dataKey: 'accuracy', name: 'Accuracy', color: '#2563EB' }
          ]}
          percent
          height={340}
        />
        <DistributionChart
          data={gameTypeBreakdown}
          type="bar"
          dataKey="leagues"
          nameKey="name"
          title="League Mix"
          subtitle="How this user's history is split by game type"
          height={340}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ComparisonChart
          data={gameTypeBreakdown}
          type="horizontalBar"
          metrics={['bestAccuracyPct', 'averageAccuracyPct']}
          title="Best vs Average Accuracy"
          subtitle="Per-game-type peak accuracy versus typical accuracy"
          height={320}
        />
        <DistributionChart
          data={finishDistribution}
          type="pie"
          dataKey="value"
          nameKey="name"
          title="Finish Distribution"
          subtitle="Podium frequency across completed leagues"
          height={320}
        />
      </div>
    </div>
  );
};

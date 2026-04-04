import { formatNumber } from '../../../../../utils/formatters';

export const safeArray = (value) => (Array.isArray(value) ? value : []);

export const safeObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const formatPercent = (value) => {
  const numericValue = Number(value || 0);
  return `${(numericValue * 100).toFixed(1)}%`;
};

export const formatCompactNumber = (value) => formatNumber(Number(value || 0));

export const getDisplayName = (record = {}) => (
  record?.userName ||
  record?.displayName ||
  record?.name ||
  record?.label ||
  record?.userId ||
  'Unknown'
);

export const getWinnerLabel = (winner) => {
  if (!winner) return 'TBD';
  if (typeof winner === 'string') return winner;
  return getDisplayName(winner);
};

export const getChampionLabel = (leagueDetail = {}) => (
  leagueDetail?.highlights?.champion ||
  getWinnerLabel(leagueDetail?.winner) ||
  'TBD'
);

export const getFinalsMvpLabel = (leagueDetail = {}) => (
  leagueDetail?.highlights?.finalsMVP ||
  leagueDetail?.summary?.finalsMVP ||
  'TBD'
);

export const getPlayerCount = (leagueDetail = {}) => (
  Number(leagueDetail?.playerCount || safeArray(leagueDetail?.leaders).length || 0)
);

export const getTopLeaders = (leagueDetail = {}, limit = 3) => (
  safeArray(leagueDetail?.leaders)
    .slice()
    .sort((left, right) => Number(left?.rank || 99) - Number(right?.rank || 99))
    .slice(0, limit)
);

export const getTopScore = (leagueDetail = {}) => {
  const leaders = safeArray(leagueDetail?.leaders);
  return leaders.reduce((max, leader) => Math.max(max, Number(leader?.score || 0)), 0);
};

export const getAverageScore = (leagueDetail = {}) => Number(leagueDetail?.summary?.averageScore || 0);

export const getMedianScore = (leagueDetail = {}) => Number(leagueDetail?.summary?.medianScore || 0);

export const getAccuracy = (leagueDetail = {}) => Number(leagueDetail?.summary?.accuracy || 0);

export const getRoundStatRows = (roundStats = {}, roundOrder = [], roundLabels = {}) => (
  roundOrder
    .map((roundId) => {
      const round = safeObject(roundStats[roundId]);
      const possible = Number(round.possiblePicks || round.possible || round.total || 0);
      const correct = Number(round.correctPicks || round.correct || 0);

      if (!possible && !correct) {
        return null;
      }

      return {
        id: roundId,
        label: roundLabels[roundId] || roundId,
        correct,
        possible,
        accuracy: possible > 0 ? correct / possible : 0
      };
    })
    .filter(Boolean)
);

export const getRoundBreakdownRows = (roundBreakdown = {}, roundOrder = [], roundLabels = {}, mapper = null) => (
  roundOrder
    .map((roundId) => {
      const round = safeObject(roundBreakdown[roundId]);
      const row = typeof mapper === 'function'
        ? mapper(roundId, round, roundLabels[roundId] || roundId)
        : {
            id: roundId,
            label: roundLabels[roundId] || roundId,
            correct: Number(round.correctPicks || round.correct || 0),
            total: Number(round.totalPoints || round.total || 0)
          };

      if (!row) {
        return null;
      }

      return row;
    })
    .filter(Boolean)
);

export const getLeadGaps = (leaders = []) => {
  const sorted = safeArray(leaders)
    .slice()
    .sort((left, right) => Number(left?.rank || 99) - Number(right?.rank || 99));

  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  return {
    firstToSecond: first && second ? Number(first.score || 0) - Number(second.score || 0) : null,
    secondToThird: second && third ? Number(second.score || 0) - Number(third.score || 0) : null,
    fieldGap: first && sorted.length > 1 ? Number(first.score || 0) - Number(sorted[sorted.length - 1].score || 0) : null
  };
};

export const makeCard = ({ label, value, meta = '', tone = 'slate' }) => ({
  label,
  value,
  meta,
  tone
});

export const makeChip = ({ label, value, tone = 'slate' }) => ({
  label,
  value,
  tone
});

export const normalizeLeader = (leader = {}, fallbackRank = 0) => ({
  ...leader,
  rank: Number(leader?.rank || fallbackRank || 0),
  score: Number(leader?.score || 0),
  accuracy: Number(leader?.accuracy || 0),
  correctPicks: Number(leader?.correctPicks || 0),
  totalPossible: Number(leader?.totalPossible || 0)
});

export const getRoundPresenceSummary = (roundStats = {}, roundOrder = []) => (
  roundOrder.filter((roundId) => {
    const round = safeObject(roundStats[roundId]);
    return Number(round.correctPicks || round.correct || 0) > 0 || Number(round.possiblePicks || round.possible || round.total || 0) > 0;
  }).length
);


import { DEFAULT_STATS_ADAPTER_VERSION } from './constants';

const DEFAULT_LEAGUE_SUMMARY = Object.freeze({
  averageScore: 0,
  highestScore: 0,
  lowestScore: 0,
  medianScore: 0,
  accuracy: 0
});

const DEFAULT_USER_SUMMARY = Object.freeze({
  totalLeagues: 0,
  totalWins: 0,
  totalSecondPlace: 0
});

const normalizeSummary = (summary = {}, fallback = {}) => ({
  ...fallback,
  ...(summary || {})
});

export const createLeagueSummary = (input = {}) => {
  const {
    leagueId = '',
    gameTypeId = '',
    seasonId = '',
    completedAt = null,
    playerCount = 0,
    winner = null,
    summary = {},
    status = null,
    highlights = null,
    adapterVersion = DEFAULT_STATS_ADAPTER_VERSION,
    sourceVersion = null,
    ...extra
  } = input;

  return {
    ...extra,
    leagueId,
    gameTypeId,
    seasonId,
    completedAt,
    playerCount,
    winner,
    summary: normalizeSummary(summary, DEFAULT_LEAGUE_SUMMARY),
    ...(status !== null && status !== undefined ? { status } : {}),
    ...(highlights !== null && highlights !== undefined ? { highlights } : {}),
    ...(adapterVersion !== null && adapterVersion !== undefined ? { adapterVersion } : {}),
    ...(sourceVersion !== null && sourceVersion !== undefined ? { sourceVersion } : {})
  };
};

export const createLeagueDetailLeader = (input = {}) => {
  const {
    userId = '',
    userName = '',
    rank = 0,
    score = 0,
    accuracy = 0,
    correctPicks = 0,
    totalPossible = 0,
    ...extra
  } = input;

  return {
    ...extra,
    userId,
    userName,
    rank,
    score,
    accuracy,
    correctPicks,
    totalPossible
  };
};

export const createLeagueDetail = (input = {}) => {
  const {
    leagueId = '',
    gameTypeId = '',
    seasonId = '',
    completedAt = null,
    leaders = [],
    stats = {},
    adapterVersion = DEFAULT_STATS_ADAPTER_VERSION,
    sourceVersion = null,
    ...extra
  } = input;

  return {
    ...extra,
    leagueId,
    gameTypeId,
    seasonId,
    completedAt,
    leaders: Array.isArray(leaders) ? leaders.map(createLeagueDetailLeader) : [],
    stats: stats || {},
    ...(adapterVersion !== null && adapterVersion !== undefined ? { adapterVersion } : {}),
    ...(sourceVersion !== null && sourceVersion !== undefined ? { sourceVersion } : {})
  };
};

export const createUserHistoryEntry = (input = {}) => {
  const {
    leagueId = '',
    gameTypeId = '',
    seasonId = '',
    completedAt = null,
    rank = 0,
    score = 0,
    accuracy = 0,
    correctPicks = 0,
    totalPossible = 0,
    ...extra
  } = input;

  return {
    ...extra,
    leagueId,
    gameTypeId,
    seasonId,
    completedAt,
    rank,
    score,
    accuracy,
    correctPicks,
    totalPossible
  };
};

export const createUserSummary = (input = {}) => {
  const {
    userId = '',
    userName = '',
    lastUpdated = null,
    summary = {},
    byGameType = {},
    adapterVersion = DEFAULT_STATS_ADAPTER_VERSION,
    sourceVersion = null,
    ...extra
  } = input;

  return {
    ...extra,
    userId,
    userName,
    lastUpdated,
    summary: normalizeSummary(summary, DEFAULT_USER_SUMMARY),
    byGameType: byGameType || {},
    ...(adapterVersion !== null && adapterVersion !== undefined ? { adapterVersion } : {}),
    ...(sourceVersion !== null && sourceVersion !== undefined ? { sourceVersion } : {})
  };
};

export const createUserDetail = (input = {}) => {
  const {
    userId = '',
    userName = '',
    lastUpdated = null,
    history = [],
    adapterVersion = DEFAULT_STATS_ADAPTER_VERSION,
    sourceVersion = null,
    ...extra
  } = input;

  return {
    ...extra,
    userId,
    userName,
    lastUpdated,
    history: Array.isArray(history) ? history.map(createUserHistoryEntry) : [],
    ...(adapterVersion !== null && adapterVersion !== undefined ? { adapterVersion } : {}),
    ...(sourceVersion !== null && sourceVersion !== undefined ? { sourceVersion } : {})
  };
};

export const isLeagueSummaryShape = (value) => Boolean(value && typeof value === 'object' && 'leagueId' in value && 'summary' in value);

export const isLeagueDetailShape = (value) => Boolean(value && typeof value === 'object' && Array.isArray(value.leaders) && 'stats' in value);

export const isUserSummaryShape = (value) => Boolean(value && typeof value === 'object' && 'userId' in value && 'summary' in value && 'byGameType' in value);

export const isUserDetailShape = (value) => Boolean(value && typeof value === 'object' && 'userId' in value && Array.isArray(value.history));

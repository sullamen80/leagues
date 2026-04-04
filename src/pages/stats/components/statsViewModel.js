// src/pages/stats/components/statsViewModel.js

export const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
};

export const normalizeDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const resolveLeagueDetail = (data = {}) => ({
  leagueId: firstDefined(data.leagueId, data.id, ''),
  gameTypeId: firstDefined(data.gameTypeId, 'unknown'),
  seasonId: firstDefined(data.seasonId, 'Unknown Season'),
  playerCount: firstDefined(data.playerCount, 0),
  completedAt: firstDefined(data.completedAt, data.timestamp, null),
  winner: firstDefined(data.winner, data.summary?.winner, null),
  winners: Array.isArray(data.winners) ? data.winners : [],
  summary: data.summary || data.stats || {},
  detail: data.detail || data,
  headerMeta: data.headerMeta || null
});

export const resolveUserDetail = (data = {}) => ({
  userId: firstDefined(data.userId, data.id, ''),
  userName: firstDefined(data.userName, 'Unknown User'),
  lastUpdated: firstDefined(data.lastUpdated, null),
  summary: data.summary || data.stats || {},
  byGameType: data.byGameType || {},
  history: Array.isArray(data.history) ? data.history : Array.isArray(data.leagues) ? data.leagues : []
});

export const formatWinnerLabel = (winner) => {
  if (!winner) {
    return 'Not Determined';
  }

  if (typeof winner === 'string') {
    return winner;
  }

  return winner.userName || winner.displayName || winner.name || winner.userId || 'Unknown Winner';
};

export const getAdapterList = (adapter, methodName, context = {}) => {
  if (!adapter || typeof adapter[methodName] !== 'function') {
    return [];
  }

  const result = adapter[methodName](context);
  return Array.isArray(result) ? result : [];
};

export const getAdapterNode = (adapter, methodName, context = {}) => {
  if (!adapter || typeof adapter[methodName] !== 'function') {
    return null;
  }

  return adapter[methodName](context);
};

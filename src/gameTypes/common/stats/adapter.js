import { DEFAULT_STATS_ADAPTER_VERSION } from './constants';

const noop = () => null;
const emptyArray = () => [];

export const createStatsAdapter = (definition = {}) => {
  const {
    gameTypeId,
    version = DEFAULT_STATS_ADAPTER_VERSION,
    buildLeagueSummary = noop,
    buildLeagueDetail = noop,
    buildUserHistoryEntry = noop,
    buildUserSummaryStats = noop,
    renderLeagueHeaderMeta = noop,
    renderLeagueColumns = emptyArray,
    renderLeagueExpanded = noop,
    renderLeagueSections = emptyArray,
    renderUserColumns = emptyArray,
    renderUserRow = noop,
    renderUserExpanded = noop,
    getListBadge = noop,
    ...extra
  } = definition;

  if (!gameTypeId) {
    throw new Error('createStatsAdapter requires a gameTypeId');
  }

  return Object.freeze({
    ...extra,
    gameTypeId,
    version,
    buildLeagueSummary,
    buildLeagueDetail,
    buildUserHistoryEntry,
    buildUserSummaryStats,
    renderLeagueHeaderMeta,
    renderLeagueColumns,
    renderLeagueExpanded,
    renderLeagueSections,
    renderUserColumns,
    renderUserRow,
    renderUserExpanded,
    getListBadge
  });
};

export const normalizeStatsAdapter = (adapter, { gameTypeId = null } = {}) => {
  if (!adapter) {
    return null;
  }

  if (typeof adapter === 'function') {
    return normalizeStatsAdapter(adapter(), { gameTypeId });
  }

  const resolvedGameTypeId = gameTypeId || adapter.gameTypeId;

  return createStatsAdapter({
    ...adapter,
    gameTypeId: resolvedGameTypeId
  });
};

export const isStatsAdapter = (adapter) => {
  return Boolean(
    adapter &&
    typeof adapter === 'object' &&
    typeof adapter.gameTypeId === 'string' &&
    typeof adapter.buildLeagueSummary === 'function' &&
    typeof adapter.buildLeagueDetail === 'function' &&
    typeof adapter.buildUserHistoryEntry === 'function' &&
    typeof adapter.buildUserSummaryStats === 'function'
  );
};

export const getStatsAdapterGameTypeId = (adapter) => adapter?.gameTypeId || null;

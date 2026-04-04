export {
  CANONICAL_STATS_COLLECTIONS,
  CANONICAL_STATS_GAME_TYPE_IDS,
  STATS_ROOT_COLLECTION,
  STATS_ROOT_DOCUMENT,
  isCanonicalStatsGameType
} from './statsCollections';

export {
  normalizeLeagueDetailDoc,
  normalizeLeagueSummaryDoc,
  normalizeUserDetailDoc,
  normalizeUserSummaryDoc
} from './statsMappers';

export {
  createStatsRepository,
  default as statsRepository,
  fetchLeagueDetail,
  fetchLeagueSummary,
  fetchUserDetail,
  fetchUserSummary,
  getCanonicalStatsCollections,
  getCanonicalStatsGameTypeIds,
  listLeagueDetails,
  listLeagueSummaries,
  listUserDetails,
  listUserSummaries,
  resolveStatsAdapter
} from './statsRepository';

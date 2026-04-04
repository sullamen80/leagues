export const CANONICAL_STATS_COLLECTIONS = Object.freeze({
  leagueSummaries: 'leagueSummaries',
  leagueDetails: 'leagueDetails',
  userSummaries: 'userSummaries',
  userDetails: 'userDetails'
});

export const LEGACY_STATS_COLLECTIONS = Object.freeze({
  leagues: 'leagues',
  userStats: 'userStats'
});

export const CANONICAL_STATS_GAME_TYPE_IDS = Object.freeze([
  'marchMadness',
  'nbaPlayoffs',
  'nflPlayoffs'
]);

export const DEFAULT_STATS_ADAPTER_VERSION = 1;

export const CANONICAL_STATS_PATHS = Object.freeze(
  Object.fromEntries(
    Object.values(CANONICAL_STATS_COLLECTIONS).map((collectionName) => [
      collectionName,
      Object.freeze(['gameStats', 'root', collectionName])
    ])
  )
);

export const LEGACY_STATS_PATHS = Object.freeze(
  Object.fromEntries(
    Object.values(LEGACY_STATS_COLLECTIONS).map((collectionName) => [
      collectionName,
      Object.freeze(['gameStats', 'root', collectionName])
    ])
  )
);

export const getCanonicalStatsCollectionSegments = (collectionName) => {
  if (!collectionName) {
    return null;
  }

  return CANONICAL_STATS_PATHS[collectionName] || null;
};

export const getCanonicalStatsDocumentSegments = (collectionName, docId) => {
  const collectionSegments = getCanonicalStatsCollectionSegments(collectionName);

  if (!collectionSegments || !docId) {
    return null;
  }

  return [...collectionSegments, docId];
};

export const getLegacyStatsCollectionSegments = (collectionName) => {
  if (!collectionName) {
    return null;
  }

  return LEGACY_STATS_PATHS[collectionName] || null;
};

export const getLegacyStatsDocumentSegments = (collectionName, docId) => {
  const collectionSegments = getLegacyStatsCollectionSegments(collectionName);

  if (!collectionSegments || !docId) {
    return null;
  }

  return [...collectionSegments, docId];
};

export const isCanonicalStatsCollection = (collectionName) => {
  return Boolean(CANONICAL_STATS_COLLECTIONS[collectionName]);
};

export const isLegacyStatsCollection = (collectionName) => {
  return Boolean(LEGACY_STATS_COLLECTIONS[collectionName]);
};

export const isCanonicalBracketStatsGameType = (gameTypeId) => {
  return CANONICAL_STATS_GAME_TYPE_IDS.includes(gameTypeId);
};

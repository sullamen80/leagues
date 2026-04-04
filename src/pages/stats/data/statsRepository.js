import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getStatsAdapter, normalizeGameTypeId } from '../../../gameTypes';
import {
  CANONICAL_STATS_COLLECTIONS,
  CANONICAL_STATS_GAME_TYPE_IDS,
  STATS_ROOT_COLLECTION,
  STATS_ROOT_DOCUMENT,
  isCanonicalStatsGameType
} from './statsCollections';
import {
  normalizeLeagueDetailDoc,
  normalizeLeagueSummaryDoc,
  normalizeUserDetailDoc,
  normalizeUserSummaryDoc
} from './statsMappers';

const resolveDb = (firestoreDb) => firestoreDb || db;

const resolveStatsRootRef = ({ firestoreDb, statsRootRef } = {}) => {
  if (statsRootRef) {
    return statsRootRef;
  }

  return doc(resolveDb(firestoreDb), STATS_ROOT_COLLECTION, STATS_ROOT_DOCUMENT);
};

const getCollectionRef = (collectionName, options = {}) => {
  const rootRef = resolveStatsRootRef(options);
  return collection(rootRef, collectionName);
};

const getDocRef = (collectionName, documentId, options = {}) => {
  const rootRef = resolveStatsRootRef(options);
  return doc(rootRef, collectionName, documentId);
};

const sortByTimestampDesc = (left, right, fieldName = 'timestamp') => {
  const leftValue = left?.[fieldName] || left?.completedAt || left?.lastUpdated || null;
  const rightValue = right?.[fieldName] || right?.completedAt || right?.lastUpdated || null;

  const leftTime = leftValue?.toMillis ? leftValue.toMillis() : leftValue instanceof Date ? leftValue.getTime() : Date.parse(leftValue) || 0;
  const rightTime = rightValue?.toMillis ? rightValue.toMillis() : rightValue instanceof Date ? rightValue.getTime() : Date.parse(rightValue) || 0;

  return rightTime - leftTime;
};

const recordHasCanonicalGameType = (record = {}) => {
  if (isCanonicalStatsGameType(record.gameTypeId)) {
    return true;
  }

  const metadataGameTypes = Array.isArray(record.metadata?.gameTypes)
    ? record.metadata.gameTypes
    : [];

  if (metadataGameTypes.some((gameTypeId) => isCanonicalStatsGameType(gameTypeId))) {
    return true;
  }

  const byGameTypeKeys = Object.keys(record.byGameType || {});
  if (byGameTypeKeys.some((gameTypeId) => isCanonicalStatsGameType(gameTypeId))) {
    return true;
  }

  const historyGameTypes = Array.isArray(record.history)
    ? record.history.map((entry) => entry?.gameTypeId)
    : [];

  return historyGameTypes.some((gameTypeId) => isCanonicalStatsGameType(gameTypeId));
};

const recordMatchesRequestedGameType = (record = {}, gameTypeId = null) => {
  if (!gameTypeId) {
    return true;
  }

  const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);
  if (!isCanonicalStatsGameType(normalizedGameTypeId)) {
    return false;
  }

  if (record.gameTypeId === normalizedGameTypeId) {
    return true;
  }

  if (Array.isArray(record.metadata?.gameTypes) && record.metadata.gameTypes.includes(normalizedGameTypeId)) {
    return true;
  }

  if (record.byGameType && Object.prototype.hasOwnProperty.call(record.byGameType, normalizedGameTypeId)) {
    return true;
  }

  if (Array.isArray(record.history)) {
    return record.history.some((entry) => entry?.gameTypeId === normalizedGameTypeId);
  }

  return false;
};

const sliceResults = (records = [], limitCount = null) => {
  if (typeof limitCount !== 'number' || limitCount < 0) {
    return records;
  }

  return records.slice(0, limitCount);
};

const readCollection = async ({
  collectionName,
  normalizeDoc,
  options = {},
  gameTypeId = null,
  limitCount = null
}) => {
  const snapshot = await getDocs(getCollectionRef(collectionName, options));
  const normalized = snapshot.docs
    .map((docSnapshot) => normalizeDoc(docSnapshot))
    .filter(Boolean)
    .filter((record) => recordHasCanonicalGameType(record))
    .filter((record) => recordMatchesRequestedGameType(record, gameTypeId))
    .sort((left, right) => sortByTimestampDesc(left, right));

  return sliceResults(normalized, limitCount);
};

const readDoc = async ({ collectionName, documentId, normalizeDoc, options = {} }) => {
  if (!documentId) {
    return null;
  }

  const snapshot = await getDoc(getDocRef(collectionName, documentId, options));
  return normalizeDoc(snapshot);
};

export const resolveStatsAdapter = (gameTypeId) => {
  const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);

  if (!isCanonicalStatsGameType(normalizedGameTypeId)) {
    return null;
  }

  return getStatsAdapter(normalizedGameTypeId);
};

export const listLeagueSummaries = (options = {}) => {
  return readCollection({
    collectionName: CANONICAL_STATS_COLLECTIONS.leagueSummaries,
    normalizeDoc: normalizeLeagueSummaryDoc,
    options,
    gameTypeId: options.gameTypeId,
    limitCount: options.limitCount
  });
};

export const fetchLeagueSummary = (leagueId, options = {}) => {
  return readDoc({
    collectionName: CANONICAL_STATS_COLLECTIONS.leagueSummaries,
    documentId: leagueId,
    normalizeDoc: normalizeLeagueSummaryDoc,
    options
  });
};

export const listLeagueDetails = (options = {}) => {
  return readCollection({
    collectionName: CANONICAL_STATS_COLLECTIONS.leagueDetails,
    normalizeDoc: normalizeLeagueDetailDoc,
    options,
    gameTypeId: options.gameTypeId,
    limitCount: options.limitCount
  });
};

export const fetchLeagueDetail = (leagueId, options = {}) => {
  return readDoc({
    collectionName: CANONICAL_STATS_COLLECTIONS.leagueDetails,
    documentId: leagueId,
    normalizeDoc: normalizeLeagueDetailDoc,
    options
  });
};

export const listUserSummaries = (options = {}) => {
  return readCollection({
    collectionName: CANONICAL_STATS_COLLECTIONS.userSummaries,
    normalizeDoc: normalizeUserSummaryDoc,
    options,
    gameTypeId: options.gameTypeId,
    limitCount: options.limitCount
  });
};

export const fetchUserSummary = (userId, options = {}) => {
  return readDoc({
    collectionName: CANONICAL_STATS_COLLECTIONS.userSummaries,
    documentId: userId,
    normalizeDoc: normalizeUserSummaryDoc,
    options
  });
};

export const listUserDetails = (options = {}) => {
  return readCollection({
    collectionName: CANONICAL_STATS_COLLECTIONS.userDetails,
    normalizeDoc: normalizeUserDetailDoc,
    options,
    gameTypeId: options.gameTypeId,
    limitCount: options.limitCount
  });
};

export const fetchUserDetail = (userId, options = {}) => {
  return readDoc({
    collectionName: CANONICAL_STATS_COLLECTIONS.userDetails,
    documentId: userId,
    normalizeDoc: normalizeUserDetailDoc,
    options
  });
};

export const getCanonicalStatsCollections = () => ({
  ...CANONICAL_STATS_COLLECTIONS
});

export const getCanonicalStatsGameTypeIds = () => [...CANONICAL_STATS_GAME_TYPE_IDS];

export const createStatsRepository = (options = {}) => ({
  resolveStatsAdapter,
  listLeagueSummaries: (queryOptions = {}) => listLeagueSummaries({ ...options, ...queryOptions }),
  fetchLeagueSummary: (leagueId, queryOptions = {}) => fetchLeagueSummary(leagueId, { ...options, ...queryOptions }),
  listLeagueDetails: (queryOptions = {}) => listLeagueDetails({ ...options, ...queryOptions }),
  fetchLeagueDetail: (leagueId, queryOptions = {}) => fetchLeagueDetail(leagueId, { ...options, ...queryOptions }),
  listUserSummaries: (queryOptions = {}) => listUserSummaries({ ...options, ...queryOptions }),
  fetchUserSummary: (userId, queryOptions = {}) => fetchUserSummary(userId, { ...options, ...queryOptions }),
  listUserDetails: (queryOptions = {}) => listUserDetails({ ...options, ...queryOptions }),
  fetchUserDetail: (userId, queryOptions = {}) => fetchUserDetail(userId, { ...options, ...queryOptions }),
  getCanonicalStatsCollections,
  getCanonicalStatsGameTypeIds
});

const defaultStatsRepository = createStatsRepository();

export default defaultStatsRepository;

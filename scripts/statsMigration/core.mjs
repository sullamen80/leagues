import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const SUPPORTED_BRACKET_GAME_TYPES = Object.freeze([
  'marchMadness',
  'nbaPlayoffs',
  'nflPlayoffs'
]);

const GAME_TYPE_ALIASES = Object.freeze({
  nbaBracket: 'nbaPlayoffs'
});

const DEFAULT_DATABASE_ID = '(default)';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const FIREBASE_TOOLS_CONFIG_PATH = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

const canonicalCollections = Object.freeze({
  leagueSummaries: 'gameStats/root/leagueSummaries',
  leagueDetails: 'gameStats/root/leagueDetails',
  userSummaries: 'gameStats/root/userSummaries',
  userDetails: 'gameStats/root/userDetails'
});

export const canonicalStatsPaths = canonicalCollections;

export function normalizeGameTypeId(gameTypeId) {
  if (!gameTypeId) return null;
  return GAME_TYPE_ALIASES[gameTypeId] || gameTypeId;
}

export function isSupportedBracketGameType(gameTypeId) {
  return SUPPORTED_BRACKET_GAME_TYPES.includes(normalizeGameTypeId(gameTypeId));
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toTimestampValue(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

export function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactObject(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, compactObject(item)])
        .filter(([, item]) => item !== undefined)
    );
  }

  return value === undefined ? undefined : value;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlEncodeBuffer(buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseIntegerValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') {
    return value ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) {
    return value.stringValue;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) {
    return Boolean(value.booleanValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    return parseIntegerValue(value.integerValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) {
    return Number(value.doubleValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) {
    return toDate(value.timestampValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) {
    return value.referenceValue;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    return decodeFirestoreFields(value.mapValue?.fields || {});
  }
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    return (value.arrayValue?.values || []).map((item) => decodeFirestoreValue(item));
  }

  return value;
}

export function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

export function decodeFirestoreDocument(document) {
  if (!document) return null;

  return {
    id: document.name?.split('/').pop() || null,
    name: document.name || null,
    createTime: document.createTime ? toDate(document.createTime) : null,
    updateTime: document.updateTime ? toDate(document.updateTime) : null,
    ...decodeFirestoreFields(document.fields || {})
  };
}

export function encodeFirestoreValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value
          .map((item) => encodeFirestoreValue(item))
          .filter((item) => item !== undefined)
      }
    };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: encodeFirestoreFields(value)
      }
    };
  }

  return { stringValue: String(value) };
}

export function encodeFirestoreFields(data = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .map(([key, value]) => {
        const encoded = encodeFirestoreValue(value);
        return encoded === undefined ? null : [key, encoded];
      })
      .filter(Boolean)
  );
}

function sortByCompletedAtDescending(left, right) {
  return (toDate(right.completedAt || right.timestamp || right.lastUpdated)?.getTime() || 0)
    - (toDate(left.completedAt || left.timestamp || left.lastUpdated)?.getTime() || 0);
}

function safeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function average(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) return 0;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function median(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!cleanValues.length) return 0;
  const middle = Math.floor(cleanValues.length / 2);
  if (cleanValues.length % 2 === 0) {
    return (cleanValues[middle - 1] + cleanValues[middle]) / 2;
  }
  return cleanValues[middle];
}

function roundToThreeDecimals(value) {
  return Math.round(value * 1000) / 1000;
}

function getTopLeader(players = []) {
  const sorted = [...players].sort((left, right) => {
    const leftRank = safeNumber(left.rank, Number.POSITIVE_INFINITY);
    const rightRank = safeNumber(right.rank, Number.POSITIVE_INFINITY);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return safeNumber(right.score) - safeNumber(left.score);
  });

  return sorted[0] || null;
}

function buildDefaultCards({ playerCount, averageScore, highestScore, accuracy }) {
  return [
    { key: 'players', label: 'Players', value: playerCount, format: 'number' },
    { key: 'averageScore', label: 'Average Score', value: averageScore, format: 'number' },
    { key: 'highestScore', label: 'Highest Score', value: highestScore, format: 'number' },
    { key: 'accuracy', label: 'Accuracy', value: accuracy, format: 'percentage' }
  ];
}

function pickModePayload(legacyLeagueDoc) {
  return compactObject({
    marchMadnessStats: legacyLeagueDoc.marchMadnessStats,
    upsetStats: legacyLeagueDoc.upsetStats,
    seedPerformance: legacyLeagueDoc.seedPerformance,
    finalFourTeams: legacyLeagueDoc.finalFourTeams,
    scoringSettings: legacyLeagueDoc.scoringSettings,
    nbaPlayoffsStats: legacyLeagueDoc.nbaPlayoffsStats,
    nflPlayoffsStats: legacyLeagueDoc.nflPlayoffsStats,
    roundStats: legacyLeagueDoc.roundStats,
    enhancedRoundStats: legacyLeagueDoc.enhancedRoundStats,
    mvpStats: legacyLeagueDoc.mvpStats,
    cumulativeStats: legacyLeagueDoc.cumulativeStats,
    pointDistribution: legacyLeagueDoc.pointDistribution,
    players: legacyLeagueDoc.players
  });
}

function extractWinnerFromLeagueDoc(legacyLeagueDoc, leaders = []) {
  if (Array.isArray(legacyLeagueDoc.winners) && legacyLeagueDoc.winners.length > 0) {
    const winner = legacyLeagueDoc.winners.find((entry) => safeNumber(entry.rank, 999) === 1) || legacyLeagueDoc.winners[0];
    return compactObject({
      userId: winner.userId || null,
      userName: winner.userName || null,
      score: safeNumber(winner.score),
      rank: safeNumber(winner.rank, 1)
    });
  }

  const topLeader = getTopLeader(leaders);
  if (topLeader) {
    return compactObject({
      userId: topLeader.userId || null,
      userName: topLeader.userName || null,
      score: safeNumber(topLeader.score),
      rank: safeNumber(topLeader.rank, 1)
    });
  }

  return null;
}

function normalizePlayerEntry(player, index) {
  const correctPicks = safeNumber(player.correctPicks, safeNumber(player.correctPickCount));
  const totalPossible = safeNumber(player.totalPossible, safeNumber(player.possiblePicks));
  const accuracy = safeNumber(player.percentage, safeNumber(player.accuracy));
  const resolvedAccuracy = accuracy > 1 ? accuracy / 100 : accuracy;

  return compactObject({
    userId: player.userId || null,
    userName: player.userName || 'Unknown User',
    rank: safeNumber(player.rank, index + 1),
    score: safeNumber(player.score),
    accuracy: roundToThreeDecimals(resolvedAccuracy || 0),
    correctPicks,
    totalPossible,
    specialPicks: compactObject({
      championPick: player.championPick,
      championCorrect: player.championCorrect,
      finalsMVPPick: player.finalsMVPPick,
      finalsMVPCorrect: player.finalsMVPCorrect
    }),
    roundBreakdown: compactObject(player.roundBreakdown || {}),
    detailPayload: compactObject(player)
  });
}

export function buildCanonicalLeagueSummaryFromLegacy(legacyLeagueDoc) {
  const gameTypeId = normalizeGameTypeId(legacyLeagueDoc.gameTypeId || legacyLeagueDoc.gameType);
  if (!isSupportedBracketGameType(gameTypeId)) {
    return null;
  }

  const players = Array.isArray(legacyLeagueDoc.players) ? legacyLeagueDoc.players : [];
  const playerScores = players.map((player) => safeNumber(player.score));
  const highestScore = safeNumber(legacyLeagueDoc.stats?.highestScore, Math.max(...playerScores, 0));
  const averageScore = safeNumber(legacyLeagueDoc.stats?.averageScore, average(playerScores));
  const lowestScore = safeNumber(legacyLeagueDoc.stats?.lowestScore, playerScores.length ? Math.min(...playerScores) : 0);
  const medianScore = safeNumber(legacyLeagueDoc.stats?.medianScore, median(playerScores));
  const accuracy = safeNumber(
    legacyLeagueDoc.stats?.correctPickPercentage,
    average(players.map((player) => {
      const pct = safeNumber(player.percentage, safeNumber(player.accuracy));
      return pct > 1 ? pct / 100 : pct;
    }))
  );
  const completedAt = toDate(legacyLeagueDoc.timestamp || legacyLeagueDoc.completedAt || legacyLeagueDoc._metadata?.createdAt || legacyLeagueDoc.lastUpdated);
  const leaders = players.map((player, index) => normalizePlayerEntry(player, index));
  const winner = extractWinnerFromLeagueDoc(legacyLeagueDoc, leaders);

  return compactObject({
    leagueId: legacyLeagueDoc.leagueId || legacyLeagueDoc.id || null,
    gameTypeId,
    seasonId: legacyLeagueDoc.seasonId || null,
    completedAt,
    playerCount: safeNumber(legacyLeagueDoc.playerCount, leaders.length),
    winner,
    summary: {
      averageScore: roundToThreeDecimals(averageScore),
      highestScore,
      lowestScore,
      medianScore,
      accuracy: roundToThreeDecimals(accuracy > 1 ? accuracy / 100 : accuracy)
    },
    status: legacyLeagueDoc.status || legacyLeagueDoc._metadata?.status || (completedAt ? 'completed' : null),
    highlights: compactObject({
      champion: legacyLeagueDoc.nbaPlayoffsStats?.champion
        || legacyLeagueDoc.nflPlayoffsStats?.champion
        || legacyLeagueDoc.marchMadnessStats?.champion
        || null,
      finalsMVP: legacyLeagueDoc.nbaPlayoffsStats?.finalsMVP
        || legacyLeagueDoc.nflPlayoffsStats?.finalsMVP
        || null,
      upsetCount: legacyLeagueDoc.marchMadnessStats?.upsetCount
        || legacyLeagueDoc.upsetStats?.totalUpsets
        || legacyLeagueDoc.nbaPlayoffsStats?.upsetPoints
        || legacyLeagueDoc.nflPlayoffsStats?.upsetPoints
        || null,
      finalFourTeams: legacyLeagueDoc.finalFourTeams
        || legacyLeagueDoc.marchMadnessStats?.finalFourTeams
        || null
    }),
    adapterVersion: 1,
    sourceVersion: legacyLeagueDoc._metadata?.version || 'legacy',
    migratedFrom: 'legacyGameStats',
    migratedAt: new Date()
  });
}

export function buildCanonicalLeagueDetailFromLegacy(legacyLeagueDoc) {
  const gameTypeId = normalizeGameTypeId(legacyLeagueDoc.gameTypeId || legacyLeagueDoc.gameType);
  if (!isSupportedBracketGameType(gameTypeId)) {
    return null;
  }

  const players = Array.isArray(legacyLeagueDoc.players) ? legacyLeagueDoc.players : [];
  const leaders = players.map((player, index) => normalizePlayerEntry(player, index));
  const roundStats = compactObject(legacyLeagueDoc.roundStats || legacyLeagueDoc.enhancedRoundStats || {});
  const modePayload = pickModePayload(legacyLeagueDoc);
  const playerScores = leaders.map((leader) => safeNumber(leader.score));
  const summary = buildCanonicalLeagueSummaryFromLegacy(legacyLeagueDoc);

  return compactObject({
    leagueId: summary?.leagueId || legacyLeagueDoc.leagueId || legacyLeagueDoc.id || null,
    gameTypeId,
    seasonId: summary?.seasonId || legacyLeagueDoc.seasonId || null,
    completedAt: summary?.completedAt || toDate(legacyLeagueDoc.timestamp || legacyLeagueDoc.completedAt || legacyLeagueDoc.lastUpdated),
    leaders,
    stats: {
      cards: buildDefaultCards({
        playerCount: leaders.length,
        averageScore: summary?.summary?.averageScore || average(playerScores),
        highestScore: summary?.summary?.highestScore || Math.max(...playerScores, 0),
        accuracy: summary?.summary?.accuracy || 0
      }),
      sections: compactObject(legacyLeagueDoc.stats?.sections || []),
      roundStats,
      modePayload
    },
    adapterVersion: 1,
    sourceVersion: legacyLeagueDoc._metadata?.version || 'legacy',
    migratedFrom: 'legacyGameStats',
    migratedAt: new Date()
  });
}

export function buildCanonicalUserSummaryFromLegacyUserDoc(legacyUserDoc) {
  const leagues = Array.isArray(legacyUserDoc.leagues) ? legacyUserDoc.leagues : [];
  const history = leagues
    .map((entry) => ({
      ...entry,
      gameTypeId: normalizeGameTypeId(entry.gameTypeId || entry.gameType)
    }))
    .filter((entry) => isSupportedBracketGameType(entry.gameTypeId));

  if (!history.length) {
    return null;
  }

  const sortedHistory = [...history].sort(sortByCompletedAtDescending);
  const lastUpdated = sortedHistory.reduce((latest, entry) => {
    const entryDate = toDate(entry.completedAt || entry.timestamp || entry.lastUpdated);
    if (!entryDate) return latest;
    return !latest || entryDate > latest ? entryDate : latest;
  }, toDate(legacyUserDoc.lastUpdated) || null);

  const byGameType = history.reduce((acc, entry) => {
    const gameTypeId = entry.gameTypeId;
    const accuracy = safeNumber(entry.percentage, safeNumber(entry.accuracy));
    const normalizedAccuracy = accuracy > 1 ? accuracy / 100 : accuracy;

    if (!acc[gameTypeId]) {
      acc[gameTypeId] = {
        leagues: 0,
        wins: 0,
        bestScore: 0,
        averageScore: 0,
        bestAccuracy: 0,
        averageAccuracy: 0
      };
    }

    acc[gameTypeId].leagues += 1;
    acc[gameTypeId].wins += safeNumber(entry.rank, 0) === 1 ? 1 : 0;
    acc[gameTypeId].bestScore = Math.max(acc[gameTypeId].bestScore, safeNumber(entry.score));
    acc[gameTypeId].averageScore += safeNumber(entry.score);
    acc[gameTypeId].bestAccuracy = Math.max(acc[gameTypeId].bestAccuracy, normalizedAccuracy);
    acc[gameTypeId].averageAccuracy += normalizedAccuracy;
    return acc;
  }, {});

  Object.values(byGameType).forEach((bucket) => {
    bucket.averageScore = roundToThreeDecimals(bucket.leagues ? bucket.averageScore / bucket.leagues : 0);
    bucket.averageAccuracy = roundToThreeDecimals(bucket.leagues ? bucket.averageAccuracy / bucket.leagues : 0);
    bucket.bestAccuracy = roundToThreeDecimals(bucket.bestAccuracy || 0);
  });

  const totalLeagues = history.length;
  const totalWins = history.filter((entry) => safeNumber(entry.rank, 0) === 1).length;
  const totalSecondPlace = history.filter((entry) => safeNumber(entry.rank, 0) === 2).length;

  return compactObject({
    userId: legacyUserDoc.userId || legacyUserDoc.id || null,
    userName: legacyUserDoc.userName || 'Unknown User',
    lastUpdated: lastUpdated || new Date(),
    summary: {
      totalLeagues,
      totalWins,
      totalSecondPlace
    },
    byGameType,
    adapterVersion: 1,
    sourceVersion: legacyUserDoc._metadata?.version || 'legacy',
    migratedFrom: 'legacyGameStats',
    migratedAt: new Date()
  });
}

export function buildCanonicalUserDetailFromLegacyUserDoc(legacyUserDoc, leagueDetailMap = new Map()) {
  const leagues = Array.isArray(legacyUserDoc.leagues) ? legacyUserDoc.leagues : [];
  const history = leagues
    .map((entry) => {
      const gameTypeId = normalizeGameTypeId(entry.gameTypeId || entry.gameType);
      if (!isSupportedBracketGameType(gameTypeId)) {
        return null;
      }

      const leagueDetail = leagueDetailMap.get(entry.leagueId) || null;
      const leaderDetail = leagueDetail?.leaders?.find((leader) => leader.userId === (legacyUserDoc.userId || legacyUserDoc.id)) || null;

      const completedAt = toDate(entry.completedAt || entry.timestamp || entry.lastUpdated || leagueDetail?.completedAt || legacyUserDoc.lastUpdated);
      const accuracy = safeNumber(entry.percentage, safeNumber(entry.accuracy));
      const normalizedAccuracy = accuracy > 1 ? accuracy / 100 : accuracy;
      const correctPicks = safeNumber(entry.correctPicks);
      const totalPossible = safeNumber(entry.totalPossible);

      return compactObject({
        leagueId: entry.leagueId || null,
        gameTypeId,
        seasonId: entry.seasonId || leagueDetail?.seasonId || null,
        completedAt,
        rank: safeNumber(entry.rank, 0),
        score: safeNumber(entry.score),
        accuracy: roundToThreeDecimals(normalizedAccuracy || 0),
        correctPicks,
        totalPossible,
        specialPicks: compactObject({
          championPick: entry.championPick,
          championCorrect: entry.championCorrect,
          finalsMVPPick: entry.finalsMVPPick,
          finalsMVPCorrect: entry.finalsMVPCorrect
        }),
        roundBreakdown: compactObject(entry.roundBreakdown || leaderDetail?.roundBreakdown || {}),
        detailPayload: compactObject({
          legacyHistoryEntry: entry,
          leagueDetail: leagueDetail
            ? {
                leagueId: leagueDetail.leagueId,
                gameTypeId: leagueDetail.gameTypeId,
                seasonId: leagueDetail.seasonId,
                completedAt: leagueDetail.completedAt,
                modePayload: leagueDetail.stats?.modePayload || null,
                leaderDetail
              }
            : null
        })
      });
    })
    .filter(Boolean)
    .sort(sortByCompletedAtDescending);

  if (!history.length) {
    return null;
  }

  const lastUpdated = history.reduce((latest, entry) => {
    const entryDate = toDate(entry.completedAt);
    if (!entryDate) return latest;
    return !latest || entryDate > latest ? entryDate : latest;
  }, toDate(legacyUserDoc.lastUpdated) || null);

  return compactObject({
    userId: legacyUserDoc.userId || legacyUserDoc.id || null,
    userName: legacyUserDoc.userName || 'Unknown User',
    lastUpdated: lastUpdated || new Date(),
    history,
    adapterVersion: 1,
    sourceVersion: legacyUserDoc._metadata?.version || 'legacy',
    migratedFrom: 'legacyGameStats',
    migratedAt: new Date()
  });
}

export async function loadServiceAccountFromEnvironment(env = process.env) {
  const rawJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    const fileContents = await fs.readFile(credentialsPath, 'utf8');
    return JSON.parse(fileContents);
  }

  throw new Error(
    'Missing service account credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

async function loadFirebaseToolsAuth() {
  try {
    const rawConfig = await fs.readFile(FIREBASE_TOOLS_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(rawConfig);
    const accessToken = parsed?.tokens?.access_token || null;
    const refreshToken = parsed?.tokens?.refresh_token || null;
    const expiresAt = Number(parsed?.tokens?.expires_at || 0);
    const clientId = parsed?.user?.aud || parsed?.user?.azp || null;

    if (!accessToken && !refreshToken) {
      return null;
    }

    return {
      type: 'firebase-tools-user',
      accessToken,
      refreshToken,
      expiresAt,
      clientId
    };
  } catch (error) {
    return null;
  }
}

export async function loadMigrationAuth(env = process.env) {
  try {
    const serviceAccount = await loadServiceAccountFromEnvironment(env);
    return {
      type: 'service-account',
      serviceAccount
    };
  } catch (error) {
    const firebaseToolsAuth = await loadFirebaseToolsAuth();
    if (firebaseToolsAuth) {
      return firebaseToolsAuth;
    }

    throw error;
  }
}

async function refreshFirebaseToolsAccessToken(authConfig) {
  if (!authConfig?.refreshToken) {
    throw new Error('Firebase CLI auth is missing a refresh token.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: authConfig.refreshToken
  });

  if (authConfig.clientId) {
    body.set('client_id', authConfig.clientId);
  }

  const response = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Firebase CLI token: ${response.status} ${response.statusText}`);
  }

  const tokenResponse = await response.json();
  return {
    accessToken: tokenResponse.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(tokenResponse.expires_in || 3600)
  };
}

async function fetchAccessToken(authConfig, tokenCache) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache?.accessToken && tokenCache?.expiresAt && tokenCache.expiresAt - 60 > now) {
    return tokenCache;
  }

  if (authConfig?.type === 'firebase-tools-user') {
    if (authConfig.accessToken && authConfig.expiresAt && authConfig.expiresAt / 1000 - 60 > now) {
      return {
        accessToken: authConfig.accessToken,
        expiresAt: Math.floor(authConfig.expiresAt / 1000)
      };
    }

    return refreshFirebaseToolsAccessToken(authConfig);
  }

  const serviceAccount = authConfig?.serviceAccount || authConfig;

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URI,
    iat: now,
    exp: now + 3600
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();

  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const signature = base64UrlEncodeBuffer(signer.sign(privateKey));
  const assertion = `${header}.${payload}.${signature}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange service account token: ${response.status} ${response.statusText}`);
  }

  const tokenResponse = await response.json();
  return {
    accessToken: tokenResponse.access_token,
    expiresAt: now + Number(tokenResponse.expires_in || 3600)
  };
}

export function createFirestoreRestClient({
  projectId,
  serviceAccount,
  auth,
  databaseId = DEFAULT_DATABASE_ID
}) {
  if (!projectId) {
    throw new Error('Missing Firestore project ID.');
  }
  const resolvedAuth = auth || (serviceAccount ? { type: 'service-account', serviceAccount } : null);
  const isServiceAccountAuth = resolvedAuth?.type === 'service-account';
  const isFirebaseToolsAuth = resolvedAuth?.type === 'firebase-tools-user';

  if (!isServiceAccountAuth && !isFirebaseToolsAuth) {
    throw new Error('Missing migration auth configuration.');
  }
  if (isServiceAccountAuth && (!resolvedAuth.serviceAccount?.client_email || !resolvedAuth.serviceAccount?.private_key)) {
    throw new Error('Invalid service account payload. client_email and private_key are required.');
  }

  const tokenCache = {
    accessToken: null,
    expiresAt: 0
  };

  async function getAccessToken() {
    const token = await fetchAccessToken(resolvedAuth, tokenCache);
    tokenCache.accessToken = token.accessToken;
    tokenCache.expiresAt = token.expiresAt;
    return token.accessToken;
  }

  function buildUrl(resourcePath, query = {}) {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${resourcePath}`
    );

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    return url;
  }

  async function request(method, resourcePath, { query = {}, body = null } = {}) {
    const accessToken = await getAccessToken();
    const response = await fetch(buildUrl(resourcePath, query), {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore request failed for ${method} ${resourcePath}: ${response.status} ${response.statusText} ${text}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  return {
    projectId,
    databaseId,
    async listDocuments(collectionPath, { pageSize = 300, pageToken = null } = {}) {
      return request('GET', collectionPath, {
        query: {
          pageSize: String(pageSize),
          ...(pageToken ? { pageToken } : {})
        }
      });
    },
    async getDocument(documentPath) {
      return request('GET', documentPath);
    },
    async writeDocument(documentPath, data) {
      return request('PATCH', documentPath, {
        body: {
          name: `projects/${projectId}/databases/${databaseId}/documents/${documentPath}`,
          fields: encodeFirestoreFields(data)
        }
      });
    }
  };
}

export async function listAllDocuments(client, collectionPath) {
  const documents = [];
  let pageToken = null;

  do {
    const response = await client.listDocuments(collectionPath, {
      pageToken
    });
    documents.push(...(response.documents || []));
    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return documents.map((document) => decodeFirestoreDocument(document));
}

export function buildMigrationPlanReport({ sourceCountByGameType, targetCountByGameType, skippedGameTypeCounts }) {
  const gameTypes = SUPPORTED_BRACKET_GAME_TYPES;
  return {
    gameTypes,
    sourceCountByGameType,
    targetCountByGameType,
    skippedGameTypeCounts,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Validation helper for canonical bracket stats docs.
 *
 * This script is read-only. It compares legacy source collections against the
 * canonical league/user summary/detail collections and reports coverage gaps.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   FIREBASE_PROJECT_ID='your-project-id' \
 *   node scripts/statsMigration/validateBracketStats.mjs --report-file ./stats-validation.json
 */
import fs from 'node:fs/promises';
import {
  SUPPORTED_BRACKET_GAME_TYPES,
  buildMigrationPlanReport,
  canonicalStatsPaths,
  createFirestoreRestClient,
  isSupportedBracketGameType,
  listAllDocuments,
  loadMigrationAuth,
  normalizeGameTypeId,
  toDate
} from './core.mjs';

function parseArgs(argv) {
  const args = {
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    reportFile: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--project-id' && next) {
      args.projectId = next;
      index += 1;
    } else if (token === '--database-id' && next) {
      args.databaseId = next;
      index += 1;
    } else if (token === '--report-file' && next) {
      args.reportFile = next;
      index += 1;
    }
  }

  return args;
}

function selectSupportedGameType(gameTypeId) {
  const normalized = normalizeGameTypeId(gameTypeId);
  return isSupportedBracketGameType(normalized) ? normalized : null;
}

function countByGameType(documents, extractor) {
  return documents.reduce((acc, doc) => {
    const gameTypeId = extractor(doc);
    if (!gameTypeId) return acc;
    acc[gameTypeId] = (acc[gameTypeId] || 0) + 1;
    return acc;
  }, {});
}

function buildLeagueCoverage(sourceDocs, canonicalDocs) {
  const sourceByType = countByGameType(sourceDocs, (doc) => selectSupportedGameType(doc.gameTypeId || doc.gameType));
  const canonicalByType = countByGameType(canonicalDocs, (doc) => selectSupportedGameType(doc.gameTypeId || doc.gameType));
  const coverage = {};

  for (const gameTypeId of SUPPORTED_BRACKET_GAME_TYPES) {
    const sourceCount = sourceByType[gameTypeId] || 0;
    const canonicalCount = canonicalByType[gameTypeId] || 0;
    coverage[gameTypeId] = {
      sourceCount,
      canonicalCount,
      missingCount: Math.max(sourceCount - canonicalCount, 0),
      coverage: sourceCount === 0 ? 1 : canonicalCount / sourceCount
    };
  }

  return coverage;
}

function buildUserCoverage(sourceDocs, canonicalDocs) {
  const sourceByType = sourceDocs.reduce((acc, doc) => {
    const history = Array.isArray(doc.leagues) ? doc.leagues : [];
    const gameTypes = new Set(
      history
        .map((entry) => selectSupportedGameType(entry.gameTypeId || entry.gameType))
        .filter(Boolean)
    );

    gameTypes.forEach((gameTypeId) => {
      acc[gameTypeId] = (acc[gameTypeId] || 0) + 1;
    });

    return acc;
  }, {});

  const canonicalByType = canonicalDocs.reduce((acc, doc) => {
    Object.keys(doc.byGameType || {}).forEach((gameTypeId) => {
      acc[gameTypeId] = (acc[gameTypeId] || 0) + 1;
    });
    return acc;
  }, {});

  const coverage = {};

  for (const gameTypeId of SUPPORTED_BRACKET_GAME_TYPES) {
    const sourceCount = sourceByType[gameTypeId] || 0;
    const canonicalCount = canonicalByType[gameTypeId] || 0;
    coverage[gameTypeId] = {
      sourceCount,
      canonicalCount,
      missingCount: Math.max(sourceCount - canonicalCount, 0),
      coverage: sourceCount === 0 ? 1 : canonicalCount / sourceCount
    };
  }

  return coverage;
}

function validateLeagueShape(doc) {
  const required = ['leagueId', 'gameTypeId', 'seasonId', 'completedAt', 'playerCount', 'winner', 'summary'];
  const missing = required.filter((field) => doc[field] === undefined || doc[field] === null);
  return {
    id: doc.id,
    missing
  };
}

function validateUserSummaryShape(doc) {
  const required = ['userId', 'userName', 'lastUpdated', 'summary', 'byGameType'];
  const missing = required.filter((field) => doc[field] === undefined || doc[field] === null);
  return {
    id: doc.id,
    missing
  };
}

function validateLeagueDetailShape(doc) {
  const required = ['leagueId', 'gameTypeId', 'seasonId', 'completedAt', 'leaders', 'stats'];
  const missing = required.filter((field) => doc[field] === undefined || doc[field] === null);
  return {
    id: doc.id,
    missing
  };
}

function validateUserDetailShape(doc) {
  const required = ['userId', 'userName', 'lastUpdated', 'history'];
  const missing = required.filter((field) => doc[field] === undefined || doc[field] === null);
  return {
    id: doc.id,
    missing
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID or --project-id.');
  }

  const auth = await loadMigrationAuth();
  const client = createFirestoreRestClient({
    projectId: args.projectId,
    databaseId: args.databaseId,
    auth
  });

  const [
    legacyLeagueDocs,
    legacyUserDocs,
    canonicalLeagueSummaryDocs,
    canonicalLeagueDetailDocs,
    canonicalUserSummaryDocs,
    canonicalUserDetailDocs
  ] = await Promise.all([
    listAllDocuments(client, 'gameStats/root/leagues'),
    listAllDocuments(client, 'gameStats/root/userStats'),
    listAllDocuments(client, canonicalStatsPaths.leagueSummaries),
    listAllDocuments(client, canonicalStatsPaths.leagueDetails),
    listAllDocuments(client, canonicalStatsPaths.userSummaries),
    listAllDocuments(client, canonicalStatsPaths.userDetails)
  ]);

  const sourceLeagueDocs = legacyLeagueDocs.filter((doc) => isSupportedBracketGameType(selectSupportedGameType(doc.gameTypeId || doc.gameType)));
  const sourceUserDocs = legacyUserDocs.filter((doc) =>
    Array.isArray(doc.leagues) &&
    doc.leagues.some((entry) => isSupportedBracketGameType(selectSupportedGameType(entry.gameTypeId || entry.gameType)))
  );

  const canonicalLeagueSummaryMap = new Map(canonicalLeagueSummaryDocs.map((doc) => [doc.leagueId || doc.id, doc]));
  const canonicalLeagueDetailMap = new Map(canonicalLeagueDetailDocs.map((doc) => [doc.leagueId || doc.id, doc]));
  const canonicalUserSummaryMap = new Map(canonicalUserSummaryDocs.map((doc) => [doc.userId || doc.id, doc]));
  const canonicalUserDetailMap = new Map(canonicalUserDetailDocs.map((doc) => [doc.userId || doc.id, doc]));

  const leagueCoverage = buildLeagueCoverage(sourceLeagueDocs, canonicalLeagueSummaryDocs);
  const userCoverage = buildUserCoverage(
    sourceUserDocs,
    canonicalUserSummaryDocs
  );

  const shapeIssues = {
    leagueSummaries: canonicalLeagueSummaryDocs.map(validateLeagueShape).filter((entry) => entry.missing.length > 0),
    leagueDetails: canonicalLeagueDetailDocs.map(validateLeagueDetailShape).filter((entry) => entry.missing.length > 0),
    userSummaries: canonicalUserSummaryDocs.map(validateUserSummaryShape).filter((entry) => entry.missing.length > 0),
    userDetails: canonicalUserDetailDocs.map(validateUserDetailShape).filter((entry) => entry.missing.length > 0)
  };

  const missingCanonicalDocs = {
    leagueSummaries: sourceLeagueDocs.filter((doc) => !canonicalLeagueSummaryMap.has(doc.leagueId || doc.id)).map((doc) => doc.leagueId || doc.id),
    leagueDetails: sourceLeagueDocs.filter((doc) => !canonicalLeagueDetailMap.has(doc.leagueId || doc.id)).map((doc) => doc.leagueId || doc.id),
    userSummaries: sourceUserDocs.filter((doc) => !canonicalUserSummaryMap.has(doc.userId || doc.id)).map((doc) => doc.userId || doc.id),
    userDetails: sourceUserDocs.filter((doc) => !canonicalUserDetailMap.has(doc.userId || doc.id)).map((doc) => doc.userId || doc.id)
  };

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: args.projectId,
    databaseId: args.databaseId,
    sourceCounts: {
      leagues: sourceLeagueDocs.length,
      users: sourceUserDocs.length
    },
    canonicalCounts: {
      leagueSummaries: canonicalLeagueSummaryDocs.length,
      leagueDetails: canonicalLeagueDetailDocs.length,
      userSummaries: canonicalUserSummaryDocs.length,
      userDetails: canonicalUserDetailDocs.length
    },
    coverage: {
      leagues: leagueCoverage,
      users: userCoverage
    },
    missingCanonicalDocs,
    shapeIssues,
    sampleCanonicalLeague: canonicalLeagueSummaryDocs[0] || null,
    sampleCanonicalUser: canonicalUserSummaryDocs[0] || null,
    migrationPlan: buildMigrationPlanReport({
      sourceCountByGameType: Object.fromEntries(SUPPORTED_BRACKET_GAME_TYPES.map((gameTypeId) => [gameTypeId, leagueCoverage[gameTypeId]?.sourceCount || 0])),
      targetCountByGameType: Object.fromEntries(SUPPORTED_BRACKET_GAME_TYPES.map((gameTypeId) => [gameTypeId, leagueCoverage[gameTypeId]?.canonicalCount || 0])),
      skippedGameTypeCounts: {
        leagues: 0,
        users: 0
      }
    })
  };

  if (args.reportFile) {
    await fs.writeFile(args.reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

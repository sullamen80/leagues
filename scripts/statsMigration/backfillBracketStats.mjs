/**
 * One-off backfill tool for canonical bracket stats docs.
 *
 * Invocation:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
 *   FIREBASE_PROJECT_ID='your-project-id' \
 *   node scripts/statsMigration/backfillBracketStats.mjs --dry-run
 *
 * Or:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   FIREBASE_PROJECT_ID='your-project-id' \
 *   node scripts/statsMigration/backfillBracketStats.mjs --report-file ./stats-migration-report.json
 *
 * This script only writes to:
 *   gameStats/root/leagueSummaries/*
 *   gameStats/root/leagueDetails/*
 *   gameStats/root/userSummaries/*
 *   gameStats/root/userDetails/*
 *
 * It never deletes or overwrites legacy docs in gameStats/root/leagues or gameStats/root/userStats.
 */
import fs from 'node:fs/promises';
import {
  SUPPORTED_BRACKET_GAME_TYPES,
  buildCanonicalLeagueDetailFromLegacy,
  buildCanonicalLeagueSummaryFromLegacy,
  buildCanonicalUserDetailFromLegacyUserDoc,
  buildCanonicalUserSummaryFromLegacyUserDoc,
  buildMigrationPlanReport,
  canonicalStatsPaths,
  createFirestoreRestClient,
  isSupportedBracketGameType,
  listAllDocuments,
  loadMigrationAuth,
  normalizeGameTypeId
} from './core.mjs';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    reportFile: null,
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    gameTypes: [...SUPPORTED_BRACKET_GAME_TYPES]
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--project-id' && next) {
      args.projectId = next;
      index += 1;
    } else if (token === '--database-id' && next) {
      args.databaseId = next;
      index += 1;
    } else if (token === '--report-file' && next) {
      args.reportFile = next;
      index += 1;
    } else if (token === '--game-types' && next) {
      args.gameTypes = next
        .split(',')
        .map((item) => normalizeGameTypeId(item.trim()))
        .filter(Boolean);
      index += 1;
    }
  }

  return args;
}

function selectSupportedGameType(gameTypeId) {
  const normalized = normalizeGameTypeId(gameTypeId);
  return isSupportedBracketGameType(normalized) ? normalized : null;
}

function collectCountsByGameType(documents) {
  return documents.reduce((acc, doc) => {
    const gameTypeId = selectSupportedGameType(doc.gameTypeId || doc.gameType);
    if (!gameTypeId) return acc;
    acc[gameTypeId] = (acc[gameTypeId] || 0) + 1;
    return acc;
  }, {});
}

function collectUserCountsByGameType(userDocs, selector) {
  return userDocs.reduce((acc, doc) => {
    const gameTypes = selector(doc);
    gameTypes.forEach((gameTypeId) => {
      acc[gameTypeId] = (acc[gameTypeId] || 0) + 1;
    });
    return acc;
  }, {});
}

function getUserGameTypesFromLegacyDoc(doc) {
  const history = Array.isArray(doc.leagues) ? doc.leagues : [];
  return [...new Set(
    history
      .map((entry) => selectSupportedGameType(entry.gameTypeId || entry.gameType))
      .filter(Boolean)
  )];
}

function getUserGameTypesFromCanonicalSummary(doc) {
  return Object.keys(doc.byGameType || {});
}

function buildLeagueDetailMap(leagueDetails) {
  return new Map(
    leagueDetails
      .filter(Boolean)
      .map((detail) => [detail.leagueId, detail])
  );
}

async function writeDocumentIfNeeded(client, documentPath, data, dryRun) {
  if (!data) {
    return { skipped: true, reason: 'no-data' };
  }

  if (dryRun) {
    return { skipped: true, reason: 'dry-run' };
  }

  await client.writeDocument(documentPath, {
    ...data,
    migratedAt: data.migratedAt || new Date(),
    completedAt: data.completedAt || undefined,
    lastUpdated: data.lastUpdated || undefined
  });

  return { skipped: false };
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

  const [legacyLeagueDocs, legacyUserDocs] = await Promise.all([
    listAllDocuments(client, canonicalStatsPaths.leagueSummaries.replace('leagueSummaries', 'leagues')),
    listAllDocuments(client, canonicalStatsPaths.userSummaries.replace('userSummaries', 'userStats'))
  ]);

  const sourceLeagueDocs = legacyLeagueDocs.filter((doc) => args.gameTypes.includes(selectSupportedGameType(doc.gameTypeId || doc.gameType)));
  const sourceUserDocs = legacyUserDocs.filter((doc) => {
    const history = Array.isArray(doc.leagues) ? doc.leagues : [];
    return history.some((entry) => args.gameTypes.includes(selectSupportedGameType(entry.gameTypeId || entry.gameType)));
  });

  const sourceLeagueCounts = collectCountsByGameType(sourceLeagueDocs);
  const sourceUserCounts = collectUserCountsByGameType(sourceUserDocs, getUserGameTypesFromLegacyDoc);

  const canonicalLeagueSummaries = [];
  const canonicalLeagueDetails = [];

  for (const leagueDoc of sourceLeagueDocs) {
    const summary = buildCanonicalLeagueSummaryFromLegacy(leagueDoc);
    const detail = buildCanonicalLeagueDetailFromLegacy(leagueDoc);
    if (summary) canonicalLeagueSummaries.push(summary);
    if (detail) canonicalLeagueDetails.push(detail);
  }

  const leagueDetailMap = buildLeagueDetailMap(canonicalLeagueDetails);

  const canonicalUserSummaries = [];
  const canonicalUserDetails = [];

  for (const userDoc of sourceUserDocs) {
    const summary = buildCanonicalUserSummaryFromLegacyUserDoc(userDoc);
    const detail = buildCanonicalUserDetailFromLegacyUserDoc(userDoc, leagueDetailMap);
    if (summary) canonicalUserSummaries.push(summary);
    if (detail) canonicalUserDetails.push(detail);
  }

  const targetLeagueCounts = collectCountsByGameType(canonicalLeagueSummaries);
  const targetUserCounts = collectUserCountsByGameType(canonicalUserSummaries, getUserGameTypesFromCanonicalSummary);

  const results = {
    dryRun: args.dryRun,
    projectId: args.projectId,
    databaseId: args.databaseId,
    sourceCounts: {
      leagues: sourceLeagueDocs.length,
      users: sourceUserDocs.length,
      leaguesByGameType: sourceLeagueCounts,
      usersByGameType: sourceUserCounts
    },
    targetCounts: {
      leagueSummaries: canonicalLeagueSummaries.length,
      leagueDetails: canonicalLeagueDetails.length,
      userSummaries: canonicalUserSummaries.length,
      userDetails: canonicalUserDetails.length,
      leaguesByGameType: targetLeagueCounts,
      usersByGameType: targetUserCounts
    },
    skippedGameTypeCounts: {
      leagues: legacyLeagueDocs.length - sourceLeagueDocs.length,
      users: legacyUserDocs.length - sourceUserDocs.length
    },
    report: buildMigrationPlanReport({
      sourceCountByGameType: sourceLeagueCounts,
      targetCountByGameType: targetLeagueCounts,
      skippedGameTypeCounts: {
        leagues: legacyLeagueDocs.length - sourceLeagueDocs.length,
        users: legacyUserDocs.length - sourceUserDocs.length
      }
    })
  };

  if (!args.dryRun) {
    for (const summary of canonicalLeagueSummaries) {
      await writeDocumentIfNeeded(client, `${canonicalStatsPaths.leagueSummaries}/${summary.leagueId}`, summary, false);
    }
    for (const detail of canonicalLeagueDetails) {
      await writeDocumentIfNeeded(client, `${canonicalStatsPaths.leagueDetails}/${detail.leagueId}`, detail, false);
    }
    for (const summary of canonicalUserSummaries) {
      await writeDocumentIfNeeded(client, `${canonicalStatsPaths.userSummaries}/${summary.userId}`, summary, false);
    }
    for (const detail of canonicalUserDetails) {
      await writeDocumentIfNeeded(client, `${canonicalStatsPaths.userDetails}/${detail.userId}`, detail, false);
    }
  }

  if (args.reportFile) {
    await fs.writeFile(args.reportFile, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

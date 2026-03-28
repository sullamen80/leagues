// src/gameTypes/winsPool/services/statsHistoryService.js
import {
  collection,
  doc,
  setDoc,
  getDocs,
  orderBy,
  query,
  limit as limitQuery
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { fetchEspnTeamWins } from './teamWinsService';
import { fetchNbaPlayerStats } from './playerStatsService';
import { PRESET_TEAM_POOLS } from '../constants/teamPools';

const STATS_HISTORY_ROOT = 'statsHistory';

const LEAGUE_PRESET_MAP = {
  NBA: 'nba',
  NFL: 'nfl'
};

const sanitizeSeasonKey = (season) => {
  if (!season) return null;
  return season
    .toString()
    .trim()
    .replace(/[^0-9a-zA-Z-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
};

const resolveTeamPoolForLeague = (leagueKey) => {
  const presetKey = LEAGUE_PRESET_MAP[leagueKey];
  if (!presetKey || !PRESET_TEAM_POOLS[presetKey]) {
    throw new Error(`Unsupported league ${leagueKey}.`);
  }
  const pool = PRESET_TEAM_POOLS[presetKey];
  return Array.isArray(pool?.teams) ? pool.teams : [];
};

const buildTeamEntriesFromWins = (espnWins = [], teamPool = []) => {
  const teamMap = new Map();
  teamPool.forEach((team) => {
    teamMap.set(team.id, team);
  });

  return espnWins.map((entry) => {
    const wins = Number.isFinite(entry.wins) ? entry.wins : 0;
    const losses = Number.isFinite(entry.losses) ? entry.losses : null;
    const winPct = Number.isFinite(entry.winPct) ? entry.winPct : null;
    const totalGames = wins + (losses || 0);
    const team = teamMap.get(entry.teamId) || {};
    return {
      teamId: entry.teamId,
      name: team.name || team.shortName || entry.teamId,
      city: team.city || '',
      conference: team.conference || '',
      division: team.division || '',
      wins,
      losses,
      winPct: winPct !== null ? winPct : totalGames > 0 ? wins / totalGames : null
    };
  });
};

const getSeasonMetadataDocRef = (leagueKey, seasonKey) => {
  return doc(db, STATS_HISTORY_ROOT, leagueKey, 'seasons', seasonKey);
};

const getTeamStandingsCollectionRef = (leagueKey, seasonKey) => {
  return collection(db, STATS_HISTORY_ROOT, leagueKey, 'seasons', seasonKey, 'teamStandings');
};

const getPlayerLeadersCollectionRef = (leagueKey, seasonKey) => {
  return collection(db, STATS_HISTORY_ROOT, leagueKey, 'seasons', seasonKey, 'playerLeaders');
};

export const fetchAvailableSeasons = async (league) => {
  if (!league) {
    throw new Error('League is required.');
  }
  const leagueKey = String(league).toUpperCase();
  const seasonsCollection = collection(db, STATS_HISTORY_ROOT, leagueKey, 'seasons');
  const snapshot = await getDocs(seasonsCollection);
  const seasons = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  return seasons.sort((a, b) => {
    const seasonA = a.season || a.id;
    const seasonB = b.season || b.id;
    return seasonA > seasonB ? -1 : 1;
  });
};

export const archiveSeasonTeamStandings = async ({
  league,
  season,
  actor = 'admin-console'
}) => {
  if (!league) {
    throw new Error('League is required.');
  }

  if (!season) {
    throw new Error('Season is required.');
  }

  const leagueKey = String(league).toUpperCase();
  if (!LEAGUE_PRESET_MAP[leagueKey]) {
    throw new Error(`League ${leagueKey} not supported for archival.`);
  }

  const seasonKey = sanitizeSeasonKey(season);
  if (!seasonKey) {
    throw new Error('Season identifier is invalid.');
  }

  const teamPool = resolveTeamPoolForLeague(leagueKey);

  const { wins: espnWins, unmatched, meta } = await fetchEspnTeamWins({
    league: leagueKey,
    season,
    teamPool
  });

  if (!espnWins.length) {
    throw new Error('ESPN returned no standings data for the requested season.');
  }

  const payload = {
    league: leagueKey,
    season: season.toString(),
    capturedAt: new Date().toISOString(),
    source: 'espn',
    actor,
    meta: {
      unmatchedCount: unmatched.length,
      fetchedAt: meta?.fetchedAt || null,
      teamCount: espnWins.length
    },
    entries: buildTeamEntriesFromWins(espnWins, teamPool),
    unmatched
  };

  const metadataRef = getSeasonMetadataDocRef(leagueKey, seasonKey);
  await setDoc(
    metadataRef,
    {
      league: leagueKey,
      season: season.toString(),
      updatedAt: payload.capturedAt
    },
    { merge: true }
  );

  const snapshotRef = doc(
    getTeamStandingsCollectionRef(leagueKey, seasonKey),
    'latest'
  );

  await setDoc(snapshotRef, payload);

  return { snapshotId: snapshotRef.id, ...payload };
};

export const archiveSeasonPlayerLeaders = async ({
  league,
  season,
  actor = 'admin-console',
  leaderboards = {},
  meta = {}
}) => {
  if (!league) {
    throw new Error('League is required.');
  }
  if (!season) {
    throw new Error('Season is required.');
  }

  const leagueKey = String(league).toUpperCase();
  if (!LEAGUE_PRESET_MAP[leagueKey]) {
    throw new Error(`League ${leagueKey} not supported for archival.`);
  }

  const seasonKey = sanitizeSeasonKey(season);
  if (!seasonKey) {
    throw new Error('Season identifier is invalid.');
  }

  let effectiveLeaderboards = leaderboards || {};
  const derivedMeta = { ...meta };

  if (!Object.keys(effectiveLeaderboards).length) {
    if (leagueKey === 'NBA') {
      const { players, categories, seasonYear, source, enforceGameMinimum } =
        await fetchNbaPlayerStats({ season });

      if (!categories || !Object.keys(categories).length) {
        throw new Error('ESPN returned no player leaderboard data for the requested season.');
      }

      effectiveLeaderboards = categories;
      derivedMeta.playerCount = Array.isArray(players) ? players.length : 0;
      derivedMeta.source = source || 'espn';
      derivedMeta.seasonYear = seasonYear;
      derivedMeta.enforceGameMinimum =
        enforceGameMinimum !== undefined ? enforceGameMinimum : true;
    } else {
      throw new Error(`Player leader archival is not implemented for ${leagueKey}.`);
    }
  }

  const payload = {
    league: leagueKey,
    season: season.toString(),
    capturedAt: new Date().toISOString(),
    source: derivedMeta.source || meta.source || 'espn',
    actor,
    meta: {
      ...derivedMeta,
      categoryCount: Object.keys(effectiveLeaderboards).length
    },
    categories: effectiveLeaderboards
  };

  const metadataRef = getSeasonMetadataDocRef(leagueKey, seasonKey);
  await setDoc(
    metadataRef,
    {
      league: leagueKey,
      season: season.toString(),
      updatedAt: payload.capturedAt
    },
    { merge: true }
  );

  const snapshotRef = doc(
    getPlayerLeadersCollectionRef(leagueKey, seasonKey),
    'latest'
  );

  await setDoc(snapshotRef, payload);

  return { snapshotId: snapshotRef.id, ...payload };
};

export const fetchSeasonTeamSnapshots = async ({
  league,
  season,
  limit = 20
}) => {
  if (!league) {
    throw new Error('League is required.');
  }
  if (!season) {
    throw new Error('Season is required.');
  }

  const leagueKey = String(league).toUpperCase();
  const seasonKey = sanitizeSeasonKey(season);

  const snapshotsRef = getTeamStandingsCollectionRef(leagueKey, seasonKey);
  const q = query(snapshotsRef, orderBy('capturedAt', 'desc'), limitQuery(limit));
  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const fetchLatestTeamStandingsSnapshot = async ({ league, season }) => {
  const snapshots = await fetchSeasonTeamSnapshots({ league, season, limit: 1 });
  return snapshots[0] || null;
};

export const fetchLatestPlayerLeadersSnapshot = async ({ league, season }) => {
  if (!league) {
    throw new Error('League is required.');
  }
  if (!season) {
    throw new Error('Season is required.');
  }
  const leagueKey = String(league).toUpperCase();
  const seasonKey = sanitizeSeasonKey(season);

  const leadersRef = getPlayerLeadersCollectionRef(leagueKey, seasonKey);
  const leadersQuery = query(leadersRef, orderBy('capturedAt', 'desc'), limitQuery(1));
  const snapshot = await getDocs(leadersQuery);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

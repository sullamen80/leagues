// src/gameTypes/winsPool/services/teamWinsService.js
import axios from 'axios';
import { ESPN_LEAGUE_CONFIG } from '../constants/externalSources.js';

const DEFAULT_TIMEOUT_MS = 12000;

const collectStandingsEntries = (node, entries = []) => {
  if (!node || typeof node !== 'object') {
    return entries;
  }

  if (Array.isArray(node.standings?.entries)) {
    entries.push(...node.standings.entries);
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => collectStandingsEntries(child, entries));
  }

  if (Array.isArray(node.entries)) {
    entries.push(...node.entries);
  }

  return entries;
};

const parseNumericValue = (stat) => {
  if (!stat) return null;

  if (stat.value !== undefined && stat.value !== null) {
    const numeric = Number(stat.value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  if (stat.displayValue) {
    const cleaned = String(stat.displayValue).replace(/[^0-9.\-]/g, '');
    if (cleaned) {
      const parsed = Number(cleaned);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  if (stat.intValue !== undefined && stat.intValue !== null) {
    return Number(stat.intValue);
  }

  return null;
};

const matchesTargetToken = (stat, tokens) => {
  if (!stat) return false;
  const fields = [
    stat.name,
    stat.shortName,
    stat.shortDisplayName,
    stat.abbreviation,
    stat.type,
    stat.displayName,
    stat.description
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return fields.some((field) => tokens.includes(field));
};

const extractStatValue = (stats = [], targets = []) => {
  if (!Array.isArray(stats) || !targets.length) return null;
  const normalizedTargets = targets.map((token) => token.toLowerCase());
  const stat = stats.find((entry) => matchesTargetToken(entry, normalizedTargets));
  if (!stat) return null;
  return parseNumericValue(stat);
};

const parseRecordFromSummary = (stats = []) => {
  if (!Array.isArray(stats)) return null;
  const summaryStat = stats.find((stat) => stat.summary && /\d+\s*-\s*\d+/.test(stat.summary));
  if (!summaryStat) return null;
  const match = summaryStat.summary.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return {
    wins: Number(match[1]),
    losses: Number(match[2])
  };
};

const buildTeamLookupMaps = (teamPool = [], leagueConfig = {}) => {
  const byId = new Map();
  const byFullName = new Map();
  const byShortName = new Map();
  const byAbbreviation = new Map();

  teamPool.forEach((team) => {
    if (!team || !team.id) return;
    const normalizedId = String(team.id).toUpperCase();
    byId.set(normalizedId, team);

    const fullName = `${team.city || ''} ${team.name || team.shortName || ''}`.trim().toLowerCase();
    if (fullName) byFullName.set(fullName, team);

    if (team.name) {
      byShortName.set(team.name.toLowerCase(), team);
    }
    if (team.shortName) {
      byShortName.set(team.shortName.toLowerCase(), team);
    }

    const altAbbrevs = leagueConfig?.abbreviationOverrides?.[normalizedId] || [];
    const primaryAbbrev = normalizedId;
    byAbbreviation.set(primaryAbbrev, team);
    altAbbrevs
      .map((abbr) => String(abbr).toUpperCase())
      .forEach((abbr) => byAbbreviation.set(abbr, team));
  });

  return { byId, byFullName, byShortName, byAbbreviation };
};

const resolveTeamId = (espnTeam = {}, lookupMaps) => {
  if (!espnTeam) return null;
  const { byId, byFullName, byShortName, byAbbreviation } = lookupMaps;

  const abbreviation = typeof espnTeam.abbreviation === 'string' ? espnTeam.abbreviation.toUpperCase() : null;
  if (abbreviation && byAbbreviation.has(abbreviation)) {
    return byAbbreviation.get(abbreviation).id;
  }

  const displayName = espnTeam.displayName || '';
  const location = espnTeam.location || '';
  const mascot = espnTeam.name || '';
  const shortDisplayName = espnTeam.shortDisplayName || '';

  const fullName = `${location} ${mascot}`.trim().toLowerCase();
  if (fullName && byFullName.has(fullName)) {
    return byFullName.get(fullName).id;
  }

  const shortKey = shortDisplayName.trim().toLowerCase();
  if (shortKey && byShortName.has(shortKey)) {
    return byShortName.get(shortKey).id;
  }

  const mascotKey = mascot.trim().toLowerCase();
  if (mascotKey && byShortName.has(mascotKey)) {
    return byShortName.get(mascotKey).id;
  }

  const espnId = espnTeam.id ? String(espnTeam.id).toUpperCase() : null;
  if (espnId && byId.has(espnId)) {
    return byId.get(espnId).id;
  }

  return null;
};

/**
 * Attempt to infer the league identifier from the provided team pool.
 * @param {Array} teamPool
 * @returns {string|null}
 */
export const inferLeagueFromTeamPool = (teamPool = []) => {
  if (!Array.isArray(teamPool) || teamPool.length === 0) return null;
  const firstTeam = teamPool[0];

  if (firstTeam?.metadata?.league) {
    return String(firstTeam.metadata.league).toUpperCase();
  }

  if (firstTeam?.league) {
    return String(firstTeam.league).toUpperCase();
  }

  const conference = (firstTeam?.conference || '').toLowerCase();
  if (conference === 'east' || conference === 'west') {
    return 'NBA';
  }
  if (conference === 'afc' || conference === 'nfc') {
    return 'NFL';
  }

  return null;
};

/**
 * Fetch standings data from ESPN and map to team wins.
 * @param {Object} params
 * @param {string} params.league - League identifier (e.g., 'NBA', 'NFL').
 * @param {Array} params.teamPool - Current league team pool for mapping.
 * @returns {Promise<{wins: Array, unmatched: Array, meta: Object}>}
 */
export const fetchEspnTeamWins = async ({ league, teamPool = [], season = null }) => {
  if (!league) {
    throw new Error('League is required to fetch ESPN standings.');
  }

  const leagueKey = String(league).toUpperCase();
  const leagueConfig = ESPN_LEAGUE_CONFIG[leagueKey];

  if (!leagueConfig) {
    throw new Error(`League ${leagueKey} is not supported for ESPN sync.`);
  }

  try {
    const requestParams = { ...(leagueConfig.params || {}) };
    if (season) {
      requestParams.season = season;
    }

    const response = await axios.get(leagueConfig.standingsUrl, {
      timeout: DEFAULT_TIMEOUT_MS,
      params: requestParams
    });

    const data = response.data;
    const entries = collectStandingsEntries(data, []);
    const lookupMaps = buildTeamLookupMaps(teamPool, leagueConfig);

    const wins = [];
    const unmatched = [];

    entries.forEach((entry) => {
      const espnTeam = entry.team || {};
      let winsValue = extractStatValue(entry.stats, ['wins', 'w']);
      let lossesValue = extractStatValue(entry.stats, ['losses', 'l']);
      let winPctValue = extractStatValue(entry.stats, ['win percent', 'pct', 'winpercent']);

      if (lossesValue === null || winsValue === null) {
        const record = parseRecordFromSummary(entry.stats);
        if (record) {
          if (winsValue === null) winsValue = record.wins;
          if (lossesValue === null) lossesValue = record.losses;
        }
      }

      if ((winPctValue === null || Number.isNaN(winPctValue)) && winsValue !== null && lossesValue !== null) {
        const totalGames = winsValue + lossesValue;
        winPctValue = totalGames > 0 ? winsValue / totalGames : 0;
      }

      const teamId = resolveTeamId(espnTeam, lookupMaps);
      if (!teamId) {
        unmatched.push({
          espnTeamId: espnTeam.id,
          espnAbbreviation: espnTeam.abbreviation,
          espnDisplayName: espnTeam.displayName
        });
        return;
      }

      wins.push({
        teamId,
        wins: Number.isFinite(winsValue) ? winsValue : 0,
        losses: Number.isFinite(lossesValue) ? lossesValue : null,
        winPct: Number.isFinite(winPctValue) ? winPctValue : null,
        source: 'espn',
        fetchedAt: new Date().toISOString()
      });
    });

    return {
      wins,
      unmatched,
      meta: {
        league: leagueKey,
        season: season ? season.toString() : 'current',
        fetchedAt: new Date().toISOString(),
        totalTeams: teamPool.length,
        totalEntries: entries.length
      }
    };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `ESPN API request failed with status ${error.response.status}: ${error.response.statusText || 'Unknown error'}`
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('ESPN API request timed out. Please try again.');
    }
    throw new Error(error.message || 'Failed to fetch ESPN standings.');
  }
};

/**
 * Utility to compose an update payload combining manual overrides and ESPN data.
 * Placeholder for future functionality—currently returns ESPN values.
 */
export const mergeWinsData = ({ currentWins = {}, autoWins = [] } = {}) => {
  const merged = new Map();

  Object.entries(currentWins).forEach(([teamId, value]) => {
    merged.set(teamId, {
      teamId,
      wins: value?.wins ?? 0,
      losses: value?.losses ?? null,
      winPct: value?.winPct ?? null,
      source: value?.source || 'manual',
      updatedAt: value?.updatedAt || null
    });
  });

  autoWins.forEach((entry) => {
    if (!entry || !entry.teamId) return;
    const existing = merged.get(entry.teamId);
    merged.set(entry.teamId, {
      teamId: entry.teamId,
      wins: entry.wins,
      losses: entry.losses ?? existing?.losses ?? null,
      winPct: entry.winPct ?? existing?.winPct ?? null,
      source: 'espn',
      updatedAt: entry.fetchedAt || new Date().toISOString(),
      previous: existing || null
    });
  });

  return Array.from(merged.values());
};

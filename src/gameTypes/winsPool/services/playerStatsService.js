// src/gameTypes/winsPool/services/playerStatsService.js
import axios from 'axios';

const REQUEST_TIMEOUT = 12000;

const ESPN_TEAM_ID_MAP = {
  ATL: 1,
  BOS: 2,
  NOP: 3,
  CHI: 4,
  CLE: 5,
  DAL: 6,
  DEN: 7,
  DET: 8,
  GSW: 9,
  HOU: 10,
  IND: 11,
  LAC: 12,
  LAL: 13,
  MIA: 14,
  MIL: 15,
  MIN: 16,
  BKN: 17,
  NYK: 18,
  ORL: 19,
  PHI: 20,
  PHX: 21,
  POR: 22,
  SAC: 23,
  SAS: 24,
  OKC: 25,
  TOR: 26,
  UTA: 27,
  WAS: 28,
  MEM: 29,
  CHA: 30
};

const sanitizeNumeric = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildStatMap = (categories = []) => {
  const map = {};
  categories.forEach((category) => {
    (category.stats || []).forEach((stat) => {
      const numericValue =
        sanitizeNumeric(stat.value) ??
        sanitizeNumeric(stat.displayValue);
      map[stat.name] = numericValue;
      if (stat.abbreviation) {
        const shortKey = stat.abbreviation.toLowerCase();
        if (map[shortKey] === undefined) {
          map[shortKey] = numericValue;
        }
      }
    });
  });
  return map;
};

let cachedCurrentSeasonYear = null;
let cachedSeasonTimestamp = 0;
const CURRENT_SEASON_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const fetchCurrentSeasonYear = async () => {
  const now = Date.now();
  if (
    cachedCurrentSeasonYear !== null &&
    now - cachedSeasonTimestamp < CURRENT_SEASON_TTL_MS
  ) {
    return cachedCurrentSeasonYear;
  }

  try {
    const response = await axios.get(
      'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/current',
      {
        params: { lang: 'en', region: 'us' },
        timeout: REQUEST_TIMEOUT
      }
    );

    const seasonYear = Number(response.data?.year);
    if (!Number.isFinite(seasonYear)) {
      throw new Error('Season year missing from ESPN response.');
    }

    cachedCurrentSeasonYear = seasonYear;
    cachedSeasonTimestamp = now;
    return seasonYear;
  } catch (error) {
    console.warn(
      '[WinsPool][PlayerStatsService] Failed to resolve current season from ESPN. Falling back to calendar year.',
      error.message
    );
    const fallbackYear = new Date().getFullYear();
    cachedCurrentSeasonYear = fallbackYear;
    cachedSeasonTimestamp = now;
    return fallbackYear;
  }
};

const resolveSeasonYear = async (season) => {
  if (!season || season === 'current') {
    return fetchCurrentSeasonYear();
  }
  const match = String(season).match(/\d{4}/);
  if (match) {
    return Number(match[0]);
  }
  const numeric = Number(season);
  return Number.isFinite(numeric) ? numeric : fetchCurrentSeasonYear();
};

const uniqueDescending = (values = []) => {
  const sorted = Array.from(new Set(values.filter((value) => Number.isFinite(value))));
  return sorted.sort((a, b) => b - a);
};

const buildSeasonCandidateList = async (season) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const resolvedCurrentYear = await resolveSeasonYear('current');

  if (season && season !== 'current') {
    const baseYear = await resolveSeasonYear(season);
    const manualCandidates = [];
    if (Number.isFinite(baseYear)) {
      manualCandidates.push(baseYear);
      if (baseYear - 1 >= 2000) {
        manualCandidates.push(baseYear - 1);
      }
      if (baseYear + 1 <= resolvedCurrentYear + 1) {
        manualCandidates.push(baseYear + 1);
      }
    }
    return {
      candidates: manualCandidates,
      resolvedCurrentYear
    };
  }

  return {
    candidates: uniqueDescending([
      currentYear + 2,
      currentYear + 1,
      resolvedCurrentYear + 1,
      resolvedCurrentYear,
      currentYear,
      currentYear - 1
    ]),
    resolvedCurrentYear
  };
};

const buildSeasonLabelFromYear = (year) => {
  if (!Number.isFinite(year)) return null;
  const startYear = year - 1;
  const endYearDigits = String(year).slice(-2);
  return `${startYear}-${endYearDigits}`;
};

const fetchAthleteStats = async ({ athleteUrl }) => {
  const urlWithParams = `${athleteUrl}${athleteUrl.includes('?') ? '&' : '?'}lang=en&region=us&view=stats`;
  const detailRes = await axios.get(urlWithParams, { timeout: REQUEST_TIMEOUT });

  const athlete = detailRes.data || {};
  const statsRef =
    athlete.statistics?.$ref ||
    athlete.seasonStats?.$ref ||
    null;

  let statsMap = {};

  if (statsRef) {
    const statsUrl = `${statsRef}${statsRef.includes('?') ? '&' : '?'}lang=en&region=us`;
    const statsRes = await axios.get(statsUrl, { timeout: REQUEST_TIMEOUT });
    const categories = statsRes.data?.splits?.categories || [];
    statsMap = buildStatMap(categories);
  }

  const teamRef = athlete.team?.$ref || athlete.teams?.[0]?.team?.$ref || null;
  let teamInfo = null;
  if (teamRef) {
    const teamDetail = await axios.get(`${teamRef}${teamRef.includes('?') ? '&' : '?'}lang=en&region=us`, {
      timeout: REQUEST_TIMEOUT
    });
    teamInfo = teamDetail.data;
  }

  const gamesPlayed =
    sanitizeNumeric(statsMap.gamesPlayed) ??
    sanitizeNumeric(statsMap.games) ??
    0;

  const result = {
    playerId: athlete.id,
    displayName: athlete.fullName || athlete.displayName,
    team: {
      abbreviation: teamInfo?.abbreviation || teamInfo?.displayName || '',
      name: teamInfo?.displayName || '',
      id: teamInfo?.id || null
    },
    gamesPlayed: Number(gamesPlayed || 0),
    averages: {
      ppg:
        sanitizeNumeric(statsMap.avgPoints) ??
        sanitizeNumeric(statsMap.pointsPerGame),
      rpg:
        sanitizeNumeric(statsMap.avgRebounds) ??
        sanitizeNumeric(statsMap.reboundsPerGame),
      apg:
        sanitizeNumeric(statsMap.avgAssists) ??
        sanitizeNumeric(statsMap.assistsPerGame),
      spg:
        sanitizeNumeric(statsMap.avgSteals) ??
        sanitizeNumeric(statsMap.stealsPerGame),
      bpg:
        sanitizeNumeric(statsMap.avgBlocks) ??
        sanitizeNumeric(statsMap.blocksPerGame)
    }
  };

  return result;
};

const asyncPool = async (items, handler, concurrency = 5) => {
  const results = [];
  const executing = [];

  for (const item of items) {
    const promise = Promise.resolve().then(() => handler(item));
    results.push(promise);

    if (concurrency <= items.length) {
      const e = promise.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
};

const LEADER_CATEGORY_KEYWORDS = {
  ppg: ['points per game', 'ppg', 'pointspergame'],
  rpg: ['rebounds per game', 'rpg', 'reboundspergame'],
  apg: ['assists per game', 'apg', 'assistspergame'],
  spg: ['steals per game', 'spg', 'stealspergame'],
  bpg: ['blocks per game', 'bpg', 'blockspergame']
};

const normalizeToken = (value) =>
  typeof value === 'string'
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    : '';

const matchesLeaderCategory = (categoryNode, keywords = []) => {
  if (!categoryNode || !keywords.length) return false;
  const normalizedKeywords = keywords.map(normalizeToken);
  const fields = [
    categoryNode.name,
    categoryNode.displayName,
    categoryNode.shortDisplayName,
    categoryNode.abbreviation,
    categoryNode.type,
    categoryNode.category,
    categoryNode.statistic?.name,
    categoryNode.statistic?.displayName,
    categoryNode.statistic?.abbreviation
  ]
    .filter(Boolean)
    .map(normalizeToken);

  return normalizedKeywords.some((keyword) =>
    fields.some((field) => field.includes(keyword))
  );
};

const flattenLeaderCategories = (root) => {
  const collected = [];
  const visited = new Set();

  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;

    if (Array.isArray(node.leaders) && node.leaders.length > 0) {
      const identifier = [
        node.name,
        node.displayName,
        node.shortDisplayName,
        node.abbreviation
      ]
        .filter(Boolean)
        .join('|');
      if (!visited.has(identifier)) {
        collected.push(node);
        visited.add(identifier);
      }
    }

    Object.values(node).forEach((value) => {
      if (value && typeof value === 'object') {
        visit(value);
      }
    });
  };

  visit(root);
  return collected;
};

const extractAthleteRef = (leaderEntry) => {
  if (!leaderEntry) return null;
  const candidateRefs = [
    leaderEntry.athlete?.$ref,
    leaderEntry.player?.$ref,
    leaderEntry.athlete?.athlete?.$ref,
    leaderEntry.profile?.$ref
  ].filter(Boolean);

  if (candidateRefs.length > 0) {
    const ref = candidateRefs[0];
    return ref.includes('?') ? ref.split('?')[0] : ref;
  }

  const candidateIds = [
    leaderEntry.athlete?.id,
    leaderEntry.player?.id,
    leaderEntry.athleteId,
    leaderEntry.id
  ].filter(Boolean);
  if (candidateIds.length > 0) {
    const id = candidateIds[0];
    return `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${id}`;
  }

  return null;
};

const fetchPlayersFromLeaders = async ({ seasonYear, seasonType = 2 }) => {
  try {
    const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${seasonYear}/types/${seasonType}/leaders`;
    const response = await axios.get(url, {
      params: { lang: 'en', region: 'us', limit: 50 },
      timeout: REQUEST_TIMEOUT
    });

    const categoriesRoot = response.data?.categories || response.data;
    const leaderNodes = flattenLeaderCategories(categoriesRoot);
    if (!leaderNodes.length) {
      return [];
    }

    const matchedNodes = {};
    Object.entries(LEADER_CATEGORY_KEYWORDS).forEach(([key, keywords]) => {
      const match = leaderNodes.find((node) => matchesLeaderCategory(node, keywords));
      if (match) {
        matchedNodes[key] = match;
      }
    });

    const athleteRefs = new Set();
    Object.values(matchedNodes).forEach((node) => {
      const leaders = Array.isArray(node.leaders) ? node.leaders.slice(0, 15) : [];
      leaders.forEach((leaderEntry) => {
        const ref = extractAthleteRef(leaderEntry);
        if (ref) {
          athleteRefs.add(ref);
        }
      });
    });

    if (athleteRefs.size === 0) {
      return [];
    }

    const players = [];
    await asyncPool(
      Array.from(athleteRefs),
      async (athleteRef) => {
        try {
          const player = await fetchAthleteStats({ athleteUrl: athleteRef });
          if (player?.playerId) {
            players.push(player);
          }
        } catch (error) {
          console.warn(
            '[WinsPool][PlayerStatsService] Failed to load athlete from leaders ref:',
            athleteRef,
            error.message
          );
        }
      },
      4
    );

    return players;
  } catch (error) {
    console.warn(
      '[WinsPool][PlayerStatsService] Failed to fetch leaderboards from ESPN:',
      error.message
    );
    return [];
  }
};

const PLAYER_STAT_CONFIG = [
  { key: 'ppg', getter: (player) => player?.averages?.ppg, precision: 1 },
  { key: 'rpg', getter: (player) => player?.averages?.rpg, precision: 1 },
  { key: 'apg', getter: (player) => player?.averages?.apg, precision: 1 },
  { key: 'spg', getter: (player) => player?.averages?.spg, precision: 2 },
  { key: 'bpg', getter: (player) => player?.averages?.bpg, precision: 2 }
];

const roundStatValue = (value, precision = 1) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const multiplier = 10 ** precision;
  return Math.round(numeric * multiplier) / multiplier;
};

const generateCategoryRankings = (
  players = [],
  { enforceMinimum = false, minimumGames = 65 } = {}
) => {
  const filteredPlayers = players.filter((player) => {
    if (!enforceMinimum) return true;
    return Number(player?.gamesPlayed || 0) >= minimumGames;
  });

  const categories = {};
  PLAYER_STAT_CONFIG.forEach(({ key, getter, precision }) => {
    const sorted = filteredPlayers
      .filter((player) => getter(player) !== null && getter(player) !== undefined)
      .sort((a, b) => (getter(b) || 0) - (getter(a) || 0))
      .slice(0, 10)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.playerId,
        name: player.displayName,
        teamAbbr: player.team?.abbreviation || '',
        teamName: player.team?.name || '',
        value: roundStatValue(getter(player), precision),
        gamesPlayed: Number(player.gamesPlayed || 0)
      }));
    categories[key] = sorted;
  });

  return categories;
};

const fetchTeamPlayers = async ({ teamAbbr, teamId, seasonYear }) => {
  const rosterUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${seasonYear}/teams/${teamId}/athletes`;
  const rosterRes = await axios.get(rosterUrl, {
    params: { limit: 100, lang: 'en', region: 'us' },
    timeout: REQUEST_TIMEOUT
  });

  const items = rosterRes.data?.items || [];
  const players = [];

  await asyncPool(
    items,
    async (item) => {
      if (!item?.$ref) return;
      try {
        const player = await fetchAthleteStats({ athleteUrl: item.$ref });
        if (!player.displayName) return;

        const averages = player.averages || {};
        const validStat =
          averages.ppg !== null ||
          averages.rpg !== null ||
          averages.apg !== null ||
          averages.spg !== null ||
          averages.bpg !== null;
        if (!validStat) return;

        players.push({
          ...player,
          team: {
            ...player.team,
            abbreviation: teamAbbr
          }
        });
      } catch (error) {
        console.warn('[WinsPool][PlayerStatsService] Failed to fetch athlete stats:', item?.$ref, error.message);
      }
    },
    4
  );

  return players;
};

const loadPlayersFromTeamRosters = async (startingSeasonYear) => {
  const allPlayers = [];
  const seen = new Set();

  const loadSeason = async (seasonToken) => {
    for (const [abbr, teamId] of Object.entries(ESPN_TEAM_ID_MAP)) {
      try {
        const teamPlayers = await fetchTeamPlayers({
          teamAbbr: abbr,
          teamId,
          seasonYear: seasonToken
        });
        teamPlayers.forEach((player) => {
          if (!player || !player.playerId || seen.has(player.playerId)) {
            return;
          }
          seen.add(player.playerId);
          allPlayers.push(player);
        });
      } catch (error) {
        console.warn(
          '[WinsPool][PlayerStatsService] Failed to load team roster',
          abbr,
          `season=${seasonToken}`,
          error.message
        );
      }
    }
    return allPlayers.length;
  };

  const trySeason = async (seasonToken) => {
    const loaded = await loadSeason(seasonToken);
    return loaded > 0;
  };

  let successful = await trySeason(startingSeasonYear);

  if (!successful) {
    console.warn(
      '[WinsPool][PlayerStatsService] Target season returned no roster data. Attempting fallback seasons.'
    );
    const fallbackYearStart = Number.isFinite(startingSeasonYear)
      ? startingSeasonYear
      : new Date().getFullYear();
    for (let offset = 1; offset <= 3 && !successful; offset += 1) {
      const fallbackYear = fallbackYearStart - offset;
      successful = await trySeason(fallbackYear);
      if (successful) {
        console.info(
          '[WinsPool][PlayerStatsService] Using fallback roster season',
          fallbackYear,
          'for player stats.'
        );
        break;
      }
    }
  }

  if (!successful) {
    console.warn('[WinsPool][PlayerStatsService] No roster-based player data found.');
  }

  return allPlayers;
};

export const fetchNbaPlayerStats = async ({ season = null } = {}) => {
  const { candidates, resolvedCurrentYear } = await buildSeasonCandidateList(season);
  let leaderPlayers = [];
  let selectedSeasonYear = candidates[0];
  let leaderSource = 'espn-leaders';
  let seasonLabel =
    typeof season === 'string' && season && season !== 'current' ? season : null;

  for (const candidateYear of candidates) {
    if (!Number.isFinite(candidateYear) || candidateYear < 2000) {
      continue;
    }
    const players = await fetchPlayersFromLeaders({
      seasonYear: candidateYear,
      seasonType: 2
    });
    if (players.length > 0) {
      leaderPlayers = players;
      selectedSeasonYear = candidateYear;
      leaderSource = 'espn-leaders';
      if (!seasonLabel) {
        seasonLabel = buildSeasonLabelFromYear(candidateYear) || String(candidateYear);
      }
      if (candidateYear !== candidates[0]) {
        console.info(
          '[WinsPool][PlayerStatsService] Using leader data from fallback season',
          candidateYear
        );
      }
      break;
    }
  }

  if (leaderPlayers.length > 0) {
    const enforceMinimum =
      (season && season !== 'current') ||
      (Number.isFinite(selectedSeasonYear) && selectedSeasonYear < resolvedCurrentYear);
    const categories = generateCategoryRankings(leaderPlayers, {
      enforceMinimum,
      minimumGames: 65
    });

    return {
      players: leaderPlayers,
      categories,
      seasonYear: selectedSeasonYear,
      seasonLabel: seasonLabel || buildSeasonLabelFromYear(selectedSeasonYear) || String(selectedSeasonYear),
      enforceGameMinimum: enforceMinimum,
      source: leaderSource
    };
  }

  console.warn(
    '[WinsPool][PlayerStatsService] Falling back to roster crawl for player stats.'
  );

  const rosterPlayers = await loadPlayersFromTeamRosters(selectedSeasonYear);
  const enforceMinimum =
    (season && season !== 'current') ||
    (Number.isFinite(selectedSeasonYear) && selectedSeasonYear < resolvedCurrentYear);
  const categories = generateCategoryRankings(rosterPlayers, {
    enforceMinimum,
    minimumGames: 65
  });

  return {
    players: rosterPlayers,
    categories,
    seasonYear: selectedSeasonYear,
    seasonLabel:
      seasonLabel || buildSeasonLabelFromYear(selectedSeasonYear) || String(selectedSeasonYear),
    enforceGameMinimum: enforceMinimum,
    source: 'espn-rosters'
  };
};

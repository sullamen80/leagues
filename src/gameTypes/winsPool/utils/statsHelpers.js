// src/gameTypes/winsPool/utils/statsHelpers.js

export const safeArray = (value) => (Array.isArray(value) ? value : []);

export const PLAYER_CATEGORY_LABELS = {
  ppg: 'Points',
  rpg: 'Rebounds',
  apg: 'Assists',
  spg: 'Steals',
  bpg: 'Blocks'
};

export const normalizePlayerLeaders = (raw = {}) => {
  const categoryKeys = Object.keys(PLAYER_CATEGORY_LABELS);
  const categories = categoryKeys.reduce(
    (accumulator, key) => {
      const entries = safeArray(raw?.categories?.[key]);
      accumulator[key] = entries.map((entry, index) => ({
        rank: entry.rank ?? index + 1,
        playerId: entry.playerId || entry.id || `${key}-${index}`,
        name: entry.name || entry.displayName || '',
        teamAbbr: entry.teamAbbr || entry.team || '',
        teamName: entry.teamName || '',
        value:
          entry.value !== undefined && entry.value !== null
            ? Number(entry.value)
            : null,
        gamesPlayed:
          entry.gamesPlayed !== undefined && entry.gamesPlayed !== null
            ? Number(entry.gamesPlayed)
            : null
      }));
      return accumulator;
    },
    {}
  );

  const meta = raw.meta || {};

  return {
    categories,
    season: raw.season || meta.season || 'current',
    seasonLabel: raw.seasonLabel || meta.seasonLabel || null,
    enforceGameMinimum: Boolean(
      raw.enforceGameMinimum ?? meta.enforceGameMinimum ?? false
    ),
    excludedPlayerIds: safeArray(meta.excludedPlayerIds || raw.excludedPlayerIds),
    lastUpdated: raw.lastUpdated || meta.lastUpdated || null,
    source: raw.source || meta.source || null,
    seasonYear:
      raw.seasonYear !== undefined && raw.seasonYear !== null
        ? raw.seasonYear
        : meta.seasonYear !== undefined && meta.seasonYear !== null
        ? meta.seasonYear
        : null
  };
};

export const buildPlayerHighlightsMap = (categories = {}, teams = []) => {
  const map = new Map();
  const teamLookup = teams.map((team) => {
    const tokens = new Set(
      [team.teamId, team.id, team.shortName, team.name, team.city]
        .filter(Boolean)
        .map((value) => String(value).toUpperCase())
    );
    return { team, tokens };
  });

  Object.entries(categories || {}).forEach(([category, entries]) => {
    safeArray(entries).forEach((entry) => {
      const lookupTokens = [entry.teamAbbr, entry.teamName, entry.team]
        .filter(Boolean)
        .map((value) => String(value).toUpperCase());

      const matchRecord = teamLookup.find(({ tokens }) =>
        lookupTokens.some((token) => tokens.has(token))
      );
      if (!matchRecord) return;

      const teamId = matchRecord.team.teamId;
      if (!map.has(teamId)) {
        map.set(teamId, []);
      }
      map.get(teamId).push({
        category,
        player: {
          ...entry,
          value:
            entry.value !== null && entry.value !== undefined
              ? Number(entry.value)
              : null
        }
      });
    });
  });

  return map;
};

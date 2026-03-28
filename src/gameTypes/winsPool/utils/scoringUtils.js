// src/gameTypes/winsPool/utils/scoringUtils.js
import { DEFAULT_SCORING_SETTINGS, PLAYER_STATS_CATEGORIES } from '../constants/winsPoolConstants';
import { safeArray } from './statsHelpers';

const buildDefaultPlayerLeaderboardConfig = () =>
  PLAYER_STATS_CATEGORIES.reduce((accumulator, categoryId) => {
    accumulator[categoryId] = {
      maxRanks: 0,
      pointsByRank: {}
    };
    return accumulator;
  }, {});

export const normalizePlayerLeaderboardConfig = (incoming = {}) => {
  const normalized = {
    enabled: Boolean(incoming.enabled),
    categories: buildDefaultPlayerLeaderboardConfig()
  };

  PLAYER_STATS_CATEGORIES.forEach((categoryId) => {
    const categoryConfig = incoming.categories?.[categoryId] || {};
    const maxRanks = Math.max(
      0,
      Math.min(
        10,
        Number(
          categoryConfig.maxRanks ??
            Object.keys(categoryConfig.pointsByRank || {}).length
        ) || 0
      )
    );
    const pointsByRank = {};
    for (let rank = 1; rank <= maxRanks; rank += 1) {
      const raw =
        categoryConfig.pointsByRank?.[rank] ??
        categoryConfig.pointsByRank?.[rank.toString()] ??
        0;
      const numeric = Number(raw);
      pointsByRank[rank] = Number.isFinite(numeric) ? numeric : 0;
    }

    normalized.categories[categoryId] = {
      maxRanks,
      pointsByRank
    };
  });

  return normalized;
};

export const normalizeScoringSettings = (incoming = {}) => ({
  ...DEFAULT_SCORING_SETTINGS,
  ...incoming,
  playerLeaderboardScoring: normalizePlayerLeaderboardConfig(
    incoming.playerLeaderboardScoring || {}
  )
});

const buildTeamMetadata = (teamPool = [], rosters = []) => {
  const metadata = new Map();

  safeArray(teamPool).forEach((team) => {
    if (!team?.id) return;
    metadata.set(team.id, { ...team });
  });

  safeArray(rosters).forEach((roster) => {
    safeArray(roster.teams).forEach((team) => {
      if (!team?.id) return;
      const existing = metadata.get(team.id) || {};
      metadata.set(team.id, {
        ...existing,
        ...team
      });
    });
  });

  return metadata;
};

const buildTeamTokenLookup = (teamMetadata) =>
  Array.from(teamMetadata.values()).map((team) => {
    const tokens = new Set(
      [team.id, team.teamId, team.shortName, team.name, team.city]
        .filter(Boolean)
        .map((value) => String(value).toUpperCase())
    );
    return {
      teamId: team.id,
      tokens
    };
  });

export const calculateStandingsFromData = ({
  rosters = [],
  scoringSettings = {},
  teamWinsMap = {},
  playerLeaders = {},
  teamPool = []
}) => {
  const normalizedSettings = normalizeScoringSettings(scoringSettings);
  const {
    pointsPerWin,
    overtimeWinBonus,
    playoffWinMultiplier,
    playerLeaderboardScoring
  } = normalizedSettings;

  const normalizedTeamPool = Array.isArray(teamPool)
    ? teamPool
    : safeArray(teamPool?.teams);
  const teamMetadata = buildTeamMetadata(normalizedTeamPool, rosters);
  const teamTokenLookup = buildTeamTokenLookup(teamMetadata);

  const teamToManagers = new Map();
  safeArray(rosters).forEach((roster) => {
    safeArray(roster.teams).forEach((team) => {
      if (!team?.id) return;
      if (!teamToManagers.has(team.id)) {
        teamToManagers.set(team.id, new Set());
      }
      teamToManagers.get(team.id).add(roster.id);
    });
  });

  const matchPlayerToTeam = (playerEntry) => {
    const lookupTokens = [
      playerEntry.teamId,
      playerEntry.teamAbbr,
      playerEntry.teamName,
      playerEntry.team
    ]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    if (!lookupTokens.length) return null;
    const match = teamTokenLookup.find(({ tokens }) =>
      lookupTokens.some((token) => tokens.has(token))
    );
    return match ? match.teamId : null;
  };

  const playerAwardsByManager = new Map();
  if (playerLeaderboardScoring.enabled) {
    const leadersByCategory = playerLeaders?.categories || {};
    Object.entries(playerLeaderboardScoring.categories || {}).forEach(
      ([categoryId, categoryConfig]) => {
        const players = safeArray(leadersByCategory[categoryId]);
        const ranks = categoryConfig.pointsByRank || {};
        Object.entries(ranks).forEach(([rankKey, rawPoints]) => {
          const rank = Number(rankKey);
          const points = Number(rawPoints);
          if (!points || !Number.isFinite(points)) return;
          const player = players[rank - 1];
          if (!player) return;
          const teamId = matchPlayerToTeam(player);
          if (!teamId) return;
          const managers = teamToManagers.get(teamId);
          if (!managers || !managers.size) return;
          managers.forEach((managerId) => {
            playerAwardsByManager.set(
              managerId,
              (playerAwardsByManager.get(managerId) || 0) + points
            );
          });
        });
      }
    );
  }

  const normalizeTeamRecord = (team) => {
    if (!team || !team.id) return team || {};
    const winsEntry = teamWinsMap?.[team.id] || {};
    return {
      ...team,
      wins: winsEntry.wins ?? team.wins ?? 0,
      overtimeWins: winsEntry.overtimeWins ?? team.overtimeWins ?? 0,
      playoffWins: winsEntry.playoffWins ?? team.playoffWins ?? 0
    };
  };

  const standings = safeArray(rosters).map((roster) => {
    const entryTeams = safeArray(roster.teams).map(normalizeTeamRecord);
    const wins = entryTeams.reduce((sum, team) => sum + (team.wins || 0), 0);
    const overtimeWins = entryTeams.reduce(
      (sum, team) => sum + (team.overtimeWins || 0),
      0
    );
    const playoffWins = entryTeams.reduce(
      (sum, team) => sum + (team.playoffWins || 0),
      0
    );

    const pointsFromWins = wins * pointsPerWin;
    const pointsFromOvertime = overtimeWins * overtimeWinBonus;
    const pointsFromPlayoffs =
      playoffWins * pointsPerWin * playoffWinMultiplier;
    const pointsFromPlayers = playerAwardsByManager.get(roster.id) || 0;

    const totalPoints =
      pointsFromWins +
      pointsFromOvertime +
      pointsFromPlayoffs +
      pointsFromPlayers;

    return {
      userId: roster.id,
      displayName:
        roster.displayName || roster.username || roster.ownerName || roster.id,
      wins,
      overtimeWins,
      playoffWins,
      playerPoints: pointsFromPlayers,
      pointsFromWins,
      pointsFromOvertime,
      pointsFromPlayoffs,
      pointsFromPlayers,
      points: totalPoints,
      teams: entryTeams
    };
  });

  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
};

export const findRosterStanding = (standings, rosterId) =>
  safeArray(standings).find((entry) => entry.userId === rosterId) || null;

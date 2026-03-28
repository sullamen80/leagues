// src/gameTypes/winsPool/components/AdminTeamWinsPanel.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  FaArrowLeft,
  FaCloudDownloadAlt,
  FaSave,
  FaSyncAlt,
  FaUserSlash,
  FaUndo,
  FaBasketballBall
} from 'react-icons/fa';
import { db } from '../../../firebase';
import { COLLECTION_KEYS, GAME_DATA_DOCUMENTS } from '../constants/winsPoolConstants';
import { fetchEspnTeamWins, inferLeagueFromTeamPool } from '../services/teamWinsService';
import { fetchNbaPlayerStats } from '../services/playerStatsService';
import {
  archiveSeasonPlayerLeaders,
  fetchAvailableSeasons,
  fetchLatestPlayerLeadersSnapshot,
  fetchLatestTeamStandingsSnapshot
} from '../services/statsHistoryService';

const STATUS_VARIANTS = {
  info: 'bg-indigo-50 border border-indigo-200 text-indigo-700',
  success: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border border-amber-200 text-amber-700',
  error: 'bg-red-50 border border-red-200 text-red-700'
};

const TAB_KEYS = {
  TEAMS: 'teams',
  PLAYERS: 'players'
};

const PLAYER_CATEGORY_CONFIG = [
  { key: 'ppg', label: 'Points Per Game', precision: 1 },
  { key: 'rpg', label: 'Rebounds Per Game', precision: 1 },
  { key: 'apg', label: 'Assists Per Game', precision: 1 },
  { key: 'spg', label: 'Steals Per Game', precision: 2 },
  { key: 'bpg', label: 'Blocks Per Game', precision: 2 }
];

const MIN_GAMES_FULL_SEASON = 65;

const formatSeasonDisplay = (value) => {
  if (!value) return '';
  if (value === 'current') return 'Current Season';
  const stringValue = String(value);
  if (stringValue.includes('-')) {
    return stringValue;
  }
  const numeric = Number(stringValue);
  if (!Number.isFinite(numeric)) return stringValue;
  const startYear = numeric - 1;
  const endYearDigits = stringValue.slice(-2);
  return `${startYear}-${endYearDigits}`;
};

const createDefaultPlayerState = () => ({
  categories: PLAYER_CATEGORY_CONFIG.reduce((accumulator, category) => {
    accumulator[category.key] = [];
    return accumulator;
  }, {}),
  season: 'current',
  enforceGameMinimum: false,
  excludedPlayerIds: [],
  excludedPlayers: [],
  lastUpdated: null,
  source: null
});

const clonePlayerState = (state) => JSON.parse(JSON.stringify(state || createDefaultPlayerState()));

const normalizePlayerLeaders = (raw) => {
  if (!raw) {
    return createDefaultPlayerState();
  }

  const base = createDefaultPlayerState();
  const categories = PLAYER_CATEGORY_CONFIG.reduce((accumulator, category) => {
    const entries = Array.isArray(raw?.categories?.[category.key])
      ? raw.categories[category.key]
      : [];
    accumulator[category.key] = entries.map((entry, index) => ({
      rank: entry.rank ?? index + 1,
      playerId: entry.playerId,
      name: entry.name || entry.displayName || '',
      teamAbbr: entry.teamAbbr || entry.team || '',
      teamName: entry.teamName || '',
      value:
        typeof entry.value === 'number'
          ? entry.value
          : entry.value !== undefined && entry.value !== null
          ? Number(entry.value)
          : null,
      gamesPlayed:
        entry.gamesPlayed !== undefined && entry.gamesPlayed !== null
          ? Number(entry.gamesPlayed)
          : null
    }));
    return accumulator;
  }, {});

  const meta = raw.meta || {};

  return {
    categories,
    season: raw.season || meta.season || base.season,
    seasonLabel: raw.seasonLabel || meta.seasonLabel || null,
    enforceGameMinimum:
      Boolean(
        raw.enforceGameMinimum ??
          meta.enforceGameMinimum ??
          base.enforceGameMinimum
      ),
    excludedPlayerIds: Array.isArray(meta.excludedPlayerIds || raw.excludedPlayerIds)
      ? [...new Set((meta.excludedPlayerIds || raw.excludedPlayerIds).filter(Boolean))]
      : base.excludedPlayerIds,
    excludedPlayers: Array.isArray(meta.excludedPlayers || raw.excludedPlayers)
      ? (meta.excludedPlayers || raw.excludedPlayers).map((entry) => ({
          playerId: entry.playerId,
          name: entry.name || entry.displayName || '',
          teamAbbr: entry.teamAbbr || entry.team || '',
          teamName: entry.teamName || '',
          removedAt: entry.removedAt || null
        }))
      : base.excludedPlayers,
    lastUpdated: raw.lastUpdated || meta.lastUpdated || base.lastUpdated,
    source: raw.source || meta.source || base.source,
    seasonYear:
      raw.seasonYear !== undefined && raw.seasonYear !== null
        ? raw.seasonYear
        : meta.seasonYear !== undefined && meta.seasonYear !== null
        ? meta.seasonYear
        : null
  };
};

const roundStatValue = (value, precision = 1) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const multiplier = 10 ** precision;
  return Math.round(numeric * multiplier) / multiplier;
};

const buildLeaderboardsFromUniverse = (players = [], { excludedIds = [], enforceGameMinimum = false } = {}) => {
  const excludedSet = new Set((excludedIds || []).filter(Boolean));
  const filteredUniverse = players.filter((player) => {
    if (excludedSet.has(player.playerId)) return false;
    if (enforceGameMinimum && Number(player.gamesPlayed || 0) < MIN_GAMES_FULL_SEASON) {
      return false;
    }
    return true;
  });

  const categories = {};
  PLAYER_CATEGORY_CONFIG.forEach((category) => {
    const { key, precision } = category;
    const rankings = filteredUniverse
      .filter(
        (player) =>
          player?.averages &&
          player.averages[key] !== null &&
          player.averages[key] !== undefined
      )
      .sort((a, b) => (b.averages?.[key] || 0) - (a.averages?.[key] || 0))
      .slice(0, 10)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.playerId,
        name: player.displayName,
        teamAbbr: player.team?.abbreviation || '',
        teamName: player.team?.name || '',
        value: roundStatValue(player.averages?.[key], precision),
        gamesPlayed: Number(player.gamesPlayed || 0)
      }));
    categories[key] = rankings;
  });

  return categories;
};

const rebuildCategoriesWithFallback = ({
  universe = [],
  currentCategories = {},
  excludedIds = [],
  enforceGameMinimum = false
}) => {
  if (Array.isArray(universe) && universe.length) {
    return buildLeaderboardsFromUniverse(universe, {
      excludedIds,
      enforceGameMinimum
    });
  }

  const excludedSet = new Set((excludedIds || []).filter(Boolean));
  const categories = {};

  PLAYER_CATEGORY_CONFIG.forEach((category) => {
    const entries = Array.isArray(currentCategories?.[category.key])
      ? currentCategories[category.key]
      : [];
    const filtered = entries
      .filter((entry) => !excludedSet.has(entry.playerId))
      .filter((entry) => {
        if (!enforceGameMinimum) return true;
        return Number(entry.gamesPlayed || 0) >= MIN_GAMES_FULL_SEASON;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
    categories[category.key] = filtered;
  });

  return categories;
};

const dedupeExcludedPlayers = (entries = []) => {
  const seen = new Set();
  const result = [];
  entries.forEach((entry) => {
    if (!entry || !entry.playerId || seen.has(entry.playerId)) {
      return;
    }
    seen.add(entry.playerId);
    result.push(entry);
  });
  return result;
};

const AdminTeamWinsPanel = ({ leagueId, onBack }) => {
  const [activeTab, setActiveTab] = useState(TAB_KEYS.TEAMS);
  const [loading, setLoading] = useState(true);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamSyncing, setTeamSyncing] = useState(false);
  const [playerSaving, setPlayerSaving] = useState(false);
  const [playerSyncing, setPlayerSyncing] = useState(false);
  const [teamStatus, setTeamStatus] = useState(null);
  const [teamStatusTone, setTeamStatusTone] = useState('info');
  const [playerStatus, setPlayerStatus] = useState(null);
  const [playerStatusTone, setPlayerStatusTone] = useState('info');
  const [teamRows, setTeamRows] = useState([]);
  const [originalStats, setOriginalStats] = useState({});
  const [teamPool, setTeamPool] = useState([]);
  const [leagueKey, setLeagueKey] = useState(null);
  const [playerState, setPlayerState] = useState(() => createDefaultPlayerState());
  const [playerOriginalState, setPlayerOriginalState] = useState(() => createDefaultPlayerState());
  const [playerUniverse, setPlayerUniverse] = useState([]);
  const [seasonSelection, setSeasonSelection] = useState('current');
  const [availableSeasons, setAvailableSeasons] = useState([]);

  const isCurrentSeason = seasonSelection === 'current';
  const seasonLabel = formatSeasonDisplay(seasonSelection);
  const playerSeasonLabel =
    playerState.seasonLabel ||
    (playerState.season === 'current'
      ? formatSeasonDisplay(playerState.seasonYear || new Date().getFullYear())
      : formatSeasonDisplay(playerState.season || seasonSelection));

  const setTeamFeedback = useCallback((message, tone = 'info') => {
    setTeamStatusTone(tone);
    setTeamStatus(message);
  }, []);

  const setPlayerFeedback = useCallback((message, tone = 'info') => {
    setPlayerStatusTone(tone);
    setPlayerStatus(message);
  }, []);

  const persistPlayerState = useCallback(
    async ({ nextState, players = null, sourceLabel = 'manual' }) => {
      if (!leagueId) return false;

      const timestamp = nextState.lastUpdated || new Date().toISOString();
      const derivedSeasonLabel =
        nextState.seasonLabel ||
        formatSeasonDisplay(
          nextState.season === 'current'
            ? nextState.seasonYear || new Date().getFullYear()
            : nextState.season
        ) || null;

      const stateToPersist = clonePlayerState({
        ...nextState,
        lastUpdated: timestamp,
        source: nextState.source || sourceLabel,
        seasonLabel: derivedSeasonLabel
      });

      const gameDataRef = doc(
        db,
        'leagues',
        leagueId,
        COLLECTION_KEYS.GAME_DATA,
        GAME_DATA_DOCUMENTS.CURRENT
      );

      await updateDoc(gameDataRef, {
        playerLeaders: {
          categories: stateToPersist.categories,
          season: stateToPersist.season,
          meta: {
            season: stateToPersist.season,
            lastUpdated: stateToPersist.lastUpdated,
            source: stateToPersist.source,
            enforceGameMinimum: stateToPersist.enforceGameMinimum,
            excludedPlayerIds: stateToPersist.excludedPlayerIds,
            excludedPlayers: stateToPersist.excludedPlayers,
            seasonYear: stateToPersist.seasonYear ?? null,
            seasonLabel: stateToPersist.seasonLabel || null
          }
        }
      });

      let archiveSucceeded = true;
      if (leagueKey) {
        try {
          const archiveSeasonId =
            stateToPersist.season === 'current' && stateToPersist.seasonYear
              ? String(stateToPersist.seasonYear)
              : stateToPersist.season;
          await archiveSeasonPlayerLeaders({
            league: leagueKey,
            season: archiveSeasonId || new Date().getFullYear(),
            actor: 'admin-console',
            leaderboards: stateToPersist.categories,
            meta: {
              source: stateToPersist.source,
              enforceGameMinimum: stateToPersist.enforceGameMinimum,
              playerCount: Array.isArray(players) ? players.length : undefined,
              seasonYear: stateToPersist.seasonYear ?? null,
              seasonLabel: stateToPersist.seasonLabel || null
            }
          });
        } catch (archiveError) {
          archiveSucceeded = false;
          console.warn('[WinsPool][AdminTeamWinsPanel] Failed to archive player leaders:', archiveError);
          setPlayerFeedback(
            'Saved current leaderboards, but failed to archive historical snapshot.',
            'warning'
          );
        }
      }

      const cloned = clonePlayerState(stateToPersist);
      setPlayerState(cloned);
      setPlayerOriginalState(cloned);
      if (players) {
        setPlayerUniverse(players);
      }
      if (archiveSucceeded) {
        setPlayerFeedback('Player leaderboards saved.', 'success');
      }

      return archiveSucceeded;
    },
    [leagueId, leagueKey, setPlayerFeedback]
  );

  const loadConsoleData = useCallback(
    async (targetSeason = 'current') => {
      if (!leagueId) return;
      const desiredSeason = targetSeason || 'current';
      setSeasonSelection(desiredSeason);
      setLoading(true);

      try {
        if (desiredSeason === 'current') {
          const gameDataRef = doc(
            db,
            'leagues',
            leagueId,
            COLLECTION_KEYS.GAME_DATA,
            GAME_DATA_DOCUMENTS.CURRENT
          );
          const snapshot = await getDoc(gameDataRef);
          if (!snapshot.exists()) {
            setTeamRows([]);
            setTeamPool([]);
            setOriginalStats({});
            setLeagueKey(null);
            const defaultPlayer = createDefaultPlayerState();
            setPlayerState(clonePlayerState(defaultPlayer));
            setPlayerOriginalState(clonePlayerState(defaultPlayer));
            setPlayerUniverse([]);
            setTeamFeedback('Game data not found. Configure the league first.', 'warning');
            setPlayerFeedback('Game data not found. Configure the league first.', 'warning');
            return;
          }

          const gameData = snapshot.data();
          const poolTeams = Array.isArray(gameData?.teamPool?.teams)
            ? gameData.teamPool.teams
            : [];
          const winsObject = gameData?.teamWins || {};

          const inferredLeague =
            gameData?.teamPool?.league || inferLeagueFromTeamPool(poolTeams);
          setLeagueKey(inferredLeague || null);

          const rows = poolTeams.map((team) => {
            const winsEntry = winsObject?.[team.id] || {};
            const resolvedWins = winsEntry.wins ?? winsEntry.manualWins ?? winsEntry.autoWins ?? 0;
            const wins = Number.isFinite(resolvedWins) ? Number(resolvedWins) : 0;

            const resolvedLosses =
              winsEntry.losses ??
              winsEntry.manualLosses ??
              winsEntry.autoLosses ??
              null;
            const losses =
              resolvedLosses !== null && Number.isFinite(resolvedLosses)
                ? Number(resolvedLosses)
                : null;

            const totalGames = wins + (losses ?? 0);
            const resolvedWinPct =
              winsEntry.winPct ??
              winsEntry.manualWinPct ??
              winsEntry.autoWinPct ??
              (totalGames > 0 ? wins / totalGames : null);

            const winPct =
              resolvedWinPct !== null && Number.isFinite(resolvedWinPct)
                ? Number(resolvedWinPct)
                : totalGames > 0
                ? wins / totalGames
                : null;

            const lastUpdated = winsEntry.updatedAt || winsEntry.fetchedAt || null;
            const lastSource =
              winsEntry.source ||
              (winsEntry.manualWins !== undefined
                ? 'manual'
                : winsEntry.autoWins !== undefined
                ? 'espn'
                : 'manual');

            return {
              teamId: team.id,
              name: team.name || team.shortName || team.id,
              city: team.city || '',
              conference: team.conference || '',
              division: team.division || '',
              wins,
              losses,
              winPct,
              manualWins: winsEntry.manualWins ?? null,
              manualLosses: winsEntry.manualLosses ?? null,
              manualWinPct: winsEntry.manualWinPct ?? null,
              autoWins: winsEntry.autoWins ?? null,
              autoLosses: winsEntry.autoLosses ?? null,
              autoWinPct: winsEntry.autoWinPct ?? null,
              lastUpdated,
              lastSource,
              dirty: false
            };
          });

          const statsMap = {};
          rows.forEach((row) => {
            statsMap[row.teamId] = {
              wins: row.wins ?? 0,
              losses: row.losses ?? 0,
              winPct: row.winPct ?? null
            };
          });

          setTeamPool(poolTeams);
          setTeamRows(rows);
          setOriginalStats(statsMap);
          setTeamFeedback(null, 'info');

          const playerLeadersRaw = gameData?.playerLeaders || null;
      const normalizedPlayerState = clonePlayerState(normalizePlayerLeaders(playerLeadersRaw));
      normalizedPlayerState.season = 'current';
      normalizedPlayerState.seasonLabel =
        normalizedPlayerState.seasonLabel || formatSeasonDisplay(normalizedPlayerState.seasonYear || new Date().getFullYear());
      setPlayerState(clonePlayerState(normalizedPlayerState));
      setPlayerOriginalState(clonePlayerState(normalizedPlayerState));
      setPlayerUniverse([]);

          if (
            normalizedPlayerState.season &&
            normalizedPlayerState.season !== 'current'
          ) {
            setPlayerFeedback(
              `Latest saved player data is for season ${normalizedPlayerState.season}. Sync to refresh the current season.`,
              'warning'
            );
          } else {
            setPlayerFeedback(null, 'info');
          }
        } else {
          const leagueForFetch = leagueKey || 'NBA';

          const friendlySeasonLabel =
            desiredSeason === 'current' ? 'Current Season' : desiredSeason;

          const [teamSnapshot, playerSnapshot] = await Promise.all([
            fetchLatestTeamStandingsSnapshot({
              league: leagueForFetch,
              season: desiredSeason
            }),
            fetchLatestPlayerLeadersSnapshot({
              league: leagueForFetch,
              season: desiredSeason
            })
          ]);

          const teamEntries = Array.isArray(teamSnapshot?.entries) ? teamSnapshot.entries : [];

          const rows = teamEntries.map((entry) => {
            const wins = Number.isFinite(entry.wins) ? entry.wins : 0;
            const losses = Number.isFinite(entry.losses) ? entry.losses : null;
            const totalGames = wins + (losses || 0);
            const winPct =
              entry.winPct !== undefined && entry.winPct !== null
                ? entry.winPct
                : totalGames > 0
                ? wins / totalGames
                : null;
            return {
              teamId: entry.teamId,
              name: entry.name || entry.teamId,
              city: entry.city || '',
              conference: entry.conference || '',
              division: entry.division || '',
              wins,
              losses,
              winPct,
              manualWins: null,
              manualLosses: null,
              manualWinPct: null,
              autoWins: wins,
              autoLosses: losses,
              autoWinPct: winPct,
              lastUpdated: teamSnapshot?.capturedAt || teamSnapshot?.meta?.fetchedAt || null,
              lastSource: teamSnapshot?.source || 'archive',
              dirty: false
            };
          });

          const statsMap = {};
          rows.forEach((row) => {
            statsMap[row.teamId] = {
              wins: row.wins ?? 0,
              losses: row.losses ?? 0,
              winPct: row.winPct ?? null
            };
          });

          setTeamPool(teamEntries);
          setTeamRows(rows);
          setOriginalStats(statsMap);

          if (rows.length === 0) {
            setTeamFeedback(`No archived standings found for ${friendlySeasonLabel}.`, 'warning');
          } else {
            setTeamFeedback(`Viewing archived standings for ${friendlySeasonLabel}.`, 'info');
          }

          const snapshotPlayerState = clonePlayerState(
            normalizePlayerLeaders(playerSnapshot || {})
          );
          snapshotPlayerState.season = desiredSeason;
          snapshotPlayerState.enforceGameMinimum =
            playerSnapshot?.meta?.enforceGameMinimum ??
            snapshotPlayerState.enforceGameMinimum ??
            true;
          snapshotPlayerState.source = playerSnapshot?.source || 'archive';
          snapshotPlayerState.lastUpdated =
            playerSnapshot?.capturedAt || playerSnapshot?.meta?.lastUpdated || null;
          snapshotPlayerState.seasonYear =
            snapshotPlayerState.seasonYear ?? playerSnapshot?.meta?.seasonYear ?? null;
          snapshotPlayerState.seasonLabel =
            snapshotPlayerState.seasonLabel ||
            playerSnapshot?.meta?.seasonLabel ||
            formatSeasonDisplay(desiredSeason);

          setPlayerState(clonePlayerState(snapshotPlayerState));
          setPlayerOriginalState(clonePlayerState(snapshotPlayerState));
          setPlayerUniverse([]);

          if (playerSnapshot?.categories && Object.keys(playerSnapshot.categories).length) {
            setPlayerFeedback(`Viewing archived player leaders for ${friendlySeasonLabel}.`, 'info');
          } else {
            setPlayerFeedback(`No archived player leaders found for ${friendlySeasonLabel}.`, 'warning');
          }
        }
      } catch (error) {
        console.error('[WinsPool][AdminTeamWinsPanel] Failed to load season data:', error);
        const message = error.message || 'Failed to load data.';
        setTeamFeedback(message, 'error');
        setPlayerFeedback(message, 'error');
        setTeamRows([]);
        setTeamPool([]);
        setOriginalStats({});
        const defaultPlayer = createDefaultPlayerState();
        setPlayerState(clonePlayerState(defaultPlayer));
        setPlayerOriginalState(clonePlayerState(defaultPlayer));
        setPlayerUniverse([]);
      } finally {
        setLoading(false);
      }
    },
    [leagueId, leagueKey, setPlayerFeedback, setTeamFeedback]
  );

  useEffect(() => {
    loadConsoleData('current');
  }, [loadConsoleData]);

  useEffect(() => {
    let isMounted = true;
    if (!leagueKey) {
      setAvailableSeasons([]);
      return () => {
        isMounted = false;
      };
    }

    const loadSeasons = async () => {
      try {
        const seasons = await fetchAvailableSeasons(leagueKey);
        if (isMounted) {
          const uniqueBySeason = [];
          const seen = new Set();
          seasons.forEach((seasonRecord) => {
            const seasonId = seasonRecord.season || seasonRecord.id;
            if (!seasonId || seen.has(seasonId)) return;
            seen.add(seasonId);
            uniqueBySeason.push(seasonRecord);
          });
          setAvailableSeasons(uniqueBySeason);
        }
      } catch (error) {
        console.warn('[WinsPool][AdminTeamWinsPanel] Failed to load historical seasons:', error.message);
      }
    };

    loadSeasons();

    return () => {
      isMounted = false;
    };
  }, [leagueKey]);

  const teamHasChanges = useMemo(() => {
    return teamRows.some((row) => {
      const original = originalStats[row.teamId] || {};
      const winsChanged = (row.wins ?? 0) !== (original.wins ?? 0);
      const lossesChanged = (row.losses ?? 0) !== (original.losses ?? 0);
      return winsChanged || lossesChanged;
    });
  }, [teamRows, originalStats]);

  const playerHasChanges = useMemo(() => {
    try {
      return JSON.stringify(playerState) !== JSON.stringify(playerOriginalState);
    } catch (error) {
      return false;
    }
  }, [playerOriginalState, playerState]);

  const handleWinsChange = (teamId, value) => {
    if (!isCurrentSeason) return;
    setTeamRows((rows) =>
      rows.map((row) => {
        if (row.teamId !== teamId) return row;
        const numeric = Number(value);
        const wins = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
        const losses = Number.isFinite(row.losses) ? row.losses : 0;
        const totalGames = wins + losses;
        const winPct = totalGames > 0 ? wins / totalGames : null;
        const original = originalStats[row.teamId] || {};
        const winsChanged = wins !== (original.wins ?? 0);
        const lossesChanged = (losses ?? 0) !== (original.losses ?? 0);
        return {
          ...row,
          wins,
          manualWins: wins,
          winPct,
          manualWinPct: winPct,
          dirty: winsChanged || lossesChanged
        };
      })
    );
  };

  const handleLossesChange = (teamId, value) => {
    if (!isCurrentSeason) return;
    setTeamRows((rows) =>
      rows.map((row) => {
        if (row.teamId !== teamId) return row;
        const numeric = Number(value);
        const losses = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
        const wins = Number.isFinite(row.wins) ? row.wins : 0;
        const totalGames = wins + losses;
        const winPct = totalGames > 0 ? wins / totalGames : null;
        const original = originalStats[row.teamId] || {};
        const winsChanged = wins !== (original.wins ?? 0);
        const lossesChanged = losses !== (original.losses ?? 0);
        return {
          ...row,
          losses,
          manualLosses: losses,
          winPct,
          manualWinPct: winPct,
          dirty: winsChanged || lossesChanged
        };
      })
    );
  };

  const handleTeamResetChanges = () => {
    if (!isCurrentSeason) return;
    setTeamRows((rows) =>
      rows.map((row) => {
        const original = originalStats[row.teamId] || {};
        const wins = original.wins ?? row.wins ?? 0;
        const losses = original.losses ?? row.losses ?? 0;
        const totalGames = wins + losses;
        const winPct = original.winPct ?? (totalGames > 0 ? wins / totalGames : null);
        return {
          ...row,
          wins,
          losses,
          winPct,
          manualWins: null,
          manualLosses: null,
          manualWinPct: null,
          dirty: false
        };
      })
    );
  };

  const handleTeamSave = async () => {
    if (!leagueId || !teamHasChanges || !isCurrentSeason) return;
    setTeamSaving(true);
    try {
      const updates = {};
      teamRows.forEach((row) => {
        const original = originalStats[row.teamId] || {};
        const winsChanged = (row.wins ?? 0) !== (original.wins ?? 0);
        const lossesChanged = (row.losses ?? 0) !== (original.losses ?? 0);
        if (!winsChanged && !lossesChanged) return;

        const timestamp = new Date().toISOString();
        updates[`teamWins.${row.teamId}`] = {
          wins: row.wins ?? 0,
          losses: row.losses ?? null,
          winPct: row.winPct ?? null,
          manualWins: row.wins ?? 0,
          manualLosses: row.losses ?? null,
          manualWinPct: row.winPct ?? null,
          autoWins: row.autoWins ?? null,
          autoLosses: row.autoLosses ?? null,
          autoWinPct: row.autoWinPct ?? null,
          updatedAt: timestamp,
          source: 'manual'
        };
      });

      if (Object.keys(updates).length === 0) {
        setTeamFeedback('No changes to save.', 'info');
        return;
      }

      const gameDataRef = doc(
        db,
        'leagues',
        leagueId,
        COLLECTION_KEYS.GAME_DATA,
        GAME_DATA_DOCUMENTS.CURRENT
      );

      await updateDoc(gameDataRef, updates);
      setTeamFeedback('Team wins saved.', 'success');
      loadConsoleData('current');
    } catch (error) {
      console.error('[WinsPool][AdminTeamWinsPanel] Failed to save team wins:', error);
      setTeamFeedback(error.message || 'Failed to save team wins.', 'error');
    } finally {
      setTeamSaving(false);
    }
  };

  const handleTeamSyncFromEspn = async () => {
    if (!leagueId) return;
    if (!isCurrentSeason) {
      setTeamFeedback('Sync is only available for the current season.', 'warning');
      return;
    }
    setTeamSyncing(true);
    try {
      if (!leagueKey) {
        throw new Error('League is unknown. Configure team pool to enable sync.');
      }
      if (!teamPool.length) {
        throw new Error('Team pool is empty. Configure teams before syncing.');
      }

      const { wins: espnWins, unmatched, meta } = await fetchEspnTeamWins({
        league: leagueKey,
        teamPool
      });

      if (!espnWins.length) {
        throw new Error('ESPN did not return any standings data.');
      }

      const updates = {};
      espnWins.forEach((entry) => {
        updates[`teamWins.${entry.teamId}`] = {
          wins: entry.wins,
          losses: entry.losses ?? null,
          winPct: entry.winPct ?? null,
          autoWins: entry.wins,
          autoLosses: entry.losses ?? null,
          autoWinPct: entry.winPct ?? null,
          fetchedAt: entry.fetchedAt,
          source: 'espn'
        };
      });

      const gameDataRef = doc(
        db,
        'leagues',
        leagueId,
        COLLECTION_KEYS.GAME_DATA,
        GAME_DATA_DOCUMENTS.CURRENT
      );

      await updateDoc(gameDataRef, updates);

      if (unmatched.length) {
        setTeamFeedback(
          `Sync completed, but ${unmatched.length} teams could not be matched. Review manually.`,
          'warning'
        );
        console.warn('[WinsPool][AdminTeamWinsPanel] Unmatched teams:', unmatched);
      } else {
        setTeamFeedback(
          `Team wins synced from ESPN (${meta?.league || ''}).`,
          'success'
        );
      }
      loadConsoleData('current');
    } catch (error) {
      console.error('[WinsPool][AdminTeamWinsPanel] ESPN sync failed:', error);
      setTeamFeedback(error.message || 'Failed to sync standings from ESPN.', 'error');
    } finally {
      setTeamSyncing(false);
    }
  };

  const handlePlayerSyncFromEspn = async () => {
    if (!leagueId) return;
    if (!leagueKey || String(leagueKey).toUpperCase() !== 'NBA') {
      setPlayerFeedback('Player stats syncing currently supports NBA presets.', 'warning');
      return;
    }
    if (!isCurrentSeason) {
      setPlayerFeedback('Sync is only available for the current season.', 'warning');
      return;
    }
    setPlayerSyncing(true);
    try {
      const seasonParam =
        seasonSelection && seasonSelection !== 'current'
          ? seasonSelection
          : null;
      const result = await fetchNbaPlayerStats({ season: seasonParam });
      const players = Array.isArray(result?.players) ? result.players : [];
      if (!players.length) {
        throw new Error('ESPN returned no player data.');
      }

      const resolvedSeasonYear = result?.seasonYear ?? null;
      const canonicalSeasonId = seasonSelection || 'current';
      const resolvedSeasonLabel =
        result?.seasonLabel ||
        (canonicalSeasonId === 'current'
          ? formatSeasonDisplay(resolvedSeasonYear || new Date().getFullYear())
          : formatSeasonDisplay(canonicalSeasonId));

      const isNewSeason = playerState.season !== canonicalSeasonId;
      const nextEnforceGameMinimum =
        result?.enforceGameMinimum !== undefined
          ? result.enforceGameMinimum
          : isNewSeason
          ? seasonSelection !== 'current'
          : playerState.enforceGameMinimum;
      const nextExcludedIds = isNewSeason ? [] : playerState.excludedPlayerIds;
      const nextExcludedPlayers = isNewSeason ? [] : playerState.excludedPlayers;

      const baselineCategories =
        result?.categories && Object.keys(result.categories).length
          ? result.categories
          : buildLeaderboardsFromUniverse(players, {
              excludedIds: [],
              enforceGameMinimum: nextEnforceGameMinimum
            });

      const categories = rebuildCategoriesWithFallback({
        universe: [],
        currentCategories: baselineCategories,
        excludedIds: nextExcludedIds,
        enforceGameMinimum: nextEnforceGameMinimum
      });

      const timestamp = new Date().toISOString();
      const refreshedExcludedPlayers = dedupeExcludedPlayers(
        nextExcludedIds
          .map((playerId) => {
            const player = players.find((entry) => entry.playerId === playerId);
            if (player) {
              return {
                playerId,
                name: player.displayName,
                teamAbbr: player.team?.abbreviation || '',
                teamName: player.team?.name || '',
                removedAt: timestamp
              };
            }
            return nextExcludedPlayers.find((entry) => entry.playerId === playerId);
          })
          .filter(Boolean)
      );

      const nextState = {
        categories,
        season: canonicalSeasonId,
        seasonLabel: resolvedSeasonLabel,
        enforceGameMinimum: nextEnforceGameMinimum,
        excludedPlayerIds: nextExcludedIds,
        excludedPlayers: refreshedExcludedPlayers,
        lastUpdated: timestamp,
        source: result?.source || 'espn',
        seasonYear: resolvedSeasonYear
      };

      await persistPlayerState({
        nextState,
        players,
        sourceLabel: result?.source || 'espn'
      });
    } catch (error) {
      console.error('[WinsPool][AdminTeamWinsPanel] Player sync failed:', error);
      setPlayerFeedback(error.message || 'Failed to sync player stats from ESPN.', 'error');
    } finally {
      setPlayerSyncing(false);
    }
  };

  const handleToggleGameMinimum = (enforce) => {
    if (!isCurrentSeason) return;
    setPlayerState((previous) => {
      const categories = rebuildCategoriesWithFallback({
        universe: playerUniverse,
        currentCategories: previous.categories,
        excludedIds: previous.excludedPlayerIds,
        enforceGameMinimum: enforce
      });
      return {
        ...previous,
        enforceGameMinimum: enforce,
        categories
      };
    });
  };

  const handleExcludePlayer = (entry) => {
    if (!entry?.playerId || !isCurrentSeason) return;
    setPlayerState((previous) => {
      if (previous.excludedPlayerIds.includes(entry.playerId)) {
        return previous;
      }

      const nextExcludedIds = [...previous.excludedPlayerIds, entry.playerId];
      const nextExcludedPlayers = dedupeExcludedPlayers([
        ...previous.excludedPlayers,
        {
          playerId: entry.playerId,
          name: entry.name,
          teamAbbr: entry.teamAbbr,
          teamName: entry.teamName,
          removedAt: new Date().toISOString()
        }
      ]);

      const categories = rebuildCategoriesWithFallback({
        universe: playerUniverse,
        currentCategories: previous.categories,
        excludedIds: nextExcludedIds,
        enforceGameMinimum: previous.enforceGameMinimum
      });

      return {
        ...previous,
        excludedPlayerIds: nextExcludedIds,
        excludedPlayers: nextExcludedPlayers,
        categories
      };
    });
    setPlayerFeedback(`${entry.name} removed from contention.`, 'info');
  };

  const handlePlayerSave = async () => {
    if (!leagueId || !playerHasChanges || !isCurrentSeason) return;
    setPlayerSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const stateToPersist = clonePlayerState({
        ...playerState,
        lastUpdated: timestamp,
        source: playerState.source || 'manual'
      });

      await persistPlayerState({
        nextState: stateToPersist,
        players: playerUniverse,
        sourceLabel: stateToPersist.source || 'manual'
      });
    } catch (error) {
      console.error('[WinsPool][AdminTeamWinsPanel] Failed to save player leaderboards:', error);
      setPlayerFeedback(error.message || 'Failed to save player leaderboards.', 'error');
    } finally {
      setPlayerSaving(false);
    }
  };

  const handlePlayerReset = () => {
    const resetState = clonePlayerState(playerOriginalState);
    setPlayerState(resetState);
    setPlayerUniverse([]);
    setPlayerFeedback('Player leaderboards reverted to the last saved state.', 'info');
  };

  const handleSeasonSelectionChange = (event) => {
    const value = event.target.value || 'current';
    if (value === seasonSelection) return;
    setSeasonSelection(value);
    loadConsoleData(value);
  };

  const activeStatus = activeTab === TAB_KEYS.TEAMS ? teamStatus : playerStatus;
  const activeStatusTone = activeTab === TAB_KEYS.TEAMS ? teamStatusTone : playerStatusTone;
  const isRefreshing = loading || teamSyncing || playerSyncing;

  const teamContent = loading ? (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      <p className="text-gray-600">Loading team wins…</p>
    </div>
  ) : teamRows.length === 0 ? (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        {isCurrentSeason
          ? 'No teams found. Configure the team pool before managing wins.'
          : 'No archived standings available for this season.'}
      </div>
  ) : (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Team
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Conference
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Division
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Wins
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Losses
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Win %
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Source
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teamRows.map((row) => (
              <tr key={row.teamId} className={row.dirty ? 'bg-indigo-50/60' : ''}>
                <td className="px-4 py-3 text-sm text-gray-800">
                  <div className="font-medium text-gray-900">{row.name}</div>
                  <div className="text-xs text-gray-500">{row.city || row.teamId}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{row.conference || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{row.division || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-800">
                  <input
                    type="number"
                    min="0"
                  value={row.wins ?? 0}
                  onChange={(event) => handleWinsChange(row.teamId, event.target.value)}
                    className={`w-20 rounded border border-gray-300 px-2 py-1 text-sm ${
                      !isCurrentSeason ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                    }`}
                    disabled={!isCurrentSeason}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-gray-800">
                  <input
                    type="number"
                    min="0"
                  value={row.losses ?? 0}
                  onChange={(event) => handleLossesChange(row.teamId, event.target.value)}
                    className={`w-20 rounded border border-gray-300 px-2 py-1 text-sm ${
                      !isCurrentSeason ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                    }`}
                    disabled={!isCurrentSeason}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {row.winPct !== null && row.winPct !== undefined
                    ? `${(row.winPct * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs font-medium text-gray-600">
                  {row.dirty ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">
                      Pending
                    </span>
                  ) : (
                    row.lastSource || 'manual'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const playerContent = (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-gray-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Player Leaderboards</h2>
          <p className="text-sm text-gray-500">
            Compare top performers across key categories and manually exclude players from contention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex items-center gap-2 text-sm ${isCurrentSeason ? 'text-gray-600' : 'text-gray-400'}`}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={playerState.enforceGameMinimum}
              onChange={(event) => handleToggleGameMinimum(event.target.checked)}
              disabled={!isCurrentSeason}
            />
            Enforce {MIN_GAMES_FULL_SEASON}-game minimum
          </label>
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3 text-sm text-gray-500">
        {isCurrentSeason ? 'Editing season' : 'Viewing season'}{' '}
        <span className="font-medium text-gray-700">{seasonLabel}</span>.
        {!isCurrentSeason && playerState.season && playerState.season !== seasonSelection ? (
          <span className="ml-2 text-amber-600">
            Last saved data: {playerSeasonLabel}. Sync to refresh the current season.
          </span>
        ) : null}{' '}
        {playerState.lastUpdated ? (
          <span className="ml-2">
            Last updated {new Date(playerState.lastUpdated).toLocaleString()}
            {playerState.source ? ` · Source: ${playerState.source.toUpperCase()}` : null}
          </span>
        ) : (
          <span className="ml-2">
            {isCurrentSeason
              ? 'Sync with ESPN to populate leaderboards.'
              : 'No archived leaderboards found for this season.'}
          </span>
        )}
      </div>

      {playerSyncing ? (
        <div className="flex flex-col items-center justify-center px-6 py-10">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
          <p className="text-gray-600">Syncing player stats…</p>
        </div>
      ) : (
        <div className="px-6 pb-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PLAYER_CATEGORY_CONFIG.map((category) => {
              const entries = Array.isArray(playerState.categories?.[category.key])
                ? playerState.categories[category.key]
                : [];
              return (
                <div key={category.key} className="flex flex-col rounded-lg border border-gray-100 bg-gray-50">
                  <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FaBasketballBall className="text-sm text-indigo-500" />
                      <span className="text-sm font-semibold text-gray-700">{category.label}</span>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-gray-400">Top 10</span>
                  </header>
                  {entries.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center px-4 py-6 text-xs text-gray-500">
                      {isCurrentSeason
                        ? 'No data yet. Sync from ESPN to populate this category.'
                        : 'No archived data for this category.'}
                    </div>
                  ) : (
                    <div className="flex-1 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {entries.map((entry) => {
                            const excluded = playerState.excludedPlayerIds.includes(entry.playerId);
                            return (
                              <tr key={`${category.key}-${entry.playerId}`} className={excluded ? 'bg-rose-50/60' : ''}>
                                <td className="px-3 py-2 text-xs font-semibold text-gray-500">{entry.rank}</td>
                                <td className="px-3 py-2">
                                  <div className="text-sm font-medium text-gray-800">{entry.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {entry.teamAbbr || entry.teamName || '—'} · {entry.gamesPlayed || 0} GP
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">
                                  {entry.value !== null && entry.value !== undefined
                                    ? entry.value.toFixed(category.precision)
                                    : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleExcludePlayer({
                                        playerId: entry.playerId,
                                        name: entry.name,
                                        teamAbbr: entry.teamAbbr,
                                        teamName: entry.teamName
                                      })
                                    }
                                    disabled={!isCurrentSeason || excluded}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                                      !isCurrentSeason || excluded
                                        ? 'bg-rose-100 text-rose-400 cursor-not-allowed'
                                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                    }`}
                                  >
                                    <FaUserSlash />
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {playerState.excludedPlayers.length > 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <p className="font-medium">
                Excluded players ({playerState.excludedPlayers.length}):
              </p>
              <p className="mt-1 text-xs">
                {playerState.excludedPlayers
                  .map((player) => `${player.name}${player.teamAbbr ? ` (${player.teamAbbr})` : ''}`)
                  .join(', ')}
              </p>
              <p className="mt-2 text-xs text-amber-600">
                {isCurrentSeason
                  ? 'Re-sync with ESPN to restore excluded players to the leaderboards.'
                  : 'Switch back to the current season to manage excluded players.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center text-gray-600 transition hover:text-indigo-600"
              >
                <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
              </button>
            )}
            <h1 className="text-2xl font-semibold text-gray-800">Team Wins & Stats Console</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === TAB_KEYS.TEAMS ? (
              <>
                <button
                  onClick={handleTeamSyncFromEspn}
                  disabled={!isCurrentSeason || teamSyncing || loading}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  <FaCloudDownloadAlt />
                  {teamSyncing ? 'Syncing…' : 'Sync Team Wins'}
                </button>
                <button
                  onClick={() => loadConsoleData(seasonSelection)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-60"
                >
                  <FaSyncAlt />
                  Refresh
                </button>
                <button
                  onClick={handleTeamSave}
                  disabled={!isCurrentSeason || !teamHasChanges || teamSaving}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  <FaSave />
                  {teamSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handlePlayerSyncFromEspn}
                  disabled={!isCurrentSeason || playerSyncing}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  <FaCloudDownloadAlt />
                  {playerSyncing ? 'Syncing…' : 'Sync Player Stats'}
                </button>
                <button
                  onClick={() => loadConsoleData(seasonSelection)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-60"
                >
                  <FaSyncAlt />
                  Refresh
                </button>
                <button
                  onClick={handlePlayerSave}
                  disabled={!isCurrentSeason || !playerHasChanges || playerSaving}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  <FaSave />
                  {playerSaving ? 'Saving…' : 'Save Leaderboards'}
                </button>
              </>
            )}
          </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="wins-pool-season-select" className="text-sm font-medium text-gray-600">
            Season
          </label>
          <select
            id="wins-pool-season-select"
            value={seasonSelection}
            onChange={handleSeasonSelectionChange}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="current">Current Season</option>
            {availableSeasons.map((season) => {
              const value = season.season || season.id;
              return (
                <option key={value} value={value}>
                  {formatSeasonDisplay(value)}
                </option>
              );
            })}
          </select>
        </div>
        {!isCurrentSeason && (
          <span className="text-sm text-gray-500">
            Viewing archived data. Editing controls are disabled.
          </span>
        )}
      </div>

      <nav className="flex border-b border-gray-200">
        {[TAB_KEYS.TEAMS, TAB_KEYS.PLAYERS].map((tab) => {
            const label = tab === TAB_KEYS.TEAMS ? 'Team Wins' : 'Player Leaderboards';
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`-mb-px px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {activeStatus && (
        <div className={`rounded-md px-4 py-3 text-sm ${STATUS_VARIANTS[activeStatusTone] || STATUS_VARIANTS.info}`}>
          {activeStatus}
        </div>
      )}

      {activeTab === TAB_KEYS.TEAMS ? teamContent : playerContent}

      {activeTab === TAB_KEYS.TEAMS && isCurrentSeason && teamHasChanges && !teamSaving && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleTeamResetChanges}
            className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            <FaUndo className="text-xs" />
            Reset Changes
          </button>
        </div>
      )}

      {activeTab === TAB_KEYS.PLAYERS && isCurrentSeason && playerHasChanges && !playerSaving && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handlePlayerReset}
            className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            <FaUndo className="text-xs" />
            Reset Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminTeamWinsPanel;

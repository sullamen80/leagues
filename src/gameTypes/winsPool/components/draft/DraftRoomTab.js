// src/gameTypes/winsPool/components/draft/DraftRoomTab.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaClock,
  FaCheck,
  FaListOl,
  FaTimes,
  FaUsers
} from 'react-icons/fa';
import {
  computeNextPick,
  makeDraftPick
} from '../../services/draftEngine';
import {
  inferLeagueFromTeamPool
} from '../../services/teamWinsService';
import {
  fetchAvailableSeasons,
  fetchLatestPlayerLeadersSnapshot,
  fetchLatestTeamStandingsSnapshot
} from '../../services/statsHistoryService';
import { DRAFT_STATUS, ASSIGNMENT_MODES } from '../../constants/winsPoolConstants';

const PLAYER_CATEGORY_LABELS = {
  ppg: 'Points',
  rpg: 'Rebounds',
  apg: 'Assists',
  spg: 'Steals',
  bpg: 'Blocks'
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const formatSeasonDisplay = (value) => {
  if (!value) return '';
  if (value === 'current') return 'Current Season';
  const stringValue = String(value);
  if (stringValue.includes('-')) return stringValue;
  const numeric = Number(stringValue);
  if (!Number.isFinite(numeric)) return stringValue;
  const startYear = numeric - 1;
  const endYearDigits = stringValue.slice(-2);
  return `${startYear}-${endYearDigits}`;
};

const normalizePlayerLeaders = (raw = {}) => {
  const categories = Object.keys(PLAYER_CATEGORY_LABELS).reduce(
    (accumulator, key) => {
      const entries = safeArray(raw?.categories?.[key]).map((entry, index) => ({
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
      accumulator[key] = entries;
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

const buildManagerLookup = (league = {}, userRoster = null) => {
  const map = new Map();

  if (league?.ownerId) {
    map.set(
      league.ownerId,
      league.ownerDisplayName ||
        league.ownerName ||
        league.ownerEmail ||
        league.ownerId
    );
  }

  safeArray(league?.users).forEach((user) => {
    if (!user?.id) return;
    map.set(
      user.id,
      user.username ||
        user.displayName ||
        user.email ||
        user.id
    );
  });

  if (league?.members && Array.isArray(league.members)) {
    league.members.forEach((memberId) => {
      if (!memberId || map.has(memberId)) return;
      map.set(memberId, memberId);
    });
  }

  if (league?.userIds && Array.isArray(league.userIds)) {
    league.userIds.forEach((memberId) => {
      if (!memberId || map.has(memberId)) return;
      map.set(memberId, memberId);
    });
  }

  if (userRoster?.id && !map.has(userRoster.id)) {
    map.set(
      userRoster.id,
      userRoster.displayName ||
        userRoster.username ||
        userRoster.id
    );
  }

  return map;
};

const buildTeamIndex = (teamPool = [], teamWins = {}, picks = []) => {
  const pickMap = new Map();
  safeArray(picks).forEach((pick) => {
    if (!pick?.teamId) return;
    pickMap.set(pick.teamId, pick);
  });

  return safeArray(teamPool).map((team) => {
    const pick = pickMap.get(team.id);
    const winsEntry = teamWins?.[team.id] || {};
    const wins = Number.isFinite(winsEntry.wins)
      ? winsEntry.wins
      : Number(team.wins || 0);
    const losses = Number.isFinite(winsEntry.losses)
      ? winsEntry.losses
      : winsEntry.losses === null
      ? null
      : Number(team.losses ?? null);
    const totalGames = wins + (losses || 0);
    const winPct =
      winsEntry.winPct !== undefined && winsEntry.winPct !== null
        ? Number(winsEntry.winPct)
        : totalGames > 0
        ? wins / totalGames
        : null;

    return {
      ...team,
      teamId: team.id,
      wins,
      losses,
      winPct,
      drafted: Boolean(pick),
      draftedBy: pick?.managerId || null,
      pickNumber: pick?.pickNumber || null
    };
  });
};

const buildPlayerHighlightsMap = (categories = {}, teams = []) => {
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
              ? Number(entry.value).toFixed(
                  ['spg', 'bpg'].includes(category) ? 2 : 1
                )
              : null
        }
      });
    });
  });

  return map;
};

const deriveDraftOrder = (draft = {}, rosterSettings = {}, league = {}) => {
  const explicitOrder = safeArray(draft.order).filter(Boolean);
  if (explicitOrder.length) return explicitOrder;
  const configuredOrder = safeArray(rosterSettings.draftOrder).filter(Boolean);
  if (configuredOrder.length) return configuredOrder;
  if (Array.isArray(league?.members) && league.members.length) {
    return league.members;
  }
  if (Array.isArray(league?.userIds) && league.userIds.length) {
    return league.userIds;
  }
  return [];
};

const getManagerForSlot = ({ pickIndex, draftOrder, useSnake }) => {
  if (!draftOrder.length) {
    return { managerId: null, round: 1, orderIndex: 0 };
  }
  const round = Math.floor(pickIndex / draftOrder.length) + 1;
  const offset = pickIndex % draftOrder.length;
  let orderIndex = offset;
  if (useSnake && round % 2 === 0) {
    orderIndex = draftOrder.length - 1 - offset;
  }
  return {
    managerId: draftOrder[orderIndex] || null,
    round,
    orderIndex
  };
};

const DraftHeader = ({ onClockName, nextPick, draftStatus, orderPreview, managerLookup }) => {
  const statusLabel =
    draftStatus === DRAFT_STATUS.IN_PROGRESS
      ? 'Draft is LIVE'
      : draftStatus === DRAFT_STATUS.PAUSED
      ? 'Draft Paused'
      : 'Draft Status';

  return (
    <div className="bg-white border border-indigo-100 rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {statusLabel}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <FaClock className="text-indigo-500" />
            <p className="text-lg md:text-xl font-semibold text-gray-900">
              On Clock: <span className="text-indigo-600">{onClockName || 'Pending'}</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Round {nextPick?.round || 1} • Pick {nextPick?.pickNumber || '—'}
            {nextPick?.poolLabel ? ` • Pool: ${nextPick.poolLabel}` : ''}
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 md:w-72">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-2">
            <FaListOl />
            Upcoming Order
          </div>
          <div className="mt-2 space-y-1">
            {orderPreview.length ? (
              orderPreview.map((slot) => (
                <div key={`order-preview-${slot.pickNumber}`} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-semibold">#{slot.pickNumber}</span>
                  <span className="text-gray-700">
                    {managerLookup.get(slot.managerId) || slot.managerId || 'TBD'}
                  </span>
                  <span className="text-xs text-gray-400">
                    R{slot.round} • {slot.isCurrent ? 'Now' : `+${slot.pickNumber - slot.currentPick}`}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">Draft order not configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityFeed = ({ picks, managerLookup, teamLookup }) => (
  <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
    <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
      <FaListOl className="text-indigo-500" />
      <h3 className="font-semibold text-gray-900">Draft Activity</h3>
    </div>
    <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">
      {picks.length ? (
        picks.map((pick) => {
          const team = teamLookup.get(pick.teamId) || {};
          return (
            <div key={`activity-${pick.pickNumber}`} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-sm font-semibold text-indigo-600">
                  #{pick.pickNumber}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {managerLookup.get(pick.managerId) || pick.managerName || pick.managerId}
                  </div>
                  <div className="text-xs text-gray-500">
                    {team.city ? `${team.city} ${team.name}` : team.name || pick.teamName}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 text-right">
                {team.wins !== undefined ? `${team.wins} wins` : 'Wins tracking'}
                {pick.poolLabel ? ` • ${pick.poolLabel}` : ''}
              </div>
            </div>
          );
        })
      ) : (
        <div className="px-4 py-6 text-sm text-gray-500 text-center">
          No picks yet. Stay ready!
        </div>
      )}
    </div>
  </div>
);

const OnClockPanel = ({
  canPick,
  pickSubmitting,
  onOpenPicker,
  onClockName,
  currentUserId,
  managerLookup,
  roster,
  pickError
}) => {
  const teams = safeArray(roster?.teams);
  const totalWins = teams.reduce((sum, team) => sum + (team.wins || 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
      <div>
        <div className="text-xs uppercase font-semibold tracking-wide text-indigo-600 flex items-center gap-2">
          <FaUsers />
          On The Clock
        </div>
        <p className="text-lg font-semibold text-gray-900 mt-1">
          {managerLookup.get(currentUserId) || 'You'}
        </p>
        <p className="text-xs text-gray-500">Current manager: {onClockName || 'Pending'}</p>
      </div>
      <button
        type="button"
        onClick={onOpenPicker}
        disabled={!canPick || pickSubmitting}
        className={`w-full py-3 rounded-lg font-semibold transition ${
          canPick && !pickSubmitting
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {pickSubmitting ? 'Submitting…' : canPick ? 'Pick Now' : 'Waiting for your turn'}
      </button>
      {pickError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {pickError}
        </div>
      )}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between text-xs uppercase text-gray-500">
          <span>Your Teams</span>
          <span>Total Wins: {totalWins}</span>
        </div>
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
          {teams.length ? (
            teams.map((team) => (
              <div
                key={`roster-mini-${team.id}`}
                className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-md px-3 py-2"
              >
                <div className="text-sm text-gray-700">
                  {team.city ? `${team.city} ${team.name}` : team.name}
                </div>
                <div className="text-xs font-semibold text-indigo-600">
                  {team.wins ?? 0} wins
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500">
              No teams drafted yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TeamPickerModal = ({
  isOpen,
  onClose,
  teams,
  selectedTeamId,
  setSelectedTeamId,
  canPick,
  onConfirm,
  seasonOptions,
  modalSeason,
  onChangeSeason,
  seasonTeamStats,
  seasonPlayerHighlights,
  seasonLoading,
  seasonError,
  scoringSettings,
  isSubmitting
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('teams');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setViewMode('teams');
      setShowList(false);
    }
  }, [isOpen]);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teams
      .filter((team) => !team.drafted)
      .filter((team) => {
        if (!query) return true;
        const name = `${team.city || ''} ${team.name || ''} ${team.shortName || ''}`.toLowerCase();
        return name.includes(query);
      })
      .sort((a, b) => (b.wins || 0) - (a.wins || 0));
  }, [teams, search]);

  const selectedTeam =
    teams.find((team) => team.teamId === selectedTeamId) ||
    filteredTeams[0] ||
    null;

  useEffect(() => {
    if (!selectedTeam && filteredTeams.length) {
      setSelectedTeamId(filteredTeams[0].teamId);
    }
  }, [filteredTeams, selectedTeam, setSelectedTeamId]);

  const seasonStatsEntry = selectedTeam ? seasonTeamStats.get(selectedTeam.teamId) : null;
  const displayWins =
    seasonStatsEntry?.wins ??
    selectedTeam?.wins ??
    0;
  const displayLosses =
    seasonStatsEntry?.losses ??
    selectedTeam?.losses ??
    null;
  const displayWinPct =
    seasonStatsEntry?.winPct ??
    selectedTeam?.winPct ??
    null;
  const playerHighlights = selectedTeam
    ? seasonPlayerHighlights.get(selectedTeam.teamId) || []
    : [];

  const [isMobile, setIsMobile] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setShowList(isMobile ? false : true);
  }, [isOpen, isMobile]);

  const selectedIndex = filteredTeams.findIndex((team) => team.teamId === (selectedTeam?.teamId || selectedTeamId));

  const goRelative = useCallback(
    (delta) => {
      if (!filteredTeams.length) return;
      const index = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = (index + delta + filteredTeams.length) % filteredTeams.length;
      setSelectedTeamId(filteredTeams[nextIndex].teamId);
    },
    [filteredTeams, selectedIndex, setSelectedTeamId]
  );

  if (!isOpen) return null;

  return (
    <div className="draft-modal">
      <div className="draft-modal__backdrop" onClick={onClose} />
      <div className="draft-modal__content">
        <div className="draft-modal__header">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Select Team</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
              aria-label="Close team picker"
            >
              <FaTimes />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Browse available teams and review their leaders before drafting.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Season
              </label>
              <select
                value={modalSeason}
                onChange={(event) => onChangeSeason(event.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-indigo-400"
              >
                {seasonOptions.map((option) => (
                  <option key={`modal-season-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goRelative(-1)}
                disabled={!filteredTeams.length}
                className={`px-2 py-1 rounded-md border text-xs font-semibold ${
                  filteredTeams.length
                    ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    : 'border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => setShowList((prev) => !prev)}
                className="px-3 py-1 rounded-md border border-indigo-200 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                {showList ? 'View Team' : 'Browse Teams'}
              </button>
              <button
                type="button"
                onClick={() => goRelative(1)}
                disabled={!filteredTeams.length}
                className={`px-2 py-1 rounded-md border text-xs font-semibold ${
                  filteredTeams.length
                    ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    : 'border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                ▶
              </button>
            </div>
          </div>
        </div>
        <div className="draft-modal__body">
          {(!isMobile || showList) && (
            <div className="draft-modal__list">
              <div className="px-4 md:px-5 py-3 border-b border-gray-100">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search teams"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setShowList(false)}
                    disabled={!filteredTeams.length}
                    className={`mt-3 w-full px-3 py-2 rounded-md text-xs font-semibold ${
                      filteredTeams.length
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    View Team Details
                  </button>
                )}
              </div>
              <div className="max-h-[55vh] overflow-y-auto">
                {filteredTeams.length ? (
                  filteredTeams.map((team) => {
                    const isSelected = team.teamId === selectedTeamId;
                    return (
                      <button
                        key={`picker-team-${team.teamId}`}
                        type="button"
                        onClick={() => {
                          setSelectedTeamId(team.teamId);
                          if (isMobile) {
                            setShowList(false);
                          }
                        }}
                        className={`w-full px-4 md:px-5 py-3 border-b border-gray-100 text-left transition ${
                          isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {team.city ? `${team.city} ${team.name}` : team.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {team.wins ?? 0} W • {team.losses ?? '—'} L
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            {(team.winPct !== null && team.winPct !== undefined
                              ? (team.winPct * 100).toFixed(1)
                              : '--') + '%'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    All teams have been drafted.
                  </div>
                )}
              </div>
            </div>
          )}
          {(!isMobile || !showList) && (
            <div className="draft-modal__details">
              {selectedTeam ? (
                <div className="p-4 md:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedTeam.city ? `${selectedTeam.city} ${selectedTeam.name}` : selectedTeam.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedTeam.conference || 'Independent'}
                      {selectedTeam.division ? ` • ${selectedTeam.division}` : ''}
                    </p>
                  </div>
                  <div className="inline-flex items-center bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 text-xs text-indigo-600">
                    {displayWinPct !== null && displayWinPct !== undefined
                      ? `${(Number(displayWinPct) * 100).toFixed(1)}%`
                      : '--'} win rate
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs uppercase text-gray-500 tracking-wide">
                      Wins
                    </div>
                    <div className="text-xl font-semibold text-gray-900">
                      {displayWins}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs uppercase text-gray-500 tracking-wide">
                      Losses
                    </div>
                    <div className="text-xl font-semibold text-gray-900">
                      {displayLosses ?? '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs uppercase text-gray-500 tracking-wide">
                      Points
                    </div>
                    <div className="text-xl font-semibold text-gray-900">
                      {(Number(displayWins) * (scoringSettings?.pointsPerWin ?? 1)).toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('teams')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                      viewMode === 'teams'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    Team Stats
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('players')}
                    disabled={!playerHighlights.length && !seasonLoading}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                      viewMode === 'players'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    } ${!playerHighlights.length && !seasonLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Player Highlights
                  </button>
                </div>

                {seasonError && (
                  <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {seasonError}
                  </div>
                )}

                {seasonLoading ? (
                  <div className="text-sm text-gray-500">Loading season data…</div>
                ) : viewMode === 'teams' ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">
                      Season Snapshot
                    </h4>
                    <p className="text-xs text-gray-500">
                      Wins reflect the selected season. Points are calculated using your league scoring settings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {playerHighlights.length
                        ? 'Top 10 Player Performances'
                        : 'No qualifying players'}
                    </h4>
                    {playerHighlights.length ? (
                      <div className="space-y-2">
                        {playerHighlights.map((highlight) => (
                          <div
                            key={`highlight-${highlight.category}-${highlight.player.playerId}`}
                            className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-md px-3 py-2"
                          >
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {highlight.player.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                #{highlight.player.rank} in {PLAYER_CATEGORY_LABELS[highlight.category]}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-indigo-600">
                              {highlight.player.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        No players from this team currently rank in the top 10 of tracked categories.
                      </p>
                    )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                    Select a team to preview details.
                  </div>
                )}
            </div>
          )}
        </div>
        <div className="draft-modal__footer">
          <div className="text-xs text-gray-500">
            {canPick
              ? 'Confirm your selection to draft this team.'
              : 'Only the manager on the clock can submit a pick.'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => selectedTeam && onConfirm(selectedTeam.teamId)}
              disabled={!canPick || !selectedTeam || isSubmitting || seasonLoading}
              className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                canPick && selectedTeam && !isSubmitting && !seasonLoading
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Submitting…' : seasonLoading ? 'Loading…' : (
                <>
                  <FaCheck />
                  Confirm Pick
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DraftRoomTab = ({
  leagueId,
  league,
  gameData,
  teamPool = [],
  userRoster,
  currentUserId,
  draftStatus
}) => {
  const draft = useMemo(() => gameData?.draft || {}, [gameData]);
  const rosterSettings = useMemo(() => gameData?.rosterSettings || {}, [gameData]);
  const teamWins = useMemo(() => gameData?.teamWins || {}, [gameData]);
  const scoringSettings = useMemo(() => gameData?.scoring || {}, [gameData]);

  const managerLookup = useMemo(
    () => buildManagerLookup(league, userRoster),
    [league, userRoster]
  );

  const draftOrder = useMemo(
    () => deriveDraftOrder(draft, rosterSettings, league),
    [draft, rosterSettings, league]
  );

  const useSnake =
    draft.assignmentMode !== ASSIGNMENT_MODES.AUCTION &&
    (draft.useSnakeDraft === undefined ? true : draft.useSnakeDraft);

  const picks = safeArray(draft.picks);
  const rosterSize = Math.max(0, rosterSettings.rosterSize || 0);
  const totalSlots =
    rosterSize && draftOrder.length ? rosterSize * draftOrder.length : picks.length;

  const teamIndex = useMemo(
    () => buildTeamIndex(teamPool, teamWins, picks),
    [teamPool, teamWins, picks]
  );

  const teamLookup = useMemo(() => {
    const map = new Map();
    teamIndex.forEach((team) => map.set(team.teamId, team));
    return map;
  }, [teamIndex]);

  const playerLeadersState = useMemo(
    () => normalizePlayerLeaders(gameData?.playerLeaders),
    [gameData]
  );

  const orderPreview = useMemo(() => {
    const rows = [];
    for (let index = picks.length; index < Math.min(totalSlots, picks.length + 5); index += 1) {
      const slot = getManagerForSlot({
        pickIndex: index,
        draftOrder,
        useSnake
      });
      rows.push({
        pickNumber: index + 1,
        round: slot.round,
        managerId: slot.managerId,
        isCurrent: index === picks.length,
        currentPick: picks.length
      });
    }
    return rows;
  }, [picks.length, totalSlots, draftOrder, useSnake]);

  const activityFeed = useMemo(
    () =>
      [...picks]
        .sort((a, b) => b.pickNumber - a.pickNumber),
    [picks]
  );

  const availableTeams = useMemo(
    () => teamIndex.filter((team) => !team.drafted),
    [teamIndex]
  );

  const currentSeasonPlayerHighlights = useMemo(
    () => buildPlayerHighlightsMap(playerLeadersState.categories, teamIndex),
    [playerLeadersState, teamIndex]
  );

  const [seasonOptions, setSeasonOptions] = useState([{ value: 'current', label: 'Current Season' }]);
  const [modalSeason, setModalSeason] = useState('current');
  const [seasonTeamStats, setSeasonTeamStats] = useState(new Map());
  const [seasonPlayerHighlights, setSeasonPlayerHighlights] = useState(new Map());
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState(null);

  const leagueKey = useMemo(
    () => (inferLeagueFromTeamPool(teamPool) || gameData?.teamPool?.league || '').toString().toUpperCase(),
    [teamPool, gameData]
  );

  useEffect(() => {
    if (modalSeason !== 'current') return;
    const statsMap = new Map();
    teamIndex.forEach((team) => {
      statsMap.set(team.teamId, {
        wins: team.wins ?? 0,
        losses: team.losses ?? null,
        winPct: team.winPct ?? null
      });
    });
    setSeasonTeamStats(statsMap);
    setSeasonPlayerHighlights(currentSeasonPlayerHighlights);
    setSeasonLoading(false);
    setSeasonError(null);
  }, [modalSeason, teamIndex, currentSeasonPlayerHighlights]);

  useEffect(() => {
    if (!leagueKey || modalSeason === 'current') return;
    let mounted = true;

    const loadSeasonData = async () => {
      try {
        setSeasonLoading(true);
        setSeasonError(null);

        const [standingsSnapshot, leadersSnapshot] = await Promise.all([
          fetchLatestTeamStandingsSnapshot({
            league: leagueKey,
            season: modalSeason
          }),
          fetchLatestPlayerLeadersSnapshot({
            league: leagueKey,
            season: modalSeason
          })
        ]);

        if (!mounted) return;

        const statsMap = new Map();
        safeArray(standingsSnapshot?.entries).forEach((entry) => {
          const lookup = [entry.teamId, entry.name]
            .filter(Boolean)
            .map((value) => String(value).toUpperCase());
          const match = teamIndex.find((team) => {
            const tokens = [team.teamId, team.id, team.shortName, team.name]
              .filter(Boolean)
              .map((value) => String(value).toUpperCase());
            return lookup.some((token) => tokens.includes(token));
          });
          const key = match ? match.teamId : entry.teamId || entry.name;
          if (!key) return;
          statsMap.set(key, {
            wins: entry.wins ?? 0,
            losses: entry.losses ?? null,
            winPct: entry.winPct ?? null
          });
        });

        const normalizedLeaders = normalizePlayerLeaders(leadersSnapshot || {});
        const highlightsMap = buildPlayerHighlightsMap(normalizedLeaders.categories, teamIndex);

        setSeasonTeamStats(statsMap);
        setSeasonPlayerHighlights(highlightsMap);
      } catch (error) {
        console.error('[WinsPool][DraftRoom] Failed to load season data:', error);
        if (mounted) {
          setSeasonError(error.message || 'Failed to load season data.');
          setSeasonTeamStats(new Map());
          setSeasonPlayerHighlights(new Map());
        }
      } finally {
        if (mounted) {
          setSeasonLoading(false);
        }
      }
    };

    loadSeasonData();
    return () => {
      mounted = false;
    };
  }, [leagueKey, modalSeason, teamIndex]);

  const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [pickSubmitting, setPickSubmitting] = useState(false);
  const [pickError, setPickError] = useState(null);

  const nextPick = useMemo(() => {
    if (!draftOrder.length || !rosterSize) return null;
    try {
      return computeNextPick({
        draft,
        rosterSettings,
        draftOrder,
        teamPool
      });
    } catch (error) {
      console.warn('[WinsPool][DraftRoom] Failed to compute next pick:', error);
      return null;
    }
  }, [draft, rosterSettings, draftOrder, teamPool, rosterSize]);

  const onClockManagerId =
    draft.onClockUid || nextPick?.managerId || null;
  const onClockName =
    managerLookup.get(onClockManagerId) || onClockManagerId || 'Pending';

  const canPick =
    draftStatus === DRAFT_STATUS.IN_PROGRESS &&
    currentUserId &&
    onClockManagerId &&
    currentUserId === onClockManagerId;

  const handleConfirmPick = useCallback(
    async (teamId) => {
      if (!canPick || !teamId) return;
      try {
        setPickSubmitting(true);
        await makeDraftPick({
          leagueId,
          managerId: onClockManagerId,
          teamId,
          actorId: currentUserId,
          managerName: onClockName,
          teamName: teamLookup.get(teamId)?.name || teamId
        });
        setIsTeamPickerOpen(false);
      } catch (error) {
        console.error('[WinsPool][DraftRoom] Failed to submit pick:', error);
        setPickError(error.message || 'Failed to submit pick.');
      } finally {
        setPickSubmitting(false);
      }
    },
    [canPick, leagueId, onClockManagerId, currentUserId, onClockName, teamLookup]
  );

  const handleOpenTeamPicker = useCallback(
    (teamId = null) => {
      if (!availableTeams.length) return;
      setSelectedTeamId(teamId || availableTeams[0].teamId);
      setIsTeamPickerOpen(true);
      setPickError(null);
    },
    [availableTeams]
  );

  useEffect(() => {
    let mounted = true;
    if (!leagueKey) return () => { mounted = false; };
    const loadSeasons = async () => {
      try {
        const seasons = await fetchAvailableSeasons(leagueKey);
        if (!mounted) return;
        const formatted = seasons
          .map((season) => ({
            value: season.season || season.id,
            label: formatSeasonDisplay(season.season || season.id)
          }))
          .filter((option) => option.value);
        setSeasonOptions([{ value: 'current', label: 'Current Season' }, ...formatted]);
      } catch (error) {
        console.warn('[WinsPool][DraftRoom] Failed to load season options:', error);
      }
    };
    loadSeasons();
    return () => {
      mounted = false;
    };
  }, [leagueKey]);

  return (
    <div className="space-y-6">
      <DraftHeader
        onClockName={onClockName}
        nextPick={nextPick}
        draftStatus={draftStatus}
        orderPreview={orderPreview}
        managerLookup={managerLookup}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 order-1 lg:order-none">
          <OnClockPanel
            canPick={canPick}
            pickSubmitting={pickSubmitting}
            onOpenPicker={() => handleOpenTeamPicker()}
            onClockName={onClockName}
            currentUserId={currentUserId}
            managerLookup={managerLookup}
            roster={userRoster}
            pickError={pickError}
          />
        </div>
        <div className="lg:col-span-2 order-2">
          <ActivityFeed
            picks={activityFeed}
            managerLookup={managerLookup}
            teamLookup={teamLookup}
          />
        </div>
      </div>

      <TeamPickerModal
        isOpen={isTeamPickerOpen}
        onClose={() => setIsTeamPickerOpen(false)}
        teams={teamIndex}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        canPick={canPick}
        onConfirm={handleConfirmPick}
        seasonOptions={seasonOptions}
        modalSeason={modalSeason}
        onChangeSeason={setModalSeason}
        seasonTeamStats={seasonTeamStats}
        seasonPlayerHighlights={seasonPlayerHighlights}
        seasonLoading={seasonLoading}
        seasonError={seasonError}
        scoringSettings={scoringSettings}
        isSubmitting={pickSubmitting}
      />
    </div>
  );
};

export default DraftRoomTab;

/* Inline styles to ensure consistent modal sizing */
const styles = `
.draft-modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}
.draft-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}
.draft-modal__content {
  position: relative;
  background: #fff;
  width: 100%;
  height: 100%;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@media (min-width: 640px) {
  .draft-modal {
    align-items: center;
  }
  .draft-modal__content {
    width: calc(100vw - 3rem);
    max-width: 1080px;
    max-height: 80vh;
    border-radius: 1rem;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
  }
}
.draft-modal__header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
}
@media (min-width: 768px) {
  .draft-modal__header {
    padding: 0.75rem 1.5rem;
  }
}

.draft-modal__body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
@media (min-width: 768px) {
  .draft-modal__body {
    flex-direction: row;
  }
}
.draft-modal__list {
  width: 100%;
  border-bottom: 1px solid #e5e7eb;
  overflow: hidden;
}
@media (min-width: 768px) {
  .draft-modal__list {
    width: 40%;
    border-bottom: none;
    border-right: 1px solid #e5e7eb;
  }
}
.draft-modal__list > div:last-child {
  overflow-y: auto;
  max-height: 60vh;
}
@media (max-width: 639px) {
  .draft-modal__list > div:last-child {
    max-height: 45vh;
  }
}
@media (min-width: 768px) {
  .draft-modal__list > div:last-child {
    max-height: 100%;
  }
}
.draft-modal__details {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
@media (max-width: 639px) {
  .draft-modal__details {
    min-height: 55vh;
  }
}
@media (min-width: 768px) {
  .draft-modal__details {
    padding: 1.5rem;
  }
}
.draft-modal__footer {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .draft-modal__footer {
    padding: 1rem 1.5rem;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('draft-room-inline-styles')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'draft-room-inline-styles';
  styleTag.innerHTML = styles;
  document.head.appendChild(styleTag);
}

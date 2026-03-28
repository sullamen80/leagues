import React, { useEffect, useMemo, useState } from 'react';
import { getColorClass } from '../../../../styles/tokens/colors';
import {
  safeArray,
  normalizePlayerLeaders,
  buildPlayerHighlightsMap,
  PLAYER_CATEGORY_LABELS
} from '../../utils/statsHelpers';
import {
  normalizeScoringSettings,
  calculateStandingsFromData,
  findRosterStanding
} from '../../utils/scoringUtils';

const formatStatValue = (category, value) => {
  if (value === null || value === undefined) return null;
  return Number(value).toFixed(['spg', 'bpg'].includes(category) ? 2 : 1);
};

const buildTeamLookup = (teams = []) =>
  teams.reduce((accumulator, team) => {
    if (team?.id) {
      accumulator[team.id] = team;
    }
    return accumulator;
  }, {});

const getRosterLabel = (rosterEntry, currentUserId) => {
  if (!rosterEntry) return 'Unknown manager';
  const baseLabel =
    rosterEntry.displayName ||
    rosterEntry.username ||
    rosterEntry.ownerName ||
    rosterEntry.email ||
    rosterEntry.id ||
    'Manager';
  if (currentUserId && rosterEntry.id === currentUserId) {
    return `Me (${baseLabel})`;
  }
  return baseLabel;
};

const MyRosterTab = ({
  roster,
  teamPool = [],
  gameData = {},
  allRosters = [],
  currentUserId = null
}) => {
  const teamLookup = useMemo(() => {
    return buildTeamLookup(teamPool);
  }, [teamPool]);

  const teamWinsMap = useMemo(() => gameData?.teamWins || {}, [gameData]);
  const playerLeadersState = useMemo(
    () => normalizePlayerLeaders(gameData?.playerLeaders || {}),
    [gameData]
  );
  const scoringSettings = useMemo(
    () => normalizeScoringSettings(gameData?.scoring),
    [gameData?.scoring]
  );

  const standingsData = useMemo(
    () =>
      calculateStandingsFromData({
        rosters: allRosters,
        scoringSettings,
        teamWinsMap,
        playerLeaders: gameData?.playerLeaders || {},
        teamPool
      }),
    [allRosters, scoringSettings, teamWinsMap, gameData?.playerLeaders, teamPool]
  );

  const [activeView, setActiveView] = useState('teams');
  const [selectedRosterId, setSelectedRosterId] = useState(() => {
    if (currentUserId) return currentUserId;
    if (roster?.id) return roster.id;
    return allRosters[0]?.id || null;
  });

  useEffect(() => {
    if (!allRosters.length) return;
    const hasSelected = selectedRosterId
      ? allRosters.some((entry) => entry.id === selectedRosterId)
      : false;
    if (!hasSelected) {
      const fallbackId =
        (currentUserId && allRosters.find((entry) => entry.id === currentUserId)?.id) ||
        roster?.id ||
        allRosters[0]?.id ||
        null;
      if (fallbackId !== selectedRosterId) {
        setSelectedRosterId(fallbackId);
      }
    }
  }, [allRosters, selectedRosterId, currentUserId, roster?.id]);

  const rosterOptions = useMemo(
    () =>
      allRosters.map((entry) => ({
        id: entry.id,
        label: getRosterLabel(entry, currentUserId)
      })),
    [allRosters, currentUserId]
  );

  const activeRoster = useMemo(() => {
    if (!selectedRosterId) {
      return roster || null;
    }
    const match = allRosters.find((entry) => entry.id === selectedRosterId);
    if (match) return match;
    return roster || null;
  }, [selectedRosterId, allRosters, roster]);

  const teams = safeArray(activeRoster?.teams);
  const enrichedTeams = useMemo(() => {
    if (!teams.length) return [];
    return teams.map((team) => {
      const metadata = teamLookup[team.id] || {};
      const seasonEntry = teamWinsMap[team.id] || {};
      const wins = seasonEntry.wins ?? team.wins ?? 0;
      const losses =
        seasonEntry.losses !== undefined && seasonEntry.losses !== null
          ? seasonEntry.losses
          : team.losses ?? null;
      const totalGames = losses !== null ? wins + losses : null;
      const winPct =
        seasonEntry.winPct !== undefined && seasonEntry.winPct !== null
          ? seasonEntry.winPct
          : totalGames && totalGames > 0
          ? wins / totalGames
          : null;

      return {
        ...metadata,
        ...team,
        teamId: team.id,
        logo: team.logo || metadata.logo || null,
        city: team.city || metadata.city || '',
        name: team.name || metadata.name || metadata.shortName || team.id,
        conference: team.conference || metadata.conference || null,
        division: team.division || metadata.division || null,
        wins,
        losses,
        winPct
      };
    });
  }, [teams, teamLookup, teamWinsMap]);

  const totalWins = enrichedTeams.reduce((sum, team) => sum + (team.wins || 0), 0);
  const currentStanding = findRosterStanding(standingsData, activeRoster?.id);
  const pointsFromWins = currentStanding?.pointsFromWins ?? totalWins * scoringSettings.pointsPerWin;
  const pointsFromPlayers = currentStanding?.pointsFromPlayers ?? 0;
  const pointsFromOvertime = currentStanding?.pointsFromOvertime ?? 0;
  const pointsFromPlayoffs = currentStanding?.pointsFromPlayoffs ?? 0;
  const totalPoints = Number(currentStanding?.points ?? (pointsFromWins + pointsFromOvertime + pointsFromPlayoffs + pointsFromPlayers)).toFixed(1);

  const summaryMetrics = [
    { label: 'Total Points', value: totalPoints, accent: getColorClass('blue', '400', 'bg') },
    { label: 'Win Points', value: Number(pointsFromWins).toFixed(1), accent: getColorClass('indigo', '400', 'bg') },
    { label: 'Player Bonus', value: Number(pointsFromPlayers).toFixed(1), accent: getColorClass('purple', '400', 'bg') },
    { label: 'Total Wins', value: totalWins, accent: getColorClass('emerald', '400', 'bg') }
  ];
  if (!activeRoster) {
    return (
      <div className="rounded-xl bg-white shadow-sm p-8 text-center border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Roster Not Ready</h3>
        <p className="text-sm text-gray-500">
          Once the draft is complete and teams are assigned, your roster will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl overflow-hidden shadow">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold">
              {getRosterLabel(activeRoster, currentUserId)}
            </h3>
            <p className="text-sm text-indigo-100">Track wins, propose trades, and manage your teams</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {summaryMetrics.map(metric => (
              <div key={metric.label} className="px-3 py-2 rounded-lg bg-white/15 text-center">
                <p className="text-xs uppercase tracking-wide text-indigo-100">{metric.label}</p>
                <p className="text-lg font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="text-xs text-indigo-100">
            Win pts {Number(pointsFromWins).toFixed(1)} • OT bonus {Number(pointsFromOvertime).toFixed(1)} • Playoff bonus {Number(pointsFromPlayoffs).toFixed(1)} • Player bonus {Number(pointsFromPlayers).toFixed(1)}
          </div>
        </div>

        <div className="bg-white px-6 py-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs uppercase text-gray-500">View</label>
                <select
                  className="mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
                  value={selectedRosterId || ''}
                  onChange={(event) => setSelectedRosterId(event.target.value || null)}
                >
                  {rosterOptions.length ? (
                    rosterOptions.map((option) => (
                      <option key={`roster-option-${option.id}`} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">{getRosterLabel(activeRoster, currentUserId)}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-gray-500">Season</label>
                <div className="mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-gray-50">
                  {playerLeadersState.seasonLabel ||
                    playerLeadersState.season ||
                    gameData?.seasonYear ||
                    new Date().getFullYear()}
                </div>
              </div>
              <div className="mt-6 lg:mt-7">
                <div className="inline-flex rounded-full border border-gray-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setActiveView('teams')}
                    className={`px-3 py-1 ${
                      activeView === 'teams' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
                    }`}
                  >
                    Teams
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('players')}
                    className={`px-3 py-1 ${
                      activeView === 'players' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
                    }`}
                  >
                    Players
                  </button>
                </div>
              </div>
            </div>
            <button
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-500"
              type="button"
            >
              Propose Trade
            </button>
          </div>

          {activeView === 'teams' ? (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <header className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">Teams</h4>
                <span className="text-xs text-gray-400">{enrichedTeams.length} rostered</span>
              </header>

              {enrichedTeams.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-500">
                  No teams drafted yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {enrichedTeams.map((team) => (
                    <div
                      key={team.teamId}
                      className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        {team.logo && (
                          <img
                            src={team.logo}
                            alt={`${team.name} logo`}
                            className="h-10 w-10 rounded-full border border-gray-200 bg-white object-contain"
                          />
                        )}
                        <div>
                          <p className="text-lg font-semibold text-gray-800">
                            {team.city} {team.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {team.conference
                              ? `${team.conference}${team.division ? ` • ${team.division}` : ''}`
                              : 'Independent'}
                          </p>
                          {team.draftPickNumber && (
                            <p className="text-xs text-gray-400 mt-1">
                              Draft Pick #{team.draftPickNumber}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div>
                          <p className="text-xs uppercase text-gray-500 tracking-wide">Wins</p>
                          <p className="text-lg font-semibold text-gray-800">{team.wins ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-gray-500 tracking-wide">Losses</p>
                          <p className="text-lg font-semibold text-gray-800">
                            {team.losses !== null && team.losses !== undefined ? team.losses : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-gray-500 tracking-wide">Win %</p>
                          <p className="text-lg font-semibold text-gray-800">
                            {team.winPct !== null && team.winPct !== undefined
                              ? `${(Number(team.winPct) * 100).toFixed(1)}%`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <RosterPlayersView
              teams={enrichedTeams}
              playerLeadersState={playerLeadersState}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border border-gray-100 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Trades</h4>
              <div className="border rounded-lg border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
                No trades posted yet.
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recently Completed</h4>
              <div className="border rounded-lg border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
                No trades completed yet.
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

const RosterPlayersView = ({ teams, playerLeadersState }) => {
  const highlightsMap = useMemo(() => {
    const map = buildPlayerHighlightsMap(playerLeadersState.categories, teams);
    const formatted = new Map();
    map.forEach((entries, teamId) => {
      formatted.set(
        teamId,
        entries.map((entry) => ({
          ...entry,
          player: {
            ...entry.player,
            value: formatStatValue(entry.category, entry.player?.value)
          }
        }))
      );
    });
    return formatted;
  }, [playerLeadersState, teams]);

  const orderedTeams = useMemo(() => {
    return teams
      .map((team) => ({
        ...team,
        highlights: highlightsMap.get(team.teamId) || []
      }))
      .filter((team) => team.highlights.length);
  }, [teams, highlightsMap]);

  if (!orderedTeams.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center text-gray-500">
        No player leaderboard appearances yet for these teams.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {orderedTeams.map((team) => (
        <div
          key={`player-highlights-${team.teamId}`}
          className="rounded-xl border border-gray-100 bg-white overflow-hidden"
        >
          <header className="px-5 py-3 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {team.logo && (
                <img
                  src={team.logo}
                  alt={`${team.name} logo`}
                  className="h-8 w-8 rounded-full border border-gray-200 bg-white object-contain"
                />
              )}
              <div>
                <h4 className="text-sm font-semibold text-gray-700">
                  {team.city} {team.name}
                </h4>
                <p className="text-xs text-gray-500">
                  {team.conference
                    ? `${team.conference}${team.division ? ` • ${team.division}` : ''}`
                    : 'Independent'}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {team.wins ?? 0} W{team.losses !== null && team.losses !== undefined ? ` • ${team.losses} L` : ''}
            </div>
          </header>
          <div className="divide-y divide-gray-100">
            {team.highlights.map((entry) => (
              <div
                key={`${team.teamId}-${entry.category}-${entry.player.playerId}`}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {entry.player.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    #{entry.player.rank} in {PLAYER_CATEGORY_LABELS[entry.category] || entry.category.toUpperCase()}
                  </p>
                </div>
                <div className="text-sm font-semibold text-indigo-600">
                  {entry.player.value !== null && entry.player.value !== undefined
                    ? entry.player.value
                    : '--'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyRosterTab;

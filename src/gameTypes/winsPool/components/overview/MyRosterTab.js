import React, { useEffect, useMemo, useState } from 'react';
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
  const bonusPoints = Number(pointsFromOvertime) + Number(pointsFromPlayoffs);
  const showBonusPoints = Number(currentStanding?.overtimeWins) > 0 ||
    Number(currentStanding?.playoffWins) > 0;
  const totalPoints = Number(currentStanding?.points ?? (pointsFromWins + pointsFromOvertime + pointsFromPlayoffs + pointsFromPlayers)).toFixed(1);

  const summaryMetrics = [
    { label: 'Win Points', value: Number(pointsFromWins).toFixed(1) },
    { label: 'Player Points', value: Number(pointsFromPlayers).toFixed(1) },
    { label: 'Total Points', value: totalPoints },
    ...(showBonusPoints ? [{ label: 'Bonus Points', value: bonusPoints.toFixed(1) }] : [])
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
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-l-4 border-indigo-500 px-4 py-5 sm:px-6 sm:py-6">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold text-gray-900 sm:text-xl">
              {getRosterLabel(activeRoster, currentUserId)}
            </h3>
            <p className="mt-1 text-sm text-gray-500">Teams, wins, and points at a glance</p>
          </div>

          <div className={`mt-5 grid grid-cols-2 gap-3 ${showBonusPoints ? 'lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {summaryMetrics.map((metric) => (
              <div key={metric.label} className={`min-w-0 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 sm:px-4 ${!showBonusPoints && metric.label === 'Total Points' ? 'col-span-2 sm:col-span-1' : ''}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{metric.label}</p>
                <p className={`mt-1 break-words text-xl font-semibold tabular-nums sm:text-2xl ${metric.label === 'Total Points' ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <details className="mt-4 border-t border-gray-100 pt-2 text-sm text-gray-600">
            <summary className="cursor-pointer rounded-md py-2 font-medium text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              How points are calculated
            </summary>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-1 pt-2 sm:grid-cols-4">
              <div><dt className="text-xs text-gray-500">Win points</dt><dd className="font-medium text-gray-800">{Number(pointsFromWins).toFixed(1)}</dd></div>
              <div><dt className="text-xs text-gray-500">Overtime bonus</dt><dd className="font-medium text-gray-800">{Number(pointsFromOvertime).toFixed(1)}</dd></div>
              <div><dt className="text-xs text-gray-500">Playoff bonus</dt><dd className="font-medium text-gray-800">{Number(pointsFromPlayoffs).toFixed(1)}</dd></div>
              <div><dt className="text-xs text-gray-500">Player points</dt><dd className="font-medium text-gray-800">{Number(pointsFromPlayers).toFixed(1)}</dd></div>
            </dl>
          </details>
        </div>

        <div className="space-y-5 border-t border-gray-100 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <div className="min-w-0">
                <label className="block text-xs uppercase text-gray-500">View</label>
                <select
                  className="mt-1 w-full min-w-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 lg:w-auto"
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
              <div className="min-w-0">
                <label className="block text-xs uppercase text-gray-500">Season</label>
                <div className="mt-1 min-w-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {playerLeadersState.seasonLabel ||
                    playerLeadersState.season ||
                    gameData?.seasonYear ||
                    new Date().getFullYear()}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-auto">
                <div className="inline-flex overflow-hidden rounded-full border border-gray-200 text-sm">
                  <button
                    type="button"
                    onClick={() => setActiveView('teams')}
                    className={`px-4 py-2 ${
                      activeView === 'teams' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
                    }`}
                  >
                    Teams
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('players')}
                    className={`px-4 py-2 ${
                      activeView === 'players' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
                    }`}
                  >
                    Players
                  </button>
                </div>
              </div>
            </div>
            <button
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 sm:w-auto"
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

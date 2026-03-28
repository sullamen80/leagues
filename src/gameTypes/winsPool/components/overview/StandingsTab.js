import React, { useMemo, useState } from 'react';
import {
  safeArray,
  normalizePlayerLeaders,
  PLAYER_CATEGORY_LABELS
} from '../../utils/statsHelpers';

const formatWinPct = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
};

const deriveTeamRows = (teamPool, teamWinsMap) => {
  const rows = safeArray(teamPool).map((team) => {
    const entry = teamWinsMap[team.id] || {};
    const wins = Number.isFinite(entry.wins) ? Number(entry.wins) : Number(team.wins || 0);
    const losses =
      entry.losses !== undefined && entry.losses !== null
        ? Number(entry.losses)
        : team.losses !== undefined && team.losses !== null
        ? Number(team.losses)
        : null;
    const totalGames = wins + (losses ?? 0);
    const winPct =
      entry.winPct !== undefined && entry.winPct !== null
        ? Number(entry.winPct)
        : totalGames > 0
        ? wins / totalGames
        : null;

    const updatedAt =
      entry.updatedAt ||
      entry.fetchedAt ||
      entry.manualUpdatedAt ||
      entry.autoUpdatedAt ||
      null;

    return {
      teamId: team.id,
      name: team.name || '',
      shortName: team.shortName || '',
      city: team.city || '',
      conference: team.conference || null,
      division: team.division || null,
      logo: team.logo || null,
      wins,
      losses,
      winPct,
      updatedAt,
      source: entry.source || null
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winPct !== a.winPct) return (b.winPct || 0) - (a.winPct || 0);
    return (a.teamId || '').localeCompare(b.teamId || '');
  });

  return rows;
};

const StandingsTab = ({ teamPool = [], gameData = {} }) => {
  const [activeView, setActiveView] = useState('teams');

  const teamWinsMap = useMemo(() => gameData?.teamWins || {}, [gameData]);
  const seasonLabel =
    gameData?.teamWinsMeta?.seasonLabel ||
    gameData?.teamWinsMeta?.season ||
    gameData?.seasonYear ||
    'Current Season';

  const standings = useMemo(
    () => deriveTeamRows(teamPool, teamWinsMap),
    [teamPool, teamWinsMap]
  );

  const groupedStandings = useMemo(() => {
    const groups = new Map();
    standings.forEach((row) => {
      const conference = row.conference || 'Independent';
      const division = row.division || 'All Divisions';
      if (!groups.has(conference)) {
        groups.set(conference, new Map());
      }
      const divisionMap = groups.get(conference);
      if (!divisionMap.has(division)) {
        divisionMap.set(division, []);
      }
      divisionMap.get(division).push(row);
    });
    // sort divisions & teams
    groups.forEach((divisionMap) => {
      divisionMap.forEach((rows, division) => {
        rows.sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if ((b.winPct || 0) !== (a.winPct || 0)) return (b.winPct || 0) - (a.winPct || 0);
          return (a.teamId || '').localeCompare(b.teamId || '');
        });
      });
    });
    return groups;
  }, [standings]);

  const lastUpdated = useMemo(() => {
    const timestamps = standings
      .map((row) => row.updatedAt)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((time) => !Number.isNaN(time));
    if (timestamps.length) {
      return new Date(Math.max(...timestamps));
    }
    const fallback = gameData?.updatedAt || null;
    return fallback ? new Date(fallback) : null;
  }, [standings, gameData?.updatedAt]);

  const playerLeadersState = useMemo(
    () => normalizePlayerLeaders(gameData?.playerLeaders || {}),
    [gameData]
  );

  const playerCategories = useMemo(() => {
    return Object.entries(playerLeadersState.categories || {})
      .map(([category, entries]) => ({
        id: category,
        label: PLAYER_CATEGORY_LABELS[category] || category.toUpperCase(),
        entries: safeArray(entries)
      }))
      .filter((category) => category.entries.length);
  }, [playerLeadersState.categories]);

  if (!standings.length && !playerCategories.length) {
    return (
      <div className="rounded-lg bg-white shadow-md p-6 text-center text-gray-500">
        Standings will appear once team wins or player stats are available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {activeView === 'teams' ? 'League Standings' : 'Player Stat Leaders'}
            </h3>
            <p className="text-sm text-gray-500">
              {activeView === 'teams'
                ? `Real-world records for the configured team pool • ${seasonLabel}`
                : `Top performers across tracked categories • ${playerLeadersState.seasonLabel || playerLeadersState.season || seasonLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
                disabled={!playerCategories.length}
              >
                Player Stats
              </button>
            </div>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Updated {lastUpdated.toLocaleString()}
              </span>
            )}
          </div>
        </header>

        {activeView === 'teams' ? (
          standings.length ? (
            <div className="divide-y divide-gray-100">
              {Array.from(groupedStandings.entries()).map(([conference, divisionMap]) => (
                <div key={`conference-${conference}`} className="px-6 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold text-gray-800">
                      {conference}
                    </h4>
                    <span className="text-xs text-gray-400">
                      {Array.from(divisionMap.values()).reduce(
                        (count, rows) => count + rows.length,
                        0
                      )}{' '}
                      teams
                    </span>
                  </div>
                  <div className="space-y-4">
                    {Array.from(divisionMap.entries()).map(([division, rows]) => (
                      <div
                        key={`division-${conference}-${division}`}
                        className="border border-gray-100 rounded-lg overflow-hidden"
                      >
                        <header className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">
                            {division}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rows.length} team{rows.length === 1 ? '' : 's'}
                          </span>
                        </header>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left">
                                  #
                                </th>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left">
                                  Team
                                </th>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                                  Wins
                                </th>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                                  Losses
                                </th>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                                  Win %
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {rows.map((row, index) => (
                                <tr key={`${division}-${row.teamId}`}>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    <div className="flex items-center gap-3">
                                      {row.logo && (
                                        <img
                                          src={row.logo}
                                          alt={`${row.name} logo`}
                                          className="h-8 w-8 rounded-full border border-gray-200 bg-white object-contain"
                                        />
                                      )}
                                      <span>
                                        {row.city} {row.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-gray-700">
                                    {row.wins}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-gray-700">
                                    {row.losses !== null && row.losses !== undefined
                                      ? row.losses
                                      : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-gray-700">
                                    {formatWinPct(row.winPct)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              Team standings will appear once wins have been recorded.
            </div>
          )
        ) : playerCategories.length ? (
          <div className="divide-y divide-gray-100">
            {playerCategories.map((category) => (
              <div key={`player-category-${category.id}`} className="px-6 py-4 space-y-3">
                <header className="flex items-center justify-between">
                  <h4 className="text-md font-semibold text-gray-800">
                    {category.label}
                  </h4>
                  <span className="text-xs text-gray-400">
                    Top {category.entries.length}
                  </span>
                </header>
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left">
                          Rank
                        </th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left">
                          Player
                        </th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left">
                          Team
                        </th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                          Value
                        </th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-right">
                          Games
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {category.entries.map((entry) => (
                        <tr key={`${category.id}-${entry.playerId}`}>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {entry.rank ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {entry.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {entry.teamName || entry.teamAbbr || '—'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-700">
                            {entry.value !== null && entry.value !== undefined
                              ? Number(entry.value).toFixed(
                                  ['spg', 'bpg'].includes(category.id) ? 2 : 1
                                )
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-700">
                            {entry.gamesPlayed ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">
            No player leaderboard data available for this season.
          </div>
        )}
      </section>
    </div>
  );
};

export default StandingsTab;

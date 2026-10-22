// src/gameTypes/winsPool/components/Leaderboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTION_KEYS } from '../constants/winsPoolConstants';
import { safeArray } from '../utils/statsHelpers';
import {
  normalizeScoringSettings,
  calculateStandingsFromData
} from '../utils/scoringUtils';

const Leaderboard = ({ leagueId, teamPool = [], allRosters = [], gameData = {} }) => {
  const [storedScoring, setStoredScoring] = useState(null);

  useEffect(() => {
    setStoredScoring(null);
    const targetLeagueId = leagueId || gameData?.leagueId;
    if (!targetLeagueId) return undefined;
    return onSnapshot(doc(db, 'leagues', targetLeagueId, COLLECTION_KEYS.SETTINGS, 'scoring'),
      (snapshot) => setStoredScoring(snapshot.exists() ? snapshot.data() : null),
      (error) => {
        console.error('[WinsPool][Leaderboard] Failed to load scoring:', error);
        setStoredScoring(null);
      });
  }, [leagueId, gameData?.leagueId]);

  const scoringSettings = useMemo(
    () => normalizeScoringSettings(gameData?.scoring || storedScoring || {}),
    [storedScoring, gameData?.scoring]
  );

  const computedStandings = useMemo(() => calculateStandingsFromData({
    rosters: allRosters,
    scoringSettings,
    teamWinsMap: gameData?.teamWins || {},
    playerLeaders: gameData?.playerLeaders || {},
    teamPool
  }), [allRosters, scoringSettings, gameData?.teamWins, gameData?.playerLeaders, teamPool]);

  const teamLookup = useMemo(() => {
    return teamPool.reduce((acc, team) => {
      if (team?.id) {
        acc[team.id] = team;
      }
      return acc;
    }, {});
  }, [teamPool]);

  const teamWinsMap = useMemo(() => gameData?.teamWins || {}, [gameData?.teamWins]);

  const rows = useMemo(() => {
    return computedStandings
      .map((entry) => {
        const roster = safeArray(allRosters).find((r) => r.id === entry.userId) || null;
        const teams = safeArray(entry.teams).length
          ? safeArray(entry.teams)
          : safeArray(roster?.teams);

        const normalizedTeams = teams.map((team) => {
          const metadata = teamLookup[team.id] || {};
          const winsEntry = teamWinsMap[team.id] || {};
          return {
            ...metadata,
            ...team,
            wins: winsEntry.wins ?? team.wins ?? metadata.wins ?? 0
          };
        });

        return {
          id: entry.userId || roster?.id,
          name:
            entry.displayName ||
            entry.userName ||
            roster?.displayName || entry.userId,
          totalWins:
            entry.totalWins ?? entry.wins ??
            normalizedTeams.reduce((sum, team) => sum + (Number(team.wins) || 0), 0),
          points: Number(entry.points ?? entry.totalPoints ?? 0),
          pointsFromPlayers: Number(entry.playerPoints ?? entry.pointsFromPlayers ?? 0),
          pointsFromWins: Number(entry.pointsFromWins ?? 0),
          pointsFromOvertime: Number(entry.pointsFromOvertime ?? 0),
          pointsFromPlayoffs: Number(entry.pointsFromPlayoffs ?? 0),
          teams: normalizedTeams
        };
      })
      .filter((entry) => entry.id)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        return a.name.localeCompare(b.name);
      });
  }, [computedStandings, allRosters, teamLookup, teamWinsMap]);

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">League Leaderboard</h3>
          <p className="text-sm text-gray-500">
            Rankings by total wins, bonuses, and player stat awards. Base points per win: {scoringSettings.pointsPerWin}
          </p>
        </div>
        <span className="text-xs text-gray-400">Live calculation</span>
      </header>

      {!rows.length ? (
        <div className="px-6 py-12 text-center text-gray-500 text-sm">
          Leaderboard will populate when participants join the league.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Manager
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Wins
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Points
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Player Bonus
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teams
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((entry, index) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-semibold">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {entry.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {entry.totalWins}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {entry.points.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-indigo-600 text-right">
                    {entry.pointsFromPlayers.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {entry.teams.slice(0, 6).map((team) => (
                        <span
                          key={`${entry.id}-${team.id}`}
                          className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs text-gray-600 gap-1"
                        >
                          {team.logo && (
                            <img
                              src={team.logo}
                              alt={`${team.shortName || team.name} logo`}
                              className="h-4 w-4 rounded-full border border-gray-200 bg-white object-contain"
                            />
                          )}
                          {team.shortName || team.name}
                          <span className="text-gray-400">({team.wins ?? 0})</span>
                        </span>
                      ))}
                      {entry.teams.length > 6 && (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-200 text-xs text-gray-600">
                          +{entry.teams.length - 6}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;

// src/gameTypes/winsPool/components/Leaderboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTION_KEYS, GAME_DATA_DOCUMENTS } from '../constants/winsPoolConstants';
import { safeArray } from '../utils/statsHelpers';
import {
  normalizeScoringSettings,
  calculateStandingsFromData
} from '../utils/scoringUtils';

const getManagerName = (roster) =>
  roster.displayName ||
  roster.username ||
  roster.ownerName ||
  roster.email ||
  roster.id ||
  'Manager';

const Leaderboard = ({ leagueId, teamPool = [], allRosters = [], gameData = {} }) => {
  const [docEntries, setDocEntries] = useState(null);
  const [docUpdatedAt, setDocUpdatedAt] = useState(null);

  useEffect(() => {
    const targetLeagueId = leagueId || gameData?.leagueId;
    if (!targetLeagueId) return undefined;

    const leaderboardRef = doc(
      db,
      'leagues',
      targetLeagueId,
      COLLECTION_KEYS.LEADERBOARD,
      GAME_DATA_DOCUMENTS.CURRENT
    );

    const unsubscribe = onSnapshot(
      leaderboardRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setDocEntries(Array.isArray(data.entries) ? data.entries : []);
          setDocUpdatedAt(data.updatedAt || null);
        } else {
          setDocEntries(null);
          setDocUpdatedAt(null);
        }
      },
      () => {
        setDocEntries(null);
        setDocUpdatedAt(null);
      }
    );

    return () => unsubscribe();
  }, [leagueId, gameData?.leagueId]);

  const scoringSettings = useMemo(
    () => normalizeScoringSettings(gameData?.scoring),
    [gameData?.scoring]
  );

  const computedStandings = useMemo(() => {
    if (docEntries && docEntries.length) {
      return null;
    }
    if (!allRosters || !allRosters.length) {
      return [];
    }

    return calculateStandingsFromData({
      rosters: allRosters,
      scoringSettings,
      teamWinsMap: gameData?.teamWins || {},
      playerLeaders: gameData?.playerLeaders || {},
      teamPool
    });
  }, [docEntries, allRosters, scoringSettings, gameData?.teamWins, gameData?.playerLeaders, teamPool]);

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
    const sourceEntries =
      docEntries && docEntries.length
        ? docEntries
        : computedStandings || [];

    return sourceEntries
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
            getManagerName(roster || { id: entry.userId }),
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
  }, [docEntries, computedStandings, allRosters, teamLookup, teamWinsMap]);

  const lastUpdated = useMemo(() => {
    if (docUpdatedAt) {
      return new Date(docUpdatedAt);
    }
    if (computedStandings) {
      return new Date(
        gameData?.updatedAt ||
          gameData?.teamWinsMeta?.updatedAt ||
          Date.now()
      );
    }
    return null;
  }, [docUpdatedAt, computedStandings, gameData?.updatedAt, gameData?.teamWinsMeta?.updatedAt]);

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">League Leaderboard</h3>
          <p className="text-sm text-gray-500">
            Rankings by total wins, bonuses, and player stat awards. Base points per win: {scoringSettings.pointsPerWin}
          </p>
        </div>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Updated {lastUpdated.toLocaleString()}
            {!docEntries?.length ? ' • Live calculation' : ''}
          </span>
        )}
      </header>

      {!rows.length ? (
        <div className="px-6 py-12 text-center text-gray-500 text-sm">
          Leaderboard will populate once managers have teams assigned.
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

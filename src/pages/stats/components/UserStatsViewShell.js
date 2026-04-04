// src/pages/stats/components/UserStatsViewShell.js
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { classNames, formatNumber, formatDate } from '../../../utils/formatters';
import { formatGameType } from '../utils/statsFormatter';
import { normalizeGameTypeId } from '../../../gameTypes';
import { normalizeDateValue, resolveUserDetail } from './statsViewModel';

/**
 * User Statistics View Shell Component
 * Base component for displaying user statistics across different game types
 */
const UserStatsViewShell = ({
  data,
  adapter = null,
  extraColumns = [],
  renderExpandedContent,
  formatLeagueData = null,
  renderSections = null,
  children
}) => {
  const [expandedRows, setExpandedRows] = useState({});

  const toggleExpand = (leagueId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [leagueId]: !prev[leagueId]
    }));
  };

  const userDetail = resolveUserDetail(data || {});
  const { history = [] } = userDetail;
  const adapterSections = renderSections || (
    adapter && typeof adapter.renderUserSections === 'function'
      ? adapter.renderUserSections({ userDetail: data, history })
      : null
  );
  const expandedRenderer = renderExpandedContent || (
    adapter && typeof adapter.renderUserExpanded === 'function'
      ? (league, userData, resolvedUserDetail) => adapter.renderUserExpanded({
          historyEntry: league.fullData || league,
          userDetail: userData,
          user: resolvedUserDetail
        })
      : null
  );

  const leaguesData = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];

    const sortedLeagues = [...history].sort((a, b) => {
      const dateA = normalizeDateValue(a.completedAt || a.timestamp || a.lastUpdated);
      const dateB = normalizeDateValue(b.completedAt || b.timestamp || b.lastUpdated);
      return (dateB?.getTime?.() || 0) - (dateA?.getTime?.() || 0);
    });

    return sortedLeagues.map((league) => {
      const getRankSuffix = (rank) => {
        if (rank === 1) return '1st';
        if (rank === 2) return '2nd';
        if (rank === 3) return '3rd';
        return `${rank}th`;
      };

      const formatTimestamp = (timestamp) => {
        const normalized = normalizeDateValue(timestamp);
        return normalized ? formatDate(normalized, 'short') : 'Unknown';
      };

      const standardLeagueData = {
        leagueId: league.leagueId,
        gameTypeId: normalizeGameTypeId(league.gameTypeId) || 'Unknown',
        seasonId: league.seasonId || 'Unknown Season',
        date: formatTimestamp(league.completedAt || league.timestamp || league.lastUpdated),
        leagueMeta: `${formatGameType(normalizeGameTypeId(league.gameTypeId) || 'Unknown')} • ${formatTimestamp(league.completedAt || league.timestamp || league.lastUpdated)}`,
        score: league.score || 0,
        rank: getRankSuffix(league.rank || 0),
        rankValue: league.rank || 999,
        accuracy: league.accuracy ?? league.percentage ?? 0,
        correctPicks: league.correctPicks || 0,
        totalPossible: league.totalPossible || 0,
        isExpanded: !!expandedRows[league.leagueId],
        fullData: league,
        actions: (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/stats/league/${league.leagueId}`}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              League Stats
            </Link>
            <button
              onClick={() => toggleExpand(league.leagueId)}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {expandedRows[league.leagueId] ? 'Collapse' : 'Expand'}
            </button>
          </div>
        )
      };

      if (formatLeagueData && typeof formatLeagueData === 'function') {
        return formatLeagueData(standardLeagueData, league, userDetail);
      }

      return standardLeagueData;
    });
  }, [history, expandedRows, formatLeagueData, userDetail]);

  if (!data) {
    return (
      <div className="bg-gray-50 p-4 rounded-md text-center">
        <p className="text-gray-500">Select a user to view statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {adapterSections}
      {children}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            League History
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            All leagues this user has participated in
          </p>
        </div>

        {leaguesData.length > 0 ? (
          <div>
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="w-[38%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    League
                  </th>
                  <th scope="col" className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th scope="col" className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaguesData.map((league) => (
                  <React.Fragment key={league.leagueId}>
                    <tr>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 break-words">
                        <div>{league.seasonId}</div>
                        <div className="mt-1 text-xs font-normal text-gray-500 break-words">{league.leagueMeta}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 break-words">
                        {formatNumber(league.score)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={classNames(
                          'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                          league.rankValue === 1 ? 'bg-green-100 text-green-800' :
                          league.rankValue === 2 ? 'bg-blue-100 text-blue-800' :
                          league.rankValue === 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        )}>
                          {league.rank}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 break-words">
                        {(league.accuracy * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-4 text-sm font-medium align-top">
                        {league.actions}
                      </td>
                    </tr>

                    {league.isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 bg-gray-50">
                          {typeof expandedRenderer === 'function'
                            ? expandedRenderer(league, data, userDetail)
                            : expandedRenderer || (
                            <div className="p-4 border rounded-md">
                              <h4 className="text-lg font-medium mb-3">Detailed Performance</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="bg-white p-3 rounded shadow-sm">
                                  <h5 className="text-sm font-medium text-gray-500">Correct Picks</h5>
                                  <p className="text-lg font-semibold">
                                    {league.correctPicks} / {league.totalPossible}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded shadow-sm">
                                  <h5 className="text-sm font-medium text-gray-500">Accuracy</h5>
                                  <p className="text-lg font-semibold">
                                    {(league.accuracy * 100).toFixed(1)}%
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded shadow-sm">
                                  <h5 className="text-sm font-medium text-gray-500">Score</h5>
                                  <p className="text-lg font-semibold">
                                    {formatNumber(league.score)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-6 text-gray-500">
            No league history available
          </div>
        )}
      </div>
    </div>
  );
};

export default UserStatsViewShell;

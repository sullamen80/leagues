// src/pages/stats/components/LeaguesTableView.js 
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNumber, classNames, formatDate } from '../../../utils/formatters';
import { normalizeGameTypeId } from '../../../gameTypes';
import { normalizeDateValue, resolveLeagueDetail, formatWinnerLabel } from './statsViewModel';

/**
 * LeaguesTableView Component
 * Displays all leagues in a table format with filtering options
 */
const LeaguesTableView = ({ leagues = [], navigateToStats }) => {
  const navigate = useNavigate();
  const [gameTypeFilter, setGameTypeFilter] = useState('all');
  
  // Extract all unique game types from the leagues
  const gameTypes = useMemo(() => {
    const types = new Set(leagues.map(league => normalizeGameTypeId(league.gameTypeId) || 'unknown'));
    return Array.from(types).sort();
  }, [leagues]);
  
  // Filter leagues based on selected game type
  const filteredLeagues = useMemo(() => {
    if (gameTypeFilter === 'all') {
      return leagues;
    }
    return leagues.filter(league => normalizeGameTypeId(league.gameTypeId) === gameTypeFilter);
  }, [leagues, gameTypeFilter]);

  // Handle navigation to stats page
  const handleStatsClick = (docId) => {
    console.log(`Navigating to stats for league with document ID: ${docId}`);
    
    // Use the provided navigation function from parent component
    if (navigateToStats) {
      navigateToStats(docId);
    } else {
      // Fallback direct navigation if the parent didn't provide a navigation function
      navigate(`/stats/league/${docId}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900">
          Leagues ({filteredLeagues.length})
        </h2>
        
        <div className="flex items-center space-x-2">
          <label htmlFor="gameTypeFilter" className="text-sm font-medium text-gray-700">
            Filter by Game Type:
          </label>
          <select
            id="gameTypeFilter"
            value={gameTypeFilter}
            onChange={(e) => setGameTypeFilter(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Game Types</option>
            {gameTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive table */}
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Season
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Game Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Players
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Winner
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Highest Score
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLeagues.length > 0 ? (
              filteredLeagues.map((league) => {
                // Find the league winner (rank 1) if exists
                const canonicalLeague = resolveLeagueDetail(league);
                const winner = formatWinnerLabel(
                  canonicalLeague.winner ||
                  canonicalLeague.winners?.[0] ||
                  league.winner ||
                  league.metadata?.winner
                );

                const normalizedGameTypeId = normalizeGameTypeId(league.gameTypeId);
                const completedAt = normalizeDateValue(league.completedAt || league.timestamp || league.lastUpdated);
                const summary = canonicalLeague.summary || {};
                const listBadge = league.statsAdapter?.getListBadge?.() || league.adapter?.getListBadge?.() || league.badge || null;
                const highestScore = summary.highestScore ?? league.highestScore ?? league.stats?.highestScore;
                const badgeNode = React.isValidElement(listBadge) ? listBadge : null;
                const badgeLabel = typeof listBadge === 'string'
                  ? listBadge
                  : listBadge?.label || normalizedGameTypeId || 'Unknown';
                const badgeClassName = typeof listBadge === 'object' && listBadge?.className
                  ? listBadge.className
                  : 'bg-gray-100 text-gray-800';

                return (
                  <tr key={league.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {league.seasonId || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {badgeNode || (
                        <span className={classNames(
                          'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                          badgeClassName
                        )}>
                          {badgeLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatNumber(league.playerCount) || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {winner}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {highestScore !== undefined && highestScore !== null ? formatNumber(highestScore) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {completedAt ? formatDate(completedAt, 'short') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleStatsClick(league.id)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          View Stats
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                  No leagues found with the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaguesTableView;

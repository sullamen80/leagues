// src/pages/stats/components/UserStatsViewShell.js
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { classNames, formatNumber, formatDate } from '../../../utils/formatters';

/**
 * User Statistics View Shell Component
 * Base component for displaying user statistics across different game types
 */
const UserStatsViewShell = ({ 
  data,
  extraColumns = [], // Additional columns based on game type
  renderExpandedContent, // Function to render game-type specific expanded content
  formatLeagueData = null, // Function to format league data based on game type
  children // Optional additional content
}) => {
  // State to track expanded league rows
  const [expandedRows, setExpandedRows] = useState({});
  
  // Extract basic stats with defaults
  const { 
    userId = '',
    userName = '',
    stats = {},
    leagues = [] // Use all leagues
  } = data || {};
  
  // Toggle a league's expanded state
  const toggleExpand = (leagueId) => {
    setExpandedRows(prev => ({
      ...prev,
      [leagueId]: !prev[leagueId]
    }));
  };
  
  // Process all league data
  const leaguesData = useMemo(() => {
    if (!leagues || !Array.isArray(leagues) || leagues.length === 0) return [];
        
    // Sort leagues by timestamp (newest first)
    const sortedLeagues = [...leagues].sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB - dateA;
    });

    // Map league data with standard formatting
    const mappedLeagues = sortedLeagues.map((league) => {
      // Format the rank with appropriate suffix (1st, 2nd, 3rd, etc.)
      const getRankSuffix = (rank) => {
        if (rank === 1) return '1st';
        if (rank === 2) return '2nd';
        if (rank === 3) return '3rd';
        return `${rank}th`;
      };
      
      // Handle the case where timestamp might be a Firestore timestamp
      const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown';
        
        // If it's a Firestore timestamp with a toDate method
        if (typeof timestamp.toDate === 'function') {
          return formatDate(timestamp.toDate(), 'short');
        }
        
        // If it's already a Date object or string
        return formatDate(timestamp, 'short');
      };
      
      // Standard league data object
      const standardLeagueData = {
        leagueId: league.leagueId,
        gameTypeId: league.gameTypeId || 'Unknown',
        seasonId: league.seasonId || 'Unknown Season',
        date: formatTimestamp(league.timestamp),
        score: league.score || 0,
        rank: getRankSuffix(league.rank || 0),
        rankValue: league.rank || 999, // For sorting
        accuracy: league.percentage || 0,
        correctPicks: league.correctPicks || 0,
        totalPossible: league.totalPossible || 0,
        isExpanded: !!expandedRows[league.leagueId],
        // Store all league data for the expanded view
        fullData: league,
        // Add action elements (to be rendered in the table)
        actions: (
          <div className="flex space-x-2">
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
      
      // If there's a custom formatter for game type, apply it
      if (formatLeagueData && typeof formatLeagueData === 'function') {
        return formatLeagueData(standardLeagueData, league);
      }
      
      return standardLeagueData;
    });
    
    return mappedLeagues;
  }, [leagues, expandedRows, formatLeagueData]);

  // If no data, show message
  if (!data) {
    return (
      <div className="bg-gray-50 p-4 rounded-md text-center">
        <p className="text-gray-500">Select a user to view statistics</p>
      </div>
    );
  }

  // Render the user stats view
  return (
    <div className="space-y-8">
      {/* Optional content before the table */}
      {children}
      
      {/* Leagues Table with Accordion */}
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    League
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Game Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                  
                  {/* Extra columns based on game type */}
                  {extraColumns.map((column, index) => (
                    <th key={index} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {column.label}
                    </th>
                  ))}
                  
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaguesData.map((league) => (
                  <React.Fragment key={league.leagueId}>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {league.seasonId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {league.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {league.gameTypeId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatNumber(league.score)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={classNames(
                          "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                          league.rankValue === 1 ? "bg-green-100 text-green-800" :
                          league.rankValue === 2 ? "bg-blue-100 text-blue-800" :
                          league.rankValue === 3 ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        )}>
                          {league.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(league.accuracy * 100).toFixed(1)}%
                      </td>
                      
                      {/* Extra column values */}
                      {extraColumns.map((column, index) => (
                        <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {column.render(league)}
                        </td>
                      ))}
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {league.actions}
                      </td>
                    </tr>
                    
                    {/* Expanded Content */}
                    {league.isExpanded && (
                      <tr>
                        <td 
                          colSpan={7 + extraColumns.length} 
                          className="px-6 py-4 bg-gray-50"
                        >
                          {/* Use the custom renderer if provided, otherwise use default */}
                          {renderExpandedContent ? (
                            renderExpandedContent(league)
                          ) : (
                            <div className="p-4 border rounded-md">
                              <h4 className="text-lg font-medium mb-3">Detailed Performance</h4>
                              
                              {/* General Stats */}
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
// src/pages/stats/components/LeagueStatsViewShell.js
import React from 'react';
import { classNames } from '../../../utils/formatters';

/**
 * League Statistics View Shell Component
 * Base shell for displaying league statistics with game-type specific extensions
 */
const LeagueStatsViewShell = ({ 
  data,
  statCards, 
  leaderboardData, 
  extraColumns = [], // Additional columns for specific game types
  renderExpandedContent, // Function to render game-type specific expanded content
  expandedRows = {}, // Current expanded state
  onToggleExpand, // Function to toggle row expansion
  children // Optional additional content
}) => {
  
  // If no data, show message
  if (!data) {
    return (
      <div className="bg-gray-50 p-4 rounded-md text-center">
        <p className="text-gray-500">Select a league to view statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                {card.icon && (
                  <div className={classNames(
                    "flex-shrink-0 rounded-md p-3",
                    card.variant === 'primary' ? 'bg-indigo-100 text-indigo-800' :
                    card.variant === 'info' ? 'bg-blue-100 text-blue-800' :
                    card.variant === 'success' ? 'bg-green-100 text-green-800' :
                    card.variant === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  )}>
                    {card.icon}
                  </div>
                )}
                <div className={card.icon ? "ml-5" : ""}>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {card.title}
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {card.value}
                  </dd>
                  {card.description && (
                    <p className="mt-2 text-sm text-gray-500">
                      {card.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional content (game-type specific sections) */}
      {children}

      {/* Player Leaderboard with Expandable Rows */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Player Leaderboard
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Performance rankings for all participants
          </p>
        </div>

        {leaderboardData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Correct Picks
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
                {leaderboardData.map((player) => (
                  <React.Fragment key={player.userId}>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={classNames(
                          "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                          player.rank === 1 ? "bg-green-100 text-green-800" :
                          player.rank === 2 ? "bg-blue-100 text-blue-800" :
                          player.rank === 3 ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        )}>
                          {player.rank === 99 ? '-' : player.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.formattedScore || player.score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.formattedAccuracy || player.accuracy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.correctPicks} / {player.totalPossible}
                      </td>
                      
                      {/* Extra column values */}
                      {extraColumns.map((column, index) => (
                        <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {column.render(player)}
                        </td>
                      ))}
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {player.actions || (
                          <div className="flex space-x-2">
                            {player.profileLink}
                            <button
                              onClick={() => onToggleExpand(player.userId)}
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                              {expandedRows[player.userId] ? 'Collapse' : 'Expand'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Content */}
                    {expandedRows[player.userId] && (
                      <tr>
                        <td 
                          colSpan={5 + extraColumns.length + 1} 
                          className="px-6 py-4 bg-gray-50"
                        >
                          {renderExpandedContent ? renderExpandedContent(player, data) : null}
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
            No player data available for this league
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueStatsViewShell;
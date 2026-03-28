// src/pages/stats/components/UsersTableView.js
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNumber, classNames, formatDate } from '../../../utils/formatters';

/**
 * UsersTableView Component
 * Displays all users in a table format with filtering options
 */
const UsersTableView = ({ users = [] }) => {
  const navigate = useNavigate();
  const [gameTypeFilter, setGameTypeFilter] = useState('all');
  
  // Extract all unique game types from users' metadata
  const gameTypes = useMemo(() => {
    const types = new Set();
    users.forEach(user => {
      if (user.metadata?.gameTypes && Array.isArray(user.metadata.gameTypes)) {
        user.metadata.gameTypes.forEach(type => types.add(type));
      }
    });
    return Array.from(types).sort();
  }, [users]);
  
  // Filter users based on selected game type
  const filteredUsers = useMemo(() => {
    if (gameTypeFilter === 'all') {
      return users;
    }
    return users.filter(user => 
      user.metadata?.gameTypes && 
      Array.isArray(user.metadata.gameTypes) && 
      user.metadata.gameTypes.includes(gameTypeFilter)
    );
  }, [users, gameTypeFilter]);

  // Stats about the users
  const userStats = useMemo(() => {
    const totalWins = users.reduce((sum, user) => sum + (user.totalWins || 0), 0);
    const totalLeaguesParticipation = users.reduce((sum, user) => sum + (user.totalLeagues || 0), 0);
    
    return {
      totalUsers: users.length,
      averageLeagues: users.length ? (totalLeaguesParticipation / users.length).toFixed(1) : 0,
      totalWins,
      mostActiveUser: users.length ? 
        users.reduce((most, user) => (user.totalLeagues > (most?.totalLeagues || 0)) ? user : most, null)?.userName || 'None' : 'None'
    };
  }, [users]);

  // Handle navigation to user stats page
  const navigateToUserStatsPage = (userId) => {
    navigate(`/stats/user/${userId}`);
  };

  return (
    <div className="space-y-6">
      
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900">
          Users ({filteredUsers.length})
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
                User
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Leagues
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Wins
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Win Rate
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Game Types
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Active
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                // Calculate win rate
                const winRate = user.totalLeagues > 0 
                  ? ((user.totalWins / user.totalLeagues) * 100).toFixed(1) 
                  : '0.0';
                
                // Format game types for display
                const gameTypesDisplay = user.metadata?.gameTypes?.length > 0
                  ? user.metadata.gameTypes.join(', ')
                  : 'None';
                
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-800 font-medium">
                            {user.userName ? user.userName.substring(0, 2).toUpperCase() : '??'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.userName || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.userId ? user.userId.substring(0, 8) + '...' : 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatNumber(user.totalLeagues) || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatNumber(user.totalWins) || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={classNames(
                        "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                        parseFloat(winRate) > 50 ? 'bg-green-100 text-green-800' :
                        parseFloat(winRate) > 25 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      )}>
                        {winRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {gameTypesDisplay}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.metadata?.lastUpdated 
                        ? formatDate(user.metadata.lastUpdated.toDate ? user.metadata.lastUpdated.toDate() : new Date(user.metadata.lastUpdated), 'short') 
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => navigateToUserStatsPage(user.id)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Stats
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                  No users found with the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Show message if no users at all */}
      {users.length === 0 && (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No users found in the database.</p>
        </div>
      )}
    </div>
  );
};

export default UsersTableView;
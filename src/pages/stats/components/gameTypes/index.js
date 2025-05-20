// src/pages/stats/gametypes/index.js
import React from 'react';
import { classNames, formatNumber } from '../../../../utils/formatters';
import { Link } from 'react-router-dom';

// Import March Madness implementations
import MarchMadnessLeagueView from './marchMadness/MarchMadnessLeagueView';
import MarchMadnessUserView from './marchMadness/MarchMadnessUserView';

// Import NBA Playoffs implementations
import NBAPlayoffsLeagueView from './nbaPlayoffs/NBAPlayoffsLeagueView';
import NBAPlayoffsUserView from './nbaPlayoffs/NBAPlayoffsUserView';

/**
 * Data structure adapter to ensure compatibility between different formats
 * This normalizes player data to work with all renderers
 */
const adaptPlayerData = (player) => {
  // Don't modify if already processed
  if (player._adapted) return player;
  
  // Create a compatible data structure that works with both formats
  const adapted = {
    ...player,
    _adapted: true
  };
  
  // Ensure fullData exists
  if (!adapted.fullData) {
    adapted.fullData = {};
  }
  
  // If roundBreakdown exists at the top level but not in fullData, copy it
  if (adapted.roundBreakdown && !adapted.fullData.roundBreakdown) {
    adapted.fullData.roundBreakdown = adapted.roundBreakdown;
  }
  
  // If it's in fullData but not at the top level, copy it to the top level
  if (!adapted.roundBreakdown && adapted.fullData.roundBreakdown) {
    adapted.roundBreakdown = adapted.fullData.roundBreakdown;
  }
  
  // Handle other commonly used properties
  ['finalsMVPPick', 'finalsMVPCorrect', 'championPick', 'championCorrect'].forEach(prop => {
    if (adapted[prop] && !adapted.fullData[prop]) {
      adapted.fullData[prop] = adapted[prop];
    } else if (!adapted[prop] && adapted.fullData[prop]) {
      adapted[prop] = adapted.fullData[prop];
    }
  });
  
  return adapted;
};

/**
 * Create a wrapper around a renderer function that handles data normalization
 */
const createRendererWrapper = (renderer) => {
  if (!renderer) return null;
  
  return (player, data) => {
    // Adapt the player data to ensure compatibility
    const adaptedPlayer = adaptPlayerData(player);
    return renderer(adaptedPlayer, data);
  };
};

// Default implementation for unknown game types
const defaultImplementation = {
  // Renderer for expanded content in league view
  renderLeagueExpandedContent: (player, leagueData) => {
    return (
      <div className="p-4 border rounded-md">
        <h4 className="text-lg font-medium mb-3">Detailed Performance</h4>
        
        {/* General Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Correct Picks</h5>
            <p className="text-lg font-semibold">
              {player.correctPicks} / {player.totalPossible}
            </p>
          </div>
          
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Accuracy</h5>
            <p className="text-lg font-semibold">
              {(player.percentage * 100).toFixed(1)}%
            </p>
          </div>
          
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Score</h5>
            <p className="text-lg font-semibold">
              {formatNumber(player.score)}
            </p>
          </div>
        </div>
        
        {/* Round-by-Round Accuracy */}
        {player.roundAccuracy && Object.keys(player.roundAccuracy).length > 0 && (
          <>
            <h5 className="font-medium text-gray-700 mb-2 mt-4">Round-by-Round Performance</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Round
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Correct
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accuracy
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(player.roundAccuracy).map(([round, data]) => (
                    <tr key={round}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {round}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {data.correctPicks}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {data.possiblePicks}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className="mr-2">{(data.percentage * 100).toFixed(1)}%</span>
                          <div className="w-24 bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={classNames(
                                "h-2.5 rounded-full",
                                data.percentage >= 0.7 ? "bg-green-600" :
                                data.percentage >= 0.5 ? "bg-blue-600" :
                                data.percentage >= 0.3 ? "bg-yellow-500" : "bg-red-600"
                              )}
                              style={{ width: `${data.percentage * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  },

  // Renderer for expanded content in user view
  renderUserExpandedContent: (league) => {
    return (
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
        
        {/* Round-by-Round Accuracy */}
        {league.fullData.roundAccuracy && (
          <>
            <h5 className="font-medium text-gray-700 mb-2 mt-4">Round-by-Round Performance</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Round
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Correct
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accuracy
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(league.fullData.roundAccuracy).map(([round, data]) => (
                    <tr key={round}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {round}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {data.correctPicks}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {data.possiblePicks}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className="mr-2">{(data.percentage * 100).toFixed(1)}%</span>
                          <div className="w-24 bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={classNames(
                                "h-2.5 rounded-full",
                                data.percentage >= 0.7 ? "bg-green-600" :
                                data.percentage >= 0.5 ? "bg-blue-600" :
                                data.percentage >= 0.3 ? "bg-yellow-500" : "bg-red-600"
                              )}
                              style={{ width: `${data.percentage * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  },

  // Extra columns for league view
  leagueExtraColumns: [],

  // Extra columns for user view
  userExtraColumns: [],

  // Custom stat cards for league view
  getCustomStatCards: null,

  // Custom renderer for additional content
  renderAdditionalContent: null,

  // Format player data for league view
  formatPlayerData: null,

  // Format league data for user view
  formatLeagueData: null
};

// NBA Playoffs implementation
const nbaPlayoffsImplementation = {
  // League view implementations
  renderLeagueExpandedContent: NBAPlayoffsLeagueView.renderLeagueExpandedContent,
  renderAdditionalContent: NBAPlayoffsLeagueView.renderAdditionalContent,
  leagueExtraColumns: NBAPlayoffsLeagueView.leagueExtraColumns,
  
  // User view implementations
  renderUserExpandedContent: NBAPlayoffsUserView.renderUserExpandedContent,
  userExtraColumns: NBAPlayoffsUserView.userExtraColumns,
  formatLeagueData: NBAPlayoffsUserView.formatLeagueData,
  
  // Custom game type cell renderer for the leagues table
  renderGameTypeCell: (league) => (
    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
      NBA Playoffs
    </span>
  )
};

// March Madness implementation
const marchMadnessImplementation = {
  // League view implementations
  renderLeagueExpandedContent: MarchMadnessLeagueView.renderLeagueExpandedContent,
  renderAdditionalContent: MarchMadnessLeagueView.renderAdditionalContent,
  leagueExtraColumns: MarchMadnessLeagueView.leagueExtraColumns,
  
  // User view implementations
  renderUserExpandedContent: MarchMadnessUserView.renderUserExpandedContent,
  userExtraColumns: MarchMadnessUserView.userExtraColumns,
  formatLeagueData: MarchMadnessUserView.formatLeagueData,
  
  // Custom game type cell renderer for the leagues table
  renderGameTypeCell: (league) => (
    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
      March Madness
    </span>
  )
};

// Registry of all game type implementations
const gameTypeImplementations = {
  default: defaultImplementation,
  nbaPlayoffs: nbaPlayoffsImplementation,
  marchMadness: marchMadnessImplementation
};

/**
 * Get a game type implementation by ID
 * @param {string} gameTypeId - The game type identifier
 * @returns {Object} The game type implementation or default if not found
 */
export const getGameTypeImplementation = (gameTypeId) => {
  if (!gameTypeId || !gameTypeImplementations[gameTypeId]) {
    return gameTypeImplementations.default;
  }
  
  return gameTypeImplementations[gameTypeId];
};

/**
 * Get league view renderer for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @returns {Function} The renderer function
 */
export const getLeagueViewRenderer = (gameTypeId) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  const renderer = implementation.renderLeagueExpandedContent || null;
  
  if (!renderer) {
    return null;
  }
  
  return createRendererWrapper(renderer);
};

/**
 * Get user view renderer for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @returns {Function} The renderer function
 */
export const getUserViewRenderer = (gameTypeId) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  const renderer = implementation.renderUserExpandedContent || null;
  
  if (!renderer) {
    return null;
  }
  
  return createRendererWrapper(renderer);
};

/**
 * Get extra league columns for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @returns {Array} Array of column definitions
 */
export const getLeagueExtraColumns = (gameTypeId) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  return implementation.leagueExtraColumns || [];
};

/**
 * Get extra user columns for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @returns {Array} Array of column definitions
 */
export const getUserExtraColumns = (gameTypeId) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  return implementation.userExtraColumns || [];
};

/**
 * Get league data formatter for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @returns {Function} The formatter function
 */
export const getLeagueDataFormatter = (gameTypeId) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  return implementation.formatLeagueData || null;
};

/**
 * Get player data formatter for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @returns {Function} The formatter function
 */
export const getPlayerDataFormatter = (gameTypeId) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  return implementation.formatPlayerData || null;
};

/**
 * Get custom stats cards for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @param {Object} data - The league or user data
 * @returns {Array} Array of stat card definitions
 */
export const getCustomStatCards = (gameTypeId, data) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  if (implementation.getCustomStatCards) {
    return implementation.getCustomStatCards(data);
  }
  return null;
};

/**
 * Get additional content sections for a specific game type
 * @param {string} gameTypeId - The game type identifier
 * @param {Object} data - The league or user data
 * @returns {React.ReactNode} Additional content to render
 */
export const getAdditionalContent = (gameTypeId, data) => {
  const implementation = getGameTypeImplementation(gameTypeId);
  if (implementation.renderAdditionalContent) {
    return implementation.renderAdditionalContent(data);
  }
  return null;
};

export default gameTypeImplementations;
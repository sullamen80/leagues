// src/pages/stats/gametypes/nbaPlayoffs/NBAPlayoffsLeagueView.js
import React from 'react';
import { classNames, formatNumber } from '../../../../../utils/formatters';

/**
 * NBA Playoffs specific implementation for league expanded view
 */
const NBAPlayoffsLeagueView = {
  /**
   * Render expanded content for a player in the league view
   * @param {Object} player - Player data
   * @param {Object} leagueData - Full league data
   * @returns {JSX.Element} React component for expanded content
   */
  renderLeagueExpandedContent: (player, leagueData) => {
    const { nbaPlayoffsStats = {} } = leagueData;
    
    // Get player's round data
    const roundBreakdown = player.fullData?.roundBreakdown || {};
    
    // NBA Playoffs rounds in order
    const roundOrder = [
      'Play In Tournament',
      'First Round',
      'Conference Semifinals', 
      'Conference Finals',
      'NBA Finals'
    ];
    
    // Calculate total points breakdown
    const basePoints = Object.values(roundBreakdown).reduce(
      (sum, round) => sum + (round.basePoints || 0), 
      0
    );
    
    const seriesLengthPoints = Object.values(roundBreakdown).reduce(
      (sum, round) => sum + (round.seriesLengthPoints || 0), 
      0
    );
    
    const upsetPoints = Object.values(roundBreakdown).reduce(
      (sum, round) => sum + (round.upsetPoints || 0), 
      0
    );
    
    return (
      <div className="p-4 border rounded-md">
        <h4 className="text-lg font-medium mb-3">NBA Playoffs Performance</h4>
        
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
            <h5 className="text-sm font-medium text-gray-500">Total Score</h5>
            <p className="text-lg font-semibold">
              {formatNumber(player.score)}
              <span className="text-sm font-normal text-gray-500 ml-1">
                (Base: {basePoints || 0}, Series: {seriesLengthPoints || 0}, Upsets: {upsetPoints || 0})
              </span>
            </p>
          </div>
        </div>
        
        {/* Special Picks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Champion Pick</h5>
            <p className={classNames(
              "text-lg font-semibold",
              player.championCorrect ? "text-green-600" : "text-gray-700"
            )}>
              {player.championPick || 'None'}
              {player.championCorrect && " ✓"}
            </p>
            {!player.championCorrect && nbaPlayoffsStats.champion && (
              <p className="text-sm text-gray-500">
                Actual Champion: <span className="font-medium">{nbaPlayoffsStats.champion}</span>
              </p>
            )}
          </div>
          
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Finals MVP Pick</h5>
            <p className={classNames(
              "text-lg font-semibold",
              player.fullData?.finalsMVPCorrect ? "text-green-600" : "text-gray-700"
            )}>
              {player.fullData?.finalsMVPPick || player.finalsMVPPick || 'None'}
              {player.fullData?.finalsMVPCorrect && " ✓"}
            </p>
            {!(player.fullData?.finalsMVPCorrect || player.finalsMVPCorrect) && nbaPlayoffsStats.finalsMVP && (
              <p className="text-sm text-gray-500">
                Actual Finals MVP: <span className="font-medium">{nbaPlayoffsStats.finalsMVP}</span>
              </p>
            )}
          </div>
        </div>
        
        {/* Round-by-Round Breakdown */}
        <h5 className="font-medium text-gray-700 mb-2 mt-4">Round-by-Round Performance</h5>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Round
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Correct Picks
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Points
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Series Points
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roundOrder.map(round => {
                // Get data for this round
                const roundData = roundBreakdown[round] || {};
                const correctPicks = roundData.correctPicks || 0;
                const possiblePoints = roundData.possiblePoints || 0;
                const basePoints = roundData.basePoints || 0;
                const seriesLengthPoints = roundData.seriesLengthPoints || 0;
                const upsetPoints = roundData.upsetPoints || 0;
                const totalPoints = roundData.totalPoints || 0;
                
                // Skip rounds with no data
                if (!roundData.correctPicks && !roundData.possiblePoints) return null;
                
                return (
                  <tr key={round}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {round}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {correctPicks} / {possiblePoints / 2}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {basePoints}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {seriesLengthPoints}
                      {roundData.seriesLengthCorrect > 0 && (
                        <span className="text-xs text-green-600 ml-1">
                          ({roundData.seriesLengthCorrect} correct)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {totalPoints}
                      {upsetPoints > 0 && (
                        <span className="text-xs text-green-600 ml-1">
                          (incl. +{upsetPoints} upset bonus)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {/* Finals MVP as special case */}
              {roundBreakdown['Finals MVP'] && (
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                    Finals MVP
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    {roundBreakdown['Finals MVP'].correctPrediction ? '1 / 1' : '0 / 1'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    {roundBreakdown['Finals MVP'].basePoints}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    -
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                    {roundBreakdown['Finals MVP'].totalPoints}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
      </div>
    );
  },
  
  /**
   * Render additional content for NBA Playoffs league view
   * @param {Object} leagueData - League data
   * @returns {JSX.Element} React component for additional content
   */
  renderAdditionalContent: (leagueData) => {
    const { nbaPlayoffsStats = {}, roundStats = {} } = leagueData;
    
    if (!nbaPlayoffsStats) return null;
    
    return (
      <div className="mb-8">
        {/* Playoffs Overview Section */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-5 sm:px-6 bg-purple-50">
            <h3 className="text-lg leading-6 font-medium text-purple-800">
              Playoffs Overview
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-purple-600">
              NBA Playoffs {leagueData.seasonId} Results
            </p>
          </div>
          
          <div className="p-6">
            {/* Champion and Finals MVP */}
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-800 mb-4">Playoff Results</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Champion */}
                {nbaPlayoffsStats.champion && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-medium text-gray-500">NBA Champion</span>
                        <span className="text-xl font-bold text-gray-900">{nbaPlayoffsStats.champion}</span>
                      </div>
                      <div className="h-16 w-16 flex items-center justify-center bg-yellow-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Finals MVP */}
                {nbaPlayoffsStats.finalsMVP && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-medium text-gray-500">Finals MVP</span>
                        <span className="text-xl font-bold text-gray-900">{nbaPlayoffsStats.finalsMVP}</span>
                      </div>
                      <div className="h-16 w-16 flex items-center justify-center bg-purple-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Round Stats */}
            {roundStats && Object.keys(roundStats).length > 0 && (
              <div className="mt-6">
                <h4 className="text-base font-semibold text-gray-800 mb-4">Round Statistics</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Round
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Correct Picks
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Picks
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Accuracy
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(roundStats)
                        .filter(([_, data]) => data) // Filter out any undefined entries
                        .map(([round, data]) => (
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
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        
          </div>
        </div>
      </div>
    );
  },
  
  /**
   * Extra columns for NBA Playoffs league view
   */
  leagueExtraColumns: [
    {
      key: 'championPick',
      label: 'Champion Pick',
      render: (player) => (
        <span className={classNames(
          player.championCorrect ? "text-green-600 font-medium" : "text-gray-600"
        )}>
          {player.championPick || 'None'}
          {player.championCorrect && " ✓"}
        </span>
      )
    },
    {
      key: 'finalsMVPPick',
      label: 'Finals MVP',
      render: (player) => (
        <span className={classNames(
          (player.fullData?.finalsMVPCorrect || player.finalsMVPCorrect) ? 
            "text-green-600 font-medium" : "text-gray-600"
        )}>
          {player.fullData?.finalsMVPPick || player.finalsMVPPick || 'None'}
          {(player.fullData?.finalsMVPCorrect || player.finalsMVPCorrect) && " ✓"}
        </span>
      )
    }
  ]
};

export default NBAPlayoffsLeagueView;
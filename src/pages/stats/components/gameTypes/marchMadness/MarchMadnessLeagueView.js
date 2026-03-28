// src/pages/stats/gametypes/marchMadness/MarchMadnessLeagueView.js
import React from 'react';
import { classNames, formatNumber } from '../../../../../utils/formatters';

/**
 * March Madness specific implementation for league expanded view
 */
const MarchMadnessLeagueView = {
  /**
   * Render expanded content for a player in the league view
   * @param {Object} player - Player data
   * @param {Object} leagueData - Full league data
   * @returns {JSX.Element} React component for expanded content
   */
  renderLeagueExpandedContent: (player, leagueData) => {
    const { marchMadnessStats = {} } = leagueData;
    
    // Debug output to verify data structure
    console.log("Player data:", player);
    console.log("Round breakdown data:", player.roundBreakdown || player.fullData?.roundBreakdown);
    
    // Get player's round data - check both possible locations
    const roundBreakdown = player.roundBreakdown || player.fullData?.roundBreakdown || {};
    
    // NCAA tournament rounds in order
    const roundOrder = [
      'RoundOf64',
      'RoundOf32', 
      'Sweet16', 
      'Elite8', 
      'FinalFour', 
      'Championship'
    ];
    
    // Format round names for display
    const formatRoundName = (round) => {
      switch (round) {
        case 'RoundOf64': return 'Round of 64';
        case 'RoundOf32': return 'Round of 32';
        case 'Sweet16': return 'Sweet 16';
        case 'Elite8': return 'Elite 8';
        case 'FinalFour': return 'Final Four';
        case 'Championship': return 'Championship';
        default: return round;
      }
    };
    
    // Calculate total base and bonus points
    const totalBase = Object.values(roundBreakdown).reduce(
      (sum, round) => sum + (round.base || 0), 
      0
    );
    
    const totalBonus = Object.values(roundBreakdown).reduce(
      (sum, round) => sum + (round.bonus || 0), 
      0
    );
    
    return (
      <div className="p-4 border rounded-md">
        <h4 className="text-lg font-medium mb-3">March Madness Performance</h4>
        
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
              {totalBonus > 0 && (
                <span className="text-sm text-gray-500 ml-1">
                  (Base: {totalBase}, Bonus: {totalBonus})
                </span>
              )}
            </p>
          </div>
        </div>
        
        {/* Champion Pick */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <h5 className="text-base font-medium text-gray-700 mb-2">Champion Pick</h5>
          <div className="flex items-center">
            <div 
              className={classNames(
                "px-4 py-2 rounded-md text-white font-medium inline-flex items-center",
                player.championCorrect ? "bg-green-600" : "bg-gray-600"
              )}
            >
              {player.championPick || 'None Selected'}
              {player.championCorrect && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {player.championCorrect && (
              <span className="ml-3 text-green-600 font-medium">Correct! +32 points</span>
            )}
          </div>
          
          {/* Show actual champion if pick was incorrect */}
          {!player.championCorrect && marchMadnessStats.champion && (
            <p className="mt-2 text-sm text-gray-500">
              Actual Champion: <span className="font-medium">{marchMadnessStats.champion}</span>
            </p>
          )}
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
                  Correct
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Accuracy
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roundOrder.map(round => {
                // Define point values per round
                const pointValues = {
                  'RoundOf64': 1,
                  'RoundOf32': 2,
                  'Sweet16': 4,
                  'Elite8': 8,
                  'FinalFour': 16,
                  'Championship': 32
                };
                
                // Get data for this round
                const data = roundBreakdown[round];
                
                // Debug output for each round
                console.log(`Round ${round} data:`, data);
                
                // Skip if no data for this round
                if (!data) return null;
                
                // Calculate the real number of games
                const pointValue = pointValues[round] || 1;
                const correct = data.correct || 0;
                const totalGames = round === 'Championship' ? 1 : Math.round((data.possible || 0) / pointValue);
                const percentage = totalGames > 0 ? correct / totalGames : 0;
                
                // Debug calculations
                console.log(`Round ${round} calculations:`, { 
                  pointValue, correct, totalGames, percentage,
                  calculatedWidth: `${percentage * 100}%`
                });
                
                return (
                  <tr key={round}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatRoundName(round)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {correct}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {totalGames}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {data.total || 0}
                      {data.bonus > 0 && (
                        <span className="text-xs text-green-600 ml-1">
                          (+{data.bonus} bonus)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-2">{(percentage * 100).toFixed(1)}%</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={classNames(
                              "h-2.5 rounded-full",
                              percentage >= 0.7 ? "bg-green-600" :
                              percentage >= 0.5 ? "bg-blue-600" :
                              percentage >= 0.3 ? "bg-yellow-500" : "bg-red-600"
                            )}
                            style={{ width: `${percentage * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    );
  },
  
  /**
   * Render additional content for March Madness league view
   * @param {Object} leagueData - League data
   * @returns {JSX.Element} React component for additional content
   */
  renderAdditionalContent: (leagueData) => {
    const { marchMadnessStats = {}, seedPerformance = {}, upsetStats = {} } = leagueData;
    
    if (!marchMadnessStats) return null;
    
    return (
      <div className="mb-8">
        {/* Tournament Overview Section */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-5 sm:px-6 bg-indigo-50">
            <h3 className="text-lg leading-6 font-medium text-indigo-800">
              Tournament Overview
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-indigo-600">
              March Madness {marchMadnessStats.year || leagueData.seasonId} Results
            </p>
          </div>
          
          <div className="p-6">
            {/* Champion and Final Four */}
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-800 mb-4">Tournament Results</h4>
              
              {/* Champion */}
              {marchMadnessStats.champion && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Champion</span>
                      <span className="text-xl font-bold text-gray-900">{marchMadnessStats.champion}</span>
                    </div>
                    <div className="h-16 w-16 flex items-center justify-center bg-yellow-100 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Final Four */}
              {marchMadnessStats.finalFourTeams && marchMadnessStats.finalFourTeams.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Final Four Teams</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {marchMadnessStats.finalFourTeams.map((team, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                        <span className="block text-sm text-gray-500">
                          {team.region && `${team.region} Region`}
                        </span>
                        <span className="block text-lg font-semibold text-gray-900">
                          {team.name}
                        </span>
                        {team.seed && (
                          <span className="inline-block mt-1 px-2 py-1 bg-gray-200 rounded-full text-xs font-medium text-gray-800">
                            Seed {team.seed}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Upsets Stats */}
            {upsetStats && upsetStats.totalUpsets > 0 && (
              <div className="mt-6">
                <h4 className="text-base font-semibold text-gray-800 mb-4">Upset Statistics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Total Upsets Card */}
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="block text-sm font-medium text-gray-500">Total Upsets</span>
                        <span className="text-2xl font-bold text-purple-700">{upsetStats.totalUpsets}</span>
                      </div>
                      <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Upsets by Round */}
                  {upsetStats.upsetsByRound && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Upsets by Round</h5>
                      <div className="space-y-2">
                        {Object.entries(upsetStats.upsetsByRound).map(([round, count]) => (
                          count > 0 && (
                            <div key={round} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">
                                {round === 'RoundOf64' ? 'Round of 64' : 
                                 round === 'RoundOf32' ? 'Round of 32' : 
                                 round === 'Sweet16' ? 'Sweet 16' :
                                 round === 'Elite8' ? 'Elite 8' :
                                 round === 'FinalFour' ? 'Final Four' :
                                 round === 'Championship' ? 'Championship' : round}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {count} {count === 1 ? 'upset' : 'upsets'}
                              </span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Seed Performance */}
            {seedPerformance && Object.keys(seedPerformance).length > 0 && (
              <div className="mt-6">
                <h4 className="text-base font-semibold text-gray-800 mb-4">Seed Performance</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seed
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Win Rate
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Furthest Round
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          W-L
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(seedPerformance)
                        .filter(([_, data]) => data) // Filter out any undefined entries
                        .sort(([seedA], [seedB]) => parseInt(seedA) - parseInt(seedB)) // Sort by seed number
                        .map(([seed, data]) => (
                          <tr key={seed}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              {seed}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {data.winRate ? `${(data.winRate * 100).toFixed(1)}%` : 'N/A'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {data.furthestRound === 'Champion' ? (
                                <span className="text-yellow-600 font-medium">Champion</span>
                              ) : data.furthestRound || 'N/A'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {data.wins || 0}-{data.losses || 0}
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
   * Extra columns for March Madness league view
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
    }
  ]
};

export default MarchMadnessLeagueView;
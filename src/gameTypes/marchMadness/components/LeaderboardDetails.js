// LeaderboardDetails.jsx
import React, { useState } from 'react';
import { FaMedal, FaCheckCircle, FaTimesCircle, FaUsers, FaChartBar, FaInfoCircle } from 'react-icons/fa';
import BracketComparison from './BracketComparison';

const LeaderboardDetails = ({ 
  player, 
  scoringSettings, 
  allPlayers = [], 
  referenceData = {} 
}) => {
  // State for active tab
  const [activeTab, setActiveTab] = useState('summary');

  // Default points configuration if settings not provided
  const defaultPoints = {
    'RoundOf64': 1,
    'RoundOf32': 2,
    'Sweet16': 4,
    'Elite8': 8,
    'FinalFour': 16,
    'Championship': 32
  };

  // Helper function to map round key to the correct scoring setting key
  const getPointValueForRound = (roundKey) => {
    if (!scoringSettings) return defaultPoints[roundKey];
    
    // Convert keys like 'RoundOf64' to 'roundOf64' for settings lookup
    const settingKey = roundKey.charAt(0).toLowerCase() + roundKey.slice(1);
    return scoringSettings[settingKey] || defaultPoints[roundKey];
  };

  // Calculate completed games for accuracy
  const getCompletedGamesCount = (referenceData) => {
    let completedGames = 0;
    
    // Check each round for completed games
    ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour'].forEach(round => {
      if (Array.isArray(referenceData[round])) {
        referenceData[round].forEach(match => {
          if (match && match.winner) {
            completedGames++;
          }
        });
      }
    });
    
    // Check Championship game
    if (referenceData.Championship?.winner) {
      completedGames++;
    }
    
    return completedGames;
  };
  
  // Get total number of completed games in the tournament
  const totalCompletedGames = getCompletedGamesCount(referenceData);
  
  // Calculate player's accuracy based on completed games only
  const correctPercentage = totalCompletedGames > 0 
    ? ((player.correctPicks / totalCompletedGames) * 100).toFixed(1) 
    : 0;
  
  // Get round-specific stats including completed games and total possible games
  const roundStats = {};
  const totalGamesByRound = {
    'RoundOf64': 32,
    'RoundOf32': 16,
    'Sweet16': 8,
    'Elite8': 4,
    'FinalFour': 2,
    'Championship': 1
  };
  
  Object.entries(player.roundBreakdown || {}).forEach(([round, data]) => {
    const completedGamesInRound = round === 'Championship' 
      ? (referenceData[round]?.winner ? 1 : 0)
      : Array.isArray(referenceData[round]) 
        ? referenceData[round].filter(match => match && match.winner).length 
        : 0;
    
    // Calculate accuracy based on total possible games in the round (not just completed games)
    const totalPossibleInRound = totalGamesByRound[round] || 0;
    const roundAccuracy = totalPossibleInRound > 0 
      ? ((data.correct / totalPossibleInRound) * 100).toFixed(0) 
      : 0;
      
    roundStats[round] = {
      completedGames: completedGamesInRound,
      totalGames: totalPossibleInRound,
      accuracy: roundAccuracy,
      pointValue: getPointValueForRound(round)
    };
  });
  
  // Calculate total possible picks (traditional way, for reference)
  const totalPossiblePicks = Object.entries(player.roundBreakdown || {}).reduce((sum, [roundKey, round]) => {
    const pointValue = getPointValueForRound(roundKey);
    return sum + Math.floor(round.possible / (pointValue || 1));
  }, 0);
  
  // Calculate overall accuracy based on all possible games (63)
  const overallAccuracy = ((player.correctPicks / 63) * 100).toFixed(1);
  
  // Calculate averages if we have all players
  const avgPoints = allPlayers.length > 0 
    ? (allPlayers.reduce((sum, p) => sum + p.points, 0) / allPlayers.length).toFixed(1)
    : null;
  
  const avgCorrectPicks = allPlayers.length > 0
    ? (allPlayers.reduce((sum, p) => sum + p.correctPicks, 0) / allPlayers.length).toFixed(1)
    : null;
  
  // Find the leader's stats
  const leader = allPlayers.length > 0 ? allPlayers[0] : null;
  
  // Find completed rounds
  const completedRounds = referenceData ? Object.keys(referenceData)
    .filter(key => ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'].includes(key))
    .filter(round => {
      if (round === 'Championship') return referenceData[round]?.winner;
      return Array.isArray(referenceData[round]) && referenceData[round].some(match => match && match.winner);
    }) : [];

  // Helper function to get formatted round display names
  const getRoundDisplayName = (roundKey) => {
    const displayNames = {
      'RoundOf64': 'Round of 64',
      'RoundOf32': 'Round of 32',
      'Sweet16': 'Sweet 16',
      'Elite8': 'Elite 8',
      'FinalFour': 'Final Four',
      'Championship': 'Championship'
    };
    return displayNames[roundKey] || roundKey;
  };

  // We've removed the bracket similarity calculation functionality
  // as it's no longer needed for the interface

  // Render the player header and basic info  
  const renderPlayerHeader = () => (
    <div className="bg-indigo-100 dark:bg-indigo-800 p-3 rounded-lg">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{player.name}</h3>
          {player.rank && (
            <div className="flex items-center mt-1">
              {player.rank <= 3 && (
                <FaMedal className={`mr-1 ${
                  player.rank === 1 ? "text-yellow-600 dark:text-yellow-300" : 
                  player.rank === 2 ? "text-gray-500 dark:text-gray-300" : "text-amber-700 dark:text-amber-400"
                }`} />
              )}
              <span className="font-semibold text-indigo-700 dark:text-indigo-200">
                Rank: {player.rank}
              </span>
            </div>
          )}
        </div>
        {player.lastUpdated && (
          <div className="text-xs text-gray-700 dark:text-gray-200">
            Updated: {player.lastUpdated.toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );

  // Render score summary section
  const renderScoreSummary = () => (
    <div className="bg-gray-100 dark:bg-gray-800 p-2 sm:p-3 rounded-lg">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div>
          <p className="text-gray-700 dark:text-gray-200 text-xs">Total</p>
          <p className="text-base sm:text-lg font-bold text-indigo-700 dark:text-indigo-200">{parseFloat(player.points).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-gray-700 dark:text-gray-200 text-xs">Base</p>
          <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">{parseFloat(player.basePoints).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-gray-700 dark:text-gray-200 text-xs">Correct</p>
          <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">{player.correctPicks}</p>
          {totalCompletedGames > 0 && (
            <p className="text-xs text-gray-700 dark:text-gray-200">of {totalCompletedGames} played</p>
          )}
        </div>
        <div>
          <p className="text-gray-700 dark:text-gray-200 text-xs">Accuracy</p>
          <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">{correctPercentage}%</p>
          <p className="text-xs text-gray-700 dark:text-gray-200">on played games</p>
        </div>
        {player.bonusPoints > 0 && (
          <div className="col-span-1 sm:col-span-2">
            <p className="text-gray-700 dark:text-gray-200 text-xs">Bonus</p>
            <p className="text-sm sm:text-base font-semibold text-green-700 dark:text-green-200">+{parseFloat(player.bonusPoints).toFixed(1)}</p>
          </div>
        )}
      </div>
    </div>
  );

  // Render tabs
  const renderTabs = () => (
    <div className="border-b border-gray-300 dark:border-gray-600 mb-3">
      <ul className="flex flex-wrap -mb-px text-xs font-medium text-center">
        <li className="mr-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`inline-flex items-center p-2 sm:p-3 border-b-2 rounded-t-lg ${
              activeTab === 'summary'
                ? 'text-indigo-700 border-indigo-700 dark:text-indigo-200 dark:border-indigo-300'
                : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-400 dark:text-gray-300 dark:hover:text-gray-200'
            }`}
          >
            <FaChartBar className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
            Summary
          </button>
        </li>
        <li className="mr-2">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`inline-flex items-center p-2 sm:p-3 border-b-2 rounded-t-lg ${
              activeTab === 'comparison'
                ? 'text-indigo-700 border-indigo-700 dark:text-indigo-200 dark:border-indigo-300'
                : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-400 dark:text-gray-300 dark:hover:text-gray-200'
            }`}
          >
            <FaUsers className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
            Outlook
          </button>
        </li>
        <li>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`inline-flex items-center p-2 sm:p-3 border-b-2 rounded-t-lg ${
              activeTab === 'breakdown'
                ? 'text-indigo-700 border-indigo-700 dark:text-indigo-200 dark:border-indigo-300'
                : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-400 dark:text-gray-300 dark:hover:text-gray-200'
            }`}
          >
            <FaInfoCircle className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
            Rounds
          </button>
        </li>
      </ul>
    </div>
  );
  
  // Render Comparison tab content
  const renderComparisonTab = () => (
    <div className="space-y-3 sm:space-y-4">
      {/* Bracket Comparison Component */}
      <BracketComparison 
        player={player}
        allPlayers={allPlayers}
        scoringSettings={scoringSettings}
        referenceData={referenceData}
      />
    </div>
  );

  // Render the comparison stats  
  const renderSummaryTab = () => (
    <div className="space-y-3 sm:space-y-4">
      {/* Comparison stats with enhanced contrast */}
      {(avgPoints || leader) && (
        <div className="bg-blue-100 dark:bg-blue-800 p-2 sm:p-3 rounded-lg">
          <h3 className="font-semibold mb-2 text-blue-800 dark:text-gray-100 text-sm sm:text-base">Comparison</h3>
          <div className="grid grid-cols-2 gap-2">
            {avgPoints && (
              <>
                <div>
                  <p className="text-gray-700 dark:text-gray-200 text-xs">League Avg. Points</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{avgPoints}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">
                    {player.points > avgPoints 
                      ? `+${(player.points - avgPoints).toFixed(1)} above avg`
                      : player.points < avgPoints 
                        ? `-${(avgPoints - player.points).toFixed(1)} below avg`
                        : 'At average'}
                  </p>
                </div>
                
                <div>
                  <p className="text-gray-700 dark:text-gray-200 text-xs">League Avg. Correct</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{avgCorrectPicks}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">
                    {player.correctPicks > avgCorrectPicks 
                      ? `+${(player.correctPicks - avgCorrectPicks).toFixed(1)} above avg`
                      : player.correctPicks < avgCorrectPicks 
                        ? `-${(avgCorrectPicks - player.correctPicks).toFixed(1)} below avg`
                        : 'At average'}
                  </p>
                </div>
              </>
            )}
            
            {leader && player.id !== leader.id && (
              <>
                <div>
                  <p className="text-gray-700 dark:text-gray-200 text-xs">Points to Leader</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    -{(leader.points - player.points).toFixed(1)}
                  </p>
                </div>
                
                <div>
                  <p className="text-gray-700 dark:text-gray-200 text-xs">Correct Picks vs Leader</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    -{(leader.correctPicks - player.correctPicks)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Removed uniqueness preview section */}

      {/* Scoring system info with improved contrast */}
      <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-lg border border-yellow-300 dark:border-yellow-600">
        <h4 className="font-semibold text-yellow-800 dark:text-gray-100 mb-1 text-sm">Scoring</h4>
        <p className="text-yellow-800 dark:text-gray-100 text-xs whitespace-pre-wrap">
          {scoringSettings ? (
            `R64: ${scoringSettings.roundOf64}, R32: ${scoringSettings.roundOf32}, S16: ${scoringSettings.sweet16}\n` +
            `E8: ${scoringSettings.elite8}, F4: ${scoringSettings.finalFour}, Champ: ${scoringSettings.championship}` +
            (scoringSettings.bonusEnabled ? 
              `\nUpset: ${scoringSettings.bonusType === 'seedDifference' ? 
                `${scoringSettings.bonusPerSeedDifference}/seed` : 
                `${scoringSettings.flatBonusValue} flat`}` 
              : '')
          ) : (
            "Standard:\nR64: 1, R32: 2, S16: 4\nE8: 8, F4: 16, Champ: 32"
          )}
        </p>
      </div>
    </div>
  );
  
  // Render the rounds breakdown tab
  const renderRoundsBreakdownTab = () => (
    <div className="space-y-3 sm:space-y-4">
      {/* Round breakdown table with improved contrast */}
      <div>
        <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100 text-sm sm:text-base">Round Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-300 dark:divide-gray-600 text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="py-1 sm:py-2 px-1 sm:px-2 text-left font-medium text-gray-700 dark:text-gray-200">Round</th>
                <th className="py-1 sm:py-2 px-1 sm:px-2 text-center font-medium text-gray-700 dark:text-gray-200">Correct</th>
                <th className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-700 dark:text-gray-200">Base</th>
                <th className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-700 dark:text-gray-200">Bonus</th>
                <th className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-700 dark:text-gray-200">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
              {Object.entries(player.roundBreakdown || {}).map(([round, data]) => {
                const { totalGames, accuracy, pointValue } = roundStats[round] || 
                  { totalGames: 0, accuracy: 0, pointValue: 1 };
                const isCompleted = completedRounds?.includes(round);
                
                return (
                  <tr key={round} className={`
                    ${data.total > 0 ? "bg-green-50 dark:bg-green-900 border-l-4 border-green-500" : ""}
                    ${isCompleted ? "" : "opacity-75 border-l-4 border-gray-300 dark:border-gray-500"}
                  `}>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
                      {getRoundDisplayName(round)}
                      {!isCompleted && <span className="ml-1 text-gray-600 dark:text-gray-300 text-xs">(Pending)</span>}
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-center">
                      <span className="text-gray-800 dark:text-gray-200">
                        {data.correct}/{totalGames}
                      </span>
                      {/* Improved percentage visibility */}
                      <span className="ml-1 text-xs text-gray-700 dark:text-gray-300">
                        ({accuracy}%)
                      </span>
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-800 dark:text-gray-200">
                      {data.base.toFixed(1)}
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-right">
                      {data.bonus > 0 ? (
                        <span className="font-medium text-green-700 dark:text-green-300">+{data.bonus.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-right font-bold text-gray-800 dark:text-gray-200">
                      {data.total.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-200 dark:bg-gray-600 font-bold">
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-gray-800 dark:text-gray-200">Total</td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-800 dark:text-gray-200">
                  {player.correctPicks}/63
                  <span className="ml-1 text-xs text-gray-700 dark:text-gray-300">
                    ({overallAccuracy}%)
                  </span>
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-gray-800 dark:text-gray-200">
                  {player.basePoints.toFixed(1)}
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-green-700 dark:text-green-300">
                  {player.bonusPoints > 0 ? `+${player.bonusPoints.toFixed(1)}` : '—'}
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-indigo-700 dark:text-indigo-200">
                  {player.points.toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  
  // Main render return
  return (
    <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm">
      {/* Always show the header and score summary */}
      {renderPlayerHeader()}
      {renderScoreSummary()}
      
      {/* Tabs navigation */}
      {renderTabs()}
      
      {/* Tab content */}
      {activeTab === 'summary' && renderSummaryTab()}
      {activeTab === 'comparison' && renderComparisonTab()}
      {activeTab === 'breakdown' && renderRoundsBreakdownTab()}
    </div>
  );
};

export default LeaderboardDetails;
import React, { useState } from 'react';
import { FaChartLine, FaInfoCircle } from 'react-icons/fa';

const BracketComparison = ({ 
  player, 
  allPlayers = [], 
  scoringSettings, 
  referenceData = {} 
}) => {
  // State for showing/hiding sections
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  
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

  // All tournament rounds in order
  const allRounds = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
  
  // Get info about completed and remaining games
  const calculateGameStatus = () => {
    const completedGames = {
      total: 0,
      byRound: {}
    };
    
    const remainingGames = {
      total: 0,
      byRound: {}
    };
    
    const totalGamesByRound = {
      'RoundOf64': 32,
      'RoundOf32': 16,
      'Sweet16': 8,
      'Elite8': 4,
      'FinalFour': 2,
      'Championship': 1
    };
    
    allRounds.forEach(round => {
      let completedInRound = 0;
      
      if (round === 'Championship') {
        completedInRound = referenceData[round]?.winner ? 1 : 0;
      } else if (Array.isArray(referenceData[round])) {
        completedInRound = referenceData[round].filter(match => match && match.winner).length;
      }
      
      const totalInRound = totalGamesByRound[round] || 0;
      const remainingInRound = totalInRound - completedInRound;
      
      completedGames.byRound[round] = completedInRound;
      completedGames.total += completedInRound;
      
      remainingGames.byRound[round] = remainingInRound;
      remainingGames.total += remainingInRound;
    });
    
    return { completedGames, remainingGames };
  };
  
  const { completedGames, remainingGames } = calculateGameStatus();
  
  // Check if tournament is completed
  const isTournamentCompleted = remainingGames.total === 0;
  
  // Calculate potential remaining points for a player
  const calculatePotentialPoints = (playerData) => {
    let maxPotentialPoints = playerData.points || 0;
    let remainingPicks = 0;
    
    // Calculate potential points from remaining games
    allRounds.forEach(round => {
      const roundPointValue = getPointValueForRound(round);
      const remainingInRound = remainingGames.byRound[round] || 0;
      
      // Maximum potential points if all remaining picks in this round are correct
      const potentialPointsForRound = remainingInRound * roundPointValue;
      maxPotentialPoints += potentialPointsForRound;
      remainingPicks += remainingInRound;
    });
    
    return {
      currentPoints: playerData.points || 0,
      maxPotentialPoints: maxPotentialPoints,
      remainingPicks: remainingPicks
    };
  };
  
  // Calculate potential scores for all players
  const playersWithPotentialScores = allPlayers.map(p => ({
    ...p,
    ...calculatePotentialPoints(p)
  })).sort((a, b) => b.maxPotentialPoints - a.maxPotentialPoints);
  
  // Find the current player's potential score
  const currentPlayerWithPotential = playersWithPotentialScores.find(p => p.id === player?.id) || {
    currentPoints: 0,
    maxPotentialPoints: 0
  };
  
  // Render the max potential points section
  const renderMaxPotentialScore = () => (
    <div className="bg-blue-100 dark:bg-blue-800 p-2 sm:p-3 rounded-lg">
      <h3 className="font-semibold mb-2 text-blue-800 dark:text-gray-100 text-sm sm:text-base flex items-center">
        <FaChartLine className="mr-2" /> Potential Maximum Score
      </h3>
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-gray-700 dark:text-gray-200 text-xs">Current Score</p>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {currentPlayerWithPotential.currentPoints.toFixed(1)}
          </p>
        </div>
        
        <div>
          <p className="text-gray-700 dark:text-gray-200 text-xs">Maximum Possible</p>
          <p className="text-base font-semibold text-blue-700 dark:text-blue-200">
            {currentPlayerWithPotential.maxPotentialPoints.toFixed(1)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-200">
            {remainingGames.total > 0 
              ? `+${(currentPlayerWithPotential.maxPotentialPoints - currentPlayerWithPotential.currentPoints).toFixed(1)} possible`
              : 'Tournament completed'}
          </p>
        </div>
      </div>
      
      {remainingGames.total > 0 && (
        <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
          <FaInfoCircle className="inline mr-1" /> 
          Based on {remainingGames.total} remaining games. Assumes all your remaining picks are correct.
        </p>
      )}
    </div>
  );
  
  // Render the comparison with other players
  const renderOtherPlayersComparison = () => (
    <div className="bg-purple-100 dark:bg-purple-800 p-2 sm:p-3 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-purple-800 dark:text-gray-100 text-sm sm:text-base">
          Player Comparison (By Max Potential)
        </h3>
        <button 
          onClick={() => setShowAllPlayers(!showAllPlayers)} 
          className="text-xs text-purple-700 dark:text-purple-200 underline"
        >
          {showAllPlayers ? 'Show Top 5' : 'Show All Players'}
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-300 dark:divide-gray-600 text-xs">
          <thead className="bg-purple-200 dark:bg-purple-700">
            <tr>
              <th className="py-1 sm:py-2 px-1 sm:px-2 text-left text-purple-800 dark:text-gray-100">Rank</th>
              <th className="py-1 sm:py-2 px-1 sm:px-2 text-left text-purple-800 dark:text-gray-100">Player</th>
              <th className="py-1 sm:py-2 px-1 sm:px-2 text-right text-purple-800 dark:text-gray-100">Current</th>
              <th className="py-1 sm:py-2 px-1 sm:px-2 text-right text-purple-800 dark:text-gray-100">Max Possible</th>
              <th className="py-1 sm:py-2 px-1 sm:px-2 text-right text-purple-800 dark:text-gray-100">Remaining</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
            {(showAllPlayers ? playersWithPotentialScores : playersWithPotentialScores.slice(0, 5)).map((p, index) => (
              <tr key={p.id} className={p.id === player?.id ? "bg-indigo-50 dark:bg-indigo-900" : ""}>
                <td className="py-1 sm:py-2 px-1 sm:px-2 font-medium text-gray-800 dark:text-gray-200">
                  {index + 1}
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
                  {p.name}
                  {p.id === player?.id && <span className="ml-1 text-indigo-600 dark:text-indigo-300">(You)</span>}
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-gray-800 dark:text-gray-200">
                  {p.currentPoints.toFixed(1)}
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-blue-700 dark:text-blue-200">
                  {p.maxPotentialPoints.toFixed(1)}
                </td>
                <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-green-700 dark:text-green-300">
                  {(p.maxPotentialPoints - p.currentPoints).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <p className="text-xs text-gray-700 dark:text-gray-300 mt-2">
        <FaInfoCircle className="inline mr-1" /> 
        Players ranked by maximum potential score assuming all remaining picks are correct.
      </p>
    </div>
  );
  
  // Main render
  return (
    <div className="space-y-3 sm:space-y-4">
      {renderMaxPotentialScore()}
      {renderOtherPlayersComparison()}
    </div>
  );
};

export default BracketComparison;
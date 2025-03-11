// src/gameTypes/marchMadness/components/Matchup.js
import React from 'react';
import { formatTeamWithSeed } from '../utils/tournamentUtils';

/**
 * A reusable component for rendering a tournament matchup
 * @param {Object} matchup - The matchup data
 * @param {Function} onWinnerSelect - Callback when a winner is selected
 * @param {boolean} isLocked - Whether the bracket is locked for editing
 * @param {boolean} showSeed - Whether to show seed numbers
 * @param {string} className - Additional CSS classes
 * @param {string} roundIdentifier - Text to identify the round/game
 * @param {Object} officialPick - Optional official pick for comparison (null if no official result yet)
 */
const Matchup = ({ 
  matchup, 
  onWinnerSelect, 
  isLocked = false,
  showSeed = true,
  className = '',
  roundIdentifier = '',
  officialPick = null
}) => {
  const { team1, team1Seed, team2, team2Seed, winner, winnerSeed } = matchup;
  
  const handleTeamClick = (team, teamSeed) => {
    if (!isLocked && team && onWinnerSelect) {
      onWinnerSelect(team, teamSeed);
    }
  };
  
  // Helper for checking if a team is selected as winner
  const isWinner = (team) => {
    if (!winner || !team) return false;
    return winner.trim().toLowerCase() === team.trim().toLowerCase();
  };

  // Determine if the user's pick is correct, incorrect, or not yet comparable
  const getPickStatus = () => {
    if (!winner || !officialPick) return "pending"; // No comparison can be made
    
    return winner.trim().toLowerCase() === officialPick.trim().toLowerCase() 
      ? "correct" 
      : "incorrect";
  }
  
  const pickStatus = getPickStatus();

  // Determine the background color based on pick status
  const getBackgroundColor = (team) => {
    if (!isWinner(team)) return "bg-white";
    
    switch(pickStatus) {
      case "correct":
        return "bg-green-500 text-white";
      case "incorrect":
        return "bg-red-500 text-white";
      default:
        return "bg-indigo-500 text-white"; // Blue for user picks with no comparison
    }
  };

  return (
    <div className={`bg-gray-50 rounded-lg p-3 shadow-sm border border-gray-100 ${className}`}>
      {roundIdentifier && (
        <div className="text-xs font-semibold text-gray-500 mb-2">
          {roundIdentifier}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        {/* Team 1 Button */}
        <div
          className={`flex-1 p-2 border rounded ${!isLocked ? 'cursor-pointer' : ''} text-center transition ${
            isWinner(team1)
              ? getBackgroundColor(team1)
              : "bg-white " +
                (!team1
                  ? "text-gray-300 opacity-50 cursor-not-allowed"
                  : `text-gray-800 ${!isLocked ? 'hover:bg-indigo-50' : ''}`)
          } ${!winner && team1 && !isLocked ? "animate-pulse text-blue-700 font-bold" : ""}`}
          onClick={() => handleTeamClick(team1, team1Seed)}
        >
          {showSeed ? formatTeamWithSeed(team1, team1Seed) : (team1 || "TBD")}
        </div>
        
        <div className="mx-2 text-sm font-semibold text-gray-400">vs</div>
        
        {/* Team 2 Button */}
        <div
          className={`flex-1 p-2 border rounded ${!isLocked ? 'cursor-pointer' : ''} text-center transition ${
            isWinner(team2)
              ? getBackgroundColor(team2)
              : "bg-white " +
                (!team2
                  ? "text-gray-300 opacity-50 cursor-not-allowed"
                  : `text-gray-800 ${!isLocked ? 'hover:bg-indigo-50' : ''}`)
          } ${!winner && team2 && !isLocked ? "animate-pulse text-blue-700 font-bold" : ""}`}
          onClick={() => handleTeamClick(team2, team2Seed)}
        >
          {showSeed ? formatTeamWithSeed(team2, team2Seed) : (team2 || "TBD")}
        </div>
      </div>
      
      {/* Winner Display */}
      {winner && (
        <div className={`mt-2 text-sm font-semibold ${
          pickStatus === "correct" ? "text-green-600" : 
          pickStatus === "incorrect" ? "text-red-600" : 
          "text-blue-600"
        }`}>
          <strong>Winner:</strong> {showSeed ? formatTeamWithSeed(winner, winnerSeed) : winner}
        </div>
      )}
    </div>
  );
};

export default Matchup;
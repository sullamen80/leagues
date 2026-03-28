// src/gameTypes/nbaPlayoffs/components/Matchup.js
import React, { useState, useEffect } from 'react';
import BaseMatchup from '../../common/components/BaseMatchup';
import { formatTeamWithSeed } from '../utils/playoffsUtils';
import { 
  calculateUserScore, 
  teamsMatch, 
  getTeamSeed,
  getPointValue,
  getSeriesBonus 
} from '../services/scoringService';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * NBA Playoffs-specific matchup component
 * Extends the BaseMatchup with NBA Playoffs series-specific functionality
 */
const Matchup = ({ 
  matchup, 
  onWinnerSelect,
  onGamesSelect, 
  isLocked = false,
  showSeed = true,
  className = '',
  roundKey = ROUND_KEYS.FIRST_ROUND,
  officialResult = null,
  pendingSelection = null,
  scoringSettings = null // New prop for scoring settings
}) => {
  const [animateGamesSelection, setAnimateGamesSelection] = useState(false);

  useEffect(() => {
    if (pendingSelection) {
      setAnimateGamesSelection(true);
      const timer = setTimeout(() => setAnimateGamesSelection(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [pendingSelection]);

  const baseMatchup = {
    participant1: {
      id: matchup.team1,
      name: matchup.team1,
      seed: matchup.team1Seed
    },
    participant2: {
      id: matchup.team2,
      name: matchup.team2,
      seed: matchup.team2Seed
    },
    winner: matchup.winner ? {
      id: matchup.winner,
      name: matchup.winner,
      seed: matchup.winnerSeed
    } : null
  };

  const formatTeam = (team) => {
    if (!team || !team.name) return "TBD";
    return showSeed ? formatTeamWithSeed(team.name, team.seed) : team.name;
  };

  const handleWinnerSelect = (participant) => {
    if (onWinnerSelect && participant && participant.name) {
      onWinnerSelect(participant.name, participant.seed);
    }
  };

  const getGameOptions = () => {
    return [4, 5, 6, 7].map(val => ({ value: val, label: val.toString() }));
  };

  const getSeriesScore = () => {
    if (!matchup.winner || !matchup.numGames || !officialResult) return null;

    const correctWinner = officialResult.winner === matchup.winner;
    const correctGames = officialResult.numGames === matchup.numGames;
    const teamsMatchResult = teamsMatch(matchup, officialResult);
    const winnerSeed = getTeamSeed(officialResult.winner);
    const loserTeamName = officialResult.team1 === officialResult.winner ? officialResult.team2 : officialResult.team1;
    const loserSeed = getTeamSeed(loserTeamName);
    const isUpset = winnerSeed > loserSeed;

    // Use the scoring utility functions to get accurate point values
    const basePoints = correctWinner ? getPointValue(roundKey, scoringSettings) : 0;
    const bonus = correctWinner && correctGames && teamsMatchResult ? getSeriesBonus(roundKey, scoringSettings) : 0;
    
    // Get upset bonus from settings or use default
    const upsetBonusValue = scoringSettings?.upsetBonus || 2;
    const upsetBonus = correctWinner && isUpset && scoringSettings?.upsetBonusEnabled ? upsetBonusValue : 0;

    return {
      basePoints,
      bonus,
      upsetBonus,
      totalPoints: basePoints + bonus + upsetBonus,
      isCorrect: correctWinner,
      isPerfect: correctWinner && correctGames && teamsMatchResult
    };
  };

  const seriesScore = getSeriesScore();

  return (
    <div className={`${matchup.conference === 'East' ? 'border-blue-300' : 'border-red-300'}`}>
      <BaseMatchup
        matchup={baseMatchup}
        onWinnerSelect={handleWinnerSelect}
        isLocked={isLocked}
        className={className}
        roundIdentifier={roundKey} // Pass the standardized roundKey
        officialPick={officialResult?.winner || null}
        formatParticipant={formatTeam}
        versusText="vs"
        winnerFormatter={formatTeam}
      />

      <div className="mt-3 mb-1">
        {pendingSelection && (
          <div className={`mt-2 border-t pt-3 ${animateGamesSelection ? 'animate-pulse' : ''}`}>
            <div className="text-xs text-indigo-700 font-semibold mb-2 text-center">
              Select Series Length:
            </div>
            <div className="flex justify-center space-x-2">
              {getGameOptions().map(option => (
                <button
                  key={option.value}
                  onClick={() => onGamesSelect(option.value)}
                  className={`px-3 py-1 rounded text-sm ${
                    matchup.numGames === option.value 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-indigo-100 border border-indigo-300 hover:bg-indigo-200 text-gray-600'
                  } ${
                    isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    officialResult && officialResult.numGames === option.value
                      ? 'ring-2 ring-green-500'
                      : ''
                  }`}
                  disabled={isLocked}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {matchup.winner && matchup.numGames && !pendingSelection && (
          <div className="mt-2 pt-2 border-t text-center">
            <div className="text-xs text-gray-600 mb-1">Series Length</div>
            <div className={`font-semibold ${
              seriesScore?.isPerfect ? "text-green-700" :
              seriesScore?.isCorrect ? "text-blue-700" :
              "text-gray-700"
            }`}>
              {matchup.numGames} games
              {seriesScore?.isPerfect && " ✓"}
            </div>
          </div>
        )}

        {seriesScore && (
          <div className={`mt-2 text-xs p-1 rounded text-center ${
            seriesScore.isPerfect ? "text-green-700 bg-green-100" :
            seriesScore.isCorrect ? "text-blue-700 bg-blue-100" :
            "text-amber-700 bg-amber-100"
          }`}>
            {seriesScore.isPerfect
              ? `Perfect! +${seriesScore.totalPoints} pts`
              : seriesScore.isCorrect
                ? `Right winner${seriesScore.bonus > 0 ? ", +" + seriesScore.bonus + " bonus" : ""}${seriesScore.upsetBonus > 0 ? ", +" + seriesScore.upsetBonus + " upset" : ""} (${seriesScore.totalPoints} pts)`
                : "Incorrect (0 pts)"
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default Matchup;
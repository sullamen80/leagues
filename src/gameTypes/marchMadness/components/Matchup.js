// src/gameTypes/marchMadness/components/Matchup.js
import React from 'react';
import BaseMatchup from '../../common/components/BaseMatchup';
import { formatTeamWithSeed } from '../utils/tournamentUtils';

/**
 * March Madness-specific matchup component
 * Extends the BaseMatchup with basketball tournament-specific functionality
 * 
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
  // Convert March Madness-specific matchup format to base format
  const baseMatchup = {
    participant1: { 
      id: matchup.team1, // Use the team name as the ID for comparison
      name: matchup.team1,
      seed: matchup.team1Seed
    },
    participant2: {
      id: matchup.team2, // Use the team name as the ID for comparison
      name: matchup.team2,
      seed: matchup.team2Seed
    },
    winner: matchup.winner ? {
      id: matchup.winner, // Use the team name as the ID for comparison
      name: matchup.winner,
      seed: matchup.winnerSeed
    } : null
  };
  
  // Convert official pick format if needed
  const formattedOfficialPick = officialPick ? {
    id: officialPick,   // Use team name as ID for comparison
    name: officialPick,
    // We don't have seed info for the official pick in this context
  } : null;
  
  // Format teams with seed numbers if showSeed is true
  const formatTeam = (team) => {
    if (!team || !team.name) return "TBD";
    return showSeed ? formatTeamWithSeed(team.name, team.seed) : team.name;
  };
  
  // Handle winner selection callback
  const handleWinnerSelect = (participant) => {
    if (onWinnerSelect && participant && participant.name) {
      onWinnerSelect(participant.name, participant.seed);
    }
  };
  
  return (
    <BaseMatchup
      matchup={baseMatchup}
      onWinnerSelect={handleWinnerSelect}
      isLocked={isLocked}
      className={className}
      roundIdentifier={roundIdentifier}
      officialPick={formattedOfficialPick}
      formatParticipant={formatTeam}
      versusText="vs"
      winnerFormatter={formatTeam}
    />
  );
};

export default Matchup;
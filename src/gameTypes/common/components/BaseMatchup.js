// src/gameTypes/common/components/BaseMatchup.js
import React from 'react';
import { getColorClass } from '../../../styles/tokens/colors';
import { classNames } from '../../../utils/formatters';

/**
 * BaseMatchup - A reusable component for rendering a matchup between two participants
 * Can be extended by specific game types
 * 
 * @param {Object} props - Component props
 * @param {Object} props.matchup - The matchup data with participant1, participant2, and winner
 * @param {Function} props.onWinnerSelect - Callback when a winner is selected
 * @param {boolean} props.isLocked - Whether the matchup is locked for editing
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.roundIdentifier - Text to identify the round/game
 * @param {Object} props.officialPick - Optional official pick for comparison (null if no official result yet)
 * @param {Function} props.formatParticipant - Optional function to format participant display (defaults to showing name)
 * @param {string} props.versusText - Text to show between participants (defaults to "vs")
 * @param {Function} props.winnerFormatter - Optional function to format winner display
 */
const BaseMatchup = ({ 
  matchup, 
  onWinnerSelect, 
  isLocked = false,
  className = '',
  roundIdentifier = '',
  officialPick = null,
  formatParticipant = (p) => p?.name || "TBD",
  versusText = "vs",
  winnerFormatter = null
}) => {
  const { participant1, participant2, winner } = matchup;
  
  const handleParticipantClick = (participant) => {
    if (!isLocked && participant && onWinnerSelect) {
      onWinnerSelect(participant);
    }
  };
  
  // Helper for checking if a participant is selected as winner
  const isWinner = (participant) => {
    if (!winner || !participant) return false;
    
    // Handle different data types (string, object)
    const winnerId = typeof winner === 'object' ? winner.id || winner.name : winner;
    const participantId = typeof participant === 'object' ? participant.id || participant.name : participant;
    
    // Handle string comparisons (for backward compatibility with March Madness)
    if (typeof winnerId === 'string' && typeof participantId === 'string') {
      return winnerId.trim().toLowerCase() === participantId.trim().toLowerCase();
    }
    
    return winnerId === participantId;
  };

  // Determine if the user's pick is correct, incorrect, or not yet comparable
  const getPickStatus = () => {
    if (!winner || !officialPick) return "pending"; // No comparison can be made
    
    // Handle different data types
    const winnerId = typeof winner === 'object' ? winner.id || winner.name : winner;
    const officialId = typeof officialPick === 'object' ? officialPick.id || officialPick.name : officialPick;
    
    // Handle string comparisons (for backward compatibility with March Madness)
    if (typeof winnerId === 'string' && typeof officialId === 'string') {
      return winnerId.trim().toLowerCase() === officialId.trim().toLowerCase() ? "correct" : "incorrect";
    }
    
    return winnerId === officialId ? "correct" : "incorrect";
  }
  
  const pickStatus = getPickStatus();

  // Determine the background color based on pick status
  const getBackgroundColor = (participant) => {
    if (!isWinner(participant)) return "bg-white";
    
    switch(pickStatus) {
      case "correct":
        return classNames(getColorClass('green', 'main', 'bg'), 'text-white');
      case "incorrect":
        return classNames(getColorClass('red', 'main', 'bg'), 'text-white');
      default:
        return classNames(getColorClass('primary', '500', 'bg'), 'text-white'); // Primary for user picks with no comparison
    }
  };

  return (
    <div className={classNames(
      getColorClass('background', 'paper'), 
      'rounded-lg p-3 shadow-sm border',
      getColorClass('border', 'light'),
      className
    )}>
      {roundIdentifier && (
        <div className={classNames(
          'text-xs font-semibold mb-2',
          getColorClass('text', 'secondary')
        )}>
          {roundIdentifier}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        {/* Participant 1 Button */}
        <div
          className={classNames(
            'flex-1 p-2 border rounded text-center transition',
            !isLocked ? 'cursor-pointer' : '',
            isWinner(participant1)
              ? getBackgroundColor(participant1)
              : classNames(
                  'bg-white',
                  !participant1
                    ? classNames(getColorClass('text', 'disabled'), 'opacity-50 cursor-not-allowed')
                    : classNames(
                        getColorClass('text', 'primary'),
                        !isLocked ? `hover:${getColorClass('primary', '50', 'bg')}` : ''
                      )
                ),
            !winner && participant1 && !isLocked 
              ? classNames('animate-pulse font-bold', getColorClass('primary', '700', 'text')) 
              : ""
          )}
          onClick={() => handleParticipantClick(participant1)}
        >
          {formatParticipant(participant1)}
        </div>
        
        <div className={classNames(
          'mx-2 text-sm font-semibold',
          getColorClass('text', 'disabled')
        )}>
          {versusText}
        </div>
        
        {/* Participant 2 Button */}
        <div
          className={classNames(
            'flex-1 p-2 border rounded text-center transition',
            !isLocked ? 'cursor-pointer' : '',
            isWinner(participant2)
              ? getBackgroundColor(participant2)
              : classNames(
                  'bg-white',
                  !participant2
                    ? classNames(getColorClass('text', 'disabled'), 'opacity-50 cursor-not-allowed')
                    : classNames(
                        getColorClass('text', 'primary'),
                        !isLocked ? `hover:${getColorClass('primary', '50', 'bg')}` : ''
                      )
                ),
            !winner && participant2 && !isLocked 
              ? classNames('animate-pulse font-bold', getColorClass('primary', '700', 'text')) 
              : ""
          )}
          onClick={() => handleParticipantClick(participant2)}
        >
          {formatParticipant(participant2)}
        </div>
      </div>
      
      {/* Winner Display */}
      {winner && (
        <div className={classNames(
          'mt-2 text-sm font-semibold',
          pickStatus === "correct" 
            ? getColorClass('green', 'dark', 'text')
            : pickStatus === "incorrect" 
              ? getColorClass('red', 'dark', 'text')
              : getColorClass('primary', '600', 'text')
        )}>
          <strong>Winner:</strong> {winnerFormatter ? winnerFormatter(winner) : formatParticipant(winner)}
        </div>
      )}
    </div>
  );
};

export default BaseMatchup;
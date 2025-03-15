// src/gameTypes/marchMadness/components/AdminSettingsPanels/AdminBracketPanel.js
import React from 'react';
import { FaRedo } from 'react-icons/fa';
import BracketEditor from '../BracketEditor';

/**
 * Panel component for managing the tournament bracket
 */
const AdminBracketPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  generateInitialRoundOf64,
}) => {
  const { tournamentData, teamsData } = data || {};
  
  // Update the next round when a winner is selected
  const updateNextRound = (bracket, currentRound, matchupIndex, winner, winnerSeed) => {
    const roundMapping = {
      'RoundOf64': 'RoundOf32',
      'RoundOf32': 'Sweet16',
      'Sweet16': 'Elite8',
      'Elite8': 'FinalFour',
      'FinalFour': 'Championship'
    };
    
    const nextRound = roundMapping[currentRound];
    if (!nextRound) return; // No next round for Championship
    
    // Special case for Championship
    if (nextRound === 'Championship') {
      // For FinalFour to Championship, we need both winners
      if (currentRound === 'FinalFour') {
        // Get the other FinalFour matchup
        const otherIndex = matchupIndex === 0 ? 1 : 0;
        const otherWinner = bracket.FinalFour[otherIndex]?.winner || '';
        const otherWinnerSeed = bracket.FinalFour[otherIndex]?.winnerSeed || null;
        
        // Update Championship matchup
        if (matchupIndex === 0) {
          bracket.Championship = {
            team1: winner,
            team1Seed: winnerSeed,
            team2: otherWinner,
            team2Seed: otherWinnerSeed,
            winner: '', // Reset winner
            winnerSeed: null
          };
        } else {
          bracket.Championship = {
            team1: otherWinner,
            team1Seed: otherWinnerSeed,
            team2: winner,
            team2Seed: winnerSeed,
            winner: '', // Reset winner
            winnerSeed: null
          };
        }
        
        // Reset Champion
        bracket.Champion = '';
        bracket.ChampionSeed = null;
      }
      
      return;
    }
    
    // For regular rounds
    const nextMatchupIndex = Math.floor(matchupIndex / 2);
    const isFirstTeam = matchupIndex % 2 === 0;
    
    // Ensure next round array exists
    if (!Array.isArray(bracket[nextRound])) {
      bracket[nextRound] = [];
    }
    
    // Ensure the next matchup exists
    if (!bracket[nextRound][nextMatchupIndex]) {
      bracket[nextRound][nextMatchupIndex] = {
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      };
    }
    
    // Update the appropriate team in the next matchup
    if (isFirstTeam) {
      bracket[nextRound][nextMatchupIndex].team1 = winner;
      bracket[nextRound][nextMatchupIndex].team1Seed = winnerSeed;
    } else {
      bracket[nextRound][nextMatchupIndex].team2 = winner;
      bracket[nextRound][nextMatchupIndex].team2Seed = winnerSeed;
    }
    
    // Reset winner for the next matchup
    bracket[nextRound][nextMatchupIndex].winner = '';
    bracket[nextRound][nextMatchupIndex].winnerSeed = null;
    
    // Recursively update subsequent rounds
    clearSubsequentRounds(bracket, nextRound, nextMatchupIndex);
  };

  // Clear all subsequent rounds affected by a change
  const clearSubsequentRounds = (bracket, startRound, matchupIndex) => {
    const roundOrder = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
    const startIndex = roundOrder.indexOf(startRound);
    
    // No need to proceed if this is the Championship or an invalid round
    if (startIndex === -1 || startIndex >= roundOrder.length - 1) return;
    
    // Process each subsequent round
    for (let i = startIndex + 1; i < roundOrder.length; i++) {
      const round = roundOrder[i];
      const nextMatchupIndex = Math.floor(matchupIndex / Math.pow(2, i - startIndex));
      
      // For Championship (object, not array)
      if (round === 'Championship') {
        // Only clear Championship if we're affecting one of its feeding matchups
        if (roundOrder[i - 1] === 'FinalFour' && (matchupIndex === 0 || matchupIndex === 1)) {
          bracket.Championship = {
            team1: bracket.Championship.team1 || '',
            team1Seed: bracket.Championship.team1Seed,
            team2: bracket.Championship.team2 || '',
            team2Seed: bracket.Championship.team2Seed,
            winner: '', 
            winnerSeed: null
          };
          bracket.Champion = '';
          bracket.ChampionSeed = null;
        }
      } 
      // For array rounds
      else if (Array.isArray(bracket[round]) && bracket[round][nextMatchupIndex]) {
        // Only clear the winner, not the teams themselves
        if (bracket[round][nextMatchupIndex].winner) {
          bracket[round][nextMatchupIndex].winner = '';
          bracket[round][nextMatchupIndex].winnerSeed = null;
        }
      }
    }
  };
  
  // Reset bracket to empty state
  const handleResetBracket = () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to reset the entire bracket? This will clear all results. This cannot be undone.")) {
      return;
    }
    
    const updatedTournament = {
      ...tournamentData,
      RoundOf64: generateInitialRoundOf64(teamsData),
      RoundOf32: Array(16).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Sweet16: Array(8).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Elite8: Array(4).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      FinalFour: Array(2).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Championship: { 
        team1: "", team1Seed: null,
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null
      },
      Champion: "",
      ChampionSeed: null
    };
    
    onDataChange({
      ...data,
      tournamentData: updatedTournament
    });
    
    setFeedback("Bracket has been reset to initial state");
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tournament Bracket</h2>
        
        <div>
          <button
            onClick={handleResetBracket}
            disabled={isArchived || !tournamentData}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaRedo className="inline mr-2" /> Reset Bracket
          </button>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
        <p className="font-bold">Important:</p>
        <p>
          After inputting teams you must reset the bracket to see the changes. 
          Resetting the bracket will clear all results while keeping team configurations. This action cannot be undone.
          Use the bracket editor below to set winners for each matchup. 
        </p>
      </div>
      
      {/* Bracket editor */}
      {tournamentData ? (
        <div className="bg-white border rounded-lg p-6">
          <BracketEditor 
            bracketData={tournamentData}
            onSelectWinner={(round, matchupIndex, winner, winnerSeed) => {
              if (isArchived) {
                setFeedback("This league is archived and cannot be edited.");
                return;
              }
              
              // Create a copy of tournament data
              const updatedTournament = { ...tournamentData };
              
              // Handle Championship round (object, not array)
              if (round === 'Championship') {
                updatedTournament.Championship = {
                  ...updatedTournament.Championship,
                  winner,
                  winnerSeed
                };
                updatedTournament.Champion = winner;
                updatedTournament.ChampionSeed = winnerSeed;
              } else {
                // For array rounds
                if (Array.isArray(updatedTournament[round]) && updatedTournament[round][matchupIndex]) {
                  updatedTournament[round][matchupIndex] = {
                    ...updatedTournament[round][matchupIndex],
                    winner,
                    winnerSeed
                  };
                  
                  // Update next round with this winner
                  updateNextRound(updatedTournament, round, matchupIndex, winner, winnerSeed);
                }
              }
              
              onDataChange({
                ...data,
                tournamentData: updatedTournament
              });
            }}
            isAdmin={true}
            isLocked={isArchived}
          />
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No tournament data available. Please initialize the tournament first.</p>
        </div>
      )}
    </div>
  );
};

export default AdminBracketPanel;
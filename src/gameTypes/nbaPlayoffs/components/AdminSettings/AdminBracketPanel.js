// src/gameTypes/nbaPlayoffs/components/AdminSettings/AdminBracketPanel.js
import React, { useEffect } from 'react';
import { FaRedo, FaInfoCircle } from 'react-icons/fa';
import BracketEditor from '../BracketEditor'; // Make sure this path is correct
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../../constants/playoffConstants';

/**
 * Panel component for managing NBA Playoffs bracket and series results
 * Uses standardized bracket format with ROUND_KEYS as single source of truth
 */
const AdminBracketPanel = ({ 
  data,
  onDataChange, 
  isArchived = false,
  setFeedback = () => {},
  generateInitialPlayoffMatchups = null
}) => {
  // Extract tournament data from the correct location
  const tournamentData = data?.tournamentData || data?.gameData?.current || {};
  const teamsData = data?.teamsData || {};
  
  useEffect(() => {
    // Log data structure for debugging
    console.log("AdminBracketPanel received data:", data);
    console.log("Tournament data:", tournamentData);
  }, [data]);
  
  // Update the next round when a winner is selected
  const updateNextRound = (bracket, round, index, winner, winnerSeed) => {
    // Get the matchup to determine conference and other details
    let matchup;
    if (round === ROUND_KEYS.FIRST_ROUND || round === ROUND_KEYS.CONF_SEMIS || round === ROUND_KEYS.CONF_FINALS) {
      matchup = bracket[round][index];
    } else if (round === ROUND_KEYS.NBA_FINALS) {
      matchup = bracket[ROUND_KEYS.NBA_FINALS];
    }
    
    if (!matchup) return;
    
    const conference = matchup.conference;
    
    switch (round) {
      case ROUND_KEYS.FIRST_ROUND:
        // First round winners advance to Conference Semifinals
        const semiIndex = Math.floor(index % 4 / 2);
        const conferenceOffset = conference === 'East' ? 0 : 2;
        const targetIndex = semiIndex + conferenceOffset;
        const isFirstTeam = index % 2 === 0;
        
        // Initialize ConferenceSemis if needed
        if (!Array.isArray(bracket[ROUND_KEYS.CONF_SEMIS])) {
          bracket[ROUND_KEYS.CONF_SEMIS] = Array(4).fill().map((_, i) => ({
            team1: "",
            team1Seed: null,
            team2: "",
            team2Seed: null,
            winner: "",
            winnerSeed: null,
            numGames: null,
            conference: i < 2 ? 'East' : 'West'
          }));
        }
        
        // Update the ConferenceSemis matchup
        if (isFirstTeam) {
          bracket[ROUND_KEYS.CONF_SEMIS][targetIndex] = {
            ...bracket[ROUND_KEYS.CONF_SEMIS][targetIndex],
            team1: winner,
            team1Seed: winnerSeed
          };
        } else {
          bracket[ROUND_KEYS.CONF_SEMIS][targetIndex] = {
            ...bracket[ROUND_KEYS.CONF_SEMIS][targetIndex],
            team2: winner,
            team2Seed: winnerSeed
          };
        }
        
        // Reset winner in this matchup since teams changed
        bracket[ROUND_KEYS.CONF_SEMIS][targetIndex].winner = "";
        bracket[ROUND_KEYS.CONF_SEMIS][targetIndex].winnerSeed = null;
        bracket[ROUND_KEYS.CONF_SEMIS][targetIndex].numGames = null;
        
        // Clear subsequent rounds
        clearSubsequentRounds(bracket, ROUND_KEYS.CONF_SEMIS, targetIndex);
        break;
        
      case ROUND_KEYS.CONF_SEMIS:
        // Conference Semifinals winners advance to Conference Finals
        const finalsIndex = conference === 'East' ? 0 : 1;
        const isFirstSemi = index % 2 === 0;
        
        // Initialize ConferenceFinals if needed
        if (!Array.isArray(bracket[ROUND_KEYS.CONF_FINALS])) {
          bracket[ROUND_KEYS.CONF_FINALS] = Array(2).fill().map((_, i) => ({
            team1: "",
            team1Seed: null,
            team2: "",
            team2Seed: null,
            winner: "",
            winnerSeed: null,
            numGames: null,
            conference: i === 0 ? 'East' : 'West'
          }));
        }
        
        // Update the ConferenceFinals matchup
        if (isFirstSemi) {
          bracket[ROUND_KEYS.CONF_FINALS][finalsIndex] = {
            ...bracket[ROUND_KEYS.CONF_FINALS][finalsIndex],
            team1: winner,
            team1Seed: winnerSeed
          };
        } else {
          bracket[ROUND_KEYS.CONF_FINALS][finalsIndex] = {
            ...bracket[ROUND_KEYS.CONF_FINALS][finalsIndex],
            team2: winner,
            team2Seed: winnerSeed
          };
        }
        
        // Reset winner in this matchup since teams changed
        bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].winner = "";
        bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].winnerSeed = null;
        bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].numGames = null;
        
        // Clear subsequent rounds
        clearSubsequentRounds(bracket, ROUND_KEYS.CONF_FINALS, finalsIndex);
        break;
        
      case ROUND_KEYS.CONF_FINALS:
        // Conference Finals winners advance to NBA Finals
        // Initialize NBAFinals if needed
        if (!bracket[ROUND_KEYS.NBA_FINALS]) {
          bracket[ROUND_KEYS.NBA_FINALS] = {
            team1: "",
            team1Seed: null,
            team1Conference: "",
            team2: "",
            team2Seed: null,
            team2Conference: "",
            winner: "",
            winnerSeed: null,
            winnerConference: "",
            numGames: null,
            predictedMVP: ""
          };
        }
        
        // Update the NBAFinals matchup
        if (conference === 'East') {
          bracket[ROUND_KEYS.NBA_FINALS] = {
            ...bracket[ROUND_KEYS.NBA_FINALS],
            team1: winner,
            team1Seed: winnerSeed,
            team1Conference: 'East'
          };
        } else {
          bracket[ROUND_KEYS.NBA_FINALS] = {
            ...bracket[ROUND_KEYS.NBA_FINALS],
            team2: winner,
            team2Seed: winnerSeed,
            team2Conference: 'West'
          };
        }
        
        // Reset winner in NBA Finals since teams changed
        bracket[ROUND_KEYS.NBA_FINALS].winner = "";
        bracket[ROUND_KEYS.NBA_FINALS].winnerSeed = null;
        bracket[ROUND_KEYS.NBA_FINALS].winnerConference = "";
        bracket[ROUND_KEYS.NBA_FINALS].numGames = null;
        bracket[ROUND_KEYS.NBA_FINALS].predictedMVP = "";
        
        // Clear Champion
        bracket[ROUND_KEYS.CHAMPION] = "";
        bracket.ChampionSeed = null;
        bracket[ROUND_KEYS.FINALS_MVP] = "";
        break;
        
      case ROUND_KEYS.NBA_FINALS:
        // NBA Finals winner is the champion
        bracket[ROUND_KEYS.NBA_FINALS] = {
          ...bracket[ROUND_KEYS.NBA_FINALS],
          winner,
          winnerSeed,
          winnerConference: bracket[ROUND_KEYS.NBA_FINALS].team1 === winner ? 
            bracket[ROUND_KEYS.NBA_FINALS].team1Conference : 
            bracket[ROUND_KEYS.NBA_FINALS].team2Conference
        };
        
        // Update Champion fields
        bracket[ROUND_KEYS.CHAMPION] = winner;
        bracket.ChampionSeed = winnerSeed;
        break;
      
      default:
        break;
    }
  };
  
  // Clear winners in subsequent rounds
  const clearSubsequentRounds = (bracket, round, index) => {
    switch (round) {
      case ROUND_KEYS.CONF_SEMIS:
        // Get the conference of the matchup we're clearing
        const conference = index < 2 ? 'East' : 'West';
        const finalsIndex = conference === 'East' ? 0 : 1;
        
        // Clear the relevant team in Conference Finals
        if (Array.isArray(bracket[ROUND_KEYS.CONF_FINALS]) && bracket[ROUND_KEYS.CONF_FINALS][finalsIndex]) {
          const isFirstTeam = index % 2 === 0;
          
          if (isFirstTeam) {
            bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].team1 = "";
            bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].team1Seed = null;
          } else {
            bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].team2 = "";
            bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].team2Seed = null;
          }
          
          // Always clear the winner
          bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].winner = "";
          bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].winnerSeed = null;
          bracket[ROUND_KEYS.CONF_FINALS][finalsIndex].numGames = null;
        }
        
        // Also clear NBA Finals if this conference's team was in it
        if (bracket[ROUND_KEYS.NBA_FINALS]) {
          if (conference === 'East') {
            bracket[ROUND_KEYS.NBA_FINALS].team1 = "";
            bracket[ROUND_KEYS.NBA_FINALS].team1Seed = null;
            bracket[ROUND_KEYS.NBA_FINALS].team1Conference = "";
          } else {
            bracket[ROUND_KEYS.NBA_FINALS].team2 = "";
            bracket[ROUND_KEYS.NBA_FINALS].team2Seed = null;
            bracket[ROUND_KEYS.NBA_FINALS].team2Conference = "";
          }
          
          // Always clear the winner
          bracket[ROUND_KEYS.NBA_FINALS].winner = "";
          bracket[ROUND_KEYS.NBA_FINALS].winnerSeed = null;
          bracket[ROUND_KEYS.NBA_FINALS].winnerConference = "";
          bracket[ROUND_KEYS.NBA_FINALS].numGames = null;
          bracket[ROUND_KEYS.NBA_FINALS].predictedMVP = "";
        }
        
        // Clear Champion
        bracket[ROUND_KEYS.CHAMPION] = "";
        bracket.ChampionSeed = null;
        bracket[ROUND_KEYS.FINALS_MVP] = "";
        break;
        
      case ROUND_KEYS.CONF_FINALS:
        // Get the conference of the matchup we're clearing
        const conf = index === 0 ? 'East' : 'West';
        
        // Clear the NBA Finals
        if (bracket[ROUND_KEYS.NBA_FINALS]) {
          if (conf === 'East') {
            bracket[ROUND_KEYS.NBA_FINALS].team1 = "";
            bracket[ROUND_KEYS.NBA_FINALS].team1Seed = null;
            bracket[ROUND_KEYS.NBA_FINALS].team1Conference = "";
          } else {
            bracket[ROUND_KEYS.NBA_FINALS].team2 = "";
            bracket[ROUND_KEYS.NBA_FINALS].team2Seed = null;
            bracket[ROUND_KEYS.NBA_FINALS].team2Conference = "";
          }
          
          // Always clear the winner
          bracket[ROUND_KEYS.NBA_FINALS].winner = "";
          bracket[ROUND_KEYS.NBA_FINALS].winnerSeed = null;
          bracket[ROUND_KEYS.NBA_FINALS].winnerConference = "";
          bracket[ROUND_KEYS.NBA_FINALS].numGames = null;
          bracket[ROUND_KEYS.NBA_FINALS].predictedMVP = "";
        }
        
        // Clear Champion
        bracket[ROUND_KEYS.CHAMPION] = "";
        bracket.ChampionSeed = null;
        bracket[ROUND_KEYS.FINALS_MVP] = "";
        break;
      
      default:
        break;
    }
  };
  
  // Helper function to update data in the correct structure
  const updateData = (updatedTournamentData) => {
    if (data?.gameData?.current) {
      // If data is nested under gameData.current
      onDataChange({
        ...data,
        gameData: {
          ...data.gameData,
          current: updatedTournamentData
        },
        editMode: false  // Critical flag - indicates we're updating bracket results, not teams
      });
    } else {
      // If data is directly in tournamentData
      onDataChange({
        ...data,
        tournamentData: updatedTournamentData,
        editMode: false  // Critical flag - indicates we're updating bracket results, not teams
      });
    }
  };
  
  // Helper function to get or create an array for a round
  const getOrCreateRoundArray = (tournament, roundKey, defaultLength, createItem) => {
    if (!Array.isArray(tournament[roundKey]) || tournament[roundKey].length === 0) {
      // Create standard array for the round
      tournament[roundKey] = Array(defaultLength).fill().map(createItem);
    }
    return tournament[roundKey];
  };

  // Handle series prediction from BracketEditor
  const handleSeriesPrediction = (round, index, winner, winnerSeed, numGames, mvp) => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    console.log("Series prediction:", { round, index, winner, winnerSeed, numGames, mvp });
    
    // Create a copy of tournament data
    const updatedTournament = { ...tournamentData };
    
    // Use standardized round key directly
    const standardRound = round;
    
    // Update in the standardized format
    if (standardRound === ROUND_KEYS.FIRST_ROUND || 
        standardRound === ROUND_KEYS.CONF_SEMIS || 
        standardRound === ROUND_KEYS.CONF_FINALS) {
      if (Array.isArray(updatedTournament[standardRound]) && updatedTournament[standardRound][index]) {
        updatedTournament[standardRound][index] = {
          ...updatedTournament[standardRound][index],
          winner,
          winnerSeed,
          numGames
        };
      }
    } else if (standardRound === ROUND_KEYS.NBA_FINALS) {
      if (updatedTournament[ROUND_KEYS.NBA_FINALS]) {
        updatedTournament[ROUND_KEYS.NBA_FINALS] = {
          ...updatedTournament[ROUND_KEYS.NBA_FINALS],
          winner,
          winnerSeed,
          numGames
        };
        
        // If MVP is provided, update it
        if (mvp) {
          updatedTournament[ROUND_KEYS.NBA_FINALS].predictedMVP = mvp;
          updatedTournament[ROUND_KEYS.FINALS_MVP] = mvp;
        }
        
        // Update Champion
        updatedTournament[ROUND_KEYS.CHAMPION] = winner;
        updatedTournament.ChampionSeed = winnerSeed;
      }
    }
    
    // Update the next round with this winner if applicable
    if (standardRound !== ROUND_KEYS.NBA_FINALS) {
      updateNextRound(updatedTournament, standardRound, index, winner, winnerSeed);
    }
    
    // Update the data
    updateData(updatedTournament);
  };
  
  // Handle Finals MVP selection
  const handleMVPSelect = (mvp) => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    // Create a copy of tournament data
    const updatedTournament = { ...tournamentData };
    
    // Update the Finals MVP in standardized format only
    if (updatedTournament[ROUND_KEYS.NBA_FINALS]) {
      updatedTournament[ROUND_KEYS.NBA_FINALS] = {
        ...updatedTournament[ROUND_KEYS.NBA_FINALS],
        predictedMVP: mvp
      };
      
      // Also update the dedicated field
      updatedTournament[ROUND_KEYS.FINALS_MVP] = mvp;
    }
    
    // Update the data
    updateData(updatedTournament);
  };
  
  // Reset bracket to initial state
  const handleResetBracket = () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to reset the entire playoff bracket? This will clear all results. This cannot be undone.")) {
      return;
    }

    // Create a copy of tournament data
    const updatedTournament = { ...tournamentData };
    
    // Reset FirstRound in standardized format only
    if (Array.isArray(updatedTournament[ROUND_KEYS.FIRST_ROUND])) {
      updatedTournament[ROUND_KEYS.FIRST_ROUND] = updatedTournament[ROUND_KEYS.FIRST_ROUND].map(match => ({
        ...match,
        winner: "",
        winnerSeed: null,
        numGames: null
      }));
    }
    
    // Clear later rounds in standardized format
    updatedTournament[ROUND_KEYS.CONF_SEMIS] = Array(4).fill().map((_, i) => ({
      team1: "",
      team1Seed: null,
      team2: "",
      team2Seed: null,
      winner: "",
      winnerSeed: null,
      numGames: null,
      conference: i < 2 ? 'East' : 'West'
    }));
    
    updatedTournament[ROUND_KEYS.CONF_FINALS] = Array(2).fill().map((_, i) => ({
      team1: "",
      team1Seed: null,
      team2: "",
      team2Seed: null,
      winner: "",
      winnerSeed: null,
      numGames: null,
      conference: i === 0 ? 'East' : 'West'
    }));
    
    updatedTournament[ROUND_KEYS.NBA_FINALS] = {
      team1: "",
      team1Seed: null,
      team1Conference: "",
      team2: "",
      team2Seed: null,
      team2Conference: "",
      winner: "",
      winnerSeed: null,
      winnerConference: "",
      numGames: null,
      predictedMVP: ""
    };
    
    updatedTournament[ROUND_KEYS.CHAMPION] = "";
    updatedTournament.ChampionSeed = null;
    updatedTournament[ROUND_KEYS.FINALS_MVP] = "";
    
    // Update the data
    updateData(updatedTournament);
    
    setFeedback("Bracket has been reset to initial state");
  };

  // Check if we have tournament data with teams
  const hasTournamentData = tournamentData && 
    Array.isArray(tournamentData[ROUND_KEYS.FIRST_ROUND]) && 
    tournamentData[ROUND_KEYS.FIRST_ROUND].length > 0;
  
  const firstRoundData = tournamentData[ROUND_KEYS.FIRST_ROUND] || [];
  
  const hasTeams = hasTournamentData && firstRoundData.length > 0 && 
    (firstRoundData[0]?.team1 && firstRoundData[0]?.team2);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Playoff Bracket</h2>
        
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
          After setting up playoff teams you may need to reset the bracket to see updated matchups.
          Resetting the bracket will clear all results while preserving the team matchups. This action cannot be undone.
        </p>
      </div>
      
      {/* Debug information - only in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-2 mb-4 text-xs overflow-auto">
          <details>
            <summary className="font-bold cursor-pointer">Debug Information</summary>
            <pre className="mt-2">{JSON.stringify({
              hasTournamentData,
              hasTeams,
              firstRoundExists: !!tournamentData[ROUND_KEYS.FIRST_ROUND],
              firstRoundLength: (tournamentData[ROUND_KEYS.FIRST_ROUND] || []).length,
              conferenceSemisExists: !!tournamentData[ROUND_KEYS.CONF_SEMIS],
              conferenceSemisLength: (tournamentData[ROUND_KEYS.CONF_SEMIS] || []).length,
              conferenceFinalsExists: !!tournamentData[ROUND_KEYS.CONF_FINALS],
              conferenceFinalsLength: (tournamentData[ROUND_KEYS.CONF_FINALS] || []).length,
              nbaFinalsExists: !!tournamentData[ROUND_KEYS.NBA_FINALS]
            }, null, 2)}</pre>
            
            <h4 className="font-bold mt-3">First Round Sample:</h4>
            <pre className="mt-1">{firstRoundData.length > 0 
              ? JSON.stringify(firstRoundData[0], null, 2) 
              : "No data"}</pre>
          </details>
        </div>
      )}
      
      {/* Bracket editor */}
      {hasTournamentData ? (
        <div className="bg-white border rounded-lg p-6">
          <BracketEditor 
            bracketData={tournamentData}
            onSeriesPrediction={handleSeriesPrediction}
            onMVPSelect={handleMVPSelect}
            isAdmin={true}
            isLocked={isArchived}
            teamPlayers={tournamentData.mvpCandidates || {}} // Add this line to pass the MVP candidates
            officialMVP={tournamentData[ROUND_KEYS.FINALS_MVP] || null} // Also add th
          />
        </div>
      ) : (
        <div className="text-center py-8 bg-yellow-50 p-4 rounded-lg">
          <FaInfoCircle className="text-yellow-500 text-xl inline-block mb-2" />
          <p>Please set up teams first before editing the bracket.</p>
        </div>
      )}
    </div>
  );
};

export default AdminBracketPanel;
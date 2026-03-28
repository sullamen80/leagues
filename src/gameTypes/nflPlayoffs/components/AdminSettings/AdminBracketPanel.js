// src/gameTypes/nflPlayoffs/components/AdminSettings/AdminBracketPanel.js
import React from 'react';
import { FaRedo, FaInfoCircle } from 'react-icons/fa';
import BracketEditor from '../BracketEditor'; // Make sure this path is correct
import { ROUND_KEYS } from '../../constants/playoffConstants';
import { applyBracketAdvancement } from '../../utils/bracketUtils';

/**
 * Panel component for managing NFL Playoffs bracket and game results
 * Uses standardized bracket format with ROUND_KEYS as single source of truth
 */
const AdminBracketPanel = ({ 
  data,
  onDataChange, 
  isArchived = false,
  setFeedback = () => {}
}) => {
  // Extract tournament data from the correct location
  const tournamentData = data?.tournamentData || data?.gameData?.current || {};
  
  const ensureReferenceData = (bracket) => ({
    ...bracket,
    playoffTeams:
      bracket.playoffTeams ||
      tournamentData.playoffTeams ||
      data?.gameData?.current?.playoffTeams ||
      data?.tournamentData?.playoffTeams
  });
  
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
  
  // Handle matchup results coming from BracketEditor
  const handleSeriesPrediction = (
    round,
    index,
    winner,
    winnerSeed,
    numGames,
    mvp,
    extraFields = {}
  ) => {
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
    if (
      standardRound === ROUND_KEYS.FIRST_ROUND ||
      standardRound === ROUND_KEYS.CONF_SEMIS ||
      standardRound === ROUND_KEYS.CONF_FINALS
    ) {
      if (Array.isArray(updatedTournament[standardRound]) && updatedTournament[standardRound][index]) {
        updatedTournament[standardRound][index] = {
          ...updatedTournament[standardRound][index],
          ...extraFields,
          winner,
          winnerSeed,
          numGames
        };
      }
    } else if (standardRound === ROUND_KEYS.SUPER_BOWL) {
      if (updatedTournament[ROUND_KEYS.SUPER_BOWL]) {
        updatedTournament[ROUND_KEYS.SUPER_BOWL] = {
          ...updatedTournament[ROUND_KEYS.SUPER_BOWL],
          ...extraFields,
          winner,
          winnerSeed,
          numGames
        };

        if (mvp) {
          updatedTournament[ROUND_KEYS.SUPER_BOWL].predictedMVP = mvp;
          updatedTournament[ROUND_KEYS.FINALS_MVP] = mvp;
        }
      }
    }
    
    applyBracketAdvancement(
      updatedTournament,
      standardRound,
      ensureReferenceData(updatedTournament)
    );
    
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
    if (updatedTournament[ROUND_KEYS.SUPER_BOWL]) {
      updatedTournament[ROUND_KEYS.SUPER_BOWL] = {
        ...updatedTournament[ROUND_KEYS.SUPER_BOWL],
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
      updatedTournament[ROUND_KEYS.FIRST_ROUND] = updatedTournament[ROUND_KEYS.FIRST_ROUND].map((match) => ({
        ...match,
        winner: '',
        winnerSeed: null,
        gamesPlayed: null,
        numGames: match.numGames ?? 1
      }));
    }
    
    applyBracketAdvancement(
      updatedTournament,
      ROUND_KEYS.FIRST_ROUND,
      ensureReferenceData(updatedTournament)
    );
    
    updatedTournament[ROUND_KEYS.CHAMPION] = '';
    updatedTournament.ChampionSeed = null;
    updatedTournament[ROUND_KEYS.FINALS_MVP] = '';
    
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
              superBowlExists: !!tournamentData[ROUND_KEYS.SUPER_BOWL]
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
            playoffTeams={tournamentData.playoffTeams || {}}
            scoringSettings={tournamentData.scoringSettings || null}
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

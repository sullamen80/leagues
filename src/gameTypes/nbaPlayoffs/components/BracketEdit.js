import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import BaseEditor from '../../common/components/BaseEditor';
import BracketEditor from './BracketEditor';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

const BracketEdit = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  hasPlayInTournament: propHasPlayInTournament = false,
  // Keep mvpPredictionMode but only for UI display
  mvpPredictionMode = false
}) => {
  const [hasPlayInTournament, setHasPlayInTournament] = useState(propHasPlayInTournament);

  // Simple instruction object based on display mode
  const bracketInstructions = {
    title: mvpPredictionMode ? `${ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} Prediction` : "How to fill out your NBA Playoffs bracket:",
    items: mvpPredictionMode ? [
      `Select your predicted ${ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]}`,
      `You can change your pick until the ${ROUND_DISPLAY_NAMES[ROUND_KEYS.NBA_FINALS]} begin`,
      "You'll earn bonus points if your MVP prediction is correct!"
    ] : [
      "Click on a team to select them as the winner of that series",
      "Then choose how many games the series will last (4-7)",
      "Winners will automatically advance to the next round",
      `Don't forget to select a ${ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} when you reach the Finals`,
      "You can change your picks until the playoffs begin"
    ]
  };

  const fetchBracketData = useCallback(async (leagueId, userId) => {
    try {
      let isBracketLocked = false;
      
      // Fetch lock status
      try {
        const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
        const locksSnap = await getDoc(locksRef);
        
        if (locksSnap.exists()) {
          const lockData = locksSnap.data();
          if (lockData[ROUND_KEYS.FIRST_ROUND]?.locked) {
            isBracketLocked = true;
          }
          if (mvpPredictionMode && lockData[ROUND_KEYS.NBA_FINALS]?.locked) {
            isBracketLocked = true;
          }
        }
      } catch (lockErr) {
        console.error('Error fetching lock status:', lockErr);
      }
      
      // Fetch tournament data
      const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (!tournamentSnap.exists()) {
        throw new Error("Tournament data not found");
      }
      
      const gameData = tournamentSnap.data();
      const hasPlayInTournamentDerived = !!gameData[ROUND_KEYS.PLAY_IN];
   
      // Ensure FirstRound structure exists
      if (!gameData[ROUND_KEYS.FIRST_ROUND] || !Array.isArray(gameData[ROUND_KEYS.FIRST_ROUND])) {
        gameData[ROUND_KEYS.FIRST_ROUND] = Array(8).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          conference: i < 4 ? 'East' : 'West'
        }));
      }
      
      // Check if tournament has started
      if (!isBracketLocked) {
        if (gameData[ROUND_KEYS.CHAMPION]) {
          isBracketLocked = true;
        } else {
          const firstRoundStarted = gameData[ROUND_KEYS.FIRST_ROUND]?.some(match => match && match.winner);
          if (firstRoundStarted) {
            isBracketLocked = true;
          }
        }
      }
      
      // Fetch user bracket data
      let userEntry = null;
      const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
      const userBracketSnap = await getDoc(userBracketRef);
      
      if (userBracketSnap.exists()) {
        userEntry = userBracketSnap.data();
      }
      
      // Create an empty bracket if needed
      if (!userEntry) {
        userEntry = createEmptyBracket(gameData);
      }
      
      // Include mvpCandidates
      userEntry = {
        ...userEntry,
        mvpCandidates: gameData.mvpCandidates || {},
        officialMVP: gameData[ROUND_KEYS.FINALS_MVP] || null
      };
      
      setHasPlayInTournament(hasPlayInTournamentDerived);
      
      return { 
        gameData, 
        userEntry, 
        isLocked: isBracketLocked,
        hasPlayInTournament: hasPlayInTournamentDerived
      };
    } catch (error) {
      console.error("Error in fetchBracketData:", error);
      throw new Error("Failed to load bracket data: " + error.message);
    }
  }, [mvpPredictionMode]);

  const createEmptyBracket = (template, currentUserEntry = null) => {
    if (!template) return null;
    
    const emptyBracket = { ...template };
    
    // Set up empty data structure for all rounds
    const emptyRounds = {
      [ROUND_KEYS.FIRST_ROUND]: (emptyBracket[ROUND_KEYS.FIRST_ROUND] || []).map(matchup => ({
        ...matchup,
        winner: '',
        winnerSeed: null,
        numGames: null
      })),
      [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({ 
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: i < 2 ? 'East' : 'West'
      })),
      [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({ 
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: i === 0 ? 'East' : 'West'
      })),
      [ROUND_KEYS.NBA_FINALS]: { 
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        predictedMVP: ''
      },
      [ROUND_KEYS.CHAMPION]: '',
      ChampionSeed: null,
      [ROUND_KEYS.FINALS_MVP]: ''
    };
    
    // IMPORTANT: Prioritize Play-In data from currentUserEntry if available
    if (currentUserEntry && currentUserEntry[ROUND_KEYS.PLAY_IN]) {
      emptyRounds[ROUND_KEYS.PLAY_IN] = currentUserEntry[ROUND_KEYS.PLAY_IN];
    } else if (emptyBracket[ROUND_KEYS.PLAY_IN]) {
      emptyRounds[ROUND_KEYS.PLAY_IN] = emptyBracket[ROUND_KEYS.PLAY_IN];
    }
    
    return { ...emptyBracket, ...emptyRounds };
  };
  
  // Modified saveBracket function that works like the admin version
  const saveBracket = async (leagueId, userId, bracketData) => {
    try {
      const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
      const userBracketSnap = await getDoc(userBracketRef);
      let currentData = userBracketSnap.exists() ? userBracketSnap.data() : {};

      // Create complete update with all existing data plus new data
      const completeData = { ...currentData, ...bracketData };
      
      // IMPORTANT: Ensure Champion data matches NBA Finals winner
      if (bracketData[ROUND_KEYS.NBA_FINALS] && bracketData[ROUND_KEYS.NBA_FINALS].winner) {
        completeData[ROUND_KEYS.CHAMPION] = bracketData[ROUND_KEYS.NBA_FINALS].winner;
        completeData.ChampionSeed = bracketData[ROUND_KEYS.NBA_FINALS].winnerSeed;
      }
      
      // IMPORTANT: Ensure MVP data is consistent
      if (bracketData[ROUND_KEYS.FINALS_MVP]) {
        if (completeData[ROUND_KEYS.NBA_FINALS]) {
          completeData[ROUND_KEYS.NBA_FINALS].predictedMVP = bracketData[ROUND_KEYS.FINALS_MVP];
        }
      } else if (bracketData[ROUND_KEYS.NBA_FINALS]?.predictedMVP) {
        completeData[ROUND_KEYS.FINALS_MVP] = bracketData[ROUND_KEYS.NBA_FINALS].predictedMVP;
      }
      
      // Add timestamp
      completeData.updatedAt = new Date().toISOString();
      
      // Save the complete data
      await setDoc(userBracketRef, completeData);
      
    } catch (error) {
      console.error("Error saving bracket:", error);
      throw error;
    }
  };
  
  // Update next round when a team advances - ADDED THIS MISSING FUNCTION
  const updateNextRound = (bracket, currentRound, matchupIndex, winner, winnerSeed) => {
    const roundMapping = {
      [ROUND_KEYS.FIRST_ROUND]: ROUND_KEYS.CONF_SEMIS,
      [ROUND_KEYS.CONF_SEMIS]: ROUND_KEYS.CONF_FINALS,
      [ROUND_KEYS.CONF_FINALS]: ROUND_KEYS.NBA_FINALS
    };
    
    const nextRound = roundMapping[currentRound];
    if (!nextRound) return;
    
    if (nextRound === ROUND_KEYS.NBA_FINALS) {
      if (currentRound === ROUND_KEYS.CONF_FINALS) {
        // Get the matchup to determine which team is advancing
        const matchup = bracket[currentRound][matchupIndex];
        const conference = matchup?.conference || (matchupIndex === 0 ? 'East' : 'West');
        
        // Make sure NBA Finals object exists
        if (!bracket[ROUND_KEYS.NBA_FINALS]) {
          bracket[ROUND_KEYS.NBA_FINALS] = {
            team1: '',
            team1Seed: null,
            team1Conference: '',
            team2: '',
            team2Seed: null,
            team2Conference: '',
            winner: '',
            winnerSeed: null,
            winnerConference: '',
            numGames: null,
            predictedMVP: ''
          };
        }
        
        // Update the correct team in NBA Finals based on conference
        if (conference === 'East') {
          bracket[ROUND_KEYS.NBA_FINALS].team1 = winner;
          bracket[ROUND_KEYS.NBA_FINALS].team1Seed = winnerSeed;
          bracket[ROUND_KEYS.NBA_FINALS].team1Conference = 'East';
        } else {
          bracket[ROUND_KEYS.NBA_FINALS].team2 = winner;
          bracket[ROUND_KEYS.NBA_FINALS].team2Seed = winnerSeed;
          bracket[ROUND_KEYS.NBA_FINALS].team2Conference = 'West';
        }
        
        // Reset the winner since teams changed
        bracket[ROUND_KEYS.NBA_FINALS].winner = '';
        bracket[ROUND_KEYS.NBA_FINALS].winnerSeed = null;
        bracket[ROUND_KEYS.NBA_FINALS].winnerConference = '';
        bracket[ROUND_KEYS.NBA_FINALS].numGames = null;
        
        // Reset Champion data since NBA Finals teams changed
        bracket[ROUND_KEYS.CHAMPION] = '';
        bracket.ChampionSeed = null;
      }
      return;
    }
    
    // Determine which matchup in the next round will receive this winner
    let nextMatchupIndex;
    let isFirstTeam;
    
    // Get the matchup to determine conference
    const matchup = bracket[currentRound][matchupIndex];
    const conference = matchup?.conference || 
                      (currentRound === ROUND_KEYS.CONF_FINALS ? 
                        (matchupIndex === 0 ? 'East' : 'West') :
                        (matchupIndex < (currentRound === ROUND_KEYS.CONF_SEMIS ? 2 : 4) ? 'East' : 'West'));
    
    if (currentRound === ROUND_KEYS.FIRST_ROUND) {
      nextMatchupIndex = conference === 'East' ? 
                       Math.floor(matchupIndex / 2) : 
                       Math.floor((matchupIndex - 4) / 2) + 2;
      isFirstTeam = matchupIndex % 2 === 0;
    } else if (currentRound === ROUND_KEYS.CONF_SEMIS) {
      nextMatchupIndex = conference === 'East' ? 0 : 1;
      isFirstTeam = matchupIndex % 2 === 0;
    } else {
      return; // Safety check
    }
    
    // Make sure next round array exists
    if (!Array.isArray(bracket[nextRound])) {
      if (nextRound === ROUND_KEYS.CONF_SEMIS) {
        bracket[nextRound] = Array(4).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i < 2 ? 'East' : 'West'
        }));
      } else if (nextRound === ROUND_KEYS.CONF_FINALS) {
        bracket[nextRound] = Array(2).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i === 0 ? 'East' : 'West'
        }));
      }
    }
    
    // Make sure matchup exists
    if (!bracket[nextRound][nextMatchupIndex]) {
      bracket[nextRound][nextMatchupIndex] = {
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference
      };
    }
    
    // Update the proper team in the next round
    if (isFirstTeam) {
      bracket[nextRound][nextMatchupIndex].team1 = winner;
      bracket[nextRound][nextMatchupIndex].team1Seed = winnerSeed;
    } else {
      bracket[nextRound][nextMatchupIndex].team2 = winner;
      bracket[nextRound][nextMatchupIndex].team2Seed = winnerSeed;
    }
    
    // Reset the winner since teams changed
    bracket[nextRound][nextMatchupIndex].winner = '';
    bracket[nextRound][nextMatchupIndex].winnerSeed = null;
    bracket[nextRound][nextMatchupIndex].numGames = null;
    
    // Clear any subsequent rounds
    clearSubsequentRounds(bracket, nextRound, nextMatchupIndex);
  };
  
  // Clear winners in subsequent rounds when earlier rounds change - ADDED THIS MISSING FUNCTION
  const clearSubsequentRounds = (bracket, round, matchupIndex) => {
    const roundOrder = [
      ROUND_KEYS.FIRST_ROUND, 
      ROUND_KEYS.CONF_SEMIS, 
      ROUND_KEYS.CONF_FINALS, 
      ROUND_KEYS.NBA_FINALS
    ];
    
    const startIndex = roundOrder.indexOf(round);
    if (startIndex === -1 || startIndex >= roundOrder.length - 1) return;
    
    for (let i = startIndex + 1; i < roundOrder.length; i++) {
      const nextRound = roundOrder[i];
      
      if (nextRound === ROUND_KEYS.NBA_FINALS) {
        if (round === ROUND_KEYS.CONF_FINALS) {
          // Determine which team in Finals needs to be cleared
          const conference = matchupIndex === 0 ? 'East' : 'West';
          
          if (bracket[nextRound]) {
            if (conference === 'East') {
              bracket[nextRound].team1 = '';
              bracket[nextRound].team1Seed = null;
              bracket[nextRound].team1Conference = '';
            } else {
              bracket[nextRound].team2 = '';
              bracket[nextRound].team2Seed = null;
              bracket[nextRound].team2Conference = '';
            }
            
            // Reset winner
            bracket[nextRound].winner = '';
            bracket[nextRound].winnerSeed = null;
            bracket[nextRound].winnerConference = '';
            bracket[nextRound].numGames = null;
            bracket[nextRound].predictedMVP = '';
          }
          
          // Reset Champion
          bracket[ROUND_KEYS.CHAMPION] = '';
          bracket.ChampionSeed = null;
          bracket[ROUND_KEYS.FINALS_MVP] = '';
        }
      } else if (Array.isArray(bracket[nextRound])) {
        // Determine which matchups need to be cleared
        let affectedIndices = [];
        
        if (round === ROUND_KEYS.FIRST_ROUND && nextRound === ROUND_KEYS.CONF_SEMIS) {
          // Get conference from matchup
          const matchup = bracket[round][matchupIndex];
          const conference = matchup?.conference || (matchupIndex < 4 ? 'East' : 'West');
          
          if (conference === 'East') {
            affectedIndices = [Math.floor(matchupIndex / 2)];
          } else {
            affectedIndices = [Math.floor((matchupIndex - 4) / 2) + 2];
          }
        } else if (round === ROUND_KEYS.CONF_SEMIS && nextRound === ROUND_KEYS.CONF_FINALS) {
          // Get conference from matchup
          const matchup = bracket[round][matchupIndex];
          const conference = matchup?.conference || (matchupIndex < 2 ? 'East' : 'West');
          
          affectedIndices = [conference === 'East' ? 0 : 1];
        }
        
        // Clear affected matchups
        for (const idx of affectedIndices) {
          if (bracket[nextRound][idx]) {
            if (round === ROUND_KEYS.FIRST_ROUND) {
              // First round change affects one team in Conference Semis
              const isFirstTeam = matchupIndex % 2 === 0;
              
              if (isFirstTeam) {
                bracket[nextRound][idx].team1 = '';
                bracket[nextRound][idx].team1Seed = null;
              } else {
                bracket[nextRound][idx].team2 = '';
                bracket[nextRound][idx].team2Seed = null;
              }
            }
            
            // Always reset winner
            bracket[nextRound][idx].winner = '';
            bracket[nextRound][idx].winnerSeed = null;
            bracket[nextRound][idx].numGames = null;
          }
        }
      }
    }
  };
  
  const BracketEditorWrapper = ({ data, onUpdate, isLocked }) => {
    const teamPlayers = data?.mvpCandidates || {};
    const officialMVP = data?.[ROUND_KEYS.FINALS_MVP] || null;
  
    // Modified handleSeriesPrediction that works like the admin version
    const handleSeriesPrediction = (round, index, winner, winnerSeed, numGames, mvp) => {
      // Create a deep copy of the data to avoid reference issues
      const updatedBracket = JSON.parse(JSON.stringify(data));
      
      // Apply updates based on round
      if (round === ROUND_KEYS.NBA_FINALS) {
        // Update NBA Finals
        updatedBracket[round] = {
          ...updatedBracket[round],
          winner,
          winnerSeed,
          numGames,
          predictedMVP: mvp || updatedBracket[round]?.predictedMVP || ''
        };
        
        // IMPORTANT: Always update Champion data
        updatedBracket[ROUND_KEYS.CHAMPION] = winner;
        updatedBracket.ChampionSeed = winnerSeed;
        
        // Update MVP if provided
        if (mvp) {
          updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
        }
      } else {
        // Update other rounds
        if (!Array.isArray(updatedBracket[round])) updatedBracket[round] = [];
        if (!updatedBracket[round][index]) {
          updatedBracket[round][index] = {
            team1: '',
            team1Seed: null,
            team2: '',
            team2Seed: null,
            conference: round === ROUND_KEYS.CONF_FINALS ? (index === 0 ? 'East' : 'West') :
                       (index < (round === ROUND_KEYS.CONF_SEMIS ? 2 : 4) ? 'East' : 'West')
          };
        }
        updatedBracket[round][index] = {
          ...updatedBracket[round][index],
          winner,
          winnerSeed,
          numGames
        };
        
        // Update next rounds
        updateNextRound(updatedBracket, round, index, winner, winnerSeed);
      }
      
      // Update without filtering by PLAY_IN
      onUpdate(updatedBracket);
    };
    
    // Modified MVP selection that works like the admin version
    const handleMVPSelect = (mvp) => {
      // Create a complete update object
      const updatedBracket = JSON.parse(JSON.stringify(data));
      
      // Update Finals MVP in both places
      updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
      
      // Also update in NBA Finals object
      if (updatedBracket[ROUND_KEYS.NBA_FINALS]) {
        updatedBracket[ROUND_KEYS.NBA_FINALS].predictedMVP = mvp;
      }
      
      // Update with complete data
      onUpdate(updatedBracket);
    };
    
    return (
      <BracketEditor
        bracketData={data}
        onSeriesPrediction={handleSeriesPrediction}
        onMVPSelect={handleMVPSelect}
        isAdmin={false}
        isLocked={isLocked}
        hasPlayInTournament={hasPlayInTournament}
        mvpPredictionMode={mvpPredictionMode} // Keep for UI display
        showMvpAtBottom={true}
        teamPlayers={teamPlayers}
        officialMVP={officialMVP}
      />
    );
  };

  return (
    <BaseEditor
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      hideBackButton={hideBackButton}
      entryType={mvpPredictionMode ? `${ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} Prediction` : "Playoffs Bracket"}
      fetchData={fetchBracketData}
      createEmptyEntry={createEmptyBracket}
      saveEntry={saveBracket}
      resetEntry={(gameData, userEntry) => createEmptyBracket(gameData, userEntry)}
      instructions={bracketInstructions}
      EditorComponent={BracketEditorWrapper}
      mvpPredictionMode={mvpPredictionMode} // Keep for UI display
    />
  );
};

export default BracketEdit;
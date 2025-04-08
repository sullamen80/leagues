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
  mvpPredictionMode = false
}) => {
  // Only keeping track of hasPlayInTournament for compatibility
  const [hasPlayInTournament, setHasPlayInTournament] = useState(propHasPlayInTournament);

  useEffect(() => {
    console.log("BracketEdit props on mount:", { hasPlayInTournament: propHasPlayInTournament, mvpPredictionMode });
  }, [propHasPlayInTournament, mvpPredictionMode]);

  // Simple instruction object
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
    console.log("Fetching data for league:", leagueId, "user:", userId);
    
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
            console.log("Bracket is locked");
          }
          if (mvpPredictionMode && lockData[ROUND_KEYS.NBA_FINALS]?.locked) {
            isBracketLocked = true;
            console.log("Finals MVP prediction is locked");
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
      console.log("Tournament data loaded:", gameData);
      console.log("MVP candidates in gameData:", gameData.mvpCandidates);
      
      // Ensure FirstRound structure exists
      if (!gameData[ROUND_KEYS.FIRST_ROUND] || !Array.isArray(gameData[ROUND_KEYS.FIRST_ROUND])) {
        console.warn("Tournament data is missing or has invalid FirstRound structure");
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
          console.log("Bracket locked because tournament is completed");
        } else {
          const firstRoundStarted = gameData[ROUND_KEYS.FIRST_ROUND]?.some(match => match && match.winner);
          if (firstRoundStarted) {
            isBracketLocked = true;
            console.log("Bracket locked because First Round has started");
          }
        }
      }
      
      // Fetch user bracket data
      let userEntry = null;
      const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
      const userBracketSnap = await getDoc(userBracketRef);
      
      if (userBracketSnap.exists()) {
        userEntry = userBracketSnap.data();
        console.log("User bracket loaded:", userEntry);
      }
      
      // Create an empty bracket if needed
      if (!userEntry) {
        userEntry = createEmptyBracket(gameData);
      }
      
      // IMPORTANT: Include mvpCandidates from gameData in the userEntry
      // This ensures the MVP selector has access to the player names
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

  const createEmptyBracket = (template) => {
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
    
    // If Play-In tournament data exists, preserve it
    if (template[ROUND_KEYS.PLAY_IN]) {
      emptyRounds[ROUND_KEYS.PLAY_IN] = template[ROUND_KEYS.PLAY_IN];
    }
    
    return { ...emptyBracket, ...emptyRounds };
  };
  
  const saveBracket = async (leagueId, userId, bracketData) => {
    try {
      const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
      const userBracketSnap = await getDoc(userBracketRef);
      let currentData = userBracketSnap.exists() ? userBracketSnap.data() : {};

      if (mvpPredictionMode) {
        const updateData = {
          ...currentData,
          [ROUND_KEYS.FINALS_MVP]: bracketData[ROUND_KEYS.FINALS_MVP],
          updatedAt: new Date().toISOString()
        };
        if (updateData[ROUND_KEYS.NBA_FINALS]) {
          updateData[ROUND_KEYS.NBA_FINALS].predictedMVP = bracketData[ROUND_KEYS.FINALS_MVP];
        }
        await setDoc(userBracketRef, updateData, { merge: true });
        return;
      }

      // Regular bracket save
      await setDoc(userBracketRef, {
        ...currentData,
        ...bracketData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving bracket:", error);
      throw error;
    }
  };
  
  const handleSelectWinner = (bracket, round, index, winner, winnerSeed, numGames, mvp = null) => {
    const updatedBracket = { ...bracket };
    
    const standardRound = round in ROUND_KEYS ? round : (
      round === 'FirstRound' ? ROUND_KEYS.FIRST_ROUND :
      round === 'ConferenceSemis' ? ROUND_KEYS.CONF_SEMIS :
      round === 'ConferenceFinals' ? ROUND_KEYS.CONF_FINALS :
      round === 'NBAFinals' ? ROUND_KEYS.NBA_FINALS : round
    );
    
    if (standardRound === ROUND_KEYS.NBA_FINALS) {
      updatedBracket[ROUND_KEYS.NBA_FINALS] = {
        ...updatedBracket[ROUND_KEYS.NBA_FINALS],
        winner,
        winnerSeed,
        numGames,
        predictedMVP: mvp || updatedBracket[ROUND_KEYS.NBA_FINALS].predictedMVP || ''
      };
      updatedBracket[ROUND_KEYS.CHAMPION] = winner;
      updatedBracket.ChampionSeed = winnerSeed;
      if (mvp) {
        updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
      }
    } else {
      if (!Array.isArray(updatedBracket[standardRound])) {
        updatedBracket[standardRound] = [];
      }
      if (!updatedBracket[standardRound][index]) {
        updatedBracket[standardRound][index] = {
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: standardRound === ROUND_KEYS.CONF_FINALS ? (index === 0 ? 'East' : 'West') :
                     (index < (standardRound === ROUND_KEYS.CONF_SEMIS ? 2 : 4) ? 'East' : 'West')
        };
      }
      updatedBracket[standardRound][index] = {
        ...updatedBracket[standardRound][index],
        winner,
        winnerSeed,
        numGames
      };
      updateNextRound(updatedBracket, standardRound, index, winner, winnerSeed);
    }
    
    return updatedBracket;
  };
  
  const handleSelectFinalsMVP = (bracket, mvp) => {
    const updatedBracket = { ...bracket };
    updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
    if (updatedBracket[ROUND_KEYS.NBA_FINALS]) {
      updatedBracket[ROUND_KEYS.NBA_FINALS] = {
        ...updatedBracket[ROUND_KEYS.NBA_FINALS],
        predictedMVP: mvp
      };
    }
    return updatedBracket;
  };
  
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
        const confFinals = bracket[ROUND_KEYS.CONF_FINALS] || [];
        const eastWinner = matchupIndex === 0 ? winner : confFinals[0]?.winner || '';
        const eastWinnerSeed = matchupIndex === 0 ? winnerSeed : confFinals[0]?.winnerSeed || null;
        const westWinner = matchupIndex === 1 ? winner : confFinals[1]?.winner || '';
        const westWinnerSeed = matchupIndex === 1 ? winnerSeed : confFinals[1]?.winnerSeed || null;
        
        if (eastWinner && westWinner) {
          bracket[ROUND_KEYS.NBA_FINALS] = {
            team1: eastWinner,
            team1Seed: eastWinnerSeed,
            team2: westWinner,
            team2Seed: westWinnerSeed,
            winner: '',
            winnerSeed: null,
            numGames: null,
            predictedMVP: bracket[ROUND_KEYS.NBA_FINALS]?.predictedMVP || ''
          };
        }
        bracket[ROUND_KEYS.CHAMPION] = '';
        bracket.ChampionSeed = null;
      }
      return;
    }
    
    let nextMatchupIndex;
    let isFirstTeam;
    const conference = currentRound === ROUND_KEYS.CONF_FINALS ? 
                      (matchupIndex === 0 ? 'East' : 'West') :
                      (matchupIndex < (currentRound === ROUND_KEYS.CONF_SEMIS ? 2 : 4) ? 'East' : 'West');
    
    if (currentRound === ROUND_KEYS.FIRST_ROUND) {
      nextMatchupIndex = conference === 'East' ? 
                       Math.floor(matchupIndex / 2) : 
                       Math.floor((matchupIndex - 4) / 2) + 2;
      isFirstTeam = matchupIndex % 2 === 0;
    } else if (currentRound === ROUND_KEYS.CONF_SEMIS) {
      nextMatchupIndex = conference === 'East' ? 0 : 1;
      isFirstTeam = matchupIndex % 2 === 0;
    } else {
      return;
    }
    
    const nextRoundArray = bracket[nextRound] = Array.isArray(bracket[nextRound]) ? 
      [...bracket[nextRound]] : [];
    
    if (!nextRoundArray[nextMatchupIndex]) {
      nextRoundArray[nextMatchupIndex] = {
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
    
    if (isFirstTeam) {
      nextRoundArray[nextMatchupIndex].team1 = winner;
      nextRoundArray[nextMatchupIndex].team1Seed = winnerSeed;
    } else {
      nextRoundArray[nextMatchupIndex].team2 = winner;
      nextRoundArray[nextMatchupIndex].team2Seed = winnerSeed;
    }
    
    nextRoundArray[nextMatchupIndex].winner = '';
    nextRoundArray[nextMatchupIndex].winnerSeed = null;
    nextRoundArray[nextMatchupIndex].numGames = null;
    
    bracket[nextRound] = nextRoundArray;
    clearSubsequentRounds(bracket, nextRound, nextMatchupIndex);
  };
  
  const clearSubsequentRounds = (bracket, startRound, matchupIndex) => {
    const roundOrder = [
      ROUND_KEYS.FIRST_ROUND, 
      ROUND_KEYS.CONF_SEMIS, 
      ROUND_KEYS.CONF_FINALS, 
      ROUND_KEYS.NBA_FINALS
    ];
    
    const startIndex = roundOrder.indexOf(startRound);
    if (startIndex === -1 || startIndex >= roundOrder.length - 1) return;
    
    for (let i = startIndex + 1; i < roundOrder.length; i++) {
      const round = roundOrder[i];
      
      if (round === ROUND_KEYS.NBA_FINALS) {
        if (roundOrder[i-1] === ROUND_KEYS.CONF_FINALS) {
          const conference = matchupIndex === 0 ? 'East' : 'West';
          if (conference === 'East') {
            if (bracket[round]) {
              bracket[round].team1 = '';
              bracket[round].team1Seed = null;
            }
          } else {
            if (bracket[round]) {
              bracket[round].team2 = '';
              bracket[round].team2Seed = null;
            }
          }
          if (bracket[round]) {
            bracket[round].winner = '';
            bracket[round].winnerSeed = null;
            bracket[round].numGames = null;
          }
          bracket[ROUND_KEYS.CHAMPION] = '';
          bracket.ChampionSeed = null;
        }
      } else if (Array.isArray(bracket[round])) {
        let affectedIndices = [];
        if ((startRound === ROUND_KEYS.FIRST_ROUND) && (round === ROUND_KEYS.CONF_SEMIS)) {
          const conference = matchupIndex < 4 ? 'East' : 'West';
          if (conference === 'East') {
            affectedIndices = [Math.floor(matchupIndex / 2)];
          } else {
            affectedIndices = [Math.floor((matchupIndex - 4) / 2) + 2];
          }
        } else if ((startRound === ROUND_KEYS.CONF_SEMIS) && (round === ROUND_KEYS.CONF_FINALS)) {
          const conference = matchupIndex < 2 ? 'East' : 'West';
          affectedIndices = [conference === 'East' ? 0 : 1];
        }
        
        for (const idx of affectedIndices) {
          if (bracket[round][idx]) {
            bracket[round][idx].winner = '';
            bracket[round][idx].winnerSeed = null;
            bracket[round][idx].numGames = null;
          }
        }
      }
    }
  };
  
  // Simple bracket editor wrapper
  const BracketEditorWrapper = ({ data, onUpdate, isLocked }) => {

    const teamPlayers = data?.mvpCandidates || {};
    const officialMVP = data?.[ROUND_KEYS.FINALS_MVP] || null;
    useEffect(() => {
      console.log("BracketEditor received data:", {
        hasFirstRound: Array.isArray(data[ROUND_KEYS.FIRST_ROUND]),
        hasData: !!data,
        isLocked
      });
    }, [data, isLocked]);
    
    const handleSeriesPrediction = (round, index, winner, winnerSeed, numGames, mvp) => {
      const updatedBracket = handleSelectWinner(data, round, index, winner, winnerSeed, numGames, mvp);
      onUpdate(updatedBracket);
    };
    
    const handleMVPSelect = (mvp) => {
      const updatedBracket = handleSelectFinalsMVP(data, mvp);
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
        mvpPredictionMode={mvpPredictionMode}
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
      resetEntry={createEmptyBracket}
      instructions={bracketInstructions}
      EditorComponent={BracketEditorWrapper}
      mvpPredictionMode={mvpPredictionMode}
    />
  );
};

export default BracketEdit;
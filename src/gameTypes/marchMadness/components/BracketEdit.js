// src/gameTypes/marchMadness/components/BracketEdit.js
import React from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import BaseEditor from '../../../gameTypes/common/components/BaseEditor';
import BracketEditor from './BracketEditor';

/**
 * Component for editing a user's March Madness bracket
 * Uses BaseEditor for common editing functionality
 */
const BracketEdit = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false
}) => {
  // Bracket-specific instructions
  const bracketInstructions = {
    title: "How to fill out your bracket:",
    items: [
      "Click on a team name to select them as the winner of that matchup",
      "Winners will automatically advance to the next round",
      "You can change your picks at any time until the tournament begins",
      "Don't forget to save your bracket when you're done!"
    ]
  };
  
  // Fetch tournament data and user bracket
  const fetchBracketData = async (leagueId, userId) => {
    console.log("Fetching data for league:", leagueId, "user:", userId);
    
    // Check lock status from locks subcollection
    let isLocked = false;
    try {
      const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
      const locksSnap = await getDoc(locksRef);
      
      if (locksSnap.exists()) {
        const lockData = locksSnap.data();
        // If RoundOf64 is locked, the entire bracket is locked
        if (lockData.RoundOf64?.locked) {
          isLocked = true;
          console.log("Bracket is locked");
        }
      }
    } catch (lockErr) {
      console.error('Error fetching lock status:', lockErr);
      // Continue anyway - assume not locked
    }
    
    // Get tournament data (will be used as template for new brackets)
    const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("Tournament data not found");
    }
    
    const gameData = tournamentSnap.data();
    
    // Get user's bracket if it exists
    let userEntry = null;
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    
    if (userBracketSnap.exists()) {
      userEntry = userBracketSnap.data();
      console.log("User bracket loaded");
    }
    
    return { gameData, userEntry, isLocked };
  };
  
  // Create an empty bracket from tournament template
  const createEmptyBracket = (template) => {
    // Ensure template exists
    if (!template) return null;
    
    // Start with a copy of template
    const emptyBracket = { ...template };
    
    // Ensure RoundOf64 exists and contains the initial matchups
    if (!Array.isArray(emptyBracket.RoundOf64)) {
      emptyBracket.RoundOf64 = [];
    }
    
    // Clear winners for Round of 64
    emptyBracket.RoundOf64 = (emptyBracket.RoundOf64 || []).map(matchup => ({
      ...matchup,
      winner: '',
      winnerSeed: null
    }));
    
    // Initialize or clear other rounds
    const emptyRounds = {
      RoundOf32: Array(16).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      Sweet16: Array(8).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      Elite8: Array(4).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      FinalFour: Array(2).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      Championship: { 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      },
      Champion: '',
      ChampionSeed: null
    };
    
    return { ...emptyBracket, ...emptyRounds };
  };
  
  // Save bracket to Firestore
  const saveBracket = async (leagueId, userId, bracketData) => {
    await setDoc(doc(db, "leagues", leagueId, "userData", userId), {
      ...bracketData,
      updatedAt: new Date().toISOString()
    });
  };
  
  // Handle selecting a winner for a matchup
  const handleSelectWinner = (bracket, round, index, winner, winnerSeed) => {
    // Create a copy of the bracket to modify
    const updatedBracket = { ...bracket };
    
    // Handle special case for Championship round
    if (round === 'Championship') {
      updatedBracket.Championship = {
        ...updatedBracket.Championship,
        winner,
        winnerSeed
      };
      
      // Also update the Champion field
      updatedBracket.Champion = winner;
      updatedBracket.ChampionSeed = winnerSeed;
    } 
    // Handle regular rounds (arrays of matchups)
    else {
      // Ensure the round array exists
      if (!Array.isArray(updatedBracket[round])) {
        updatedBracket[round] = [];
      }
      
      // Ensure the matchup at this index exists
      if (!updatedBracket[round][index]) {
        updatedBracket[round][index] = {
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', winnerSeed: null
        };
      }
      
      // Update the winner
      updatedBracket[round][index] = {
        ...updatedBracket[round][index],
        winner,
        winnerSeed
      };
      
      // Update the next round's matchups
      updateNextRound(updatedBracket, round, index, winner, winnerSeed);
    }
    
    return updatedBracket;
  };
  
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
  
  // Special case for Elite8 to FinalFour - use configuration from tournament data
  if (currentRound === 'Elite8' && nextRound === 'FinalFour') {
    // Get the region for this matchup
    let region = '';
    if (matchupIndex === 0) region = 'East';
    else if (matchupIndex === 1) region = 'West';
    else if (matchupIndex === 2) region = 'Midwest';
    else if (matchupIndex === 3) region = 'South';
    
    // Get the Final Four configuration (or use default)
    const finalFourConfig = bracket.finalFourConfig || {
      semifinal1: { region1: 'South', region2: 'West' },
      semifinal2: { region1: 'East', region2: 'Midwest' }
    };
    
    // Determine which Final Four matchup this should go into
    let finalFourIndex, isFirstTeam;
    
    // Check semifinal 1
    if (region === finalFourConfig.semifinal1.region1) {
      finalFourIndex = 0;
      isFirstTeam = true;
    } else if (region === finalFourConfig.semifinal1.region2) {
      finalFourIndex = 0;
      isFirstTeam = false;
    } 
    // Check semifinal 2
    else if (region === finalFourConfig.semifinal2.region1) {
      finalFourIndex = 1;
      isFirstTeam = true;
    } else if (region === finalFourConfig.semifinal2.region2) {
      finalFourIndex = 1;
      isFirstTeam = false;
    } 
    // Fallback to default pattern if not found
    else {
      console.warn(`Region ${region} not found in Final Four config. Using default placement.`);
      if (region === 'South') {
        finalFourIndex = 0;
        isFirstTeam = true;
      } else if (region === 'West') {
        finalFourIndex = 0;
        isFirstTeam = false;
      } else if (region === 'East') {
        finalFourIndex = 1;
        isFirstTeam = true;
      } else if (region === 'Midwest') {
        finalFourIndex = 1;
        isFirstTeam = false;
      } else {
        // Last resort fallback to old logic
        finalFourIndex = Math.floor(matchupIndex / 2);
        isFirstTeam = matchupIndex % 2 === 0;
      }
    }
    
    // Ensure FinalFour array exists
    if (!Array.isArray(bracket.FinalFour)) {
      bracket.FinalFour = [
        { team1: '', team1Seed: null, team2: '', team2Seed: null, winner: '', winnerSeed: null },
        { team1: '', team1Seed: null, team2: '', team2Seed: null, winner: '', winnerSeed: null }
      ];
    }
    
    // Ensure the matchup exists
    if (!bracket.FinalFour[finalFourIndex]) {
      bracket.FinalFour[finalFourIndex] = {
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      };
    }
    
    // Update the team in the Final Four
    if (isFirstTeam) {
      bracket.FinalFour[finalFourIndex].team1 = winner;
      bracket.FinalFour[finalFourIndex].team1Seed = winnerSeed;
    } else {
      bracket.FinalFour[finalFourIndex].team2 = winner;
      bracket.FinalFour[finalFourIndex].team2Seed = winnerSeed;
    }
    
    // Reset winner
    bracket.FinalFour[finalFourIndex].winner = '';
    bracket.FinalFour[finalFourIndex].winnerSeed = null;
    
    // Clear Championship
    bracket.Championship = {
      team1: '', team1Seed: null,
      team2: '', team2Seed: null,
      winner: '', winnerSeed: null
    };
    bracket.Champion = '';
    bracket.ChampionSeed = null;
    
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
        // Only reset if we're directly affecting the championship
        if (roundOrder[i-1] === 'FinalFour' && (nextMatchupIndex === 0)) {
          bracket.Championship.winner = '';
          bracket.Championship.winnerSeed = null;
          bracket.Champion = '';
          bracket.ChampionSeed = null;
        }
      } 
      // For array rounds
      else if (Array.isArray(bracket[round]) && bracket[round][nextMatchupIndex]) {
        // Only reset the winner, not the teams
        if (bracket[round][nextMatchupIndex].winner) {
          bracket[round][nextMatchupIndex].winner = '';
          bracket[round][nextMatchupIndex].winnerSeed = null;
        }
      }
    }
  };
  
  // BracketEditor wrapper component that handles the bracket-specific logic
  const BracketEditorWrapper = ({ data, onUpdate, isLocked }) => {
    const handleWinnerSelect = (round, index, winner, winnerSeed) => {
      const updatedBracket = handleSelectWinner(data, round, index, winner, winnerSeed);
      onUpdate(updatedBracket);
    };
    
    return (
      <BracketEditor
        bracketData={data}
        onSelectWinner={handleWinnerSelect}
        isAdmin={false}
        isLocked={isLocked}
      />
    );
  };
  
  return (
    <BaseEditor
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      hideBackButton={hideBackButton}
      entryType="Bracket"
      fetchData={fetchBracketData}
      createEmptyEntry={createEmptyBracket}
      saveEntry={saveBracket}
      resetEntry={createEmptyBracket}
      instructions={bracketInstructions}
      EditorComponent={BracketEditorWrapper}
    />
  );
};

export default BracketEdit;
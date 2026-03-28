// src/gameTypes/marchMadness/hooks/useBracket.js
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { 
  getUserBracket, 
  saveUserBracket, 
  saveUserBracketRound, 
  createUserBracketFromTemplate,
  repairUserBracket 
} from '../services/bracketService';
import { listenToLockStatus } from '../services/tournamentService';
import { 
  getNextRound, 
  repairBracket, 
  getRegionName, 
  getFinalFourMatchup,
  computeFinalFour
} from '../utils/bracketUtils';

/**
 * Custom hook for working with a user's bracket
 * @param {string} leagueId - League ID
 * @param {string} [userId] - User ID (defaults to current user)
 * @param {boolean} [readOnly=false] - Whether bracket is read-only
 * @returns {Object} Bracket data and functions
 */
const useBracket = (leagueId, userId = null, readOnly = false) => {
  const [bracketData, setBracketData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lockStatus, setLockStatus] = useState({});
  const [feedback, setFeedback] = useState('');
  const [initialized, setInitialized] = useState(false);
  
  // Default to current user if not specified
  const currentUserId = auth.currentUser?.uid;
  const targetUserId = userId || currentUserId;
  
  // Load bracket data and lock status
  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return () => {};
    }
    
    if (!targetUserId) {
      setError("User ID is required. Make sure you're logged in.");
      setIsLoading(false);
      return () => {};
    }
    
    setIsLoading(true);
    
    // Listen for lock status changes
    const lockUnsubscribe = listenToLockStatus(
      leagueId,
      (locksData) => {
        setLockStatus(locksData);
      },
      (err) => {
        console.error("Error listening to locks:", err);
      }
    );
    
    // Listen for bracket changes
    const bracketRef = doc(db, "leagues", leagueId, "userData", targetUserId);
    const bracketUnsubscribe = onSnapshot(
      bracketRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setBracketData(docSnapshot.data());
          setInitialized(true);
        } else {
          // Bracket doesn't exist yet - try to create it
          if (!readOnly && targetUserId === currentUserId) {
            initializeBracket();
          } else {
            setError("Bracket not found");
          }
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Error listening to bracket:", err);
        setError(`Error loading bracket: ${err.message}`);
        setIsLoading(false);
      }
    );
    
    return () => {
      lockUnsubscribe();
      bracketUnsubscribe();
    };
  }, [leagueId, targetUserId]);
  
  // Initialize bracket for current user
  const initializeBracket = useCallback(async () => {
    if (!leagueId || !targetUserId || readOnly || targetUserId !== currentUserId) return;
    
    try {
      setIsLoading(true);
      const result = await createUserBracketFromTemplate(leagueId, targetUserId);
      
      if (result) {
        setFeedback("Bracket created successfully!");
        setTimeout(() => setFeedback(''), 3000);
      } else {
        setError("Failed to create bracket");
      }
      
      setInitialized(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Error initializing bracket:", err);
      setError(`Error initializing bracket: ${err.message}`);
      setIsLoading(false);
    }
  }, [leagueId, targetUserId, readOnly, currentUserId]);
  
  // Check if bracket is locked
  const isRoundLocked = useCallback((round) => {
    return lockStatus[round]?.locked || false;
  }, [lockStatus]);
  
  // Save the entire bracket
  const saveBracket = useCallback(async (data) => {
    if (readOnly || !leagueId || !targetUserId || targetUserId !== currentUserId) {
      setFeedback("Cannot save bracket - read only or not logged in");
      setTimeout(() => setFeedback(''), 3000);
      return false;
    }
    
    if (isRoundLocked('RoundOf64')) {
      setFeedback("Cannot save bracket - tournament has started");
      setTimeout(() => setFeedback(''), 3000);
      return false;
    }
    
    try {
      setIsSaving(true);
      
      // Use provided data or current state
      const bracketToSave = data || bracketData;
      
      // Save to Firebase
      await saveUserBracket(leagueId, targetUserId, bracketToSave);
      
      setFeedback("Bracket saved successfully!");
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error("Error saving bracket:", err);
      setError(`Error saving bracket: ${err.message}`);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return false;
    }
  }, [leagueId, targetUserId, currentUserId, bracketData, readOnly, isRoundLocked]);
  
  // Save a specific round in the bracket
  const saveRound = useCallback(async (roundName, roundData) => {
    if (readOnly || !leagueId || !targetUserId || targetUserId !== currentUserId) {
      setFeedback("Cannot save round - read only or not logged in");
      setTimeout(() => setFeedback(''), 3000);
      return false;
    }
    
    if (isRoundLocked(roundName)) {
      setFeedback(`Cannot save ${roundName} - this round is locked`);
      setTimeout(() => setFeedback(''), 3000);
      return false;
    }
    
    try {
      setIsSaving(true);
      
      // Save round to Firebase
      await saveUserBracketRound(leagueId, targetUserId, roundName, roundData);
      
      // Update local state
      setBracketData(prevData => ({
        ...prevData,
        [roundName]: roundData
      }));
      
      setFeedback(`${roundName} saved successfully!`);
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error(`Error saving ${roundName}:`, err);
      setError(`Error saving ${roundName}: ${err.message}`);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return false;
    }
  }, [leagueId, targetUserId, currentUserId, readOnly, isRoundLocked]);
  
  // Update a winner in the bracket
  const updateWinner = useCallback(async (round, matchupIndex, winner, winnerSeed) => {
    if (readOnly || !leagueId || !targetUserId || targetUserId !== currentUserId) {
      return false;
    }
    
    if (isRoundLocked(round)) {
      setFeedback(`Cannot update ${round} - this round is locked`);
      setTimeout(() => setFeedback(''), 3000);
      return false;
    }
    
    try {
      setIsSaving(true);
      
      // Make a copy of the current bracket
      const updatedBracket = { ...bracketData };
      
      // Handle Championship round (object, not array)
      if (round === 'Championship') {
        updatedBracket.Championship = {
          ...updatedBracket.Championship,
          winner,
          winnerSeed
        };
        
        // Also update Champion field
        updatedBracket.Champion = winner;
        updatedBracket.ChampionSeed = winnerSeed;
        
        // Save Championship and Champion
        await saveUserBracketRound(leagueId, targetUserId, 'Championship', updatedBracket.Championship);
        await saveUserBracketRound(leagueId, targetUserId, 'Champion', winner);
        
        // Update local state
        setBracketData(updatedBracket);
      } 
      // Handle regular rounds (arrays)
      else {
        // Ensure round array exists
        if (!Array.isArray(updatedBracket[round])) {
          updatedBracket[round] = [];
        }
        
        // Ensure the target matchup exists
        if (!updatedBracket[round][matchupIndex]) {
          updatedBracket[round][matchupIndex] = {
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null
          };
        }
        
        // Update the winner
        updatedBracket[round][matchupIndex] = {
          ...updatedBracket[round][matchupIndex],
          winner,
          winnerSeed
        };
        
        // Update next round
        updateNextRound(updatedBracket, round, matchupIndex, winner, winnerSeed);
        
        // Save current round
        await saveUserBracketRound(leagueId, targetUserId, round, updatedBracket[round]);
        
        // Save next round if it exists
        const nextRound = getNextRound(round);
        if (nextRound && updatedBracket[nextRound]) {
          await saveUserBracketRound(leagueId, targetUserId, nextRound, updatedBracket[nextRound]);
        }
        
        // Update local state
        setBracketData(updatedBracket);
      }
      
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error(`Error updating winner in ${round}:`, err);
      setError(`Error updating winner: ${err.message}`);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return false;
    }
  }, [leagueId, targetUserId, currentUserId, bracketData, readOnly, isRoundLocked]);
  
  // Update next round when a winner is selected
  const updateNextRound = (bracket, currentRound, matchupIndex, winner, winnerSeed) => {
    const nextRoundName = getNextRound(currentRound);
    if (!nextRoundName) return;
    
    // Special case for Championship
    if (nextRoundName === 'Championship') {
      // For FinalFour to Championship, we need both winners
      const finalFour = bracket.FinalFour || [];
      
      // Check if both Final Four matchups have winners
      if (finalFour[0]?.winner && finalFour[1]?.winner) {
        bracket.Championship = {
          team1: finalFour[0].winner,
          team1Seed: finalFour[0].winnerSeed,
          team2: finalFour[1].winner,
          team2Seed: finalFour[1].winnerSeed,
          winner: bracket.Championship?.winner || '',
          winnerSeed: bracket.Championship?.winnerSeed || null
        };
      }
      
      return;
    }
    
    // Special case for Elite8 to FinalFour with region-based matchups
    if (currentRound === 'Elite8' && nextRoundName === 'FinalFour') {
      // Get the region for this Elite8 matchup
      const region = getRegionName('Elite8', matchupIndex);
      
      // Get Final Four placement based on region
      const finalFourPlacement = getFinalFourMatchup(region);
      
      if (finalFourPlacement) {
        const { matchupIndex: finalFourIndex, isFirstTeam } = finalFourPlacement;
        
        // Ensure FinalFour array exists
        if (!Array.isArray(bracket.FinalFour)) {
          bracket.FinalFour = [
            { team1: '', team1Seed: null, team2: '', team2Seed: null, winner: '', winnerSeed: null },
            { team1: '', team1Seed: null, team2: '', team2Seed: null, winner: '', winnerSeed: null }
          ];
        }
        
        // Ensure the target matchup exists
        if (!bracket.FinalFour[finalFourIndex]) {
          bracket.FinalFour[finalFourIndex] = {
            team1: '', team1Seed: null,
            team2: '', team2Seed: null,
            winner: '', winnerSeed: null
          };
        }
        
        // Update the appropriate team in the Final Four matchup
        if (isFirstTeam) {
          bracket.FinalFour[finalFourIndex].team1 = winner;
          bracket.FinalFour[finalFourIndex].team1Seed = winnerSeed;
        } else {
          bracket.FinalFour[finalFourIndex].team2 = winner;
          bracket.FinalFour[finalFourIndex].team2Seed = winnerSeed;
        }
        
        // Reset winner if teams have changed
        const existingMatchup = bracket.FinalFour[finalFourIndex];
        if ((isFirstTeam && existingMatchup.team1 !== winner) ||
            (!isFirstTeam && existingMatchup.team2 !== winner)) {
          bracket.FinalFour[finalFourIndex].winner = '';
          bracket.FinalFour[finalFourIndex].winnerSeed = null;
          
          // Clear Championship
          clearSubsequentRounds(bracket, 'FinalFour', finalFourIndex);
        }
        
        return;
      }
    }
    
    // For other rounds
    const nextMatchupIndex = Math.floor(matchupIndex / 2);
    const isFirstTeam = matchupIndex % 2 === 0;
    
    // Create next round array if it doesn't exist
    if (!Array.isArray(bracket[nextRoundName])) {
      bracket[nextRoundName] = [];
    }
    
    // Create next matchup if it doesn't exist
    if (!bracket[nextRoundName][nextMatchupIndex]) {
      bracket[nextRoundName][nextMatchupIndex] = {
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      };
    }
    
    // Update team in next matchup
    if (isFirstTeam) {
      bracket[nextRoundName][nextMatchupIndex].team1 = winner;
      bracket[nextRoundName][nextMatchupIndex].team1Seed = winnerSeed;
    } else {
      bracket[nextRoundName][nextMatchupIndex].team2 = winner;
      bracket[nextRoundName][nextMatchupIndex].team2Seed = winnerSeed;
    }
    
    // Reset winner if teams have changed
    const existingMatchup = bracket[nextRoundName][nextMatchupIndex];
    if ((isFirstTeam && existingMatchup.team1 !== winner) ||
        (!isFirstTeam && existingMatchup.team2 !== winner)) {
      bracket[nextRoundName][nextMatchupIndex].winner = '';
      bracket[nextRoundName][nextMatchupIndex].winnerSeed = null;
      
      // Clear subsequent rounds
      clearSubsequentRounds(bracket, nextRoundName, nextMatchupIndex);
    }
  };
  
  // Clear all rounds after a change
  const clearSubsequentRounds = (bracket, startRound, matchupIndex) => {
    const roundOrder = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
    const startIndex = roundOrder.indexOf(startRound);
    
    if (startIndex === -1 || startIndex >= roundOrder.length - 1) return;
    
    // Process each subsequent round
    for (let i = startIndex + 1; i < roundOrder.length; i++) {
      const roundName = roundOrder[i];
      const nextMatchupIndex = Math.floor(matchupIndex / Math.pow(2, i - startIndex));
      
      // Championship is a special case (object, not array)
      if (roundName === 'Championship') {
        bracket.Championship = { 
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', winnerSeed: null
        };
        bracket.Champion = '';
        bracket.ChampionSeed = null;
      } 
      // For array rounds
      else if (Array.isArray(bracket[roundName]) && bracket[roundName][nextMatchupIndex]) {
        // Clear the affected matchup
        bracket[roundName][nextMatchupIndex] = {
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', winnerSeed: null
        };
      }
    }
  };
  
  // Repair a damaged bracket
  const repairBracketData = useCallback(async () => {
    if (!leagueId || !targetUserId) return false;
    
    try {
      setIsSaving(true);
      
      if (bracketData) {
        // Use local repair if we have data
        const repairedData = repairBracket(bracketData);
        await saveUserBracket(leagueId, targetUserId, repairedData);
        setBracketData(repairedData);
      } else {
        // Use server repair if no local data
        await repairUserBracket(leagueId, targetUserId);
      }
      
      setFeedback("Bracket repaired successfully!");
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error("Error repairing bracket:", err);
      setError(`Error repairing bracket: ${err.message}`);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return false;
    }
  }, [leagueId, targetUserId, bracketData]);
  
  // Get data for a specific round
  const getRoundData = useCallback((roundName) => {
    if (!bracketData) return null;
    
    if (roundName === 'Championship') {
      return bracketData.Championship || { 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      };
    } else if (roundName === 'Champion') {
      return bracketData.Champion || '';
    } else if (Array.isArray(bracketData[roundName])) {
      return bracketData[roundName];
    }
    
    return null;
  }, [bracketData]);
  
  return {
    // State
    bracketData,
    isLoading,
    isSaving,
    error,
    feedback,
    lockStatus,
    initialized,
    
    // Computed properties
    isLocked: isRoundLocked('RoundOf64'),
    
    // Data access
    getRoundData,
    
    // Actions
    initializeBracket,
    saveBracket,
    saveRound,
    updateWinner,
    repairBracket: repairBracketData,
    isRoundLocked
  };
};

export default useBracket;
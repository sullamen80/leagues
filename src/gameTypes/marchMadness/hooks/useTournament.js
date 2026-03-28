import { useState, useEffect, useCallback } from 'react';
import { auth } from '../../../../firebase';
import { 
  getGameData, 
  saveGameData, 
  listenToGameData 
} from '../services/tournamentService';
import { 
  getUserBracket, 
  saveUserBracket, 
  saveUserBracketRound, 
  listenToUserBracket 
} from '../services/bracketService';
import { getNextRound } from '../../../components/tournament/utils/tournamentUtils';

/**
 * Custom hook for managing tournament bracket data and operations
 * This is adapted from your existing useTournament hook
 */
const useTournament = (leagueId, mode = 'user', isLocked = false) => {
  const [tournamentData, setTournamentData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  
  const userId = auth.currentUser?.uid;
  
  // Initialize data - listen to tournament data and user bracket
  useEffect(() => {
    if (!leagueId) {
      setError('League ID is required');
      setIsLoading(false);
      return () => {};
    }
    
    let tournamentUnsubscribe = () => {};
    let userBracketUnsubscribe = () => {};
    
    // Always load tournament data
    tournamentUnsubscribe = listenToGameData(
      leagueId,
      (data) => {
        setTournamentData(data);
        
        // If admin mode, we're done loading
        if (mode === 'admin') {
          setIsLoading(false);
        } else if (mode === 'user' && !userId) {
          // If user mode but no userId, still allow viewing with tournament data
          setIsLoading(false);
        }
      },
      (err) => {
        console.error('Error loading tournament data:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );
    
    // For user mode, load user bracket data
    if (mode === 'user' && userId) {
      userBracketUnsubscribe = listenToUserBracket(
        leagueId,
        userId,
        (data) => {
          console.log('User bracket data loaded:', data);
          setUserBracket(data);
          setIsLoading(false);
        },
        (err) => {
          console.error('Error loading user bracket:', err);
          setError(err.message);
          setIsLoading(false);
        }
      );
    }
    
    return () => {
      tournamentUnsubscribe();
      userBracketUnsubscribe();
    };
  }, [leagueId, userId, mode]);
  
  // Get active data based on mode
  const getBracketData = () => {
    if (mode === 'admin') {
      return tournamentData || getDefaultGameData();
    }
    
    // For user mode, use userBracket if available, otherwise fall back to tournament data
    return userBracket || tournamentData || getDefaultGameData();
  };
  
  // Get a specific round
  const getRound = (roundName) => {
    const data = getBracketData();
    
    if (!data) return [];
    
    if (roundName === 'Championship') {
      return data.Championship || { team1: '', team2: '', winner: '' };
    } else if (roundName === 'Champion') {
      return data.Champion || '';
    }
    
    // Handle array rounds (RoundOf64, RoundOf32, etc.)
    const roundData = data[roundName];
    
    // If round data doesn't exist or is empty, return empty array
    if (!roundData || !Array.isArray(roundData) || roundData.length === 0) {
      return [];
    }
    
    // Expected lengths for each round
    const expectedLengths = {
      'RoundOf64': 32,
      'RoundOf32': 16,
      'Sweet16': 8,
      'Elite8': 4,
      'FinalFour': 2
    };
    
    // Filter out null entries and ensure all entries are properly structured
    let cleanedRound = roundData
      .filter(matchup => matchup !== null && matchup !== undefined)
      .map(matchup => ({
        team1: matchup.team1 || '',
        team1Seed: matchup.team1Seed !== undefined ? matchup.team1Seed : null,
        team2: matchup.team2 || '',
        team2Seed: matchup.team2Seed !== undefined ? matchup.team2Seed : null,
        winner: matchup.winner || '',
        winnerSeed: matchup.winnerSeed !== undefined ? matchup.winnerSeed : null
      }));
    
    // If we don't have enough entries after filtering out nulls, pad the array
    if (expectedLengths[roundName] && cleanedRound.length < expectedLengths[roundName]) {
      const emptyMatchups = Array(expectedLengths[roundName] - cleanedRound.length).fill().map(() => ({
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null
      }));
      
      cleanedRound = [...cleanedRound, ...emptyMatchups];
    }
    
    return cleanedRound;
  };
  
  // Clear all rounds after the specified round
  const clearSubsequentRounds = (bracketData, startRound, matchupIndex) => {
    const roundOrder = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
    const startIndex = roundOrder.indexOf(startRound);
    
    if (startIndex === -1 || startIndex >= roundOrder.length - 1) return bracketData;
    
    let updatedData = { ...bracketData };
    
    // Clear next rounds
    for (let i = startIndex + 1; i < roundOrder.length; i++) {
      const roundName = roundOrder[i];
      const nextMatchupIndex = Math.floor(matchupIndex / Math.pow(2, i - startIndex));
      
      if (roundName === 'Championship') {
        updatedData.Championship = { 
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', winnerSeed: null
        };
      } else {
        // Clear affected matchup in this round
        if (updatedData[roundName] && updatedData[roundName][nextMatchupIndex]) {
          // For the immediate next round, preserve teams but clear winner
          if (i === startIndex + 1) {
            updatedData[roundName][nextMatchupIndex] = {
              ...updatedData[roundName][nextMatchupIndex],
              winner: '',
              winnerSeed: null
            };
          } else {
            // For later rounds, clear everything
            updatedData[roundName][nextMatchupIndex] = {
              team1: '', team1Seed: null,
              team2: '', team2Seed: null,
              winner: '', winnerSeed: null
            };
          }
        }
      }
    }
    
    // Clear Champion
    updatedData.Champion = '';
    updatedData.ChampionSeed = null;
    
    return updatedData;
  };
  
  // Update next round when a winner is selected
  const updateNextRound = (bracketData, round, matchupIndex, winner, winnerSeed) => {
    const nextRoundName = getNextRound(round);
    if (!nextRoundName) return bracketData;
    
    let updatedData = { ...bracketData };
    
    // Special case for Championship
    if (nextRoundName === 'Championship') {
      // Both Final Four winners must be set
      const finalFour = updatedData.FinalFour || [];
      if (finalFour[0]?.winner && finalFour[1]?.winner) {
        updatedData.Championship = {
          team1: finalFour[0].winner,
          team1Seed: finalFour[0].winnerSeed,
          team2: finalFour[1].winner,
          team2Seed: finalFour[1].winnerSeed,
          winner: updatedData.Championship?.winner || '',
          winnerSeed: updatedData.Championship?.winnerSeed || null
        };
      }
      return updatedData;
    }
    
    // For other rounds
    const nextMatchupIndex = Math.floor(matchupIndex / 2);
    const isFirstTeamInNextMatchup = matchupIndex % 2 === 0;
    
    // Ensure next round array exists
    if (!updatedData[nextRoundName]) {
      updatedData[nextRoundName] = [];
    }
    
    // Ensure next matchup exists
    if (!updatedData[nextRoundName][nextMatchupIndex]) {
      updatedData[nextRoundName][nextMatchupIndex] = {
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      };
    }
    
    // Update team in next matchup
    if (isFirstTeamInNextMatchup) {
      updatedData[nextRoundName][nextMatchupIndex].team1 = winner;
      updatedData[nextRoundName][nextMatchupIndex].team1Seed = winnerSeed;
    } else {
      updatedData[nextRoundName][nextMatchupIndex].team2 = winner;
      updatedData[nextRoundName][nextMatchupIndex].team2Seed = winnerSeed;
    }
    
    // Clear winner if teams have changed
    const existingMatchup = bracketData[nextRoundName]?.[nextMatchupIndex] || {};
    if ((isFirstTeamInNextMatchup && existingMatchup.team1 !== winner) ||
        (!isFirstTeamInNextMatchup && existingMatchup.team2 !== winner)) {
      updatedData[nextRoundName][nextMatchupIndex].winner = '';
      updatedData[nextRoundName][nextMatchupIndex].winnerSeed = null;
      
      // Clear subsequent rounds
      updatedData = clearSubsequentRounds(updatedData, nextRoundName, nextMatchupIndex);
    }
    
    return updatedData;
  };
  
  // Handle winner selection
  const handleSelectWinner = useCallback(async (round, index, winner, winnerSeed) => {
    if (isLocked || !leagueId) return;
    
    try {
      setIsSaving(true);
      
      if (mode === 'admin') {
        // Admin mode updates
        let updatedTournament = { ...tournamentData };
        
        if (round === 'Championship') {
          // Determine championship winner seed
          let championshipWinnerSeed = null;
          if (winner === updatedTournament.Championship.team1) {
            championshipWinnerSeed = updatedTournament.Championship.team1Seed;
          } else if (winner === updatedTournament.Championship.team2) {
            championshipWinnerSeed = updatedTournament.Championship.team2Seed;
          }
          
          updatedTournament.Championship = {
            ...updatedTournament.Championship,
            winner,
            winnerSeed: championshipWinnerSeed
          };
          updatedTournament.Champion = winner;
          updatedTournament.ChampionSeed = championshipWinnerSeed;
        } else if (round === 'Champion') {
          updatedTournament.Champion = winner;
          updatedTournament.ChampionSeed = winnerSeed;
        } else {
          // Update winner in this round
          if (!updatedTournament[round]) {
            updatedTournament[round] = [];
          }
          
          if (!updatedTournament[round][index]) {
            updatedTournament[round][index] = { team1: '', team2: '', winner: '' };
          }
          
          // Determine the winner's seed
          let determinedWinnerSeed = null;
          const matchup = updatedTournament[round][index];
          
          if (winner === matchup.team1) {
            determinedWinnerSeed = matchup.team1Seed;
          } else if (winner === matchup.team2) {
            determinedWinnerSeed = matchup.team2Seed;
          }
          
          updatedTournament[round][index] = {
            ...updatedTournament[round][index],
            winner,
            winnerSeed: determinedWinnerSeed
          };
          
          // Update subsequent rounds
          updatedTournament = updateNextRound(updatedTournament, round, index, winner, determinedWinnerSeed);
        }
        
        // Save to Firestore
        await saveGameData(leagueId, updatedTournament);
        setFeedbackMessage('Tournament data updated');
      } else if (mode === 'user' && userId) {
        // User mode updates
        let updatedBracket = { ...userBracket };
        
        if (round === 'Championship') {
          console.log("Updating Championship winner:", winner);
          
          // Determine championship winner seed
          let championshipWinnerSeed = null;
          if (winner === updatedBracket.Championship?.team1) {
            championshipWinnerSeed = updatedBracket.Championship.team1Seed;
          } else if (winner === updatedBracket.Championship?.team2) {
            championshipWinnerSeed = updatedBracket.Championship.team2Seed;
          }
          
          // Ensure Championship object exists
          if (!updatedBracket.Championship) {
            updatedBracket.Championship = { 
              team1: "", team1Seed: null,
              team2: "", team2Seed: null,
              winner: "", winnerSeed: null
            };
          }
          
          // Update Championship and Champion
          updatedBracket.Championship = {
            ...updatedBracket.Championship,
            winner,
            winnerSeed: championshipWinnerSeed
          };
          
          updatedBracket.Champion = winner;
          updatedBracket.ChampionSeed = championshipWinnerSeed;
          
          // Save Championship directly to Firebase
          await saveUserBracketRound(leagueId, userId, 'Championship', updatedBracket.Championship);
          
          // Save Champion separately
          await saveUserBracketRound(leagueId, userId, 'Champion', winner);
          
          // Update local state
          setUserBracket(updatedBracket);
          
        } else if (round === 'Champion') {
          updatedBracket.Champion = winner;
          updatedBracket.ChampionSeed = winnerSeed;
          
          // Save Champion to Firebase
          await saveUserBracketRound(leagueId, userId, 'Champion', winner);
          
          // Update local state
          setUserBracket(updatedBracket);
          
        } else {
          // Update winner in this round
          if (!updatedBracket[round]) {
            updatedBracket[round] = [];
          }
          
          if (!updatedBracket[round][index]) {
            updatedBracket[round][index] = { team1: '', team2: '', winner: '' };
          }
          
          // Determine the winner's seed
          let determinedWinnerSeed = null;
          const matchup = updatedBracket[round][index];
          
          if (winner === matchup.team1) {
            determinedWinnerSeed = matchup.team1Seed;
          } else if (winner === matchup.team2) {
            determinedWinnerSeed = matchup.team2Seed;
          }
          
          updatedBracket[round][index] = {
            ...updatedBracket[round][index],
            winner,
            winnerSeed: determinedWinnerSeed
          };
          
          // Update subsequent rounds
          const updatedData = updateNextRound(updatedBracket, round, index, winner, determinedWinnerSeed);
          
          // Save round data to Firebase
          await saveUserBracketRound(leagueId, userId, round, updatedData[round]);
          
          // If next round was updated, save that too
          const nextRound = getNextRound(round);
          if (nextRound && updatedData[nextRound]) {
            await saveUserBracketRound(leagueId, userId, nextRound, updatedData[nextRound]);
          }
          
          setUserBracket(updatedData);
        }
        
        setFeedbackMessage('Your bracket has been updated');
      }
      
      setTimeout(() => setFeedbackMessage(''), 3000);
      setIsSaving(false);
    } catch (err) {
      console.error('Error updating bracket:', err);
      setError(`Error: ${err.message}`);
      setFeedbackMessage(`Error: ${err.message}`);
      setIsSaving(false);
    }
  }, [leagueId, userId, mode, tournamentData, userBracket, isLocked]);
  
  // Save complete user bracket
  const saveBracket = useCallback(async () => {
    if (mode !== 'user' || !userId || isLocked || !userBracket) return;
    
    try {
      setIsSaving(true);
      
      await saveUserBracket(leagueId, userId, userBracket);
      
      setFeedbackMessage('Your bracket has been saved successfully!');
      setTimeout(() => setFeedbackMessage(''), 3000);
      setIsSaving(false);
    } catch (err) {
      console.error('Error saving bracket:', err);
      setError(`Error: ${err.message}`);
      setFeedbackMessage(`Error: ${err.message}`);
      setIsSaving(false);
    }
  }, [leagueId, userId, userBracket, mode, isLocked]);
  
  return {
    // Data
    tournamentData,
    userBracket,
    activeData: getBracketData(),
    
    // Status
    isLoading,
    error,
    isSaving,
    feedbackMessage,
    
    // Round access
    getRound,
    
    // Actions
    handleSelectWinner,
    saveBracket
  };
};

/**
 * Get default game data structure
 */
const getDefaultGameData = () => {
  return {
    status: 'setup',
    SetTeams: {
      eastRegion: Array(16).fill().map((_, i) => ({ name: '', seed: i + 1 })),
      westRegion: Array(16).fill().map((_, i) => ({ name: '', seed: i + 1 })),
      midwestRegion: Array(16).fill().map((_, i) => ({ name: '', seed: i + 1 })),
      southRegion: Array(16).fill().map((_, i) => ({ name: '', seed: i + 1 }))
    },
    RoundOf64: Array(32).fill().map(() => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null
    })),
    RoundOf32: Array(16).fill().map(() => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null
    })),
    Sweet16: Array(8).fill().map(() => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null
    })),
    Elite8: Array(4).fill().map(() => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null
    })),
    FinalFour: Array(2).fill().map(() => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null
    })),
    Championship: {
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null
    },
    Champion: '',
    ChampionSeed: null
  };
};

export default useTournament;
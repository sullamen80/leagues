import { useState, useEffect, useCallback } from 'react';
import { auth } from '../../../../firebase';
import { 
  fetchPlayoffsData, 
  savePlayoffsData, 
  listenToPlayoffsData,
  updateFinalsMVP 
} from '../services/playoffsService';
import { 
  getUserBracket, 
  saveUserBracket, 
  saveUserBracketRound,
  saveUserFinalsMVP,
  listenToUserBracket 
} from '../services/bracketService';
import { getNextRound, getNextRoundMatchupIndex, isTeam1InNextRound } from '../utils/playoffsUtils';
import { getDefaultGameData } from '../utils/bracketUtils';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Custom hook for managing NBA Playoffs bracket data and operations
 */
const usePlayoffs = (leagueId, mode = 'user', isLocked = false) => {
  const [playoffsData, setPlayoffsData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  
  const userId = auth.currentUser?.uid;
  
  // Initialize data - listen to playoffs data and user bracket
  useEffect(() => {
    if (!leagueId) {
      setError('League ID is required');
      setIsLoading(false);
      return () => {};
    }
    
    let playoffsUnsubscribe = () => {};
    let userBracketUnsubscribe = () => {};
    
    // Always load playoffs data
    playoffsUnsubscribe = listenToPlayoffsData(
      leagueId,
      (data) => {
        setPlayoffsData(data);
        
        // If admin mode, we're done loading
        if (mode === 'admin') {
          setIsLoading(false);
        } else if (mode === 'user' && !userId) {
          // If user mode but no userId, still allow viewing with playoffs data
          setIsLoading(false);
        }
      },
      (err) => {
        console.error('Error loading playoffs data:', err);
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
      playoffsUnsubscribe();
      userBracketUnsubscribe();
    };
  }, [leagueId, userId, mode]);
  
  // Get active data based on mode
  const getBracketData = () => {
    if (mode === 'admin') {
      return playoffsData || getDefaultGameData();
    }
    
    // For user mode, use userBracket if available, otherwise fall back to playoffs data
    return userBracket || playoffsData || getDefaultGameData();
  };
  
  // Get a specific round
  const getRound = (roundName) => {
    const data = getBracketData();
    
    if (!data) return [];
    
    if (roundName === ROUND_KEYS.NBA_FINALS) {
      return data[ROUND_KEYS.NBA_FINALS] || { team1: '', team2: '', winner: '', gamesPlayed: null };
    } else if (roundName === ROUND_KEYS.FINALS_MVP) {
      return data[ROUND_KEYS.FINALS_MVP] || '';
    }
    
    // Handle array rounds (FirstRound, ConfSemis, ConfFinals)
    const roundData = data[roundName];
    
    // If round data doesn't exist or is empty, return empty array
    if (!roundData || !Array.isArray(roundData) || roundData.length === 0) {
      return [];
    }
    
    // Expected lengths for each round
    const expectedLengths = {
      [ROUND_KEYS.FIRST_ROUND]: 8,
      [ROUND_KEYS.CONF_SEMIS]: 4,
      [ROUND_KEYS.CONF_FINALS]: 2
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
        gamesPlayed: matchup.gamesPlayed !== undefined ? matchup.gamesPlayed : null,
        conference: matchup.conference || ''
      }));
    
    // If we don't have enough entries after filtering out nulls, pad the array
    if (expectedLengths[roundName] && cleanedRound.length < expectedLengths[roundName]) {
      const missingCount = expectedLengths[roundName] - cleanedRound.length;
      const emptyMatchups = Array(missingCount).fill().map(() => ({
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        gamesPlayed: null,
        conference: ''
      }));
      
      cleanedRound = [...cleanedRound, ...emptyMatchups];
    }
    
    return cleanedRound;
  };
  
  // Clear all rounds after the specified round
  const clearSubsequentRounds = (bracketData, startRound, matchupIndex) => {
    const roundOrder = [
      ROUND_KEYS.FIRST_ROUND,
      ROUND_KEYS.CONF_SEMIS,
      ROUND_KEYS.CONF_FINALS,
      ROUND_KEYS.NBA_FINALS
    ];
    const startIndex = roundOrder.indexOf(startRound);
    
    if (startIndex === -1 || startIndex >= roundOrder.length - 1) return bracketData;
    
    let updatedData = { ...bracketData };
    
    // Clear next round
    for (let i = startIndex + 1; i < roundOrder.length; i++) {
      const roundName = roundOrder[i];
      
      if (roundName === ROUND_KEYS.NBA_FINALS) {
        // If we're clearing after Conference Finals, clear NBA Finals
        if (startRound === ROUND_KEYS.CONF_FINALS) {
          updatedData[ROUND_KEYS.NBA_FINALS] = { 
            team1: '', team1Seed: null,
            team2: '', team2Seed: null,
            winner: '', gamesPlayed: null
          };
        }
        // If we're clearing after a Conference Semifinal, only clear that conference's path
        else {
          const conference = (matchupIndex < 2) ? 'East' : 'West';
          if (conference === 'East' && updatedData[ROUND_KEYS.NBA_FINALS]?.team1) {
            updatedData[ROUND_KEYS.NBA_FINALS].team1 = '';
            updatedData[ROUND_KEYS.NBA_FINALS].team1Seed = null;
          } else if (conference === 'West' && updatedData[ROUND_KEYS.NBA_FINALS]?.team2) {
            updatedData[ROUND_KEYS.NBA_FINALS].team2 = '';
            updatedData[ROUND_KEYS.NBA_FINALS].team2Seed = null;
          }
          
          // If either team is missing, clear winner
          if (!updatedData[ROUND_KEYS.NBA_FINALS]?.team1 || !updatedData[ROUND_KEYS.NBA_FINALS]?.team2) {
            updatedData[ROUND_KEYS.NBA_FINALS].winner = '';
            updatedData[ROUND_KEYS.NBA_FINALS].gamesPlayed = null;
          }
        }
      } 
      // For array rounds
      else if (Array.isArray(updatedData[roundName])) {
        // For Conference transitions, we need to map the affected matchups
        // based on conference structure
        const nextMatchupIndex = getNextRoundMatchupIndex(matchupIndex, startRound);
        
        // Clear affected matchup in this round
        if (updatedData[roundName][nextMatchupIndex]) {
          // For the immediate next round, preserve teams but clear winner
          if (i === startIndex + 1) {
            const teamToUpdate = isTeam1InNextRound(matchupIndex, startRound) ? 'team1' : 'team2';
            
            updatedData[roundName][nextMatchupIndex] = {
              ...updatedData[roundName][nextMatchupIndex],
              [teamToUpdate]: '',
              [`${teamToUpdate}Seed`]: null,
              winner: '',
              gamesPlayed: null
            };
          } else {
            // For later rounds, clear all matchups in the affected conference
            const conference = (matchupIndex < 4 && startRound === ROUND_KEYS.FIRST_ROUND) || 
                            (matchupIndex < 2 && startRound === ROUND_KEYS.CONF_SEMIS) ? 'East' : 'West';
            
            // In ConfFinals, there's only one matchup per conference
            if (roundName === ROUND_KEYS.CONF_FINALS) {
              const confMatchupIndex = conference === 'East' ? 0 : 1;
              
              updatedData[roundName][confMatchupIndex] = {
                team1: '', team1Seed: null,
                team2: '', team2Seed: null,
                winner: '', gamesPlayed: null,
                conference
              };
            }
          }
        }
      }
    }
    
    // Clear Finals MVP if NBA Finals winner is cleared
    if (!updatedData[ROUND_KEYS.NBA_FINALS]?.winner) {
      updatedData[ROUND_KEYS.FINALS_MVP] = '';
    }
    
    return updatedData;
  };
  
  // Update next round when a winner is selected
  const updateNextRound = (bracketData, round, matchupIndex, winner, winnerSeed, gamesPlayed) => {
    const nextRoundName = getNextRound(round);
    if (!nextRoundName) return bracketData;
    
    let updatedData = { ...bracketData };
    
    // Special case for NBA Finals
    if (nextRoundName === ROUND_KEYS.NBA_FINALS) {
      // Both Conference Finals winners must be set
      const confFinals = updatedData[ROUND_KEYS.CONF_FINALS] || [];
      
      // Update the NBA Finals teams based on conference winners
      if (!updatedData[ROUND_KEYS.NBA_FINALS]) {
        updatedData[ROUND_KEYS.NBA_FINALS] = {
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', gamesPlayed: null
        };
      }
      
      // East is first matchup (index 0)
      if (matchupIndex === 0) {
        updatedData[ROUND_KEYS.NBA_FINALS].team1 = winner;
        updatedData[ROUND_KEYS.NBA_FINALS].team1Seed = winnerSeed;
      } 
      // West is second matchup (index 1)
      else if (matchupIndex === 1) {
        updatedData[ROUND_KEYS.NBA_FINALS].team2 = winner;
        updatedData[ROUND_KEYS.NBA_FINALS].team2Seed = winnerSeed;
      }
      
      return updatedData;
    }
    
    // For other rounds
    const nextMatchupIndex = getNextRoundMatchupIndex(matchupIndex, round);
    const isFirstTeamInNextMatchup = isTeam1InNextRound(matchupIndex, round);
    
    // Ensure next round array exists
    if (!updatedData[nextRoundName]) {
      updatedData[nextRoundName] = [];
    }
    
    // Ensure next matchup exists
    if (!updatedData[nextRoundName][nextMatchupIndex]) {
      updatedData[nextRoundName][nextMatchupIndex] = {
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', gamesPlayed: null,
        conference: (round === ROUND_KEYS.FIRST_ROUND && matchupIndex < 4) || 
                  (round === ROUND_KEYS.CONF_SEMIS && matchupIndex < 2) ? 'East' : 'West'
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
      updatedData[nextRoundName][nextMatchupIndex].gamesPlayed = null;
      
      // Clear subsequent rounds
      updatedData = clearSubsequentRounds(updatedData, nextRoundName, nextMatchupIndex);
    }
    
    return updatedData;
  };
  
  // Handle winner selection with series result
  const handleSelectWinner = useCallback(async (round, index, winner, winnerSeed, gamesPlayed = null) => {
    if (isLocked || !leagueId) return;
    
    try {
      setIsSaving(true);
      
      if (mode === 'admin') {
        // Admin mode updates
        let updatedPlayoffs = { ...playoffsData };
        
        if (round === ROUND_KEYS.NBA_FINALS) {
          // For NBA Finals, update the winner and games played
          updatedPlayoffs[ROUND_KEYS.NBA_FINALS] = {
            ...updatedPlayoffs[ROUND_KEYS.NBA_FINALS],
            winner,
            gamesPlayed
          };
          
          // Set the champion in the league data
          updatedPlayoffs.champion = winner;
          updatedPlayoffs.status = "completed";
        } 
        else if (round === ROUND_KEYS.FINALS_MVP) {
          // Update Finals MVP
          updatedPlayoffs[ROUND_KEYS.FINALS_MVP] = winner;
          
          // Use the dedicated function for Finals MVP
          await updateFinalsMVP(leagueId, winner);
          setFeedbackMessage('Finals MVP has been updated');
          setIsSaving(false);
          setTimeout(() => setFeedbackMessage(''), 3000);
          return; // Skip the rest of the function
        }
        else {
          // Update winner in this round
          if (!updatedPlayoffs[round]) {
            updatedPlayoffs[round] = [];
          }
          
          if (!updatedPlayoffs[round][index]) {
            const conference = (round === ROUND_KEYS.FIRST_ROUND && index < 4) ||
                             (round === ROUND_KEYS.CONF_SEMIS && index < 2) ||
                             (round === ROUND_KEYS.CONF_FINALS && index === 0) ? 'East' : 'West';
                             
            updatedPlayoffs[round][index] = { 
              team1: '', team2: '', winner: '',
              gamesPlayed: null, conference 
            };
          }
          
          updatedPlayoffs[round][index] = {
            ...updatedPlayoffs[round][index],
            winner,
            gamesPlayed
          };
          
          // Update subsequent rounds
          updatedPlayoffs = updateNextRound(updatedPlayoffs, round, index, winner, winnerSeed, gamesPlayed);
        }
        
        // Save to Firestore
        await savePlayoffsData(leagueId, updatedPlayoffs);
        setFeedbackMessage('Playoffs data updated');
      } 
      else if (mode === 'user' && userId) {
        // User mode updates
        let updatedBracket = { ...userBracket };
        
        if (round === ROUND_KEYS.NBA_FINALS) {
          console.log("Updating NBA Finals winner:", winner, "Games played:", gamesPlayed);
          
          // Ensure NBAFinals object exists
          if (!updatedBracket[ROUND_KEYS.NBA_FINALS]) {
            updatedBracket[ROUND_KEYS.NBA_FINALS] = { 
              team1: "", team1Seed: null,
              team2: "", team2Seed: null,
              winner: "", gamesPlayed: null
            };
          }
          
          // Update NBAFinals
          updatedBracket[ROUND_KEYS.NBA_FINALS] = {
            ...updatedBracket[ROUND_KEYS.NBA_FINALS],
            winner,
            gamesPlayed
          };
          
          // Save NBAFinals directly to Firebase
          await saveUserBracketRound(leagueId, userId, ROUND_KEYS.NBA_FINALS, updatedBracket[ROUND_KEYS.NBA_FINALS]);
          
          // Update local state
          setUserBracket(updatedBracket);
        } 
        else if (round === ROUND_KEYS.FINALS_MVP) {
          updatedBracket[ROUND_KEYS.FINALS_MVP] = winner;
          
          // Save Finals MVP to Firebase
          await saveUserFinalsMVP(leagueId, userId, winner);
          
          // Update local state
          setUserBracket(updatedBracket);
        } 
        else {
          // Update winner in this round
          if (!updatedBracket[round]) {
            updatedBracket[round] = [];
          }
          
          if (!updatedBracket[round][index]) {
            const conference = (round === ROUND_KEYS.FIRST_ROUND && index < 4) ||
                             (round === ROUND_KEYS.CONF_SEMIS && index < 2) ||
                             (round === ROUND_KEYS.CONF_FINALS && index === 0) ? 'East' : 'West';
                             
            updatedBracket[round][index] = { 
              team1: '', team2: '', winner: '',
              gamesPlayed: null, conference 
            };
          }
          
          updatedBracket[round][index] = {
            ...updatedBracket[round][index],
            winner,
            gamesPlayed
          };
          
          // Update subsequent rounds
          const updatedData = updateNextRound(updatedBracket, round, index, winner, winnerSeed, gamesPlayed);
          
          // Save round data to Firebase
          await saveUserBracketRound(leagueId, userId, round, updatedData[round]);
          
          // If next round was updated, save that too
          const nextRound = getNextRound(round);
          if (nextRound && updatedData[nextRound]) {
            await saveUserBracketRound(leagueId, userId, nextRound, updatedData[nextRound]);
          }
          
          // If this affects NBA Finals, save that too
          if (round === ROUND_KEYS.CONF_FINALS && updatedData[ROUND_KEYS.NBA_FINALS]) {
            await saveUserBracketRound(leagueId, userId, ROUND_KEYS.NBA_FINALS, updatedData[ROUND_KEYS.NBA_FINALS]);
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
  }, [leagueId, userId, mode, playoffsData, userBracket, isLocked]);
  
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
    playoffsData,
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

export default usePlayoffs;
// src/gameTypes/nbaPlayoffs/hooks/usePlayoffsBracket.js
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
import { listenToLockStatus } from '../services/playoffsService';
import { getNextRound, repairBracket, getConferenceForMatchup } from '../utils/bracketUtils';
import { ROUND_KEYS } from '../constants/playoffConstants';

// NBA Playoffs round keys in order
const ROUND_ORDER = [
  ROUND_KEYS.PLAY_IN,
  ROUND_KEYS.FIRST_ROUND,
  ROUND_KEYS.CONF_SEMIS,
  ROUND_KEYS.CONF_FINALS,
  ROUND_KEYS.NBA_FINALS,
];

/**
 * Custom hook for working with a user's NBA Playoffs bracket
 * @param {string} leagueId - League ID
 * @param {string} [userId] - User ID (defaults to current user)
 * @param {boolean} [readOnly=false] - Whether bracket is read-only
 * @param {boolean} [includePlayIn=false] - Whether to include the Play-In Tournament
 * @returns {Object} Bracket data and functions
 */
const usePlayoffsBracket = (leagueId, userId = null, readOnly = false, includePlayIn = false) => {
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
      // Pass includePlayIn parameter to template creation
      const result = await createUserBracketFromTemplate(leagueId, targetUserId, includePlayIn);
      
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
  }, [leagueId, targetUserId, readOnly, currentUserId, includePlayIn]);
  
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
    
    if (isRoundLocked(includePlayIn ? ROUND_KEYS.PLAY_IN : ROUND_KEYS.FIRST_ROUND)) {
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
  }, [leagueId, targetUserId, currentUserId, bracketData, readOnly, isRoundLocked, includePlayIn]);
  
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
  
  // Update a winner, number of games, and MVP (for Finals) in the bracket
  const updateSeries = useCallback(async (round, matchupIndex, winner, winnerSeed, numGames, mvp = null) => {
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
      
      // Handle NBA Finals (has MVP prediction)
      if (round === ROUND_KEYS.NBA_FINALS) {
        updatedBracket[ROUND_KEYS.NBA_FINALS] = {
          ...updatedBracket[ROUND_KEYS.NBA_FINALS],
          winner,
          winnerSeed,
          numGames: numGames || 4, // Default to 4 games if not specified
          mvp: mvp || ''
        };
        
        // Also update Champion field
        updatedBracket[ROUND_KEYS.CHAMPION] = winner;
        updatedBracket.ChampionSeed = winnerSeed;
        updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp || '';
        
        // Save NBA Finals and Champion info
        await saveUserBracketRound(leagueId, targetUserId, ROUND_KEYS.NBA_FINALS, updatedBracket[ROUND_KEYS.NBA_FINALS]);
        await saveUserBracketRound(leagueId, targetUserId, ROUND_KEYS.CHAMPION, winner);
        await saveUserBracketRound(leagueId, targetUserId, ROUND_KEYS.FINALS_MVP, mvp || '');
        
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
            winner: "", winnerSeed: null,
            numGames: null,
            conference: getConferenceForMatchup(round, matchupIndex)
          };
        }
        
        // Update the series outcome
        updatedBracket[round][matchupIndex] = {
          ...updatedBracket[round][matchupIndex],
          winner,
          winnerSeed,
          numGames: numGames || 4 // Default to 4 games if not specified
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
      console.error(`Error updating series in ${round}:`, err);
      setError(`Error updating series: ${err.message}`);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return false;
    }
  }, [leagueId, targetUserId, currentUserId, bracketData, readOnly, isRoundLocked]);
  
  // Update Finals MVP prediction
  const updateFinalsMVP = useCallback(async (mvp) => {
    if (readOnly || !leagueId || !targetUserId || targetUserId !== currentUserId) {
      return false;
    }
    
    if (isRoundLocked(ROUND_KEYS.NBA_FINALS)) {
      setFeedback(`Cannot update Finals MVP - finals are locked`);
      setTimeout(() => setFeedback(''), 3000);
      return false;
    }
    
    try {
      setIsSaving(true);
      
      // Make a copy of the current bracket
      const updatedBracket = { ...bracketData };
      
      // Update MVP in NBA Finals and FinalsMVP field
      if (updatedBracket[ROUND_KEYS.NBA_FINALS]) {
        updatedBracket[ROUND_KEYS.NBA_FINALS] = {
          ...updatedBracket[ROUND_KEYS.NBA_FINALS],
          mvp
        };
      }
      
      updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
      
      // Save to Firebase
      await saveUserBracketRound(leagueId, targetUserId, ROUND_KEYS.FINALS_MVP, mvp);
      if (updatedBracket[ROUND_KEYS.NBA_FINALS]) {
        await saveUserBracketRound(leagueId, targetUserId, ROUND_KEYS.NBA_FINALS, updatedBracket[ROUND_KEYS.NBA_FINALS]);
      }
      
      // Update local state
      setBracketData(updatedBracket);
      
      setFeedback("Finals MVP saved successfully!");
      setTimeout(() => setFeedback(''), 3000);
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error("Error updating Finals MVP:", err);
      setError(`Error updating Finals MVP: ${err.message}`);
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
    
    // Special case for NBA Finals
    if (nextRoundName === ROUND_KEYS.NBA_FINALS) {
      // For Conference Finals to NBA Finals, we need both conference winners
      const conferenceFinals = bracket[ROUND_KEYS.CONF_FINALS] || [];
      
      // Check if both Conference Finals matchups have winners
      // Index 0 is East, Index 1 is West (convention)
      if (conferenceFinals[0]?.winner && conferenceFinals[1]?.winner) {
        bracket[ROUND_KEYS.NBA_FINALS] = {
          team1: conferenceFinals[0].winner, // East Champion
          team1Seed: conferenceFinals[0].winnerSeed,
          team2: conferenceFinals[1].winner, // West Champion
          team2Seed: conferenceFinals[1].winnerSeed,
          winner: bracket[ROUND_KEYS.NBA_FINALS]?.winner || '',
          winnerSeed: bracket[ROUND_KEYS.NBA_FINALS]?.winnerSeed || null,
          numGames: bracket[ROUND_KEYS.NBA_FINALS]?.numGames || null,
          mvp: bracket[ROUND_KEYS.NBA_FINALS]?.mvp || ''
        };
      }
      
      return;
    }
    
    // For Play-In Tournament to First Round, special handling required
    if (currentRound === ROUND_KEYS.PLAY_IN) {
      // Map Play-In winners to the correct First Round matchups
      // This depends on your Play-In format implementation
      // We assume a function that knows where Play-In winners go
      const { nextMatchupIndex, isFirstTeam } = mapPlayInWinnerToFirstRound(matchupIndex);
      
      // Ensure First Round array exists
      if (!Array.isArray(bracket[nextRoundName])) {
        bracket[nextRoundName] = [];
      }
      
      // Ensure the target matchup exists
      if (!bracket[nextRoundName][nextMatchupIndex]) {
        bracket[nextRoundName][nextMatchupIndex] = {
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', winnerSeed: null,
          numGames: null
        };
      }
      
      // Update team in First Round matchup
      if (isFirstTeam) {
        bracket[nextRoundName][nextMatchupIndex].team1 = winner;
        bracket[nextRoundName][nextMatchupIndex].team1Seed = winnerSeed;
      } else {
        bracket[nextRoundName][nextMatchupIndex].team2 = winner;
        bracket[nextRoundName][nextMatchupIndex].team2Seed = winnerSeed;
      }
      
      return;
    }
    
    // For regular rounds (conference-based progression)
    // In each conference, matchups go from 4 to 2 to 1
    const conference = getConferenceForMatchup(currentRound, matchupIndex);
    const nextMatchupIndex = getNextMatchupIndex(currentRound, matchupIndex, conference);
    const isFirstTeam = isFirstTeamInNextMatchup(currentRound, matchupIndex);
    
    // Create next round array if it doesn't exist
    if (!Array.isArray(bracket[nextRoundName])) {
      bracket[nextRoundName] = [];
    }
    
    // Create next matchup if it doesn't exist
    if (!bracket[nextRoundName][nextMatchupIndex]) {
      bracket[nextRoundName][nextMatchupIndex] = {
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null,
        numGames: null,
        conference
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
      bracket[nextRoundName][nextMatchupIndex].numGames = null;
      
      // Clear subsequent rounds
      clearSubsequentRounds(bracket, nextRoundName, nextMatchupIndex);
    }
  };
  
  // Helper function to map Play-In Tournament winners to First Round matchups
  const mapPlayInWinnerToFirstRound = (playInMatchupIndex) => {
    // This mapping depends on your Play-In Tournament implementation
    // Example implementation:
    // - East 7/8 winner becomes the 7 seed (plays 2 seed in First Round matchup 1)
    // - East 9/10 vs East 7/8 loser winner becomes the 8 seed (plays 1 seed in First Round matchup 0)
    // - West 7/8 winner becomes the 7 seed (plays 2 seed in First Round matchup 5)
    // - West 9/10 vs West 7/8 loser winner becomes the 8 seed (plays 1 seed in First Round matchup 4)
    
    // Simple example mapping - adjust based on your specific Play-In format
    const mapping = {
      0: { nextMatchupIndex: 0, isFirstTeam: false }, // East 7/8 vs 9/10 loser → East 1 vs 8
      1: { nextMatchupIndex: 1, isFirstTeam: false }, // East 7/8 Winner → East 2 vs 7
      2: { nextMatchupIndex: 4, isFirstTeam: false }, // West 7/8 vs 9/10 loser → West 1 vs 8
      3: { nextMatchupIndex: 5, isFirstTeam: false }, // West 7/8 Winner → West 2 vs 7
    };
    
    return mapping[playInMatchupIndex] || { nextMatchupIndex: 0, isFirstTeam: true };
  };
  
  // Helper function to determine the next matchup index
  const getNextMatchupIndex = (round, matchupIndex, conference) => {
    // For each conference, the matchups get halved in each round
    // Conference matchups are grouped together
    if (round === ROUND_KEYS.FIRST_ROUND) {
      // FirstRound: 4 matchups per conference → ConferenceSemis: 2 matchups per conference
      return conference === 'East' 
        ? Math.floor(matchupIndex / 2) 
        : Math.floor((matchupIndex - 4) / 2) + 2;
    } else if (round === ROUND_KEYS.CONF_SEMIS) {
      // ConferenceSemis: 2 matchups per conference → ConferenceFinals: 1 matchup per conference
      return conference === 'East' ? 0 : 1;
    } else {
      return 0; // Default fallback
    }
  };
  
  // Helper function to determine if a team is the first or second team in the next matchup
  const isFirstTeamInNextMatchup = (round, matchupIndex) => {
    if (round === ROUND_KEYS.FIRST_ROUND) {
      // In each conference, even indices (0,2,4,6) feed into first team spots
      // and odd indices (1,3,5,7) feed into second team spots
      return matchupIndex % 2 === 0;
    } else if (round === ROUND_KEYS.CONF_SEMIS) {
      // Same pattern within each conference
      return matchupIndex % 2 === 0;
    } else {
      return matchupIndex === 0; // Default fallback
    }
  };
  
  // Clear all rounds after a change
  const clearSubsequentRounds = (bracket, startRound, matchupIndex) => {
    const startIndex = ROUND_ORDER.indexOf(startRound);
    
    if (startIndex === -1 || startIndex >= ROUND_ORDER.length - 1) return;
    
    // Process each subsequent round
    for (let i = startIndex + 1; i < ROUND_ORDER.length; i++) {
      const roundName = ROUND_ORDER[i];
      
      // NBA Finals is a special case (object with additional MVP field)
      if (roundName === ROUND_KEYS.NBA_FINALS) {
        if (bracket[roundName] && (
          // Clear if one of the teams in Finals was affected
          (matchupIndex === 0 && startRound === ROUND_KEYS.CONF_FINALS) || 
          (matchupIndex === 1 && startRound === ROUND_KEYS.CONF_FINALS)
        )) {
          bracket[ROUND_KEYS.NBA_FINALS] = {
            team1: '', team1Seed: null,
            team2: '', team2Seed: null,
            winner: '', winnerSeed: null,
            numGames: null,
            mvp: ''
          };
          bracket[ROUND_KEYS.CHAMPION] = '';
          bracket.ChampionSeed = null;
          bracket[ROUND_KEYS.FINALS_MVP] = '';
        }
      } 
      // For array rounds
      else if (Array.isArray(bracket[roundName])) {
        // For Conference transitions, we need to map the affected matchups
        // based on conference structure
        const affectedMatchups = getAffectedMatchups(startRound, roundName, matchupIndex);
        
        for (const idx of affectedMatchups) {
          if (bracket[roundName][idx]) {
            // Clear the affected matchup
            bracket[roundName][idx] = {
              team1: '', team1Seed: null,
              team2: '', team2Seed: null,
              winner: '', winnerSeed: null,
              numGames: null,
              conference: getConferenceForMatchup(roundName, idx)
            };
          }
        }
      }
    }
  };
  
  // Helper function to get affected matchups in subsequent rounds when a winner changes
  const getAffectedMatchups = (startRound, targetRound, matchupIndex) => {
    const conference = getConferenceForMatchup(startRound, matchupIndex);
    
    // If rounds are adjacent, use direct mapping
    if (ROUND_ORDER.indexOf(targetRound) === ROUND_ORDER.indexOf(startRound) + 1) {
      if (targetRound === ROUND_KEYS.NBA_FINALS) {
        return [0]; // Only one NBA Finals matchup
      } else if (startRound === ROUND_KEYS.PLAY_IN) {
        const { nextMatchupIndex } = mapPlayInWinnerToFirstRound(matchupIndex);
        return [nextMatchupIndex];
      } else {
        return [getNextMatchupIndex(startRound, matchupIndex, conference)];
      }
    }
    
    // For non-adjacent rounds, we need to cascade the effects
    // This is a simplified approach - adjust based on your exact bracket structure
    if (startRound === ROUND_KEYS.FIRST_ROUND && targetRound === ROUND_KEYS.CONF_FINALS) {
      // From FirstRound to ConferenceFinals (skipping ConferenceSemis)
      return conference === 'East' ? [0] : [1];
    } else if (startRound === ROUND_KEYS.FIRST_ROUND && targetRound === ROUND_KEYS.NBA_FINALS) {
      // From FirstRound to NBAFinals (skipping multiple rounds)
      return [0];
    } else if (startRound === ROUND_KEYS.CONF_SEMIS && targetRound === ROUND_KEYS.NBA_FINALS) {
      // From ConferenceSemis to NBAFinals (skipping ConferenceFinals)
      return [0];
    }
    
    return [];
  };
  
  // Repair a damaged bracket
  const repairBracketData = useCallback(async () => {
    if (!leagueId || !targetUserId) return false;
    
    try {
      setIsSaving(true);
      
      if (bracketData) {
        // Use local repair if we have data
        const repairedData = repairBracket(bracketData, includePlayIn);
        await saveUserBracket(leagueId, targetUserId, repairedData);
        setBracketData(repairedData);
      } else {
        // Use server repair if no local data
        await repairUserBracket(leagueId, targetUserId, includePlayIn);
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
  }, [leagueId, targetUserId, bracketData, includePlayIn]);
  
  // Get data for a specific round
  const getRoundData = useCallback((roundName) => {
    if (!bracketData) return null;
    
    if (roundName === ROUND_KEYS.NBA_FINALS) {
      return bracketData[ROUND_KEYS.NBA_FINALS] || { 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null,
        numGames: null,
        mvp: ''
      };
    } else if (roundName === ROUND_KEYS.CHAMPION) {
      return bracketData[ROUND_KEYS.CHAMPION] || '';
    } else if (roundName === ROUND_KEYS.FINALS_MVP) {
      return bracketData[ROUND_KEYS.FINALS_MVP] || '';
    } else if (Array.isArray(bracketData[roundName])) {
      return bracketData[roundName];
    }
    
    return null;
  }, [bracketData]);
  
  // Get list of predicted players from chosen teams for Finals MVP selection
  const getEligibleMVPCandidates = useCallback(() => {
    if (!bracketData || !bracketData[ROUND_KEYS.NBA_FINALS]) return [];
    
    const finalsTeams = [
      bracketData[ROUND_KEYS.NBA_FINALS].team1,
      bracketData[ROUND_KEYS.NBA_FINALS].team2
    ].filter(Boolean);
    
    // This would need integration with your player database/service
    // Return format should be [{id, name, teamId}, ...]
    return getPlayersByTeamIds(finalsTeams);
  }, [bracketData]);
  
  // Placeholder function - implement with your player data service
  const getPlayersByTeamIds = (teamIds) => {
    // This should be replaced with actual implementation using your player data
    // Return mock data for now
    return [
      { id: 'player1', name: 'Star Player 1', teamId: teamIds[0] },
      { id: 'player2', name: 'Star Player 2', teamId: teamIds[0] },
      { id: 'player3', name: 'Star Player 3', teamId: teamIds[1] },
      { id: 'player4', name: 'Star Player 4', teamId: teamIds[1] }
    ];
  };
  
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
    isLocked: isRoundLocked(includePlayIn ? ROUND_KEYS.PLAY_IN : ROUND_KEYS.FIRST_ROUND),
    hasPlayInTournament: includePlayIn,
    
    // Data access
    getRoundData,
    getEligibleMVPCandidates,
    
    // Actions
    initializeBracket,
    saveBracket,
    saveRound,
    updateSeries,
    updateFinalsMVP,
    repairBracket: repairBracketData,
    isRoundLocked
  };
};

export default usePlayoffsBracket;
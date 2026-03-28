// src/gameTypes/marchMadness/hooks/useScoring.js
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { fetchTournamentData, listenToTournamentData } from '../services/tournamentService';
import { 
  calculateUserScore,
  calculateLeagueScores,
  updateLeagueScores,
  fetchLeaderboard,
  getTopUsers,
  getUserScore,
  POINT_VALUES 
} from '../services/scoringService';
import { getUserBracket } from '../services/bracketService';

/**
 * Custom hook for bracket scoring and leaderboard functionality
 * @param {string} leagueId - League ID
 * @param {string} [userId] - User ID (defaults to current user)
 * @returns {Object} Scoring data and functions
 */
const useScoring = (leagueId, userId = null) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userScore, setUserScore] = useState(null);
  const [tournamentData, setTournamentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [userRank, setUserRank] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Default to current user if not specified
  const currentUserId = auth.currentUser?.uid;
  const targetUserId = userId || currentUserId;
  
  // Load tournament data for scoring calculations
  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return () => {};
    }
    
    // Subscribe to tournament data changes
    const unsubscribe = listenToTournamentData(
      leagueId,
      (data) => {
        setTournamentData(data);
        // Tournament data changes might affect scores, so we'll update
        // We'll rely on the leaderboard listener for actual updates
      },
      (err) => {
        console.error("Error listening to tournament data:", err);
        setError(`Error loading tournament data: ${err.message}`);
      }
    );
    
    return () => unsubscribe();
  }, [leagueId]);
  
  // Load leaderboard data
  useEffect(() => {
    if (!leagueId) {
      return () => {};
    }
    
    setIsLoading(true);
    
    // First, get initial leaderboard
    fetchLeaderboard(leagueId)
      .then(data => {
        if (data && data.rankings) {
          setLeaderboard(data.rankings);
          setLastUpdated(data.updatedAt);
          
          // Find user's rank
          if (targetUserId) {
            const userIndex = data.rankings.findIndex(entry => entry.userId === targetUserId);
            if (userIndex !== -1) {
              setUserRank(userIndex + 1);
              setUserScore(data.rankings[userIndex]);
            }
          }
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching leaderboard:", err);
        setError(`Error loading leaderboard: ${err.message}`);
        setIsLoading(false);
      });
    
    // Subscribe to leaderboard changes
    const leaderboardRef = doc(db, "leagues", leagueId, "leaderboard", "current");
    const unsubscribe = onSnapshot(
      leaderboardRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setLeaderboard(data.rankings || []);
          setLastUpdated(data.updatedAt);
          
          // Find user's rank
          if (targetUserId) {
            const userIndex = data.rankings.findIndex(entry => entry.userId === targetUserId);
            if (userIndex !== -1) {
              setUserRank(userIndex + 1);
              setUserScore(data.rankings[userIndex]);
            }
          }
        }
      },
      (err) => {
        console.error("Error listening to leaderboard:", err);
      }
    );
    
    return () => unsubscribe();
  }, [leagueId, targetUserId]);
  
  // Get user score separately if not found in leaderboard
  useEffect(() => {
    if (!leagueId || !targetUserId || userScore) {
      return;
    }
    
    // Only fetch if we don't have the score already
    getUserScore(leagueId, targetUserId)
      .then(score => {
        setUserScore(score);
      })
      .catch(err => {
        console.error("Error fetching user score:", err);
      });
  }, [leagueId, targetUserId, userScore]);
  
  // Calculate score for a specific user
  const calculateScore = useCallback(async (bracketUserId = targetUserId, forceRefresh = false) => {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    try {
      // Get user's bracket
      const userBracket = await getUserBracket(leagueId, bracketUserId);
      if (!userBracket) {
        throw new Error("User bracket not found");
      }
      
      // Make sure we have tournament data
      let officialBracket = tournamentData;
      if (!officialBracket) {
        officialBracket = await fetchTournamentData(leagueId);
        if (!officialBracket) {
          throw new Error("Tournament data not found");
        }
      }
      
      // Calculate score
      const scoreData = calculateUserScore(userBracket, officialBracket);
      
      // If this is for the target user, update state
      if (bracketUserId === targetUserId) {
        setUserScore({
          userId: bracketUserId,
          ...scoreData
        });
      }
      
      return {
        userId: bracketUserId,
        ...scoreData
      };
    } catch (err) {
      console.error("Error calculating score:", err);
      setError(`Error calculating score: ${err.message}`);
      throw err;
    }
  }, [leagueId, targetUserId, tournamentData]);
  
  // Force update of all scores and leaderboard
  const refreshLeaderboard = useCallback(async () => {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    try {
      setIsUpdating(true);
      
      // Update all scores in the league
      await updateLeagueScores(leagueId);
      
      // Get the updated leaderboard
      const data = await fetchLeaderboard(leagueId);
      
      if (data && data.rankings) {
        setLeaderboard(data.rankings);
        setLastUpdated(data.updatedAt);
        
        // Find user's rank
        if (targetUserId) {
          const userIndex = data.rankings.findIndex(entry => entry.userId === targetUserId);
          if (userIndex !== -1) {
            setUserRank(userIndex + 1);
            setUserScore(data.rankings[userIndex]);
          }
        }
      }
      
      setIsUpdating(false);
      return data;
    } catch (err) {
      console.error("Error refreshing leaderboard:", err);
      setError(`Error refreshing leaderboard: ${err.message}`);
      setIsUpdating(false);
      throw err;
    }
  }, [leagueId, targetUserId]);
  
  // Get top N users by score
  const getTopScorers = useCallback(async (limit = 10) => {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    try {
      return await getTopUsers(leagueId, limit);
    } catch (err) {
      console.error("Error getting top users:", err);
      setError(`Error getting top users: ${err.message}`);
      throw err;
    }
  }, [leagueId]);
  
  // Check if tournament has started
  const isTournamentStarted = useCallback(() => {
    if (!tournamentData) return false;
    
    // Tournament has started if any matchup in Round of 64 has a winner
    return tournamentData.RoundOf64 && 
           Array.isArray(tournamentData.RoundOf64) && 
           tournamentData.RoundOf64.some(match => match && match.winner);
  }, [tournamentData]);
  
  // Check if tournament is completed
  const isTournamentCompleted = useCallback(() => {
    if (!tournamentData) return false;
    
    // Tournament is complete if we have a champion
    return !!tournamentData.Champion;
  }, [tournamentData]);
  
  // Get the list of scoring rounds and their point values
  const getScoringSystem = useCallback(() => {
    return POINT_VALUES;
  }, []);
  
  // Get the percentage of correct picks
  const getAccuracyPercentage = useCallback(() => {
    if (!userScore || !userScore.correctPicks || !userScore.possiblePoints || userScore.possiblePoints === 0) {
      return 0;
    }
    
    return Math.round((userScore.correctPicks / userScore.possiblePoints) * 100);
  }, [userScore]);
  
  return {
    // Data
    leaderboard,
    userScore,
    tournamentData,
    userRank,
    lastUpdated,
    
    // Status
    isLoading,
    isUpdating,
    error,
    
    // Methods
    calculateScore,
    refreshLeaderboard,
    getTopScorers,
    
    // Helpers
    isTournamentStarted,
    isTournamentCompleted,
    getScoringSystem,
    getAccuracyPercentage
  };
};

export default useScoring;
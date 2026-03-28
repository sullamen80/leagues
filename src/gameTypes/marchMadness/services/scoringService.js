// src/gameTypes/marchMadness/services/scoringService.js
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { calculateBracketScore, countCorrectPicks } from '../utils/bracketUtils';
import { fetchTournamentData } from './tournamentService';
import { getAllUserBrackets } from './bracketService';

/**
 * Standard point values for each round
 */
export const POINT_VALUES = {
  RoundOf64: 1,
  RoundOf32: 2,
  Sweet16: 4,
  Elite8: 8,
  FinalFour: 16,
  Championship: 32
};

/**
 * Calculate score for a single user's bracket
 * @param {Object} userBracket - User's bracket data
 * @param {Object} officialBracket - Official tournament data
 * @returns {Object} Score details
 */
export const calculateUserScore = (userBracket, officialBracket) => {
  if (!userBracket || !officialBracket) {
    return { points: 0, correctPicks: 0, possiblePoints: 0, maxPossible: 0 };
  }
  
  // Count correct picks and calculate points
  const scoreData = calculateBracketScore(userBracket, officialBracket);
  
  // Calculate possible remaining points
  const maxPossible = calculateMaxPossiblePoints(userBracket, officialBracket);
  
  return {
    ...scoreData,
    maxPossible,
    total: scoreData.total,
    possibleTotal: scoreData.total + maxPossible
  };
};

/**
 * Calculate maximum possible remaining points
 * @param {Object} userBracket - User's bracket data
 * @param {Object} officialBracket - Official tournament data
 * @returns {number} Maximum possible remaining points
 */
export const calculateMaxPossiblePoints = (userBracket, officialBracket) => {
  if (!userBracket || !officialBracket) return 0;
  
  let maxPossible = 0;
  
  // Check each round
  for (const [round, pointValue] of Object.entries(POINT_VALUES)) {
    // Championship is special case - object instead of array
    if (round === 'Championship') {
      // If no official winner yet, check if user made a pick
      if (!officialBracket.Championship?.winner && userBracket.Championship?.winner) {
        // For simplicity, we consider this pick still alive
        // In a more advanced implementation, we'd check if the team is still in the tournament
        maxPossible += pointValue;
      }
    } 
    // Regular rounds (arrays)
    else if (Array.isArray(officialBracket[round]) && Array.isArray(userBracket[round])) {
      // For each matchup in the round
      for (let i = 0; i < Math.min(officialBracket[round].length, userBracket[round].length); i++) {
        const officialMatchup = officialBracket[round][i];
        const userMatchup = userBracket[round][i];
        
        // If official bracket has no winner yet but user made a pick
        if ((!officialMatchup?.winner || officialMatchup.winner === '') && 
            userMatchup?.winner && userMatchup.winner !== '') {
          // This pick is still alive
          maxPossible += pointValue;
        }
      }
    }
  }
  
  return maxPossible;
};

/**
 * Calculate scores for all users in a league
 * @param {string} leagueId - League ID
 * @returns {Promise<Array>} Array of user scores
 */
export const calculateLeagueScores = async (leagueId) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Get official tournament data
    const officialBracket = await fetchTournamentData(leagueId);
    if (!officialBracket) {
      throw new Error("Tournament data not found");
    }
    
    // Get all user brackets
    const userBrackets = await getAllUserBrackets(leagueId);
    
    // Get league metadata for user details
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueSnap = await getDoc(leagueRef);
    const leagueData = leagueSnap.exists() ? leagueSnap.data() : {};
    const usersMap = {};
    
    // Create a map of user IDs to user data
    if (Array.isArray(leagueData.users)) {
      leagueData.users.forEach(user => {
        if (typeof user === 'string') {
          usersMap[user] = { id: user };
        } else if (user && user.id) {
          usersMap[user.id] = user;
        }
      });
    }
    
    // Calculate scores for each user
    const scores = [];
    
    for (const bracket of userBrackets) {
      const userId = bracket.id;
      const scoreData = calculateUserScore(bracket, officialBracket);
      
      // Get user data from map or fetch if needed
      let userData = usersMap[userId] || { id: userId };
      
      if (!userData.username) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            userData = {
              ...userData,
              username: userSnap.data().username || userSnap.data().displayName || "Unknown User",
              photoURL: userSnap.data().photoURL
            };
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
      
      scores.push({
        userId,
        userName: userData.username || userData.displayName || "Unknown User",
        userPhoto: userData.photoURL,
        score: scoreData.total,
        correctPicks: scoreData.correctPicks?.total || 0,
        possiblePoints: scoreData.possiblePoints || 0,
        maxPossible: scoreData.maxPossible,
        possibleTotal: scoreData.possibleTotal,
        championPick: bracket.Champion || "None Selected",
        championCorrect: bracket.Champion === officialBracket.Champion
      });
    }
    
    // Sort by score (descending)
    return scores.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Error calculating league scores:", error);
    throw error;
  }
};

/**
 * Update and save scores for all users
 * @param {string} leagueId - League ID
 * @returns {Promise<boolean>} Success status
 */
export const updateLeagueScores = async (leagueId) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Calculate scores for all users
    const scores = await calculateLeagueScores(leagueId);
    
    // Save scores to leaderboard
    const leaderboardRef = doc(db, "leagues", leagueId, "leaderboard", "current");
    await setDoc(leaderboardRef, {
      rankings: scores,
      updatedAt: new Date().toISOString()
    });
    
    // For each user, save their individual score data
    for (const userScore of scores) {
      const userScoreRef = doc(db, "leagues", leagueId, "scores", userScore.userId);
      await setDoc(userScoreRef, {
        ...userScore,
        updatedAt: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error updating league scores:", error);
    throw error;
  }
};

/**
 * Fetch leaderboard data
 * @param {string} leagueId - League ID
 * @param {boolean} [forceRecalculate=false] - Whether to force recalculation
 * @returns {Promise<Object>} Leaderboard data
 */
export const fetchLeaderboard = async (leagueId, forceRecalculate = false) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // If forceRecalculate is true, recalculate scores
    if (forceRecalculate) {
      await updateLeagueScores(leagueId);
    }
    
    // Get leaderboard data
    const leaderboardRef = doc(db, "leagues", leagueId, "leaderboard", "current");
    const leaderboardSnap = await getDoc(leaderboardRef);
    
    if (leaderboardSnap.exists()) {
      return leaderboardSnap.data();
    } else {
      // No leaderboard yet, calculate and save
      await updateLeagueScores(leagueId);
      
      // Try again
      const updatedSnap = await getDoc(leaderboardRef);
      return updatedSnap.exists() ? updatedSnap.data() : { rankings: [] };
    }
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }
};

/**
 * Get the top N users by score
 * @param {string} leagueId - League ID
 * @param {number} [limit=10] - Number of users to return
 * @returns {Promise<Array>} Array of top users
 */
export const getTopUsers = async (leagueId, limit = 10) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Try to get from scores collection (faster than recalculating)
    const scoresRef = collection(db, "leagues", leagueId, "scores");
    const scoresQuery = query(scoresRef, orderBy("score", "desc"), limit(limit));
    const scoresSnap = await getDocs(scoresQuery);
    
    if (!scoresSnap.empty) {
      const topUsers = [];
      scoresSnap.forEach(doc => {
        topUsers.push(doc.data());
      });
      return topUsers;
    }
    
    // Fallback: Calculate scores
    const scores = await calculateLeagueScores(leagueId);
    return scores.slice(0, limit);
  } catch (error) {
    console.error("Error getting top users:", error);
    throw error;
  }
};

/**
 * Get a single user's score
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @param {boolean} [forceRecalculate=false] - Whether to force recalculation
 * @returns {Promise<Object>} User's score data
 */
export const getUserScore = async (leagueId, userId, forceRecalculate = false) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }
    
    // If we don't need to recalculate, try to get from saved scores
    if (!forceRecalculate) {
      const userScoreRef = doc(db, "leagues", leagueId, "scores", userId);
      const userScoreSnap = await getDoc(userScoreRef);
      
      if (userScoreSnap.exists()) {
        return userScoreSnap.data();
      }
    }
    
    // Need to calculate
    // Get official bracket
    const officialBracket = await fetchTournamentData(leagueId);
    if (!officialBracket) {
      throw new Error("Tournament data not found");
    }
    
    // Get user bracket
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    
    if (!userBracketSnap.exists()) {
      throw new Error("User bracket not found");
    }
    
    const userBracket = userBracketSnap.data();
    
    // Calculate score
    const scoreData = calculateUserScore(userBracket, officialBracket);
    
    // Get user data
    let userName = "Unknown User";
    let userPhoto = null;
    
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        userName = userSnap.data().username || userSnap.data().displayName || "Unknown User";
        userPhoto = userSnap.data().photoURL;
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
    
    // Create score object
    const userScore = {
      userId,
      userName,
      userPhoto,
      score: scoreData.total,
      correctPicks: scoreData.correctPicks?.total || 0,
      possiblePoints: scoreData.possiblePoints || 0,
      maxPossible: scoreData.maxPossible,
      possibleTotal: scoreData.possibleTotal,
      championPick: userBracket.Champion || "None Selected",
      championCorrect: userBracket.Champion === officialBracket.Champion,
      updatedAt: new Date().toISOString()
    };
    
    // Save the score
    const userScoreRef = doc(db, "leagues", leagueId, "scores", userId);
    await setDoc(userScoreRef, userScore);
    
    return userScore;
  } catch (error) {
    console.error("Error getting user score:", error);
    throw error;
  }
};

export default {
  calculateUserScore,
  calculateLeagueScores,
  updateLeagueScores,
  fetchLeaderboard,
  getTopUsers,
  getUserScore,
  POINT_VALUES
};
// src/gameTypes/common/services/customScoringService.js
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs, 
    Timestamp,
    updateDoc,
    arrayUnion
  } from 'firebase/firestore';
  import { db } from '../../../firebase';
  
  /**
   * Fetch all custom score adjustments for a specific user in a league
   * @param {string} leagueId - The league ID
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of adjustment objects
   */
  export const getUserAdjustments = async (leagueId, userId) => {
    try {
      const adjustmentRef = doc(db, "leagues", leagueId, "customScores", userId);
      const adjustmentSnap = await getDoc(adjustmentRef);
      
      if (!adjustmentSnap.exists()) {
        return [];
      }
      
      const data = adjustmentSnap.data();
      return data.adjustments || [];
    } catch (error) {
      console.error("Error fetching user adjustments:", error);
      throw error;
    }
  };
  
  /**
   * Get custom adjustments for all users in a league
   * @param {string} leagueId - The league ID
   * @returns {Promise<Object>} Object with userId keys and adjustment arrays
   */
  export const getAllUserAdjustments = async (leagueId) => {
    try {
      const adjustmentsRef = collection(db, "leagues", leagueId, "customScores");
      const adjustmentsSnap = await getDocs(adjustmentsRef);
      
      const allAdjustments = {};
      
      adjustmentsSnap.forEach(doc => {
        const userId = doc.id;
        const data = doc.data();
        allAdjustments[userId] = data.adjustments || [];
      });
      
      return allAdjustments;
    } catch (error) {
      console.error("Error fetching all user adjustments:", error);
      throw error;
    }
  };
  
  /**
   * Calculate the total adjustment for a user
   * @param {Array} adjustments - Array of adjustment objects
   * @returns {number} Total adjustment value
   */
  export const calculateTotalAdjustment = (adjustments) => {
    if (!adjustments || !Array.isArray(adjustments)) {
      return 0;
    }
    
    return adjustments.reduce((total, adjustment) => {
      return total + (parseFloat(adjustment.value) || 0);
    }, 0);
  };
  
  /**
   * Add a new score adjustment for a user
   * @param {string} leagueId - The league ID
   * @param {string} userId - The user ID
   * @param {Object} adjustment - The adjustment object
   * @param {number} adjustment.value - The point value (positive or negative)
   * @param {string} adjustment.reason - The reason for the adjustment
   * @param {string} adjustment.adminId - The ID of the admin making the adjustment
   * @returns {Promise<Object>} The created adjustment
   */
  export const addScoreAdjustment = async (leagueId, userId, adjustment) => {
    try {
      if (!leagueId || !userId) {
        throw new Error("League ID and User ID are required");
      }
      
      if (!adjustment || !adjustment.value || !adjustment.reason || !adjustment.adminId) {
        throw new Error("Adjustment must include value, reason, and adminId");
      }
      
      const newAdjustment = {
        ...adjustment,
        timestamp: Timestamp.now(),
        id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };
      
      const adjustmentRef = doc(db, "leagues", leagueId, "customScores", userId);
      const adjustmentSnap = await getDoc(adjustmentRef);
      
      if (!adjustmentSnap.exists()) {
        // Create new document with the adjustment
        await setDoc(adjustmentRef, {
          userId,
          adjustments: [newAdjustment]
        });
      } else {
        // Add to existing adjustments array
        await updateDoc(adjustmentRef, {
          adjustments: arrayUnion(newAdjustment)
        });
      }
      
      return newAdjustment;
    } catch (error) {
      console.error("Error adding score adjustment:", error);
      throw error;
    }
  };
  
  /**
   * Remove a specific adjustment by ID
   * @param {string} leagueId - The league ID
   * @param {string} userId - The user ID
   * @param {string} adjustmentId - The ID of the adjustment to remove
   * @returns {Promise<boolean>} Success status
   */
  export const removeScoreAdjustment = async (leagueId, userId, adjustmentId) => {
    try {
      if (!leagueId || !userId || !adjustmentId) {
        throw new Error("League ID, User ID, and Adjustment ID are required");
      }
      
      const adjustmentRef = doc(db, "leagues", leagueId, "customScores", userId);
      const adjustmentSnap = await getDoc(adjustmentRef);
      
      if (!adjustmentSnap.exists()) {
        throw new Error("No adjustments found for this user");
      }
      
      const data = adjustmentSnap.data();
      const adjustments = data.adjustments || [];
      
      // Filter out the adjustment to remove
      const updatedAdjustments = adjustments.filter(adj => adj.id !== adjustmentId);
      
      // Update the document with the filtered adjustments
      await updateDoc(adjustmentRef, {
        adjustments: updatedAdjustments
      });
      
      return true;
    } catch (error) {
      console.error("Error removing adjustment:", error);
      throw error;
    }
  };
  
  /**
   * Update the leaderboard with custom adjustments
   * @param {string} leagueId - The league ID
   * @returns {Promise<boolean>} Success status
   */
  export const updateLeaderboardWithAdjustments = async (leagueId) => {
    try {
      // Get all custom adjustments
      const allAdjustments = await getAllUserAdjustments(leagueId);
      
      // Get current leaderboard
      const leaderboardRef = doc(db, "leagues", leagueId, "leaderboard", "current");
      const leaderboardSnap = await getDoc(leaderboardRef);
      
      if (!leaderboardSnap.exists()) {
        console.warn("No leaderboard found to update.");
        return false; // No leaderboard to update
      }
      
      const leaderboardData = leaderboardSnap.data();
      const rankings = leaderboardData.rankings || [];
      
      // Update each user's score with their adjustments
      const updatedRankings = rankings.map(user => {
        const userAdjustments = allAdjustments[user.userId] || [];
        const adjustmentTotal = calculateTotalAdjustment(userAdjustments);
        
        // Calculate the new total score including the adjustment
        const baseScore = user.basePoints || 0;
        const seriesPoints = user.seriesLengthPoints || 0;
        const upsetPoints = user.upsetPoints || 0;
        const mvpPoints = user.finalsMVPPoints || 0;
        
        const newScore = baseScore + seriesPoints + upsetPoints + mvpPoints + adjustmentTotal;
        
        return {
          ...user,
          customAdjustment: adjustmentTotal,
          adjustments: userAdjustments,
          score: newScore
        };
      });
      
      // Sort by updated scores
      updatedRankings.sort((a, b) => b.score - a.score);
      
      // Update leaderboard
      await updateDoc(leaderboardRef, {
        rankings: updatedRankings,
        updatedAt: new Date().toISOString()
      });
      
      // Update individual user scores
      for (const user of updatedRankings) {
        const userScoreRef = doc(db, "leagues", leagueId, "scores", user.userId);
        const userScoreSnap = await getDoc(userScoreRef);
        
        if (userScoreSnap.exists()) {
          await updateDoc(userScoreRef, {
            customAdjustment: user.customAdjustment || 0,
            adjustments: user.adjustments || [],
            score: user.score,
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      console.log("Leaderboard updated successfully with adjustments");
      return true;
    } catch (error) {
      console.error("Error updating leaderboard with adjustments:", error);
      throw error;
    }
  };
  
  export default {
    getUserAdjustments,
    getAllUserAdjustments,
    calculateTotalAdjustment,
    addScoreAdjustment,
    removeScoreAdjustment,
    updateLeaderboardWithAdjustments
  };
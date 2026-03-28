// src/gameTypes/nflPlayoffs/services/playoffsService.js
import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db } from '../../../firebase';
import { createBracketTemplate } from './bracketService';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { applyBracketAdvancement } from '../utils/bracketUtils';

/**
 * Fetch NFL playoffs data
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} Playoffs data
 */
const fetchPlayoffsData = async (leagueId) => {
  if (!leagueId) {
    console.error("No league ID provided");
    throw new Error("League ID is required");
  }
  
  try {
    const docRef = doc(db, "leagues", leagueId, "gameData", "current");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error fetching playoffs data:", error);
    throw error;
  }
};

/**
 * Save NFL playoffs data
 * @param {string} leagueId - League ID
 * @param {Object} data - Playoffs data to save
 * @returns {Promise<boolean>} Success status
 */
const savePlayoffsData = async (leagueId, data) => {
  if (!leagueId) {
    console.error("No league ID provided");
    throw new Error("League ID is required");
  }
  
  try {
    // Clean data before saving (remove undefined values)
    const cleanData = JSON.parse(JSON.stringify(data));
    
    // Add last updated timestamp
    cleanData.updatedAt = new Date().toISOString();
    
    // Save to Firestore
    const docRef = doc(db, "leagues", leagueId, "gameData", "current");
    await setDoc(docRef, cleanData, { merge: true });
    
    // Also update the bracket template when playoff teams change
    // This is important for new users joining the league
    await createBracketTemplate(leagueId, cleanData);
    
    return true;
  } catch (error) {
    console.error("Error saving playoffs data:", error);
    throw error;
  }
};

/**
 * Update official results for a playoff matchup
 * @param {string} leagueId - League ID
 * @param {string} round - Round name
 * @param {number} matchupIndex - Index of the matchup in the round
 * @param {Object} results - Series results data
 * @returns {Promise<boolean>} Success status
 */
const updateSeriesResults = async (leagueId, round, matchupIndex, results) => {
  if (!leagueId || !round || matchupIndex === undefined) {
    throw new Error("League ID, round name, and matchup index are required");
  }
  
  try {
    // Get current playoffs data
    const playoffsData = await fetchPlayoffsData(leagueId);
    if (!playoffsData) {
      throw new Error("Playoffs data not found");
    }
    
    // Deep clone to avoid reference issues
    const updatedData = JSON.parse(JSON.stringify(playoffsData));
    
    // Handle special case for Super Bowl (object instead of array)
    if (round === ROUND_KEYS.SUPER_BOWL) {
      updatedData[round] = {
        ...updatedData[round],
        ...results,
        updatedAt: new Date().toISOString()
      };
    } 
    // Handle arrays for other rounds
    else if (updatedData[round] && Array.isArray(updatedData[round])) {
      // Make sure the matchup exists
      if (!updatedData[round][matchupIndex]) {
        updatedData[round][matchupIndex] = {};
      }
      
      // Update the matchup with results
      updatedData[round][matchupIndex] = {
        ...updatedData[round][matchupIndex],
        ...results,
        updatedAt: new Date().toISOString()
      };
      
      // If winner is set, update team elimination status
      if (results.winner && updatedData.playoffTeams) {
        const matchup = updatedData[round][matchupIndex];
        
        // Find the loser
        const loser = matchup.team1 === results.winner ? matchup.team2 : matchup.team1;
        
        // Mark the loser as eliminated in playoffTeams
        for (const conference of ['afcConference', 'nfcConference']) {
          if (updatedData.playoffTeams[conference]) {
            updatedData.playoffTeams[conference].forEach(team => {
              if (team.teamId === loser) {
                team.eliminated = true;
              }
            });
          }
        }
      }
      
      // Advance winner to next round if needed
      if (results.winner) {
        applyBracketAdvancement(updatedData, round, updatedData);
      }
    }
    
    // If the final round has a winner, set the champion
    if (round === ROUND_KEYS.SUPER_BOWL && results.winner) {
      updatedData[ROUND_KEYS.CHAMPION] = results.winner;
      updatedData.status = "completed";
    }
    
    // Save the updated data
    return await savePlayoffsData(leagueId, updatedData);
  } catch (error) {
    console.error("Error updating matchup results:", error);
    throw error;
  }
};

/**
 * Update Finals MVP selection
 * @param {string} leagueId - League ID
 * @param {string} playerId - Player ID selected as Finals MVP
 * @returns {Promise<boolean>} Success status
 */
const updateFinalsMVP = async (leagueId, playerId) => {
  if (!leagueId || !playerId) {
    throw new Error("League ID and Player ID are required");
  }
  
  try {
    const docRef = doc(db, "leagues", leagueId, "gameData", "current");
    
    await updateDoc(docRef, {
      [ROUND_KEYS.FINALS_MVP]: playerId,
      updatedAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error("Error updating Finals MVP:", error);
    throw error;
  }
};

/**
 * Subscribe to playoffs data changes
 * @param {string} leagueId - League ID
 * @param {Function} onData - Callback for data updates
 * @param {Function} onError - Callback for errors
 * @returns {Function} Unsubscribe function
 */
const listenToPlayoffsData = (leagueId, onData, onError) => {
  if (!leagueId) {
    const error = new Error("League ID is required");
    if (onError) onError(error);
    return () => {}; // No-op unsubscribe
  }
  
  const docRef = doc(db, "leagues", leagueId, "gameData", "current");
  return onSnapshot(
    docRef,
    (docSnapshot) => {
      const data = docSnapshot.exists() ? docSnapshot.data() : {};
      if (onData) onData(data);
    },
    (error) => {
      console.error("Error listening to playoffs data:", error);
      if (onError) onError(error);
    }
  );
};

/**
 * Update playoffs lock status for a specific round
 * @param {string} leagueId - League ID
 * @param {string} round - Round name to lock/unlock
 * @param {boolean} isLocked - Whether the round should be locked
 * @returns {Promise<boolean>} Success status
 */
const updateRoundLockStatus = async (leagueId, round, isLocked) => {
  if (!leagueId || !round) {
    throw new Error("League ID and round name are required");
  }
  
  try {
    const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
    
    // Update lock status with current timestamp if locking
    await updateDoc(locksRef, {
      [round]: {
        locked: isLocked,
        lockedAt: isLocked ? new Date().toISOString() : null
      }
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating lock status for ${round}:`, error);
    throw error;
  }
};

/**
 * Subscribe to playoffs lock status changes
 * @param {string} leagueId - League ID
 * @param {Function} onData - Callback for data updates
 * @param {Function} onError - Callback for errors
 * @returns {Function} Unsubscribe function
 */
const listenToLockStatus = (leagueId, onData, onError) => {
  if (!leagueId) {
    const error = new Error("League ID is required");
    if (onError) onError(error);
    return () => {}; // No-op unsubscribe
  }
  
  const docRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
  return onSnapshot(
    docRef,
    (docSnapshot) => {
      const data = docSnapshot.exists() ? docSnapshot.data() : {};
      if (onData) onData(data);
    },
    (error) => {
      console.error("Error listening to lock status:", error);
      if (onError) onError(error);
    }
  );
};

/**
 * Check if a user is the owner of a league
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} Whether the user is the owner
 */
const checkLeagueOwnership = async (leagueId, userId) => {
  if (!leagueId || !userId) {
    return false;
  }
  
  try {
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (leagueSnap.exists()) {
      const leagueData = leagueSnap.data();
      return leagueData.ownerId === userId || leagueData.createdBy === userId;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking league ownership:", error);
    return false;
  }
};

/**
 * Add a user to a league's members list
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID to add
 * @param {Object} userData - Additional user data
 * @returns {Promise<boolean>} Success status
 */
const addUserToLeague = async (leagueId, userId, userData = {}) => {
  if (!leagueId || !userId) {
    throw new Error("League ID and User ID are required");
  }
  
  try {
    const leagueRef = doc(db, "leagues", leagueId);
    
    // Get user data if not provided
    let userInfo = { id: userId, ...userData };
    
    if (Object.keys(userData).length === 0) {
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          userInfo = {
            id: userId,
            username: userSnap.data().username || userSnap.data().displayName || "Unknown User",
            photoURL: userSnap.data().photoURL,
            ...userSnap.data()
          };
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    }
    
    // Add user to both members array (basic) and users array (with details)
    await updateDoc(leagueRef, {
      members: arrayUnion(userId),
      users: arrayUnion(userInfo)
    });
    
    return true;
  } catch (error) {
    console.error("Error adding user to league:", error);
    throw error;
  }
};

/**
 * Fetch league metadata
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} League metadata
 */
const getLeagueMetadata = async (leagueId) => {
  if (!leagueId) {
    throw new Error("League ID is required");
  }
  
  try {
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (leagueSnap.exists()) {
      return leagueSnap.data();
    } else {
      throw new Error("League not found");
    }
  } catch (error) {
    console.error("Error fetching league metadata:", error);
    throw error;
  }
};

/**
 * Update league metadata
 * @param {string} leagueId - League ID
 * @param {Object} metadata - Metadata to update
 * @returns {Promise<boolean>} Success status
 */
const updateLeagueMetadata = async (leagueId, metadata) => {
  if (!leagueId) {
    throw new Error("League ID is required");
  }
  
  try {
    const leagueRef = doc(db, "leagues", leagueId);
    
    // Clean data before saving
    const cleanData = JSON.parse(JSON.stringify(metadata));
    
    await updateDoc(leagueRef, {
      ...cleanData,
      updatedAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error("Error updating league metadata:", error);
    throw error;
  }
};

export {
  fetchPlayoffsData,
  savePlayoffsData,
  updateSeriesResults,
  updateFinalsMVP,
  listenToPlayoffsData,
  updateRoundLockStatus,
  listenToLockStatus,
  checkLeagueOwnership,
  addUserToLeague,
  getLeagueMetadata,
  updateLeagueMetadata
};

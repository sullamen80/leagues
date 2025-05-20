/**
 * Common League Service
 * 
 * Provides shared functionality for managing leagues across all game types.
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../firebase';

// Remove the direct import to break the circular dependency
// import { getGameType } from '../../index';

/**
 * Create a new league
 * @param {Object} leagueData - League information
 * @param {string} leagueData.title - The league title
 * @param {string} leagueData.gameTypeId - The game type ID
 * @param {string} leagueData.ownerId - The user ID of the owner
 * @param {Object} leagueData.settings - Game type specific settings
 * @returns {Promise<string>} - The new league ID
 */
export const createLeague = async (leagueData) => {
  try {
    if (!leagueData.title) {
      throw new Error('League title is required');
    }
    
    if (!leagueData.gameTypeId) {
      throw new Error('Game type is required');
    }
    
    if (!leagueData.ownerId) {
      throw new Error('Owner ID is required');
    }
    
    // Get the game type module
    // Use dynamic import to avoid circular dependency
    const { getGameType } = await import('../../index');
    const gameTypeModule = getGameType(leagueData.gameTypeId);
    if (!gameTypeModule) {
      throw new Error(`Invalid game type: ${leagueData.gameTypeId}`);
    }
    
    // Create the league document
    const leagueRef = doc(collection(db, 'leagues'));
    
    // Prepare the league data
    const newLeague = {
      id: leagueRef.id,
      title: leagueData.title,
      gameTypeId: leagueData.gameTypeId,
      ownerId: leagueData.ownerId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      members: [leagueData.ownerId],
      users: [{ id: leagueData.ownerId, role: 'owner' }],
      settings: leagueData.settings || {},
      status: 'active'
    };
    
    // Save the league
    await setDoc(leagueRef, newLeague);
    
    // Call the game type's onLeagueCreate method
    try {
      await gameTypeModule.onLeagueCreate(leagueRef.id, leagueData.ownerId, leagueData.settings);
    } catch (error) {
      console.error(`Error in ${leagueData.gameTypeId}.onLeagueCreate:`, error);
    }
    
    // Add the league to the user's leagues
    const userRef = doc(db, 'users', leagueData.ownerId);
    await updateDoc(userRef, {
      leagueIds: arrayUnion(leagueRef.id)
    });
    
    return leagueRef.id;
  } catch (error) {
    console.error('Error creating league:', error);
    throw error;
  }
};

/**
 * Get a league by ID
 * @param {string} leagueId - The league ID
 * @returns {Promise<Object>} - The league data
 */
export const getLeague = async (leagueId) => {
  try {
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (!leagueSnap.exists()) {
      throw new Error('League not found');
    }
    
    return { id: leagueSnap.id, ...leagueSnap.data() };
  } catch (error) {
    console.error('Error getting league:', error);
    throw error;
  }
};

/**
 * Add a user to a league
 * @param {string} leagueId - The league ID
 * @param {string} userId - The user ID
 * @param {Object} userData - Additional user data
 * @returns {Promise<boolean>} - Success indicator
 */
export const addUserToLeague = async (leagueId, userId, userData = {}) => {
  try {
    // Get the league
    const league = await getLeague(leagueId);
    
    // Get the game type module
    // Use dynamic import to avoid circular dependency
    const { getGameType } = await import('../../index');
    const gameTypeModule = getGameType(league.gameTypeId);
    if (!gameTypeModule) {
      throw new Error(`Invalid game type: ${league.gameTypeId}`);
    }
    
    // Update the league document
    const leagueRef = doc(db, 'leagues', leagueId);
    
    // Add user to members array
    await updateDoc(leagueRef, {
      members: arrayUnion(userId),
      users: arrayUnion({ 
        id: userId,
        role: 'member',
        joinedAt: Timestamp.now(),
        ...userData 
      }),
      updatedAt: Timestamp.now()
    });
    
    // Add the league to the user's leagues
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      leagueIds: arrayUnion(leagueId)
    });
    
    // Call the game type's onUserJoinLeague method
    try {
      await gameTypeModule.onUserJoinLeague(leagueId, userId);
    } catch (error) {
      console.error(`Error in ${league.gameTypeId}.onUserJoinLeague:`, error);
    }
    
    return true;
  } catch (error) {
    console.error('Error adding user to league:', error);
    throw error;
  }
};

/**
 * Remove a user from a league
 * @param {string} leagueId - The league ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Success indicator
 */
export const removeUserFromLeague = async (leagueId, userId) => {
  try {
    // Get the league
    const league = await getLeague(leagueId);
    
    // Can't remove the owner
    if (league.ownerId === userId) {
      throw new Error('Cannot remove the league owner');
    }
    
    // Get the game type module
    // Use dynamic import to avoid circular dependency
    const { getGameType } = await import('../../index');
    const gameTypeModule = getGameType(league.gameTypeId);
    if (!gameTypeModule) {
      throw new Error(`Invalid game type: ${league.gameTypeId}`);
    }
    
    // Update the league document
    const leagueRef = doc(db, 'leagues', leagueId);
    
    // Get the current users array
    const leagueSnap = await getDoc(leagueRef);
    if (!leagueSnap.exists()) {
      throw new Error('League not found');
    }
    
    const leagueData = leagueSnap.data();
    
    // Remove user from members array
    await updateDoc(leagueRef, {
      members: arrayRemove(userId),
      updatedAt: Timestamp.now()
    });
    
    // Remove user from users array
    const users = leagueData.users || [];
    const updatedUsers = users.filter(user => 
      typeof user === 'string' 
        ? user !== userId 
        : user.id !== userId
    );
    
    await updateDoc(leagueRef, {
      users: updatedUsers
    });
    
    // Remove the league from the user's leagues
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      leagueIds: arrayRemove(leagueId)
    });
    
    // Call the game type's onUserLeaveLeague method
    if (gameTypeModule.onUserLeaveLeague) {
      try {
        await gameTypeModule.onUserLeaveLeague(leagueId, userId);
      } catch (error) {
        console.error(`Error in ${league.gameTypeId}.onUserLeaveLeague:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error removing user from league:', error);
    throw error;
  }
};
  
/**
 * Get all leagues for a user, with option to separate active and archived
 * @param {string} userId - The user ID
 * @param {boolean} includeArchived - Whether to include archived leagues (default: true)
 * @param {boolean} separateArchived - Whether to separate active and archived leagues in result
 * @returns {Promise<Object>} - Object with leagues or {active, archived} arrays
 */
export const getUserLeagues = async (userId, includeArchived = true, separateArchived = false) => {
  try {
    // Get the user's leagueIds
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    const leagueIds = userData.leagueIds || [];
    
    if (leagueIds.length === 0) {
      return separateArchived ? { active: [], archived: [] } : [];
    }
    
    // Get all the leagues
    const activeLeagues = [];
    const archivedLeagues = [];
    
    for (const leagueId of leagueIds) {
      try {
        const leagueRef = doc(db, 'leagues', leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (leagueSnap.exists()) {
          const league = { id: leagueSnap.id, ...leagueSnap.data() };
          
          // Determine if league is archived
          const isArchived = league.status === 'archived';
          
          // Skip archived leagues if not included
          if (isArchived && !includeArchived) {
            continue;
          }
          
          // Add to appropriate array if separating, otherwise just to leagues array
          if (separateArchived) {
            if (isArchived) {
              archivedLeagues.push(league);
            } else {
              activeLeagues.push(league);
            }
          } else {
            activeLeagues.push(league);
          }
        }
      } catch (error) {
        console.error(`Error getting league ${leagueId}:`, error);
        // Skip this league and continue
      }
    }
    
    // Return in appropriate format
    return separateArchived 
      ? { active: activeLeagues, archived: archivedLeagues } 
      : activeLeagues;
  } catch (error) {
    console.error('Error getting user leagues:', error);
    throw error;
  }
};
  
/**
 * Get all available leagues (that the user is not already in)
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} - Array of available league objects
 */
export const getAvailableLeagues = async (userId) => {
  try {
    // Get all leagues
    const leaguesRef = collection(db, 'leagues');
    const leaguesSnap = await getDocs(leaguesRef);
    
    // Get the user's leagueIds
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    const userLeagueIds = userData.leagueIds || [];
    
    // Filter to only include leagues the user is not in
    const availableLeagues = [];
    
    leaguesSnap.forEach(doc => {
      const leagueData = doc.data();
      
      // Skip leagues the user is already in
      if (userLeagueIds.includes(doc.id)) {
        return;
      }
      
      // Skip inactive leagues
      if (leagueData.status === 'inactive') {
        return;
      }
      
      availableLeagues.push({
        id: doc.id,
        ...leagueData
      });
    });
    
    return availableLeagues;
  } catch (error) {
    console.error('Error getting available leagues:', error);
    throw error;
  }
};

/**
 * End a league and determine winners
 * @param {string} leagueId - The league ID
 * @param {string} requestingUserId - The ID of the user ending the league (must be owner)
 * @returns {Promise<Object>} - Object with winners array and success status
 */
export const endLeague = async (leagueId, requestingUserId) => {
  try {
    // Get the league data
    const league = await getLeague(leagueId);
    
    // Check if the requesting user is the owner
    if (league.ownerId !== requestingUserId) {
      throw new Error('Only the league owner can end a league');
    }
    
    // Check if the league is already archived
    if (league.status === 'archived') {
      throw new Error('This league is already archived');
    }
    
    // Get the game type module
    // Use dynamic import to avoid circular dependency
    const { getGameType } = await import('../../index');
    const gameTypeModule = getGameType(league.gameTypeId);
    if (!gameTypeModule) {
      throw new Error(`Invalid game type: ${league.gameTypeId}`);
    }
    
    // Calculate winners using the game type's logic
    let winners = [];
    try {
      // If the game type has a custom implementation for determining winners
      if (gameTypeModule.determineLeagueWinners) {
        winners = await gameTypeModule.determineLeagueWinners(leagueId);
      } else {
        // Default implementation for determining winners (should be overridden by game types)
        // This is a simple implementation that just gets players in the league
        const userBracketsRef = collection(db, "leagues", leagueId, "userData");
        const userBracketsSnap = await getDocs(userBracketsRef);
        
        if (userBracketsSnap.empty) {
          throw new Error("No user data found to determine winners");
        }
        
        // In a default implementation, we'd need a way to score users
        // For now, we're just marking all as equal (ties)
        const players = [];
        
        for (const bracketDoc of userBracketsSnap.docs) {
          const userId = bracketDoc.id;
          let userName = "Unknown User";
          
          // Get user info
          try {
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName = userData.displayName || userData.username || userData.email || "Unknown User";
            }
          } catch (err) {
            console.error("Error fetching user data:", err);
          }
          
          players.push({
            userId,
            userName,
            score: 0 // Default score
          });
        }
        
        winners = players;
      }
    } catch (err) {
      console.error("Error determining winners:", err);
      throw new Error(`Failed to determine winners: ${err.message}`);
    }
    
    if (winners.length === 0) {
      throw new Error("No winners could be determined");
    }
    
    // Batch write to update multiple documents
    const batch = writeBatch(db);
    
    // Update league status
    const leagueRef = doc(db, "leagues", leagueId);
    batch.update(leagueRef, {
      status: 'archived',
      archivedAt: Timestamp.now(),
      winners: winners.map(w => ({
        userId: w.userId,
        userName: w.userName,
        score: w.score || 0
      })),
      updatedAt: Timestamp.now()
    });
    
    // Update each winner's profile
    const winTimestamp = Timestamp.now();
    const endDate = winTimestamp.toDate().toLocaleDateString();
    
    for (const winner of winners) {
      // Add win to user's record
      const userRef = doc(db, "users", winner.userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Get existing wins or initialize empty array
        const userData = userSnap.data();
        const wins = userData.wins || [];
        
        // Add new win record
        wins.push({
          leagueId,
          leagueName: league.title,
          gameType: league.gameTypeId,
          score: winner.score || 0,
          date: winTimestamp,
          displayDate: endDate
        });
        
        // Update user document
        batch.update(userRef, { wins });
      }
    }
    
    // Commit the batch
    await batch.commit();
    
    // Call the game type's onLeagueEnd method if it exists
    if (gameTypeModule.onLeagueEnd) {
      try {
        await gameTypeModule.onLeagueEnd(leagueId, winners);
      } catch (err) {
        console.error(`Error in ${league.gameTypeId}.onLeagueEnd:`, err);
        // Continue even if this fails
      }
    }
    
    return {
      success: true,
      winners,
      archivedAt: winTimestamp
    };
  } catch (error) {
    console.error('Error ending league:', error);
    throw error;
  }
};
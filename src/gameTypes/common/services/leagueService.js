/**
 * Common League Service
 * 
 * Provides shared functionality for managing leagues across all game types.
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection, 
  getDocs, 
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../firebase';

const buildUserIdentity = (user = {}) => {
  const uid = user.uid || user.id;
  const displayName =
    user.displayName ||
    user.username ||
    user.email?.split('@')[0] ||
    uid;

  return {
    uid,
    displayName,
    username: user.username || displayName,
    email: user.email || null,
    photoURL: user.photoURL || null
  };
};

const getGameTypeContext = async (gameTypeId) => {
  const { getGameTypeModule, normalizeGameTypeId } = await import('../../index');
  const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);
  const gameTypeModule = getGameTypeModule(normalizedGameTypeId);

  if (!gameTypeModule) {
    throw new Error(`Invalid game type: ${gameTypeId}`);
  }

  return { normalizedGameTypeId, gameTypeModule };
};

const upsertUserLeagueMembership = async (user, leagueId) => {
  const identity = buildUserIdentity(user);
  const userRef = doc(db, 'users', identity.uid);
  const userSnap = await getDoc(userRef);
  const timestamp = Timestamp.now();

  if (userSnap.exists()) {
    await updateDoc(userRef, {
      username: identity.username,
      displayName: identity.displayName,
      email: identity.email,
      photoURL: identity.photoURL,
      leagueIds: arrayUnion(leagueId),
      updatedAt: timestamp
    });
    return;
  }

  await setDoc(userRef, {
    id: identity.uid,
    username: identity.username,
    displayName: identity.displayName,
    email: identity.email,
    photoURL: identity.photoURL,
    leagueIds: [leagueId],
    createdAt: timestamp,
    updatedAt: timestamp
  });
};

const buildLeagueUserRecord = (user, role = 'member') => {
  const identity = buildUserIdentity(user);

  return {
    id: identity.uid,
    username: identity.username,
    displayName: identity.displayName,
    email: identity.email,
    photoURL: identity.photoURL,
    role,
    joinedAt: Timestamp.now()
  };
};

export const hashLeaguePassword = async (password) => {
  if (!password) {
    return null;
  }

  if (!window.crypto?.subtle) {
    throw new Error('Secure password hashing is not available in this environment');
  }

  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const createPasswordJoinRequest = async (leagueId, userId, providedPassword) => {
  if (!providedPassword?.trim()) {
    throw new Error('Password is required');
  }

  const passwordHash = await hashLeaguePassword(providedPassword.trim());
  const joinRequestRef = doc(db, 'leagues', leagueId, 'joinRequests', userId);

  try {
    await setDoc(joinRequestRef, {
      userId,
      passwordHash,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    if (error?.code === 'permission-denied') {
      throw new Error('Incorrect password');
    }

    throw error;
  }

  return joinRequestRef;
};

/**
 * Create a new league
 * @param {Object} leagueData - League information
 * @param {string} leagueData.gameTypeId - The game type ID
 * @param {Object} leagueData.owner - Firebase Auth user creating the league
 * @returns {Promise<Object>} - Created league metadata
 */
export const createLeague = async (leagueData) => {
  try {
    if (!leagueData.gameTypeId) {
      throw new Error('Game type is required');
    }
    
    if (!leagueData.owner?.uid) {
      throw new Error('Owner is required');
    }

    const { normalizedGameTypeId } = await getGameTypeContext(leagueData.gameTypeId);
    const ownerIdentity = buildUserIdentity(leagueData.owner);
    const leagueRef = doc(collection(db, 'leagues'));
    const timestamp = Timestamp.now();
    const newLeague = {
      leagueId: leagueRef.id,
      title: '',
      description: '',
      gameTypeId: normalizedGameTypeId,
      ownerId: ownerIdentity.uid,
      ownerName: ownerIdentity.displayName,
      createdBy: ownerIdentity.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
      private: false,
      passwordProtected: false,
      setupCompleted: false,
      status: 'active',
      users: [buildLeagueUserRecord(leagueData.owner, 'owner')],
      members: [ownerIdentity.uid],
      userIds: [ownerIdentity.uid]
    };

    await setDoc(leagueRef, newLeague);
    await upsertUserLeagueMembership(leagueData.owner, leagueRef.id);

    return {
      leagueId: leagueRef.id,
      gameTypeId: normalizedGameTypeId
    };
  } catch (error) {
    console.error('Error creating league:', error);
    throw error;
  }
};

export const completeLeagueSetup = async (leagueId, setupData = {}) => {
  try {
    const league = await getLeague(leagueId);
    const { normalizedGameTypeId, gameTypeModule } = await getGameTypeContext(league.gameTypeId);
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSecretRef = doc(db, 'leagueSecrets', leagueId);
    const passwordProtected = setupData.passwordProtected === true;

    await updateDoc(leagueRef, {
      title: setupData.title || league.title || '',
      description: setupData.description || league.description || '',
      private: setupData.private !== undefined ? setupData.private : league.private === true,
      passwordProtected,
      password: deleteField(),
      gameTypeId: normalizedGameTypeId,
      setupCompleted: false,
      updatedAt: Timestamp.now()
    });

    if (passwordProtected) {
      const passwordHash = await hashLeaguePassword(setupData.password);
      await setDoc(leagueSecretRef, {
        ownerId: league.ownerId,
        passwordHash,
        updatedAt: Timestamp.now()
      });
    } else {
      try {
        await deleteDoc(leagueSecretRef);
      } catch (error) {
        if (error?.code !== 'not-found') {
          throw error;
        }
      }
    }

    if (typeof gameTypeModule.initializeLeague === 'function') {
      const initializationResult = await gameTypeModule.initializeLeague(leagueId, {
        ...setupData,
        gameTypeId: normalizedGameTypeId
      });
      if (initializationResult?.success === false) {
        throw new Error(initializationResult.error || 'Failed to initialize league game data');
      }
    }

    await updateDoc(leagueRef, {
      setupCompleted: true,
      updatedAt: Timestamp.now()
    });

    return {
      success: true,
      leagueId,
      gameTypeId: normalizedGameTypeId
    };
  } catch (error) {
    console.error('Error completing league setup:', error);
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
    
    const leagueData = leagueSnap.data();
    const { normalizeGameTypeId } = await import('../../index');

    return {
      id: leagueSnap.id,
      ...leagueData,
      gameTypeId: normalizeGameTypeId(leagueData.gameTypeId)
    };
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
    const league = await getLeague(leagueId);
    const { gameTypeModule } = await getGameTypeContext(league.gameTypeId);
    const leagueRef = doc(db, 'leagues', leagueId);
    const joiningUser = {
      id: userId,
      uid: userId,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      email: userData.email,
      photoURL: userData.photoURL
    };

    await updateDoc(leagueRef, {
      members: arrayUnion(userId),
      users: arrayUnion({ 
        ...buildLeagueUserRecord(joiningUser),
        ...userData
      }),
      updatedAt: Timestamp.now()
    });

    await upsertUserLeagueMembership(joiningUser, leagueId);

    try {
      if (typeof gameTypeModule.onUserJoin === 'function') {
        await gameTypeModule.onUserJoin(leagueId, userId, { userInfo: joiningUser, league });
      } else if (typeof gameTypeModule.onUserJoinLeague === 'function') {
        await gameTypeModule.onUserJoinLeague(leagueId, userId, { userInfo: joiningUser, league });
      }
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
    const { gameTypeModule } = await getGameTypeContext(league.gameTypeId);
    
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
    const { normalizeGameTypeId } = await import('../../index');
    // Get the user's leagueIds
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    const profileLeagueIds = userData.leagueIds || [];
    const memberQuery = query(collection(db, 'leagues'), where('members', 'array-contains', userId));
    const memberSnapshot = await getDocs(memberQuery);
    const memberLeagues = new Map(memberSnapshot.docs.map((entry) => [entry.id, entry]));
    const leagueIds = [...new Set([...profileLeagueIds, ...memberLeagues.keys()])];

    if (leagueIds.length === 0) {
      return separateArchived ? { active: [], archived: [] } : [];
    }
    
    // Get all the leagues
    const activeLeagues = [];
    const archivedLeagues = [];
    const staleWinsPoolIds = [];
    
    for (const leagueId of leagueIds) {
      try {
        const leagueRef = doc(db, 'leagues', leagueId);
        const leagueSnap = memberLeagues.get(leagueId) || await getDoc(leagueRef);
        
        if (leagueSnap.exists()) {
          const leagueData = leagueSnap.data();
          if (
            normalizeGameTypeId(leagueData.gameTypeId) === 'winsPool' &&
            leagueData.ownerId !== userId &&
            !leagueData.members?.includes(userId)
          ) {
            staleWinsPoolIds.push(leagueId);
            continue;
          }
          const league = {
            id: leagueSnap.id,
            ...leagueData,
            gameTypeId: normalizeGameTypeId(leagueData.gameTypeId)
          };
          
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

    // A league owner can manage membership, but only the user can update their profile.
    // Reconcile that profile when the participant next opens their dashboard.
    try {
      const addedIds = [...memberLeagues.keys()].filter((id) => !profileLeagueIds.includes(id));
      if (addedIds.length) await updateDoc(userRef, { leagueIds: arrayUnion(...addedIds) });
      if (staleWinsPoolIds.length) await updateDoc(userRef, { leagueIds: arrayRemove(...staleWinsPoolIds) });
    } catch (membershipError) {
      console.warn('Could not reconcile profile league membership:', membershipError);
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
    const { normalizeGameTypeId } = await import('../../index');
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
      const isWinsPoolMember = leagueData.ownerId === userId || leagueData.members?.includes(userId);
      const alreadyJoined = normalizeGameTypeId(leagueData.gameTypeId) === 'winsPool'
        ? isWinsPoolMember
        : userLeagueIds.includes(doc.id) || leagueData.members?.includes(userId);
      if (alreadyJoined) {
        return;
      }
      
      // Skip inactive leagues
      if (leagueData.status === 'inactive') {
        return;
      }
      
      availableLeagues.push({
        id: doc.id,
        ...leagueData,
        gameTypeId: normalizeGameTypeId(leagueData.gameTypeId)
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
    const { gameTypeModule } = await getGameTypeContext(league.gameTypeId);
    
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

export const joinLeague = async ({ leagueId, currentUser, providedPassword = null }) => {
  let joinRequestRef = null;

  try {
    if (!currentUser?.uid) {
      throw new Error('You must be logged in to join a league');
    }

    const league = await getLeague(leagueId);

    if (league.status === 'archived') {
      throw new Error('This league has been archived and cannot be joined');
    }

    if (league.private) {
      throw new Error('Private leagues cannot be joined from the public browser');
    }

    if (Array.isArray(league.members) && league.members.includes(currentUser.uid)) {
      return {
        success: true,
        alreadyMember: true,
        league
      };
    }

    if (league.passwordProtected) {
      joinRequestRef = await createPasswordJoinRequest(leagueId, currentUser.uid, providedPassword);
    }

    await addUserToLeague(leagueId, currentUser.uid, {
      username:
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        'User',
      displayName:
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        'User',
      email: currentUser.email || null,
      photoURL: currentUser.photoURL || null
    });

    if (joinRequestRef) {
      await deleteDoc(joinRequestRef);
    }

    return {
      success: true,
      league
    };
  } catch (error) {
    if (joinRequestRef) {
      try {
        await deleteDoc(joinRequestRef);
      } catch (cleanupError) {
        console.warn('Error cleaning up join request:', cleanupError);
      }
    }

    console.error('Error joining league:', error);
    throw error;
  }
};

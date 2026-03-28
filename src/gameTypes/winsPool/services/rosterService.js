// src/gameTypes/winsPool/services/rosterService.js
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTION_KEYS, GAME_DATA_DOCUMENTS } from '../constants/winsPoolConstants';

const USER_DATA_COLLECTION = COLLECTION_KEYS.USER_DATA;

/**
 * Fetch all user rosters for a league.
 * @param {string} leagueId
 * @returns {Promise<Array>}
 */
export const fetchAllRosters = async (leagueId) => {
  if (!leagueId) return [];
  
  const rosterRef = collection(db, 'leagues', leagueId, USER_DATA_COLLECTION);
  const snapshot = await getDocs(rosterRef);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
};

/**
 * Fetch a single roster for a user.
 * @param {string} leagueId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export const fetchRoster = async (leagueId, userId) => {
  if (!leagueId || !userId) return null;
  
  const rosterDoc = await getDoc(doc(db, 'leagues', leagueId, USER_DATA_COLLECTION, userId));
  if (!rosterDoc.exists()) return null;
  return {
    id: rosterDoc.id,
    ...rosterDoc.data()
  };
};

/**
 * Initialize empty roster for a user joining a league.
 * @param {string} leagueId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const createEmptyRoster = async (leagueId, userId, userInfo = {}) => {
  if (!leagueId || !userId) return;

  const rosterRef = doc(db, 'leagues', leagueId, USER_DATA_COLLECTION, userId);
  const existingSnap = await getDoc(rosterRef);
  const timestamp = new Date().toISOString();

  const metadata = {};
  if (userInfo.displayName) metadata.displayName = userInfo.displayName;
  if (userInfo.username) metadata.username = userInfo.username;
  if (userInfo.email) metadata.email = userInfo.email;
  if (userInfo.photoURL) metadata.photoURL = userInfo.photoURL;
  if (userInfo.role) metadata.role = userInfo.role;
  if (userInfo.joinedAt) metadata.joinedAt = userInfo.joinedAt;

  if (!existingSnap.exists()) {
    await setDoc(rosterRef, {
      teams: [],
      totalWins: 0,
      pendingPicks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...metadata
    });
    return;
  }

  const existingData = existingSnap.data() || {};
  const updates = { updatedAt: timestamp };

  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null && !existingData[key]) {
      updates[key] = value;
    }
  });

  await updateDoc(rosterRef, updates);
};

/**
 * Assign a team to a user's roster.
 * @param {string} leagueId
 * @param {string} userId
 * @param {Object} team
 * @returns {Promise<void>}
 */
export const assignTeamToRoster = async (leagueId, userId, team) => {
  if (!leagueId || !userId || !team) return;
  
  const rosterRef = doc(db, 'leagues', leagueId, USER_DATA_COLLECTION, userId);
  await updateDoc(rosterRef, {
    teams: team
      ? [...(await getRosterTeams(leagueId, userId)), {
          ...team,
          wins: team.wins || 0
        }]
      : [],
    updatedAt: new Date().toISOString()
  });
};

const getRosterTeams = async (leagueId, userId) => {
  const roster = await fetchRoster(leagueId, userId);
  return roster?.teams || [];
};

/**
 * Update win total for a specific team in a roster.
 * @param {string} leagueId
 * @param {string} userId
 * @param {string} teamId
 * @param {number} wins
 */
export const updateTeamWins = async (leagueId, userId, teamId, wins) => {
  if (!leagueId || !userId || !teamId) return;
  
  const roster = await fetchRoster(leagueId, userId);
  if (!roster) return;
  
  const updatedTeams = (roster.teams || []).map(team => {
    if (team.id === teamId) {
      return {
        ...team,
        wins
      };
    }
    return team;
  });
  
  const totalWins = updatedTeams.reduce((acc, team) => acc + (team.wins || 0), 0);
  
  await updateDoc(doc(db, 'leagues', leagueId, USER_DATA_COLLECTION, userId), {
    teams: updatedTeams,
    totalWins,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Increment a team's win total by delta (can be negative).
 * @param {string} leagueId
 * @param {string} userId
 * @param {string} teamId
 * @param {number} delta
 */
export const incrementTeamWins = async (leagueId, userId, teamId, delta = 1) => {
  if (!leagueId || !userId || !teamId || !delta) return;
  
  const rosterRef = doc(db, 'leagues', leagueId, USER_DATA_COLLECTION, userId);
  const rosterSnap = await getDoc(rosterRef);
  if (!rosterSnap.exists()) return;
  const roster = rosterSnap.data();
  
  const updatedTeams = (roster.teams || []).map(team => {
    if (team.id === teamId) {
      return {
        ...team,
        wins: (team.wins || 0) + delta
      };
    }
    return team;
  });
  
  const totalWins = updatedTeams.reduce((acc, team) => acc + (team.wins || 0), 0);
  
  await updateDoc(rosterRef, {
    teams: updatedTeams,
    totalWins,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Update league leaderboard totals based on current rosters.
 * @param {string} leagueId
 * @returns {Promise<void>}
 */
export const updateLeaderboardFromRosters = async (leagueId) => {
  if (!leagueId) return;
  
  const rosters = await fetchAllRosters(leagueId);
  const leaderboardData = rosters
    .map(roster => ({
      userId: roster.id,
      username: roster.username || roster.displayName || roster.id,
      totalWins: roster.totalWins || 0,
      teams: roster.teams || []
    }))
    .sort((a, b) => b.totalWins - a.totalWins);
  
  const leaderboardRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.LEADERBOARD, GAME_DATA_DOCUMENTS.CURRENT);
  await setDoc(leaderboardRef, {
    entries: leaderboardData,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

/**
 * Sync aggregated stats into game data for quick dashboard display.
 * @param {string} leagueId
 * @returns {Promise<void>}
 */
export const syncGameDataTotals = async (leagueId) => {
  if (!leagueId) return;
  
  const rosters = await fetchAllRosters(leagueId);
  const totalWins = rosters.reduce((acc, roster) => acc + (roster.totalWins || 0), 0);
  
  const gameDataRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);
  await updateDoc(gameDataRef, {
    totals: {
      totalWins,
      totalTeamsAssigned: rosters.reduce((acc, roster) => acc + (roster.teams?.length || 0), 0)
    },
    updatedAt: new Date().toISOString()
  });
};

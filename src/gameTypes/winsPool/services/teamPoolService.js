// src/gameTypes/winsPool/services/teamPoolService.js
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { PRESET_TEAM_POOLS, getPresetTeamPoolById, hydrateTeamPool } from '../constants/teamPools';
import { COLLECTION_KEYS, TEAM_POOL_SCOPES } from '../constants/winsPoolConstants';

const GLOBAL_TEAM_POOLS_COLLECTION = COLLECTION_KEYS.TEAM_POOLS;

/**
 * Fetch all global team pools (preset + globally saved custom pools).
 * @returns {Promise<Array>}
 */
export const fetchGlobalTeamPools = async () => {
  const pools = Object.values(PRESET_TEAM_POOLS).map(pool => ({
    ...pool,
    scope: TEAM_POOL_SCOPES.PRESET
  }));
  
  try {
    const globalRef = collection(db, GLOBAL_TEAM_POOLS_COLLECTION);
    const snapshot = await getDocs(globalRef);
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      pools.push({
        id: data.id || docSnap.id,
        ...data,
        scope: TEAM_POOL_SCOPES.GLOBAL
      });
    });
  } catch (error) {
    console.error('[WinsPool][TeamPoolService] Failed to fetch global pools:', error);
  }
  
  return pools;
};

/**
 * Fetch team pools scoped to a specific league.
 * @param {string} leagueId
 * @returns {Promise<Array>}
 */
export const fetchLeagueTeamPools = async (leagueId) => {
  if (!leagueId) return [];
  
  try {
    const leagueCollection = collection(db, 'leagues', leagueId, GLOBAL_TEAM_POOLS_COLLECTION);
    const snapshot = await getDocs(leagueCollection);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      scope: TEAM_POOL_SCOPES.LEAGUE
    }));
  } catch (error) {
    console.error('[WinsPool][TeamPoolService] Failed to fetch league pools:', error);
    return [];
  }
};

/**
 * Get a team pool by id, checking preset, global, then league scope.
 * @param {Object} params
 * @param {string} params.poolId
 * @param {string} [params.leagueId]
 * @returns {Promise<Object|null>}
 */
export const getTeamPool = async ({ poolId, leagueId }) => {
  if (!poolId) return null;
  
  const preset = getPresetTeamPoolById(poolId.replace(/^preset-/, ''));
  if (preset) {
    return {
      ...preset,
      scope: TEAM_POOL_SCOPES.PRESET
    };
  }
  
  // Check global custom pools
  try {
    const globalDoc = await getDoc(doc(db, GLOBAL_TEAM_POOLS_COLLECTION, poolId));
    if (globalDoc.exists()) {
      return {
        id: globalDoc.id,
        ...globalDoc.data(),
        scope: TEAM_POOL_SCOPES.GLOBAL
      };
    }
  } catch (error) {
    console.error('[WinsPool][TeamPoolService] Failed to fetch global pool:', error);
  }
  
  if (leagueId) {
    try {
      const leagueDoc = await getDoc(doc(db, 'leagues', leagueId, GLOBAL_TEAM_POOLS_COLLECTION, poolId));
      if (leagueDoc.exists()) {
        return {
          id: leagueDoc.id,
          ...leagueDoc.data(),
          scope: TEAM_POOL_SCOPES.LEAGUE
        };
      }
    } catch (error) {
      console.error('[WinsPool][TeamPoolService] Failed to fetch league pool:', error);
    }
  }
  
  return null;
};

/**
 * Save a custom team pool either globally or scoped to the league.
 * @param {Object} params
 * @param {string} params.leagueId
 * @param {Object} params.pool
 * @param {boolean} [params.isGlobal=false]
 * @returns {Promise<Object>}
 */
export const saveCustomTeamPool = async ({ leagueId, pool, isGlobal = false }) => {
  if (!pool) throw new Error('Pool data is required');
  
  const hydrated = hydrateTeamPool(pool, isGlobal ? TEAM_POOL_SCOPES.GLOBAL : TEAM_POOL_SCOPES.LEAGUE);
  const targetCollection = isGlobal
    ? collection(db, GLOBAL_TEAM_POOLS_COLLECTION)
    : collection(db, 'leagues', leagueId, GLOBAL_TEAM_POOLS_COLLECTION);
  
  const docId = hydrated.id;
  
  try {
    await setDoc(doc(targetCollection, docId), hydrated, { merge: true });
    return hydrated;
  } catch (error) {
    console.error('[WinsPool][TeamPoolService] Failed to save pool:', error);
    throw error;
  }
};

/**
 * Update existing pool metadata/teams.
 * @param {Object} params
 * @param {string} params.poolId
 * @param {Object} params.updates
 * @param {string} [params.leagueId]
 * @returns {Promise<void>}
 */
export const updateTeamPool = async ({ poolId, updates, leagueId }) => {
  if (!poolId || !updates) return;
  
  try {
    if (leagueId) {
      await updateDoc(doc(db, 'leagues', leagueId, GLOBAL_TEAM_POOLS_COLLECTION, poolId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return;
    }
    
    await updateDoc(doc(db, GLOBAL_TEAM_POOLS_COLLECTION, poolId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WinsPool][TeamPoolService] Failed to update pool:', error);
    throw error;
  }
};

/**
 * Delete a custom team pool.
 * @param {Object} params
 * @param {string} params.poolId
 * @param {string} [params.leagueId]
 * @returns {Promise<void>}
 */
export const deleteTeamPool = async ({ poolId, leagueId }) => {
  if (!poolId) return;
  
  try {
    if (leagueId) {
      await deleteDoc(doc(db, 'leagues', leagueId, GLOBAL_TEAM_POOLS_COLLECTION, poolId));
    } else {
      await deleteDoc(doc(db, GLOBAL_TEAM_POOLS_COLLECTION, poolId));
    }
  } catch (error) {
    console.error('[WinsPool][TeamPoolService] Failed to delete pool:', error);
    throw error;
  }
};

/**
 * Hydrate pool options for UI selects.
 * @param {Array} pools
 * @returns {Array}
 */
export const toSelectOptions = (pools = []) => {
  return pools.map(pool => ({
    value: pool.id,
    label: pool.name,
    description: pool.description || '',
    scope: pool.scope || TEAM_POOL_SCOPES.CUSTOM
  }));
};

// src/gameTypes/winsPool/services/scoringService.js
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTION_KEYS, GAME_DATA_DOCUMENTS } from '../constants/winsPoolConstants';
import { fetchAllRosters } from './rosterService';
import {
  normalizeScoringSettings,
  calculateStandingsFromData
} from '../utils/scoringUtils';

/**
 * Get scoring settings for a league or fallback to defaults.
 * @param {string} leagueId
 * @returns {Promise<Object>}
 */
export const getScoringSettings = async (leagueId) => {
  if (!leagueId) return normalizeScoringSettings();

  try {
    const scoringRef = doc(
      db,
      'leagues',
      leagueId,
      COLLECTION_KEYS.SETTINGS,
      'scoring'
    );
    const scoringSnap = await getDoc(scoringRef);
    if (scoringSnap.exists()) {
      return normalizeScoringSettings(scoringSnap.data());
    }
  } catch (error) {
    console.error('[WinsPool][ScoringService] Failed to fetch scoring settings:', error);
  }

  return normalizeScoringSettings();
};

/**
 * Save scoring settings.
 * @param {string} leagueId
 * @param {Object} settings
 * @returns {Promise<void>}
 */
export const saveScoringSettings = async (leagueId, settings) => {
  if (!leagueId || !settings) return;

  const normalized = normalizeScoringSettings(settings);
  const scoringRef = doc(
    db,
    'leagues',
    leagueId,
    COLLECTION_KEYS.SETTINGS,
    'scoring'
  );

  await setDoc(
    scoringRef,
    {
      ...normalized,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
};

/**
 * Calculate league standings based on current rosters and scoring settings.
 * @param {string} leagueId
 * @returns {Promise<Array>}
 */
export const calculateLeagueStandings = async (leagueId) => {
  if (!leagueId) return [];

  const gameDataRef = doc(
    db,
    'leagues',
    leagueId,
    COLLECTION_KEYS.GAME_DATA,
    GAME_DATA_DOCUMENTS.CURRENT
  );

  const [rosters, scoringSettingsRaw, gameDataSnap] = await Promise.all([
    fetchAllRosters(leagueId),
    getScoringSettings(leagueId),
    getDoc(gameDataRef)
  ]);

  const gameData = gameDataSnap.exists() ? gameDataSnap.data() || {} : {};
  const teamPool = Array.isArray(gameData?.teamPool)
    ? gameData.teamPool
    : gameData?.teamPool?.teams || [];

  return calculateStandingsFromData({
    rosters,
    scoringSettings: scoringSettingsRaw,
    teamWinsMap: gameData.teamWins || {},
    playerLeaders: gameData.playerLeaders || {},
    teamPool
  });
};

/**
 * Persist calculated standings into the league leaderboard document.
 * @param {string} leagueId
 * @returns {Promise<void>}
 */
export const updateLeagueLeaderboard = async (leagueId) => {
  if (!leagueId) return;

  const standings = await calculateLeagueStandings(leagueId);
  const leaderboardRef = doc(
    db,
    'leagues',
    leagueId,
    COLLECTION_KEYS.LEADERBOARD,
    GAME_DATA_DOCUMENTS.CURRENT
  );

  await setDoc(
    leaderboardRef,
    {
      entries: standings,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
};

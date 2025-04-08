// src/gameTypes/nbaPlayoffs/services/bracketService.js
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getDefaultGameData, repairBracket, generateFirstRoundMatchups } from '../utils/bracketUtils';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Initialize a new league with NBA Playoffs game data
 * @param {string} leagueId - ID of the league to initialize
 * @param {Object} playoffsData - Optional playoffs data from setup
 * @returns {Promise<boolean>} Success status
 */
const initializeLeagueGameData = async (leagueId, playoffsData = null) => {
  try {
    if (!leagueId) {
      console.error("No league ID provided");
      throw new Error("League ID is required");
    }

    // Create default game data structure
    const gameData = getDefaultGameData();

    // If playoffs data was provided, use it instead of the default
    if (playoffsData && playoffsData.playoffTeams) {
      console.log("Using provided playoffs data", playoffsData);
      gameData.playoffTeams = playoffsData.playoffTeams;
      gameData.seasonYear = playoffsData.seasonYear || new Date().getFullYear();
    }

    // Generate first round matchups based on seeding
    if (gameData.playoffTeams && 
        gameData.playoffTeams.eastConference && 
        gameData.playoffTeams.westConference) {
      gameData[ROUND_KEYS.FIRST_ROUND] = generateFirstRoundMatchups(
        gameData.playoffTeams.eastConference,
        gameData.playoffTeams.westConference
      );
    }

    // Save to Firestore
    await setDoc(doc(db, "leagues", leagueId, "gameData", "current"), gameData);
    
    // Create default locks document
    const defaultLocks = {
      [ROUND_KEYS.FIRST_ROUND]: { locked: false, lockedAt: null },
      [ROUND_KEYS.CONF_SEMIS]: { locked: false, lockedAt: null },
      [ROUND_KEYS.CONF_FINALS]: { locked: false, lockedAt: null },
      [ROUND_KEYS.NBA_FINALS]: { locked: false, lockedAt: null },
      [ROUND_KEYS.FINALS_MVP]: { locked: false, lockedAt: null }
    };
    
    await setDoc(doc(db, "leagues", leagueId, "locks", "lockStatus"), defaultLocks);

    console.log("NBA Playoffs game data initialized for league:", leagueId);
    return true;
  } catch (error) {
    console.error("Error initializing NBA Playoffs game data:", error);
    throw error;
  }
};

/**
 * Fetch a user's bracket
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User's bracket data
 */
const getUserBracket = async (leagueId, userId) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }

    const bracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const bracketSnap = await getDoc(bracketRef);

    if (bracketSnap.exists()) {
      return bracketSnap.data();
    } else {
      return null; // User doesn't have a bracket yet
    }
  } catch (error) {
    console.error("Error fetching user bracket:", error);
    throw error;
  }
};

/**
 * Save a user's bracket
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @param {Object} bracketData - Bracket data to save
 * @returns {Promise<boolean>} Success status
 */
const saveUserBracket = async (leagueId, userId, bracketData) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }
    
    if (!bracketData) {
      throw new Error("Bracket data is required");
    }

    // Clean data before saving (remove undefined values that Firestore rejects)
    const cleanData = JSON.parse(JSON.stringify(bracketData));
    
    // Add metadata
    cleanData.updatedAt = new Date().toISOString();
    
    // Save to Firestore
    await setDoc(doc(db, "leagues", leagueId, "userData", userId), cleanData, { merge: true });
    
    return true;
  } catch (error) {
    console.error("Error saving user bracket:", error);
    throw error;
  }
};

/**
 * Save specific round data for a user's bracket
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @param {string} roundName - Round name
 * @param {Array|Object} roundData - Round data to save
 * @returns {Promise<boolean>} Success status
 */
const saveUserBracketRound = async (leagueId, userId, roundName, roundData) => {
  try {
    if (!leagueId || !userId || !roundName) {
      throw new Error("League ID, User ID, and Round name are required");
    }
    
    if (!roundData) {
      throw new Error("Round data is required");
    }
    
    // Clean data before saving
    const cleanData = JSON.parse(JSON.stringify(roundData));
    
    // Update the specific round and updatedAt timestamp
    await updateDoc(doc(db, "leagues", leagueId, "userData", userId), {
      [roundName]: cleanData,
      updatedAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error(`Error saving ${roundName}:`, error);
    throw error;
  }
};

/**
 * Save Finals MVP prediction for a user's bracket
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @param {string} mvpId - Player ID predicted as Finals MVP
 * @returns {Promise<boolean>} Success status
 */
const saveUserFinalsMVP = async (leagueId, userId, mvpId) => {
  try {
    if (!leagueId || !userId || !mvpId) {
      throw new Error("League ID, User ID, and MVP ID are required");
    }
    
    // Update the Finals MVP prediction and updatedAt timestamp
    await updateDoc(doc(db, "leagues", leagueId, "userData", userId), {
      [ROUND_KEYS.FINALS_MVP]: mvpId,
      updatedAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error("Error saving Finals MVP prediction:", error);
    throw error;
  }
};

/**
 * Create bracket template for new users
 * @param {string} leagueId - League ID
 * @param {Object} playoffsData - Playoffs data to use as a base
 * @returns {Promise<boolean>} Success status
 */
const createBracketTemplate = async (leagueId, playoffsData) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    // Create a template with the teams but no winners
    const templateData = {
      [ROUND_KEYS.FIRST_ROUND]: playoffsData[ROUND_KEYS.FIRST_ROUND] ? playoffsData[ROUND_KEYS.FIRST_ROUND].map(matchup => ({
        team1: matchup.team1 || "",
        team1Seed: matchup.team1Seed || null,
        team2: matchup.team2 || "",
        team2Seed: matchup.team2Seed || null,
        winner: "", // No winner
        gamesPlayed: null
      })) : Array(8).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", gamesPlayed: null 
      })),
      // Empty arrays for subsequent rounds
      [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", gamesPlayed: null
      })),
      [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", gamesPlayed: null
      })),
      [ROUND_KEYS.NBA_FINALS]: { 
        team1: "", team1Seed: null,
        team2: "", team2Seed: null,
        winner: "", gamesPlayed: null
      },
      [ROUND_KEYS.FINALS_MVP]: "",
      createdAt: new Date().toISOString(),
      isTemplate: true
    };
    
    // Save the template
    await setDoc(doc(db, "leagues", leagueId, "bracketTemplate", "current"), templateData);
    
    return true;
  } catch (error) {
    console.error("Error creating bracket template:", error);
    throw error;
  }
};

/**
 * Create user bracket from template
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
const createUserBracketFromTemplate = async (leagueId, userId) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }
    
    // Check if user already has a bracket
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    
    if (userBracketSnap.exists()) {
      console.log("User already has a bracket, skipping template creation");
      return false;
    }
    
    // Check if we have a template
    const templateRef = doc(db, "leagues", leagueId, "bracketTemplate", "current");
    const templateSnap = await getDoc(templateRef);
    
    let templateData;
    
    if (templateSnap.exists()) {
      templateData = templateSnap.data();
    } else {
      console.log("No bracket template found, creating from playoffs data");
      
      // Get playoffs data instead
      const playoffsRef = doc(db, "leagues", leagueId, "gameData", "current");
      const playoffsSnap = await getDoc(playoffsRef);
      
      if (!playoffsSnap.exists()) {
        throw new Error("No template or playoffs data available");
      }
      
      const playoffsData = playoffsSnap.data();
      
      // Create template from playoffs data
      await createBracketTemplate(leagueId, playoffsData);
      
      // Fetch the new template
      const newTemplateSnap = await getDoc(templateRef);
      
      if (!newTemplateSnap.exists()) {
        throw new Error("Failed to create bracket template");
      }
      
      templateData = newTemplateSnap.data();
    }
    
    // Create user bracket from template
    const userData = {
      ...templateData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId,
      isTemplate: false
    };
    
    // Save to user document
    await setDoc(userBracketRef, userData);
    
    return true;
  } catch (error) {
    console.error("Error creating user bracket from template:", error);
    throw error;
  }
};

/**
 * Repair a damaged user bracket
 * @param {string} leagueId - League ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
const repairUserBracket = async (leagueId, userId) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }
    
    // Get current user bracket
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    
    if (!userBracketSnap.exists()) {
      console.log("No user bracket found to repair");
      return false;
    }
    
    const bracketData = userBracketSnap.data();
    
    // Repair the bracket structure
    const repairedBracket = repairBracket(bracketData);
    
    // Save the repaired bracket
    repairedBracket.repairedAt = new Date().toISOString();
    repairedBracket.updatedAt = new Date().toISOString();
    
    await setDoc(userBracketRef, repairedBracket);
    
    return true;
  } catch (error) {
    console.error("Error repairing user bracket:", error);
    throw error;
  }
};

/**
 * Get all user brackets in a league
 * @param {string} leagueId - League ID
 * @returns {Promise<Array>} Array of user brackets
 */
const getAllUserBrackets = async (leagueId) => {
  try {
    if (!leagueId) {
      throw new Error("League ID is required");
    }
    
    const bracketsRef = collection(db, "leagues", leagueId, "userData");
    const bracketsSnap = await getDocs(bracketsRef);
    
    const brackets = [];
    
    bracketsSnap.forEach(doc => {
      brackets.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return brackets;
  } catch (error) {
    console.error("Error fetching all user brackets:", error);
    throw error;
  }
};

export {
  initializeLeagueGameData,
  getUserBracket,
  saveUserBracket,
  saveUserBracketRound,
  saveUserFinalsMVP,
  createBracketTemplate,
  createUserBracketFromTemplate,
  repairUserBracket,
  getAllUserBrackets
};

export default initializeLeagueGameData;
/**
 * Game Types - Main Entry Point
 * 
 * This file imports all game type modules and exports functions to work with them.
 */
//
import marchMadnessModule from './marchMadness/MarchMadnessModule';
import nbaBracketModule from './nbaPlayoffs/NBAPlayoffsModule';

// Registry of all available game types
const gameTypeModules = {
  marchMadness: new marchMadnessModule(),
  nbaBracket: new nbaBracketModule(),
};

console.log('Game types module initialized with:', Object.keys(gameTypeModules));

/**
 * Get a specific game type module by ID
 * @param {string} gameTypeId - The ID of the game type to retrieve
 * @returns {Object|null} The game type module or null if not found
 */
export const getGameTypeModule = (gameTypeId) => {
  if (gameTypeModules[gameTypeId]) {
    return gameTypeModules[gameTypeId];
  }
  
  console.warn(`Game type module not found: ${gameTypeId}`);
  return null;
};

/**
 * Get a specific game type (alias for getGameTypeModule for backward compatibility)
 * @param {string} id - Game type ID
 * @returns {Object|null} Game type module or null if not found
 */
export const getGameType = getGameTypeModule;

/**
 * Get information about all available game types
 * @returns {Array} Array of game type information objects
 */
export const getAvailableGameTypes = () => {
  return Object.entries(gameTypeModules).map(([id, module]) => ({
    id,
    name: module.name,
    description: module.description,
    category: module.category || 'Uncategorized',
    icon: module.icon,
    color: module.color,
    enabled: true
  }));
};

/**
 * Get all game types (alias for getAvailableGameTypes for backward compatibility)
 * @returns {Array} Array of game type objects
 */
export const getAllGameTypes = getAvailableGameTypes;

/**
 * Get the setup component for a game type
 * @param {string} gameTypeId - The ID of the game type
 * @returns {React.Component|null} The setup component or null if not found
 */
export const getSetupComponent = (gameTypeId) => {
  const module = getGameTypeModule(gameTypeId);
  
  if (!module) {
    console.error(`Cannot get setup component: game type '${gameTypeId}' not found`);
    return null;
  }
  
  if (typeof module.getSetupComponent !== 'function') {
    console.error(`Game type '${gameTypeId}' does not have a getSetupComponent method`);
    return null;
  }
  
  return module.getSetupComponent();
};

/**
 * Get the settings component for a game type
 * @param {string} gameTypeId - The ID of the game type
 * @returns {React.Component|null} The settings component or null if not found
 */
export const getSettingsComponent = (gameTypeId) => {
  const module = getGameTypeModule(gameTypeId);
  
  if (!module) {
    console.error(`Cannot get settings component: game type '${gameTypeId}' not found`);
    return null;
  }
  
  if (typeof module.getSettingsComponent !== 'function') {
    console.error(`Game type '${gameTypeId}' does not have a getSettingsComponent method`);
    return null;
  }
  
  return module.getSettingsComponent();
};

/**
 * Initialize a league for a specific game type
 * @param {string} gameTypeId - The ID of the game type
 * @param {string} leagueId - The ID of the league to initialize
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export const initializeLeague = async (gameTypeId, leagueId) => {
  const module = getGameTypeModule(gameTypeId);
  
  if (!module) {
    throw new Error(`Cannot initialize league: game type '${gameTypeId}' not found`);
  }
  
  if (typeof module.initializeLeague !== 'function') {
    throw new Error(`Game type '${gameTypeId}' does not have an initializeLeague method`);
  }
  
  return module.initializeLeague(leagueId);
};

/**
 * Register routes for a specific game type
 * @param {string} gameTypeId - The ID of the game type
 * @param {string} baseUrl - The base URL for the routes
 * @returns {Array|null} Array of route objects or null if not found
 */
export const getGameTypeRoutes = (gameTypeId, baseUrl) => {
  const module = getGameTypeModule(gameTypeId);
  
  if (!module) {
    console.error(`Cannot get routes: game type '${gameTypeId}' not found`);
    return null;
  }
  
  if (typeof module.getRoutes !== 'function') {
    console.error(`Game type '${gameTypeId}' does not have a getRoutes method`);
    return null;
  }
  
  return module.getRoutes(baseUrl);
};

// Export all functions
export default {
  getGameTypeModule,
  getGameType,
  getAvailableGameTypes,
  getAllGameTypes,
  getSetupComponent,
  getSettingsComponent,
  initializeLeague,
  getGameTypeRoutes
};
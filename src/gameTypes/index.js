/**
 * Game Types - Main Entry Point
 * 
 * This file imports all game type modules and exports functions to work with them.
 */
import marchMadnessModule from './marchMadness/MarchMadnessModule';
import NBAPlayoffsModule from './nbaPlayoffs/NBAPlayoffsModule';
import nflPlayoffsModule from './nflPlayoffs/NFLPlayoffsModule';
import winsPoolModule from './winsPool/WinsPoolModule';
import { normalizeStatsAdapter } from './common/stats';

const GAME_TYPE_ALIASES = Object.freeze({
  nbaBracket: 'nbaPlayoffs'
});

export const normalizeGameTypeId = (gameTypeId) => {
  if (!gameTypeId) {
    return gameTypeId;
  }

  return GAME_TYPE_ALIASES[gameTypeId] || gameTypeId;
};

export const normalizeGameTypeSettings = (types = {}) => {
  const normalizedTypes = {};

  Object.entries(types || {}).forEach(([rawId, settings]) => {
    const normalizedId = normalizeGameTypeId(rawId);
    if (!normalizedId) {
      return;
    }

    normalizedTypes[normalizedId] = {
      ...(normalizedTypes[normalizedId] || {}),
      ...(settings || {})
    };
  });

  return normalizedTypes;
};

// Registry of all available game types
const gameTypeModules = {
  marchMadness: new marchMadnessModule(),
  nbaPlayoffs: new NBAPlayoffsModule(),
  nflPlayoffs: new nflPlayoffsModule(),
  winsPool: new winsPoolModule(),
};

const statsAdapterRegistry = {};

/**
 * Get a specific game type module by ID
 * @param {string} gameTypeId - The ID of the game type to retrieve
 * @returns {Object|null} The game type module or null if not found
 */
export const getGameTypeModule = (gameTypeId) => {
  const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);

  if (gameTypeModules[normalizedGameTypeId]) {
    return gameTypeModules[normalizedGameTypeId];
  }
  
  console.warn(`Game type module not found: ${gameTypeId}`);
  return null;
};

/**
 * Register a stats adapter for a game type.
 * Game-type modules or adapter loaders can call this during initialization.
 * @param {string} gameTypeId - The ID of the game type
 * @param {Object|Function} adapter - The adapter implementation or factory
 * @returns {Object|null} The normalized adapter or null if registration failed
 */
export const registerStatsAdapter = (gameTypeId, adapter) => {
  const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);

  if (!normalizedGameTypeId || !adapter) {
    return null;
  }

  const normalizedAdapter = normalizeStatsAdapter(adapter, { gameTypeId: normalizedGameTypeId });

  if (!normalizedAdapter) {
    return null;
  }

  statsAdapterRegistry[normalizedGameTypeId] = normalizedAdapter;
  return normalizedAdapter;
};

/**
 * Resolve the stats adapter for a game type.
 * This is tolerant of missing adapters so winsPool can remain unchanged.
 * @param {string} gameTypeId - The ID of the game type
 * @returns {Object|null} The stats adapter or null if not available
 */
export const getStatsAdapter = (gameTypeId) => {
  const normalizedGameTypeId = normalizeGameTypeId(gameTypeId);

  if (!normalizedGameTypeId) {
    return null;
  }

  if (statsAdapterRegistry[normalizedGameTypeId]) {
    return statsAdapterRegistry[normalizedGameTypeId];
  }

  const gameTypeModule = gameTypeModules[normalizedGameTypeId];
  if (!gameTypeModule) {
    return null;
  }

  const moduleAdapter =
    (typeof gameTypeModule.getStatsAdapter === 'function' ? gameTypeModule.getStatsAdapter() : null) ||
    gameTypeModule.statsAdapter ||
    null;

  if (!moduleAdapter) {
    return null;
  }

  const normalizedAdapter = normalizeStatsAdapter(moduleAdapter, { gameTypeId: normalizedGameTypeId });
  if (normalizedAdapter) {
    statsAdapterRegistry[normalizedGameTypeId] = normalizedAdapter;
  }

  return normalizedAdapter;
};

/**
 * Check whether a game type currently has a registered stats adapter.
 * @param {string} gameTypeId - The ID of the game type
 * @returns {boolean} True when a stats adapter is available
 */
export const hasStatsAdapter = (gameTypeId) => Boolean(getStatsAdapter(gameTypeId));

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
const gameTypesApi = {
  normalizeGameTypeId,
  normalizeGameTypeSettings,
  getGameTypeModule,
  getGameType,
  getAvailableGameTypes,
  getAllGameTypes,
  getSetupComponent,
  getSettingsComponent,
  initializeLeague,
  getGameTypeRoutes,
  registerStatsAdapter,
  getStatsAdapter,
  hasStatsAdapter
};

export default gameTypesApi;

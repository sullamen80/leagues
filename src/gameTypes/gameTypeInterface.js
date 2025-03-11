/**
 * Game Type Interface
 * 
 * Defines the standard interface that all game type modules must implement.
 * This serves as documentation and can be used for validation.
 */

/**
 * Example Game Type Module Structure
 */
export const GameTypeInterface = {
    // Required metadata
    id: 'gameTypeId',              // Unique identifier
    name: 'Game Type Name',        // Display name
    description: 'Description',    // Short description
    icon: null,                    // React component or image URL
    category: 'Sports',            // For categorizing in UI
    enabled: true,                 // Whether this game type is currently enabled
    
    // Required components
    components: {
      // User-facing views
      BracketDashboard: null,      // Main user view component
      BracketView: null,           // Component to view a bracket
      BracketEdit: null,           // Component to edit a bracket
      
      // Admin-facing views
      AdminDashboard: null,        // Main admin view component
      AdminSettings: null,         // Component to edit settings
      
      // League setup views
      LeagueSetup: null,           // Component for league creation/setup
      LeagueSettings: null,        // Component for league settings
      
      // Optional components
      Leaderboard: null,           // Custom leaderboard component (optional)
      Rules: null,                 // Rules component (optional)
    },
    
    // Required services
    services: {
      // User bracket services
      getUserBracket: null,        // Function to get user bracket
      saveUserBracket: null,       // Function to save user bracket
      createUserBracket: null,     // Function to create a new user bracket
      
      // Game data services
      getGameData: null,           // Function to get game data
      saveGameData: null,          // Function to save game data
      
      // Scoring services
      scoreUserBracket: null,      // Function to calculate user score
      getLeaderboard: null,        // Function to get leaderboard data
    },
    
    // Required lifecycle methods
    onLeagueCreate: null,          // Called when a league is created
    onUserJoinLeague: null,        // Called when a user joins a league
    onUserLeaveLeague: null,       // Called when a user leaves a league
    
    // Optional hooks
    hooks: {
      useBracket: null,            // Hook for bracket operations
      useGameData: null,           // Hook for game data
      useScoring: null             // Hook for scoring functionality
    }
  };
  
  /**
   * Validate that a module implements the required interface
   * @param {Object} module - The module to validate
   * @returns {Object} - Object with valid flag and any errors
   */
  export const validateGameTypeModule = (module) => {
    const errors = [];
    
    // Check required metadata
    if (!module.id) errors.push('Missing required field: id');
    if (!module.name) errors.push('Missing required field: name');
    if (!module.description) errors.push('Missing required field: description');
    
    // Check required components
    if (!module.components) errors.push('Missing required object: components');
    if (module.components) {
      if (!module.components.BracketDashboard) errors.push('Missing required component: BracketDashboard');
      if (!module.components.AdminDashboard) errors.push('Missing required component: AdminDashboard');
      if (!module.components.LeagueSetup) errors.push('Missing required component: LeagueSetup');
    }
    
    // Check required services
    if (!module.services) errors.push('Missing required object: services');
    if (module.services) {
      if (!module.services.getUserBracket) errors.push('Missing required service: getUserBracket');
      if (!module.services.saveUserBracket) errors.push('Missing required service: saveUserBracket');
      if (!module.services.createUserBracket) errors.push('Missing required service: createUserBracket');
    }
    
    // Check required lifecycle methods
    if (!module.onLeagueCreate) errors.push('Missing required method: onLeagueCreate');
    if (!module.onUserJoinLeague) errors.push('Missing required method: onUserJoinLeague');
    
    return {
      valid: errors.length === 0,
      errors
    };
  };
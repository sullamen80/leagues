// src/gameTypes/common/BaseGameModule.js
import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation } from 'react-router-dom';

/**
 * Custom hook to get URL parameters with improved state tracking
 * @returns {Object} URL parameters as key-value pairs
 */
export const useUrlParams = () => {
  const location = useLocation();
  const [params, setParams] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    const initialParams = {};
    
    for (const [key, value] of searchParams.entries()) {
      initialParams[key] = value;
    }
    
    return initialParams;
  });
  
  // Update params when location.search changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const newParams = {};
    
    for (const [key, value] of searchParams.entries()) {
      newParams[key] = value;
    }
    
    // Direct comparison of the URL parameter string instead of object comparison
    // This ensures we capture all changes
    if (location.search !== new URLSearchParams(params).toString()) {
      setParams(newParams);
    }
  }, [location.search]); // Remove params from dependency array to avoid circular updates
  
  return params;
};

/**
 * Component wrapper that handles parameter-based navigation
 * @param {Object} props - Component props
 * @param {React.Component} props.component - Component to render
 * @param {Function} props.paramCheck - Function that checks if params match this component
 * @param {React.Component} props.fallback - Fallback component if params don't match
 * @returns {React.Element} Rendered component
 */
export const ParameterComponent = ({ component: Component, paramCheck, fallback: Fallback, ...props }) => {
  const params = useUrlParams();
  
  // Check if this component should be rendered based on parameters
  if (paramCheck(params)) {
    return <Component {...props} urlParams={params} />;
  }
  
  // Render fallback if provided
  return Fallback ? <Fallback {...props} urlParams={params} /> : null;
};

/**
 * Enhanced parameter-based router component that pre-renders all components for smoother transitions
 */
export const ParameterRouter = (props) => {
  const params = useUrlParams();
  const view = params.view || '';
  const routes = props.routes || [];
  const baseUrl = props.baseUrl || '';
  
  
  // Pre-render all possible route components but only show the active one
  // This prevents components from unmounting/remounting during navigation
  const routeComponents = useMemo(() => {
    return routes.map((route, index) => {
      const routePath = route.path.replace(baseUrl, '').replace(/^\//, '');
      const isActive = routePath === view || (index === 0 && !view);
      const RouteComponent = route.element;
      
      
      return {
        path: routePath,
        isActive,
        component: <RouteComponent {...props} urlParams={params} />
      };
    });
  }, [routes, baseUrl, view, params, props]);
  
  return (
    <>
      {routeComponents.map((routeInfo) => (
        <div 
          key={`route-${routeInfo.path || 'default'}`} 
          style={{ display: routeInfo.isActive ? 'block' : 'none' }}
        >
          {routeInfo.component}
        </div>
      ))}
    </>
  );
};

/**
 * Efficient parameter router that only renders the matching component
 * @deprecated Use ParameterRouter instead for smoother transitions 
 */
export const SimpleParameterRouter = (props) => {
  const params = useUrlParams();
  const view = params.view || '';
  const routes = props.routes || [];
  const baseUrl = props.baseUrl || '';
  
  // Find matching route based on parameter
  for (const route of routes) {
    const routePath = route.path.replace(baseUrl, '').replace(/^\//, '');
    if (routePath === view) {
      const RouteComponent = route.element;
      return <RouteComponent {...props} urlParams={params} />;
    }
  }
  
  // Default to the first route's component if no match
  if (routes.length > 0) {
    const DefaultComponent = routes[0].element;
    return <DefaultComponent {...props} urlParams={params} />;
  }
  
  return null;
};

/**
 * Generate query string from parameters
 * @param {Object} params - Parameters to stringify
 * @returns {string} URL query string
 */
export const generateQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, value);
    }
  }
  
  return searchParams.toString();
};

/**
 * BaseGameModule - Base class for all game type modules
 * This provides a standard interface and shared functionality for all game types
 */
class BaseGameModule {
  constructor() {
    // Basic properties all game types should override
    this.id = 'base';
    this.name = 'Base Game';
    this.description = 'Base game type - extend this class';
    this.icon = null;
    this.color = '#666666'; // Default gray color
    this.rules = null;
  }

  /**
   * Get routes for this game type
   * @param {string} baseUrl - Base URL for routes
   * @returns {Array} Array of route objects
   */
  getRoutes(baseUrl) {
    // This should be overridden by each game type
    return [];
  }

  /**
   * Get parameter-based routes for this game type
   * @param {string} baseUrl - Base URL for routes
   * @returns {Array} Array of parameter-based route objects
   */
  getParameterRoutes(baseUrl) {
    // Default implementation converts standard routes to parameter routes
    // Game types should override this for better control
    const standardRoutes = this.getRoutes(baseUrl);
    
    // By default, return a single route with parameter handling
    return [
      {
        path: baseUrl,
        // Use a proper component that handles parameter-based routing
        element: (props) => <ParameterRouter {...props} routes={standardRoutes} baseUrl={baseUrl} />
      }
    ];
  }

  /**
   * Utility to generate URL with parameters
   * @param {string} baseUrl - Base URL
   * @param {Object} params - Parameters to add
   * @returns {string} URL with parameters
   */
  generateParameterUrl(baseUrl, params = {}) {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value);
      }
    }
    
    const queryString = searchParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Convert a route path to parameter format
   * @param {string} baseUrl - Base URL
   * @param {string} routePath - Route path
   * @returns {string} Parameter URL
   */
  routeToParameterUrl(baseUrl, routePath) {
    // Extract the view part from the route path
    const viewPath = routePath.replace(baseUrl, '').replace(/^\//, '');
    
    // Return parameter URL
    return this.generateParameterUrl(baseUrl, { view: viewPath });
  }

  /**
   * Merge multiple parameter sets
   * @param {...Object} paramSets - Sets of parameters to merge
   * @returns {Object} Merged parameters
   */
  mergeParams(...paramSets) {
    return Object.assign({}, ...paramSets);
  }

  /**
   * Get setup component for creating a new league of this game type
   * @returns {React.Component} League setup component
   */
  getSetupComponent() {
    // This should be overridden by each game type
    return null;
  }

  /**
   * Get settings component for managing a league of this game type
   * @returns {React.Component} League settings component
   */
  getSettingsComponent() {
    // This should be overridden by each game type
    return null;
  }

  /**
   * Initialize a new league with game data
   * @param {string} leagueId - ID of the new league
   * @param {Object} setupData - Data from the setup component
   * @returns {Promise} Promise that resolves when initialization is complete
   */
  async initializeLeague(leagueId, setupData = {}) {
    try {
      
      // Base implementation just returns success
      // Specific game types should override this with their initialization logic
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing league:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to initialize game data'
      };
    }
  }

  /**
   * Handle a user joining a league
   * @param {string} leagueId - ID of the league
   * @param {string} userId - ID of the user joining
   * @returns {Promise} Promise that resolves when join process is complete
   */
  async onUserJoin(leagueId, userId) {
    // Base implementation does nothing
    // Game types can override this to handle user joining
    return { success: true };
  }

  /**
   * Get metadata for display in league listings
   * @param {Object} gameData - The league's game data
   * @returns {Object} Metadata for display
   */
  getMetadata(gameData) {
    // Base implementation returns minimal metadata
    // Game types should override this to provide relevant metadata
    return {
      status: 'Unknown',
      customFields: []
    };
  }

  /**
   * Calculate scores for a user entry compared to official results
   * @param {Object} userEntry - User's entry data
   * @param {Object} officialResults - Official results data
   * @param {Object} scoringSettings - Custom scoring settings
   * @returns {Object} Score information
   */
  calculateScore(userEntry, officialResults, scoringSettings = null) {
    // Base implementation returns a zero score
    // Game types should override this with their specific scoring logic
    return { 
      points: 0, 
      basePoints: 0, 
      bonusPoints: 0, 
      correctPicks: 0,
      roundBreakdown: {} 
    };
  }
  
  /**
   * Determine the winners of a league
   * @param {string} leagueId - The league ID
   * @returns {Promise<Array>} Array of winner objects
   */
  async determineLeagueWinners(leagueId) {
    try {
      // Get all user entries
      const userEntriesRef = collection(db, "leagues", leagueId, "userData");
      const userEntriesSnap = await getDocs(userEntriesRef);
      
      if (userEntriesSnap.empty) {
        throw new Error("No user entries found to determine winners");
      }
      
      // Get official results data
      const resultsRef = doc(db, "leagues", leagueId, "gameData", "current");
      const resultsSnap = await getDoc(resultsRef);
      
      if (!resultsSnap.exists()) {
        throw new Error("Official results data not found");
      }
      
      const officialResults = resultsSnap.data();
      
      // Get custom scoring settings if they exist
      let scoringSettings = null;
      try {
        const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
        const scoringSnap = await getDoc(scoringRef);
        
        if (scoringSnap.exists()) {
          scoringSettings = scoringSnap.data();
        }
      } catch (err) {
        console.warn("Could not load custom scoring settings, using defaults", err);
      }
      
      // Calculate scores for each player
      const playerScores = [];
      
      for (const entryDoc of userEntriesSnap.docs) {
        const userId = entryDoc.id;
        const entryData = entryDoc.data();
        
        // Calculate score using the game type's scoring system with custom settings
        const scoreResult = this.calculateScore(entryData, officialResults, scoringSettings);
        
        // Get user info
        let userName = "Unknown User";
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
        
        playerScores.push({
          userId,
          userName,
          score: scoreResult.points
        });
      }
      
      // Sort players by score (highest first)
      playerScores.sort((a, b) => b.score - a.score);
      
      // Determine winner(s) - could be multiple in case of a tie
      const winningScore = playerScores[0]?.score || 0;
      const winners = playerScores.filter(player => player.score === winningScore);
      
      return winners;
    } catch (error) {
      console.error("Error determining league winners:", error);
      throw error;
    }
  }
  
  /**
   * Handle actions when a league is ended
   * @param {string} leagueId - The league ID
   * @param {Array} winners - Array of winner objects
   * @returns {Promise<boolean>} Success indicator
   */
  async onLeagueEnd(leagueId, winners) {
    try {
      // Base implementation just logs the winners
      
      return true;
    } catch (error) {
      console.error("Error in onLeagueEnd:", error);
      throw error;
    }
  }
  
  /**
   * Get user-friendly name for this game type
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.name;
  }
  
  /**
   * Get a renderer for this game type's icon
   * @param {Object} props - Props to pass to the icon component
   * @returns {React.Element} Icon element
   */
  renderIcon(props = {}) {
    return this.icon ? React.cloneElement(this.icon, props) : null;
  }
}

export default BaseGameModule;
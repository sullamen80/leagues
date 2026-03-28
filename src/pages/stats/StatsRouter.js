// src/pages/stats/StatsRouter.js
import React from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { db } from '../../firebase';
import Stats from './stats';

/**
 * Helper function to parse URL search parameters
 * @returns {Object} Object containing all URL parameters
 */
export const useUrlParams = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const params = {};
  
  // Convert URL parameters to object
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  // Add route parameters as well
  const routeParams = useParams();
  Object.assign(params, routeParams);
  
  return params;
};

/**
 * Stats Router Component
 * Handles parameter-based routing for Stats pages
 */
const StatsRouter = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useUrlParams();
  
  // Extract the view and id parameters
  const view = params.type || 'league';
  const id = params.id || null;
  
  console.log('StatsRouter - URL params:', { view, id, location: location.pathname });
  
  // Root reference for gameStats
  const statsRoot = doc(db, 'gameStats', 'root');
  
  // Generate a URL with parameters
  const generateStatsUrl = (baseUrl, params = {}) => {
    const url = new URL(baseUrl, window.location.origin);
    
    // Add all parameters to the URL
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return url.pathname + url.search;
  };
  
  // Navigation handlers
  const navigateToLeague = (leagueId) => {
    navigate(`/stats/league/${leagueId}`);
  };
  
  const navigateToUser = (userId) => {
    navigate(`/stats/user/${userId}`);
  };
  
  const navigateToLeaguesList = () => {
    navigate('/stats/league');
  };
  
  const navigateToUsersList = () => {
    navigate('/stats/user');
  };
  
  // Render the Stats component with all necessary props
  return (
    <Stats
      {...props}
      urlParams={params}
      type={view}
      id={id}
      statsRoot={statsRoot}
      navigateToLeague={navigateToLeague}
      navigateToUser={navigateToUser}
      navigateToLeaguesList={navigateToLeaguesList}
      navigateToUsersList={navigateToUsersList}
      generateStatsUrl={generateStatsUrl}
    />
  );
};

export default StatsRouter;
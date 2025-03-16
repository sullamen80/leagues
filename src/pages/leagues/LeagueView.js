// src/pages/leagues/LeagueView.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getGameTypeModule } from '../../gameTypes';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../../components/common/Loading';
import ErrorDisplay from '../../components/common/ErrorDisplay';

// ErrorBoundary component to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error in component:", error);
    console.error("Component stack:", errorInfo.componentStack);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded mb-4">
          <h2 className="text-lg font-bold mb-2">Error Rendering Component</h2>
          <p>Something went wrong when trying to render this component.</p>
          <details className="mt-2">
            <summary className="cursor-pointer">Technical Details</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Component for viewing a league and its game-specific content using parameter-based navigation
 */
const LeagueView = () => {
  const { leagueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [league, setLeague] = useState(null);
  const [gameModule, setGameModule] = useState(null);
  const [parameterRouter, setParameterRouter] = useState(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const location = useLocation();
  
  // Get current URL parameters
  const searchParams = new URLSearchParams(location.search);
  const currentView = searchParams.get('view') || '';
  const currentSubview = searchParams.get('subview') || '';
  
  console.log("LeagueView - Current parameters:", { 
    view: currentView, 
    subview: currentSubview,
    search: location.search 
  });
  
  useEffect(() => {
    const loadLeague = async () => {
      if (!leagueId) {
        setError("League ID is required");
        setLoading(false);
        return;
      }

      try {
        console.log(`Loading league with ID: ${leagueId}`);
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found");
          setLoading(false);
          return;
        }

        const leagueData = {
          id: leagueSnap.id,
          ...leagueSnap.data()
        };
        
        setLeague(leagueData);
        
        // Get the game type module
        const gameTypeId = leagueData.gameTypeId;
        if (!gameTypeId) {
          setError("League doesn't have a game type specified");
          setLoading(false);
          return;
        }
        
        const module = getGameTypeModule(gameTypeId);
        if (!module) {
          setError(`Game type module not found: ${gameTypeId}`);
          setLoading(false);
          return;
        }
        
        setGameModule(module);
        
        // Check if the league setup is completed
        if (!leagueData.setupCompleted) {
          // Redirect to setup if user is the owner
          if (leagueData.ownerId === currentUser?.uid) {
            navigate(`/leagues/${leagueId}/setup`);
            return;
          }
        }
        
        // Get parameter-based router from the game module
        if (module.getParameterRoutes) {
          const baseUrl = `/league/${leagueId}`;
          const paramRoutes = module.getParameterRoutes(baseUrl);
          
          if (paramRoutes && paramRoutes.length > 0) {
            console.log("Parameter routes from module:", paramRoutes);
            // Get the router component from the first route
            const RouterComponent = paramRoutes[0].element;
            setParameterRouter(() => (props) => (
              <RouterComponent 
                {...props} 
                baseUrl={baseUrl}
                leagueId={leagueId} 
                league={leagueData}
              />
            ));
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading league:", err);
        setError(`Error loading league: ${err.message}`);
        setLoading(false);
      }
    };

    loadLeague();
  }, [leagueId, navigate, currentUser]);

  if (loading) {
    return <Loading message="Loading league..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  if (!league) {
    return <ErrorDisplay message="League not found" />;
  }

  // If no parameter router found, show error
  if (!parameterRouter) {
    return (
      <ErrorDisplay message="Game module does not support parameter-based navigation" />
    );
  }

  // Create a Router component instance with all URL parameters
  const ParameterRouter = parameterRouter;
  
  // Get all URL parameters
  const urlParams = {};
  for (const [key, value] of searchParams.entries()) {
    urlParams[key] = value;
  }

  // Make sure we always have a view parameter
  if (!urlParams.view && gameModule && gameModule.defaultView) {
    urlParams.view = gameModule.defaultView;
  } else if (!urlParams.view) {
    // Default to 'view' if no view parameter and no default from module
    urlParams.view = 'view';
  }

  // If coming from admin view, check for stored return tab
  if (urlParams.view !== 'admin') {
    const returnTab = sessionStorage.getItem(`bracket-dashboard-${leagueId}-return`);
    if (returnTab && returnTab !== 'admin') {
      urlParams.view = returnTab;
      urlParams.tab = returnTab; // For backward compatibility
      // Clear the stored return tab
      sessionStorage.removeItem(`bracket-dashboard-${leagueId}-return`);
    }
  }

  console.log("LeagueView rendering with urlParams:", urlParams);

  return (
    <div className="container mx-auto px-0 py-3 sm:px-4 sm:py-6 game-container">
      <div className="bg-white rounded-lg shadow-md p-2 sm:p-4 md:p-6 inner-game-container">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">{league.title || "League View"}</h1>
        
        {league.description && (
          <p className="text-gray-600 mb-3 sm:mb-6">{league.description}</p>
        )}
        
        <ErrorBoundary>
          <ParameterRouter urlParams={urlParams} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default LeagueView;
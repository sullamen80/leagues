// src/pages/leagues/LeagueView.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getGameTypeModule } from '../../gameTypes';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../../components/common/Loading';
import ErrorDisplay from '../../components/common/ErrorDisplay';

// Direct import of AdminSettings component
import AdminSettings from '../../gameTypes/marchMadness/components/AdminSettings';

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
 * Component for viewing a league and its game-specific content
 */
const LeagueView = () => {
  const { leagueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [league, setLeague] = useState(null);
  const [gameModule, setGameModule] = useState(null);
  const [routes, setRoutes] = useState([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const location = useLocation();

  console.log("Current path:", location.pathname);
  
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
        
        // Get all routes from the game type
        if (module.getRoutes) {
          const moduleRoutes = module.getRoutes(`/league/${leagueId}`);
          console.log("All routes from module:", moduleRoutes);
          
          // Check if module directly returns AdminSettings in its getRoutes method
          const hasAdminSettingsRoute = moduleRoutes.some(route => 
            route.path === `/league/${leagueId}/admin/settings`
          );
          
          console.log("Has admin/settings route? ", hasAdminSettingsRoute);
          
          // Check for components by name
          moduleRoutes.forEach(route => {
            console.log(`Route ${route.path} component:`, route.element?.name || 'unnamed');
          });
          
          setRoutes(moduleRoutes);
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

  // Current path for debugging
  const currentPathAfterBase = location.pathname.replace(`/league/${leagueId}`, '').replace(/^\//, '');
  console.log("Current path after base:", currentPathAfterBase);
  
  // Special handling for admin/settings path - we'll just render the component directly
  if (currentPathAfterBase === 'admin/settings') {
    console.log("Directly rendering AdminSettings component");
    
    return (
      <div className="container mx-auto px-2 py-3 sm:px-4 sm:py-6">
        <div className="bg-white rounded-lg shadow-md p-2 sm:p-4 md:p-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">{league.title || "League Settings"}</h1>
          
          {league.description && (
            <p className="text-gray-600 mb-3 sm:mb-6">{league.description}</p>
          )}
          
          {/* Error boundary for AdminSettings */}
          <ErrorBoundary>
            <AdminSettings leagueId={leagueId} league={league} />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0 py-3 sm:px-4 sm:py-6 game-container">
      <div className="bg-white rounded-lg shadow-md p-2 sm:p-4 md:p-6 inner-game-container">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">{league.title || "League View"}</h1>
        
        {league.description && (
          <p className="text-gray-600 mb-3 sm:mb-6">{league.description}</p>
        )}
        
        <ErrorBoundary>
          <Routes>
            {routes.map((route) => {
              const Component = route.element;
              const routePath = route.path.replace(`/league/${leagueId}/`, '').replace(`/league/${leagueId}`, '');
              
              // Skip the admin/settings route as we're handling it separately
              if (routePath === 'admin/settings') return null;
              
              return (
                <Route
                  key={route.path}
                  path={routePath}
                  element={<Component leagueId={leagueId} league={league} />}
                />
              );
            })}
            
            {/* Catch-all route */}
            <Route 
              path="*" 
              element={
                <div>
                  <h3 className="text-lg font-bold mb-2">Route Not Found</h3>
                  <p>Path: {location.pathname}</p>
                  <button 
                    onClick={() => navigate(`/league/${leagueId}`)}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
                  >
                    Go to Dashboard
                  </button>
                </div>
              } 
            />
          </Routes>
        </ErrorBoundary>
      </div>
    </div>
  );
};

// Default view component
const DefaultView = ({ gameModule }) => {
  return (
    <div className="text-center py-5 sm:py-10">
      <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Coming Soon</h2>
      <p className="text-gray-600">
        {gameModule && gameModule.name 
          ? `Your ${gameModule.name} league is being set up.` 
          : 'The league view functionality is being implemented.'}
      </p>
      <p className="text-gray-600 mt-2">Setting up your league view...</p>
    </div>
  );
};

export default LeagueView;
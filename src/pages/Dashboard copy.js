import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserLeagues } from '../gameTypes/common/services/leagueService';
import { getAvailableGameTypes } from '../gameTypes';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import MarchMadnessDashboard from '../gameTypes/marchMadness/components/BracketDashboard';
import NBAPlayoffsDashboard from '../gameTypes/nbaPlayoffs/components/BracketDashboard';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [leagueData, setLeagueData] = useState({ active: [], archived: [] });
  const [activeLeague, setActiveLeague] = useState(null);
  const [currentLeagueData, setCurrentLeagueData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filteredGameTypes, setFilteredGameTypes] = useState([]);
  
  // State to track the current displayed game type
  const [currentGameType, setCurrentGameType] = useState(null);
  
  // Component separation - render different components instead of trying to reuse
  const [showMarchMadness, setShowMarchMadness] = useState(false);
  const [showNBAPlayoffs, setShowNBAPlayoffs] = useState(false);
  
  // A unique identifier for each render - used in keys to force fresh renders
  const [renderID, setRenderID] = useState(Date.now());
  
  const navigate = useNavigate();
  const location = useLocation();

  // Load game types based on admin settings
  useEffect(() => {
    const loadGameTypes = async () => {
      try {
        const allGameTypes = getAvailableGameTypes();
        const settingsRef = doc(db, 'settings', 'gameTypes');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          const gameTypeSettings = settingsDoc.data().types || {};
          const processed = allGameTypes
            .map(gameType => ({
              ...gameType,
              enabled: gameTypeSettings[gameType.id]?.enabled ?? gameType.enabled ?? false,
              visible: gameTypeSettings[gameType.id]?.visible ?? true,
              displayOrder: gameTypeSettings[gameType.id]?.displayOrder ?? 999
            }))
            .filter(gameType => gameType.visible)
            .sort((a, b) => a.displayOrder - b.displayOrder);
          
          setFilteredGameTypes(processed);
        } else {
          setFilteredGameTypes(allGameTypes);
        }
      } catch (err) {
        console.error('Error loading game types settings:', err);
        setFilteredGameTypes(getAvailableGameTypes());
      }
    };
    
    loadGameTypes();
  }, []);

  useEffect(() => {
    const loadUserLeagues = async () => {
      try {
        setIsLoading(true);
        const leagues = await getUserLeagues(currentUser.uid, true, true);
        setLeagueData(leagues);

        if (leagues.active.length > 0) {
          const firstActiveLeague = leagues.active[0].id;
          setActiveLeague(firstActiveLeague);
          const leagueData = await loadLeagueData(firstActiveLeague);
          if (leagueData) {
            setCurrentGameType(leagueData.gameTypeId);
            // Initialize the correct game component
            updateVisibleGameComponent(leagueData.gameTypeId);
          }
        } else {
          setActiveLeague(null);
          setCurrentLeagueData(null);
          setCurrentGameType(null);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading user leagues:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    loadUserLeagues();
  }, [currentUser]);

  // Function to show/hide the correct component based on game type
  const updateVisibleGameComponent = (gameTypeId) => {
    // First hide all components
    setShowMarchMadness(false);
    setShowNBAPlayoffs(false);
    
    // Then show only the one we need
    switch (gameTypeId) {
      case 'nbaPlayoffs':
      case 'nbaBracket': // Handle both naming conventions
        setShowNBAPlayoffs(true);
        break;
      case 'marchMadness':
      default:
        setShowMarchMadness(true);
        break;
    }
    
    // Always regenerate the renderID to force a fresh render
    setRenderID(Date.now());
  };

  const loadLeagueData = async (leagueId) => {
    try {
      const leagueRef = doc(db, "leagues", leagueId);
      const leagueSnap = await getDoc(leagueRef);
      if (leagueSnap.exists()) {
        const data = { ...leagueSnap.data(), id: leagueId };
        setCurrentLeagueData(data);
        return data;
      } else {
        setError("League not found");
        return null;
      }
    } catch (err) {
      console.error('Error loading league data:', err);
      setError("Failed to load league data");
      return null;
    }
  };

  const handleLeagueChange = async (leagueId) => {
    try {
      // Hide all components first
      setShowMarchMadness(false);
      setShowNBAPlayoffs(false);
      
      // Get the league data first to check game type
      const leagueRef = doc(db, "leagues", leagueId);
      const leagueSnap = await getDoc(leagueRef);
      
      if (leagueSnap.exists()) {
        const newLeagueData = { ...leagueSnap.data(), id: leagueId };
        const newGameType = newLeagueData.gameTypeId;
        
        // Update active league immediately
        setActiveLeague(leagueId);
        setCurrentLeagueData(newLeagueData);
        setCurrentGameType(newGameType);
        
        // Force full DOM cleanup with a delay
        setTimeout(() => {
          // Clean any session storage related to either game type
          clearAllGameSessionStorage(leagueId);
          
          // Now update which component should be visible
          updateVisibleGameComponent(newGameType);
        }, 200);
      } else {
        console.error('League not found');
        setError("League not found");
      }
    } catch (err) {
      console.error('Error switching leagues:', err);
      setError("Failed to load league data");
    }
  };
  
  // Helper function to clear all game-related session storage
  const clearAllGameSessionStorage = (leagueId) => {
    // Clean up any global event listeners that might have been created
    window.removeEventListener('popstate', () => {});
    window.removeEventListener('hashchange', () => {});
    
    // Clean all session storage items that might be related to our games
    const keysToCheck = [
      `bracket-dashboard-${leagueId}-return`,
      `playoffs-dashboard-${leagueId}-return`,
      `marchMadness-dashboard-${leagueId}-return`,
      `nbaPlayoffs-dashboard-${leagueId}-return`
    ];
    
    // Also check for any key containing these IDs
    const allKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.includes(leagueId) || 
        key.includes('marchMadness') || 
        key.includes('nbaPlayoffs') ||
        key.includes('nbaBracket') ||
        key.includes('bracket')
      )) {
        allKeys.push(key);
      }
    }
    
    // Combine all keys to remove
    const allKeysToRemove = [...new Set([...keysToCheck, ...allKeys])];
    
    allKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });
  };

  const toggleArchivedLeagues = () => {
    setShowArchived(!showArchived);
  };

  const handleViewBracketFromLeaderboard = (bracketId) => {
    // Update the URL parameters instead of navigating to a different route
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('userId', bracketId);
    searchParams.set('tab', 'view');
    searchParams.set('view', 'view');
    
    // Use replace to update URL without adding to history stack
    navigate(`/league/${activeLeague}?${searchParams.toString()}`, { replace: true });
  };

  if (isLoading) return <Loading message="Loading your leagues..." />;

  const getGameTypeName = (gameTypeId) => {
    const gameType = filteredGameTypes.find(gt => gt.id === gameTypeId);
    return gameType ? gameType.name : 'Unknown Game Type';
  };

  return (
    <div className="text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 title-container">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/create-league" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition flex-1 sm:flex-auto text-center">
            Create League
          </Link>
          <Link to="/join-league" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition flex-1 sm:flex-auto text-center">
            Join League
          </Link>
        </div>
      </div>

      {error && <ErrorDisplay message={error} type="error" />}

      {leagueData.active.length === 0 && leagueData.archived.length === 0 ? (
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-white">Your Leagues</h2>
          <div className="bg-gray-800 p-2 sm:p-4 md:p-6 rounded-lg border border-gray-700 text-center">
            <p className="text-gray-300 mb-4">You haven't joined any leagues yet.</p>
          </div>
        </div>
      ) : (
        <div>
          {leagueData.active.length > 0 && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Active Leagues</h2>
                {leagueData.archived.length > 0 && (
                  <button onClick={toggleArchivedLeagues} className="text-xs sm:text-sm px-2 py-1 sm:px-3 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition">
                    {showArchived ? 'Hide Archived' : 'Show Archived'} ({leagueData.archived.length})
                  </button>
                )}
              </div>

              <div className="mb-4">
                <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 border-b border-gray-700">
                  <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2 pb-2 sm:pb-4">
                    {leagueData.active.map(league => (
                      <button
                        key={league.id}
                        onClick={() => handleLeagueChange(league.id)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-t-lg transition text-sm ${
                          activeLeague === league.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="truncate max-w-32 sm:max-w-none">{league.title}</span>
                          {league.ownerId === currentUser.uid && (
                            <span className="ml-1 sm:ml-2 bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full text-xs">Owner</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {activeLeague && currentLeagueData && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg mb-6 sm:mb-8">
                  <div className="flex justify-between items-center p-2 sm:p-3 md:p-4 border-b border-gray-700">
                    <div className="flex flex-col">
                      <h2 className="text-base sm:text-xl font-semibold text-white truncate max-w-40 sm:max-w-none">{currentLeagueData.title}</h2>
                      <span className="text-xs sm:text-sm text-gray-400">{getGameTypeName(currentLeagueData.gameTypeId)}</span>
                    </div>
                    <button onClick={() => navigate(`/league/${activeLeague}`)} className="text-blue-400 hover:text-blue-300 text-sm">
                      Full View
                    </button>
                  </div>
                  <div className="bg-gray-900 p-0 sm:p-2 md:p-4 rounded-b-lg dash-game-container">
                    {/* Conditional rendering of appropriate dashboard component */}
                    {showMarchMadness && (
                      <MarchMadnessDashboard 
                        key={`mm-${activeLeague}-${renderID}`}
                        leagueId={activeLeague}
                        league={currentLeagueData}
                        isEmbedded={true}
                        onViewBracket={handleViewBracketFromLeaderboard}
                        forceTabReset={true}
                      />
                    )}
                    
                    {showNBAPlayoffs && (
                      <NBAPlayoffsDashboard 
                        key={`nba-${activeLeague}-${renderID}`}
                        leagueId={activeLeague}
                        league={currentLeagueData}
                        isEmbedded={true}
                        onViewBracket={handleViewBracketFromLeaderboard}
                        forceTabReset={true}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {showArchived && leagueData.archived.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-white">Archived Leagues</h2>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {leagueData.archived.map(league => (
                  <div
                    key={league.id}
                    className="bg-gray-800 border border-gray-700 p-2 sm:p-3 md:p-4 rounded-lg hover:bg-gray-700 transition cursor-pointer"
                    onClick={() => navigate(`/league/${league.id}`)}
                  >
                    <div className="flex justify-between mb-1 sm:mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-white truncate max-w-36 sm:max-w-none">{league.title}</h3>
                      <span className="bg-gray-600 text-gray-300 text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">Archived</span>
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">{getGameTypeName(league.gameTypeId)}</p>
                    {league.winners && league.winners.length > 0 && (
                      <div className="mt-1 sm:mt-2">
                        <p className="text-xs text-gray-400">Winners:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {league.winners.map((winner, idx) => (
                            <span key={idx} className="bg-yellow-900 text-yellow-300 text-xs px-1.5 sm:px-2 py-0.5 rounded">{winner.userName}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {league.archivedAt && (
                      <p className="text-xs text-gray-500 mt-1 sm:mt-2">Archived on {new Date(league.archivedAt.toDate()).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {filteredGameTypes.length > 0 && (
        <>
          <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 mt-6 sm:mt-8 text-white">Game Types</h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredGameTypes.map(gameType => (
              <div key={gameType.id} className="bg-gray-800 border border-gray-700 p-2 sm:p-3 md:p-4 rounded-lg hover:bg-gray-700 transition">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-white">{gameType.name}</h3>
                  {gameType.enabled ? (
                    <span className="bg-green-900 text-green-300 text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">Available</span>
                  ) : (
                    <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">Coming Soon</span>
                  )}
                </div>
                <p className="text-gray-300 mb-2 sm:mb-3 text-sm">{gameType.description}</p>
                {gameType.enabled && (
                  <Link to="/create-league" className="text-blue-300 hover:text-blue-200 font-medium text-sm" state={{ gameTypeId: gameType.id }}>
                    Create a {gameType.name} league →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
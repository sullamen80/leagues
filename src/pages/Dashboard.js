import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserLeagues } from '../gameTypes/common/services/leagueService';
import { getAvailableGameTypes } from '../gameTypes';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Components
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import BracketDashboard from '../gameTypes/marchMadness/components/BracketDashboard';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [leagueData, setLeagueData] = useState({
    active: [],
    archived: []
  });
  const [activeLeague, setActiveLeague] = useState(null);
  const [currentLeagueData, setCurrentLeagueData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  
  // Get all available game types
  const gameTypes = getAvailableGameTypes();
  
  // Load user's leagues
  useEffect(() => {
    const loadUserLeagues = async () => {
      try {
        setIsLoading(true);
        
        // Get leagues with separation between active and archived
        const leagues = await getUserLeagues(currentUser.uid, true, true);
        setLeagueData(leagues);
        
        // Set the first active league as default if available
        if (leagues.active.length > 0) {
          setActiveLeague(leagues.active[0].id);
          await loadLeagueData(leagues.active[0].id);
        }
        // If no active leagues but has archived ones, don't set an active league but don't show error
        else if (leagues.archived.length > 0) {
          setActiveLeague(null);
          setCurrentLeagueData(null);
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
  
  // Load league data when active league changes
  const loadLeagueData = async (leagueId) => {
    try {
      const leagueRef = doc(db, "leagues", leagueId);
      const leagueSnap = await getDoc(leagueRef);
      
      if (leagueSnap.exists()) {
        setCurrentLeagueData({
          ...leagueSnap.data(),
          id: leagueId
        });
      } else {
        setError("League not found");
      }
    } catch (err) {
      console.error('Error loading league data:', err);
      setError("Failed to load league data");
    }
  };
  
  // Handle changing active league
  const handleLeagueChange = async (leagueId) => {
    setActiveLeague(leagueId);
    await loadLeagueData(leagueId);
  };

  // Toggle showing archived leagues
  const toggleArchivedLeagues = () => {
    setShowArchived(!showArchived);
  };
  
  if (isLoading) {
    return <Loading message="Loading your leagues..." />;
  }
  
  // Function to get game type name from ID
  const getGameTypeName = (gameTypeId) => {
    const gameType = gameTypes.find(gt => gt.id === gameTypeId);
    return gameType ? gameType.name : 'Unknown Game Type';
  };
  
  return (
    <div className="text-white">
      {/* Mobile-friendly header - stack vertically on small screens */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 title-container">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            to="/create-league"
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition flex-1 sm:flex-auto text-center"
          >
            Create League
          </Link>
          <Link
            to="/join-league"
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition flex-1 sm:flex-auto text-center"
          >
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
          {/* Active Leagues Section */}
          {leagueData.active.length > 0 && (
            <div className="mb-8">
              {/* League Header Section with Archived Toggle Button */}
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Active Leagues
                </h2>
                {leagueData.archived.length > 0 && (
                  <button 
                    onClick={toggleArchivedLeagues}
                    className="text-xs sm:text-sm px-2 py-1 sm:px-3 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition"
                  >
                    {showArchived ? 'Hide Archived' : 'Show Archived'} ({leagueData.archived.length})
                  </button>
                )}
              </div>
              
              {/* Active Leagues Navigation - Horizontal scrolling on mobile */}
              <div className="mb-4">
                <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 border-b border-gray-700">
                  <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2 pb-2 sm:pb-4">
                    {leagueData.active.map(league => (
                      <button
                        key={league.id}
                        onClick={() => handleLeagueChange(league.id)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-t-lg transition text-sm ${
                          activeLeague === league.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="truncate max-w-32 sm:max-w-none">{league.title}</span>
                          {league.ownerId === currentUser.uid && (
                            <span className="ml-1 sm:ml-2 bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full text-xs">
                              Owner
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Embedded League Dashboard for Active League */}
              {activeLeague && currentLeagueData && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg mb-6 sm:mb-8">
                  <div className="flex justify-between items-center p-2 sm:p-3 md:p-4 border-b border-gray-700">
                    <div className="flex flex-col">
                      <h2 className="text-base sm:text-xl font-semibold text-white truncate max-w-40 sm:max-w-none">
                        {currentLeagueData.title}
                      </h2>
                      <span className="text-xs sm:text-sm text-gray-400">
                        {getGameTypeName(currentLeagueData.gameTypeId)}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/league/${activeLeague}`)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Full View
                    </button>
                  </div>
                  
                  {/* Render appropriate game type component */}
                  {currentLeagueData.gameTypeId === 'marchMadness' && (
                    <div className="bg-gray-900 p-0 sm:p-2 md:p-4 rounded-b-lg dash-game-container">
                      <BracketDashboard leagueId={activeLeague} league={currentLeagueData} />
                    </div>
                  )}
                  
                  {/* For other game types, add conditional rendering here */}
                  {currentLeagueData.gameTypeId !== 'marchMadness' && (
                    <div className="text-center py-2 sm:py-4 md:py-8">
                      <p className="text-gray-300 text-sm">
                        Visit the full league page to interact with this league type.
                      </p>
                      <button
                        onClick={() => navigate(`/league/${activeLeague}`)}
                        className="mt-3 sm:mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
                      >
                        Open League
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Archived Leagues Section - Completely separate section */}
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
                      <span className="bg-gray-600 text-gray-300 text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">
                        Archived
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">{getGameTypeName(league.gameTypeId)}</p>
                    
                    {league.winners && league.winners.length > 0 && (
                      <div className="mt-1 sm:mt-2">
                        <p className="text-xs text-gray-400">Winners:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {league.winners.map((winner, idx) => (
                            <span key={idx} className="bg-yellow-900 text-yellow-300 text-xs px-1.5 sm:px-2 py-0.5 rounded">
                              {winner.userName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {league.archivedAt && (
                      <p className="text-xs text-gray-500 mt-1 sm:mt-2">
                        Archived on {new Date(league.archivedAt.toDate()).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Featured Game Types */}
      <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 mt-6 sm:mt-8 text-white">Game Types</h2>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {gameTypes.map(gameType => (
          <div 
            key={gameType.id}
            className="bg-gray-800 border border-gray-700 p-2 sm:p-3 md:p-4 rounded-lg hover:bg-gray-700 transition"
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-white">{gameType.name}</h3>
              {gameType.enabled ? (
                <span className="bg-green-900 text-green-300 text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">
                  Available
                </span>
              ) : (
                <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">
                  Coming Soon
                </span>
              )}
            </div>
            <p className="text-gray-300 mb-2 sm:mb-3 text-sm">{gameType.description}</p>
            {gameType.enabled && (
              <Link 
                to="/create-league" 
                className="text-blue-300 hover:text-blue-200 font-medium text-sm"
                state={{ gameTypeId: gameType.id }}
              >
                Create a {gameType.name} league →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
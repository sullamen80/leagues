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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="space-x-2">
          <Link
            to="/create-league"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Create League
          </Link>
          <Link
            to="/join-league"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Join League
          </Link>
        </div>
      </div>
      
      {error && <ErrorDisplay message={error} type="error" />}
      
      {leagueData.active.length === 0 && leagueData.archived.length === 0 ? (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Your Leagues</h2>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center">
            <p className="text-gray-300 mb-4">You haven't joined any leagues yet.</p>
          </div>
        </div>
      ) : (
        <div>
          {/* League Header Section with Archived Toggle Button */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">
              {leagueData.active.length > 0 ? "Active Leagues" : "Your Leagues"}
            </h2>
            {leagueData.archived.length > 0 && (
              <button 
                onClick={toggleArchivedLeagues}
                className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition"
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'} ({leagueData.archived.length})
              </button>
            )}
          </div>
          
          {/* Active Leagues Section */}
          {leagueData.active.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-4">
                {leagueData.active.map(league => (
                  <button
                    key={league.id}
                    onClick={() => handleLeagueChange(league.id)}
                    className={`px-4 py-2 rounded-t-lg transition ${
                      activeLeague === league.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <span>{league.title}</span>
                      {league.ownerId === currentUser.uid && (
                        <span className="ml-2 bg-green-900 text-green-300 px-2 py-0.5 rounded-full text-xs">
                          Owner
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Archived Leagues Section */}
          {showArchived && leagueData.archived.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-white">Archived Leagues</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {leagueData.archived.map(league => (
                  <div 
                    key={league.id}
                    className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:bg-gray-700 transition cursor-pointer"
                    onClick={() => navigate(`/league/${league.id}`)}
                  >
                    <div className="flex justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{league.title}</h3>
                      <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                        Archived
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{getGameTypeName(league.gameTypeId)}</p>
                    
                    {league.winners && league.winners.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">Winners:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {league.winners.map((winner, idx) => (
                            <span key={idx} className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded">
                              {winner.userName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {league.archivedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Archived on {new Date(league.archivedAt.toDate()).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Embedded League Dashboard */}
          {activeLeague && currentLeagueData && (
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {currentLeagueData.title}
                  <span className="ml-2 text-sm text-gray-400">
                    {getGameTypeName(currentLeagueData.gameTypeId)}
                  </span>
                </h2>
                <button
                  onClick={() => navigate(`/league/${activeLeague}`)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Full View
                </button>
              </div>
              
              {/* Render appropriate game type component */}
              {currentLeagueData.gameTypeId === 'marchMadness' && (
                <div className="bg-gray-900 p-4 rounded-lg">
                  <BracketDashboard leagueId={activeLeague} league={currentLeagueData} />
                </div>
              )}
              
              {/* For other game types, add conditional rendering here */}
              {currentLeagueData.gameTypeId !== 'marchMadness' && (
                <div className="text-center py-8">
                  <p className="text-gray-300">
                    Visit the full league page to interact with this league type.
                  </p>
                  <button
                    onClick={() => navigate(`/league/${activeLeague}`)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Open League
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Featured Game Types */}
      <h2 className="text-xl font-semibold mb-4 mt-8 text-white">Game Types</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gameTypes.map(gameType => (
          <div 
            key={gameType.id}
            className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:bg-gray-700 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">{gameType.name}</h3>
              {gameType.enabled ? (
                <span className="bg-green-900 text-green-300 text-xs px-2 py-1 rounded-full">
                  Available
                </span>
              ) : (
                <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
                  Coming Soon
                </span>
              )}
            </div>
            <p className="text-gray-300 mb-3">{gameType.description}</p>
            {gameType.enabled && (
              <Link 
                to="/create-league" 
                className="text-blue-300 hover:text-blue-200 font-medium"
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
// src/gameTypes/marchMadness/components/BracketDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { FaBasketballBall, FaEdit, FaEye, FaTrophy, FaCog, FaChartLine } from 'react-icons/fa';

// Import the actual components to embed directly
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';

/**
 * Main dashboard for March Madness league
 */
const BracketDashboard = ({ leagueId, league }) => {
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);
  const [activeBox, setActiveBox] = useState('edit'); // Default to 'edit', 'view', or 'leaderboard'
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // State for tracking embedded component params
  const [activeBracketId, setActiveBracketId] = useState(null);
  
  // State for fog of war setting
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load game data
        const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
        const gameDataSnap = await getDoc(gameDataRef);
        
        if (gameDataSnap.exists()) {
          setGameData(gameDataSnap.data());
        }
        
        // Fetch fog of war setting
        try {
          const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
          const visibilitySnap = await getDoc(visibilityRef);
          
          if (visibilitySnap.exists()) {
            setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
          }
        } catch (err) {
          console.error("Error fetching visibility settings:", err);
          // Continue with default (fog of war disabled)
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading bracket dashboard data:", error);
        setLoading(false);
      }
    };
    
    if (leagueId) {
      loadData();
    }
  }, [leagueId]);

  // After loading data, set the default active box
  useEffect(() => {
    if (!loading) {
      // Set default box based on tournament status
      const status = getTournamentStatus();
      if (status === "Completed") {
        // If tournament is completed, default to View Bracket
        setActiveBox('view');
      } else {
        // Otherwise default to Edit Bracket
        setActiveBox('edit');
      }
    }
  }, [loading]);
  
  // Extract userId from URL if present
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const bracketUserId = searchParams.get('userId');
    if (bracketUserId) {
      setActiveBracketId(bracketUserId);
      setActiveBox('view'); // Switch to view mode when a userId is present
    }
  }, [location]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Calculate tournament status
  const getTournamentStatus = () => {
    if (!gameData) return "Not Started";
    
    if (gameData.Champion) {
      return "Completed";
    } else if (
      gameData.RoundOf64 && 
      gameData.RoundOf64.some(match => match && match.winner)
    ) {
      return "In Progress";
    } else {
      return "Not Started";
    }
  };
  
  const tournamentStatus = getTournamentStatus();
  const isAdmin = league && league.ownerId === currentUser?.uid;
  const canEditBracket = tournamentStatus !== "Completed";
  
  // Handle box click
  const handleBoxClick = (boxId) => {
    if (boxId === 'edit' && !canEditBracket) {
      // If trying to edit but tournament is locked, show view instead
      setActiveBox('view');
    } else {
      setActiveBox(boxId);
      
      // Reset active bracket when switching to a different box
      if (boxId !== 'view') {
        setActiveBracketId(null);
      }
      
      // Update URL without navigating away from the page
      updateUrlWithoutRefresh(boxId);
    }
  };
  
  // Handle bracket selection in view mode
  const handleBracketSelect = (bracketId) => {
    setActiveBracketId(bracketId);
    
    // Update URL without refreshing the page
    const newUrl = bracketId === 'tournament' 
      ? `/league/${leagueId}?tab=view` 
      : `/league/${leagueId}?tab=view&userId=${bracketId}`;
    
    window.history.pushState({}, '', newUrl);
  };
  
  // Update URL without page refresh
  const updateUrlWithoutRefresh = (tab) => {
    let newUrl = `/league/${leagueId}?tab=${tab}`;
    if (tab === 'view' && activeBracketId) {
      newUrl += `&userId=${activeBracketId}`;
    }
    window.history.pushState({}, '', newUrl);
  };
  
  return (
    <div className="space-y-6">
      {/* Admin Actions - Only shown if user is admin */}
      {isAdmin && (
        <div className="mb-6">
          <div
            className="rounded-lg shadow-md p-4 border-2 cursor-pointer transition border-gray-200 hover:border-blue-300 bg-white"
            onClick={() => navigate(`/league/${leagueId}/admin`)}
          >
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-gray-100">
                <FaCog className="text-gray-500" />
              </div>
              <div className="ml-4">
              <h3 className="font-semibold text-gray-700">
                  League Administration</h3>
                <p className="text-sm text-gray-500">
                  Manage tournament teams, brackets, and league settings
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Navigation Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* View Bracket Box */}
        <div 
          className={`rounded-lg shadow-md p-4 border-2 cursor-pointer transition 
            ${activeBox === 'view' 
              ? 'bg-blue-50 border-blue-500' 
              : 'bg-white border-gray-200 hover:border-blue-300'}`}
          onClick={() => handleBoxClick('view')}
        >
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${activeBox === 'view' ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <FaEye className={`${activeBox === 'view' ? 'text-blue-500' : 'text-gray-500'}`} />
            </div>
            <div className="ml-3">
              <h3 className={`font-semibold ${activeBox === 'view' ? 'text-blue-700' : 'text-gray-700'}`}>
                View Bracket
              </h3>
              <p className="text-sm text-gray-500">Tournament brackets</p>
            </div>
          </div>
        </div>
        
        {/* Edit Bracket Box */}
        <div 
          className={`rounded-lg shadow-md p-4 border-2 cursor-pointer transition 
            ${!canEditBracket ? 'opacity-75 ' : ''}
            ${activeBox === 'edit' 
              ? 'bg-green-50 border-green-500' 
              : 'bg-white border-gray-200 hover:border-green-300'}`}
          onClick={() => handleBoxClick('edit')}
        >
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${activeBox === 'edit' ? 'bg-green-100' : 'bg-gray-100'}`}>
              <FaEdit className={`${activeBox === 'edit' ? 'text-green-500' : 'text-gray-500'}`} />
            </div>
            <div className="ml-3">
              <h3 className={`font-semibold ${activeBox === 'edit' ? 'text-green-700' : 'text-gray-700'}`}>
                Edit My Bracket
              </h3>
              <p className="text-sm text-gray-500">
                {canEditBracket ? "Make your predictions" : "Tournament locked"}
              </p>
            </div>
          </div>
        </div>
        
        {/* Leaderboard Box */}
        <div 
          className={`rounded-lg shadow-md p-4 border-2 cursor-pointer transition 
            ${activeBox === 'leaderboard' 
              ? 'bg-purple-50 border-purple-500' 
              : 'bg-white border-gray-200 hover:border-purple-300'}`}
          onClick={() => handleBoxClick('leaderboard')}
        >
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${activeBox === 'leaderboard' ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <FaChartLine className={`${activeBox === 'leaderboard' ? 'text-purple-500' : 'text-gray-500'}`} />
            </div>
            <div className="ml-3">
              <h3 className={`font-semibold ${activeBox === 'leaderboard' ? 'text-purple-700' : 'text-gray-700'}`}>
                Leaderboard
              </h3>
              <p className="text-sm text-gray-500">Rankings & scores</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Active Component Container */}
      <div className={`bg-white rounded-lg shadow-md border-t-4 
        ${activeBox === 'view' ? 'border-blue-500' : 
          activeBox === 'edit' ? 'border-green-500' : 
          'border-purple-500'
        }`}
      >
        {/* Directly embed components based on active selection */}
        {activeBox === 'view' && (
          <div className="embedded-component">
            <BracketView 
              isEmbedded={true}
              leagueId={leagueId}
              initialBracketId={activeBracketId}
              onBracketSelect={handleBracketSelect}
              hideBackButton={true}
              fogOfWarEnabled={fogOfWarEnabled}
              tournamentCompleted={getTournamentStatus() === "Completed"}
            />
          </div>
        )}
        
        {activeBox === 'edit' && canEditBracket && (
          <div className="embedded-component">
            <BracketEdit 
              isEmbedded={true}
              leagueId={leagueId}
              hideBackButton={true}
            />
          </div>
        )}
        
        {activeBox === 'edit' && !canEditBracket && (
          <div className="p-6">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="text-xl font-semibold text-yellow-800 mb-2">Tournament Locked</h3>
              <p className="text-yellow-700">
                The tournament is complete and brackets can no longer be edited. 
                You can view all brackets and check the leaderboard.
              </p>
              <button 
                onClick={() => setActiveBox('view')} 
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
              >
                View Brackets Instead
              </button>
            </div>
          </div>
        )}
        
        {activeBox === 'leaderboard' && (
          <div className="embedded-component">
            <Leaderboard 
              isEmbedded={true}
              leagueId={leagueId}
              hideBackButton={true}
              fogOfWarEnabled={fogOfWarEnabled}
              tournamentCompleted={getTournamentStatus() === "Completed"}
              onViewBracket={(userId) => {
                setActiveBox('view');
                setActiveBracketId(userId);
                updateUrlWithoutRefresh('view');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BracketDashboard;
// src/gameTypes/marchMadness/components/BracketView.js
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaUser, FaTrophy, FaShare, FaLock } from 'react-icons/fa';
import BracketEditor from './BracketEditor'; // Import the correct component

/**
 * Component for viewing a bracket in read-only mode
 * Supports viewing official tournament bracket or a specific user's bracket
 */
const BracketView = ({ 
  isEmbedded = false, 
  leagueId: propLeagueId, 
  initialBracketId = null,
  onBracketSelect = null,
  hideBackButton = false
}) => {
  const [brackets, setBrackets] = useState([]);
  const [activeBracket, setActiveBracket] = useState('tournament');
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  // State for bracket data
  const [bracketData, setBracketData] = useState(null);
  // State for official tournament data (for comparison)
  const [tournamentData, setTournamentData] = useState(null);

  // Use either the prop leagueId or the one from useParams
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const leagueId = propLeagueId || params.leagueId;
  
  // Get user ID from URL parameters if not embedded
  const searchParams = new URLSearchParams(location.search);
  const bracketUserId = !isEmbedded ? searchParams.get('userId') : null;
  
  // Set active bracket based on URL parameter or initialBracketId
  useEffect(() => {
    if (!isEmbedded && bracketUserId) {
      setActiveBracket(bracketUserId);
    } else if (isEmbedded && initialBracketId) {
      setActiveBracket(initialBracketId);
    } else {
      setActiveBracket('tournament');
    }
  }, [bracketUserId, initialBracketId, isEmbedded]);
  
  // Load official tournament data for comparison
  useEffect(() => {
    const fetchTournamentData = async () => {
      if (!leagueId) return;
      
      try {
        // Get official tournament data for comparison
        const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          setTournamentData(data);
          console.log("Tournament data loaded for comparison");
        }
      } catch (err) {
        console.error("Error loading tournament data for comparison:", err);
      }
    };
    
    fetchTournamentData();
  }, [leagueId]);
  
  // Effect to load bracket data when active bracket changes
  useEffect(() => {
    const fetchBracketData = async () => {
      if (!leagueId || !activeBracket) return;
      
      try {
        console.log(`Fetching bracket data for: ${activeBracket}`);
        
        let bracketRef;
        if (activeBracket === 'tournament') {
          // Official tournament bracket - FIXED PATH
          // The tournament data is in gameData/current, not in brackets/tournament
          bracketRef = doc(db, "leagues", leagueId, "gameData", "current");
        } else {
          // User bracket from userData collection
          bracketRef = doc(db, "leagues", leagueId, "userData", activeBracket);
        }
        
        const bracketSnap = await getDoc(bracketRef);
        
        if (bracketSnap.exists()) {
          const data = bracketSnap.data();
          console.log(`Bracket data found for ${activeBracket}:`, data);
          setBracketData(data);
        } else {
          console.log(`No bracket data found for ${activeBracket}`);
          setBracketData(null);
        }
      } catch (err) {
        console.error(`Error loading bracket data for ${activeBracket}:`, err);
        setBracketData(null);
      }
    };
    
    fetchBracketData();
  }, [leagueId, activeBracket]);
  
  // Load league info and available brackets
  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return;
    }
    
    const fetchLeagueData = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching league data for:", leagueId); // Debug log
        
        // Get league info
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const leagueData = leagueSnap.data();
        setLeagueInfo(leagueData);
        console.log("League data:", leagueData); // Debug log
        
        // Get all user brackets (start with the official tournament bracket)
        const brackets = [
          { id: 'tournament', name: 'Official Tournament', isOfficial: true }
        ];
        
        // Fetch user brackets
        try {
          const userBracketsRef = collection(db, "leagues", leagueId, "userData");
          const userBracketsSnap = await getDocs(userBracketsRef);
          
          console.log("User brackets found:", userBracketsSnap.size); // Debug log
          
          if (userBracketsSnap.size === 0) {
            console.log("No user brackets found");
            setBrackets(brackets);
            setIsLoading(false);
            return;
          }
          
          // Process user data
          const userPromises = userBracketsSnap.docs.map(async (bracketDoc) => {
            const bracketId = bracketDoc.id;
            let username = "Unknown User";
            console.log("Processing bracket for user:", bracketId); // Debug log
            
            // Always try to get the username from the users collection first for the most up-to-date info
            try {
              // Try getting user info directly from the users collection
              const userRef = doc(db, "users", bracketId);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const userData = userSnap.data();
                username = userData.displayName || userData.username || userData.email || "Unknown User";
                console.log("Found username from users collection:", username);
              } else {
                // Fallback to league data if user doc doesn't exist
                if (Array.isArray(leagueData.users)) {
                  const userEntry = leagueData.users.find(user => {
                    if (typeof user === 'string') return user === bracketId;
                    return user.id === bracketId;
                  });
                  
                  if (userEntry) {
                    if (typeof userEntry === 'string') {
                      console.log("User ID found in league data, but no user doc exists");
                    } else {
                      // User info included in league document
                      username = userEntry.displayName || userEntry.username || userEntry.email || "Unknown User";
                      console.log("Found username from league data:", username);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Error fetching user data:", err);
            }
            
            // Make sure we're setting isCurrentUser properly
            const isCurrentUser = bracketId === userId;
            console.log(`User ${bracketId} is current user: ${isCurrentUser}, Username: ${username}`); // Debug log
            
            // Add to brackets list
            return {
              id: bracketId,
              name: username ? username.trim() : "Unknown User", // Trim any whitespace
              isOfficial: false,
              isCurrentUser: isCurrentUser
            };
          });
          
          // Wait for all user data to be processed
          const userBrackets = await Promise.all(userPromises);
          console.log("Processed user brackets:", userBrackets); // Debug log
          setBrackets([...brackets, ...userBrackets]);
        } catch (err) {
          console.error("Error fetching user brackets:", err);
          // Still set the brackets with just the tournament bracket
          setBrackets(brackets);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading brackets:", err);
        setError("Failed to load brackets. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchLeagueData();
  }, [leagueId, userId]);
  
  // Handle bracket selection change
  const handleBracketChange = (bracketId) => {
    setActiveBracket(bracketId);
    
    if (isEmbedded && onBracketSelect) {
      // Use the callback when embedded
      onBracketSelect(bracketId);
    } else {
      // Update URL with the selected user's bracket (when not embedded)
      if (bracketId === 'tournament') {
        navigate(`/league/${leagueId}/view`);
      } else {
        navigate(`/league/${leagueId}/view?userId=${bracketId}`);
      }
    }
  };
  
  // Handle sharing functionality
  const handleShareClick = () => {
    let url;
    
    if (activeBracket === 'tournament') {
      url = `${window.location.origin}/league/${leagueId}/view`;
    } else {
      url = `${window.location.origin}/league/${leagueId}/view?userId=${activeBracket}`;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(err => {
        console.error("Failed to copy URL:", err);
      });
  };
  
  // Handle back navigation
  const handleBack = () => {
    if (isEmbedded) {
      // No navigation when embedded
      return;
    }
    navigate(`/league/${leagueId}`);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">    
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-gray-600">Loading bracket data...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
      {/* Header with navigation and sharing - only show if not embedded or hideBackButton is false */}
      {!isEmbedded && !hideBackButton && (
        <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
            
            <h1 className="text-2xl font-bold">
              {activeBracket === 'tournament' 
                ? 'Official Tournament Bracket' 
                : `${brackets.find(b => b.id === activeBracket)?.name}${brackets.find(b => b.id === activeBracket)?.isCurrentUser ? ' (You)' : ''}'s Bracket`
              }
            </h1>
          </div>
          
          <div className="flex items-center">
            <button
              onClick={handleShareClick}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            >
              <FaShare className="mr-1" />
              <span>{copied ? 'Copied!' : 'Share Bracket'}</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Bracket selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Bracket</label>
        {brackets.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {brackets.map((bracket) => (
              <button
                key={bracket.id}
                onClick={() => handleBracketChange(bracket.id)}
                className={`flex items-center px-4 py-2 rounded transition ${
                  activeBracket === bracket.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {bracket.isOfficial ? <FaTrophy className="mr-2" /> : <FaUser className="mr-2" />}
                <span>
                  {bracket.name}
                  {bracket.isCurrentUser ? " (You)" : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 italic">
            No user brackets found. Only the official tournament bracket is available.
          </div>
        )}
      </div>
      
      {/* League info */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center">
          <p className="text-gray-600 text-sm">
            View-only mode: brackets shown here cannot be edited
          </p>
          {leagueInfo?.lastUpdated && (
            <p className="text-gray-500 text-xs">
              Last updated: {new Date(leagueInfo.lastUpdated.toDate()).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      
      {/* Bracket display */}
      <div className="bg-white border rounded-lg p-4">
        {activeBracket && bracketData ? (
          <div className="overflow-x-auto">
            <h3 className="text-xl font-semibold mb-4 text-center">
              {activeBracket === 'tournament' 
                ? 'Official Tournament Bracket' 
                : `${brackets.find(b => b.id === activeBracket)?.name}${brackets.find(b => b.id === activeBracket)?.isCurrentUser ? ' (You)' : ''}'s Bracket`
              }
            </h3>
            
            {/* Use the existing BracketEditor component in view-only mode */}
            <BracketEditor 
              bracketData={bracketData}
              isLocked={true}
              isAdmin={false}
              onSelectWinner={() => {}} // Empty function to disable interaction
              officialBracket={activeBracket !== 'tournament' ? tournamentData : null} // Pass official bracket when viewing user bracket
            />
            
            {/* Last updated info */}
            {bracketData.updatedAt && (
              <div className="text-right text-xs text-gray-500 mt-2">
                Last updated: {new Date(bracketData.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {!activeBracket ? (
              <p>No bracket selected. Please select a bracket to view.</p>
            ) : (
              <div className="flex flex-col items-center">
                <FaLock className="text-4xl mb-3 text-gray-400" />
                <p className="mb-1">Bracket data not available</p>
                <p className="text-sm text-gray-400">
                  {activeBracket === 'tournament' 
                    ? "The official tournament bracket hasn't been created yet." 
                    : "This user hasn't filled out their bracket yet."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BracketView;
// src/gameTypes/marchMadness/components/Leaderboard.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaArrowLeft, FaSort, FaUser, FaTrophy, FaCheck } from 'react-icons/fa';

/**
 * Component for displaying tournament leaderboard
 */
const Leaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  onViewBracket = null
}) => {
  const [rankings, setRankings] = useState([]);
  const [tournamentData, setTournamentData] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortCriteria, setSortCriteria] = useState('points');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Use either the prop leagueId or the one from useParams
  const params = useParams();
  const navigate = useNavigate();
  const leagueId = propLeagueId || params.leagueId;
  
  // Fetch tournament data and user brackets
  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
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
        
        // Get tournament data (official results)
        const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (tournamentSnap.exists()) {
          setTournamentData(tournamentSnap.data());
        } else {
          setError("Tournament data not found");
          setIsLoading(false);
          return;
        }
        
        // Get all user brackets
        const userBracketsRef = collection(db, "leagues", leagueId, "userData");
        const userBracketsSnap = await getDocs(userBracketsRef);
        
        // Calculate scores for each user
        const rankingsData = [];
        const tournamentResults = tournamentSnap.data();
        
        // Process each user bracket
        for (const bracketDoc of userBracketsSnap.docs) {
          const bracketData = bracketDoc.data();
          const userId = bracketDoc.id;
          
          // Get user info
          let userName = "Unknown User";
          let userPhoto = null;
          
          // Always try to get user info directly from users collection first
          try {
            // Try getting user info directly from the users collection
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName = userData.displayName || userData.username || userData.email || "Unknown User";
              userPhoto = userData.photoURL || null;
              console.log(`Found user ${userId} in users collection: ${userName}`);
            } else {
              // Fallback to league data if user doc doesn't exist
              if (Array.isArray(leagueData.users)) {
                const userEntry = leagueData.users.find(user => {
                  if (typeof user === 'string') return user === userId;
                  return user.id === userId;
                });
                
                if (userEntry) {
                  if (typeof userEntry === 'string') {
                    console.log("User ID found in league data, but no user doc exists");
                  } else {
                    // User info included in league document
                    userName = userEntry.displayName || userEntry.username || userEntry.email || "Unknown User";
                    userPhoto = userEntry.photoURL || null;
                    console.log(`Found user ${userId} in league data: ${userName}`);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Error fetching user data:", err);
          }
          
          // Calculate scores
          const scores = calculateScores(bracketData, tournamentResults);
          
          // Add to rankings
          rankingsData.push({
            userId,
            userName: userName.trim(), // Trim any whitespace
            userPhoto,
            ...scores
          });
        }
        
        // Sort rankings by specified criteria
        const sortedRankings = sortRankings(rankingsData, sortCriteria, sortDirection);
        setRankings(sortedRankings);
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading leaderboard:", err);
        setError("Failed to load leaderboard data. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId]);
  
  // Points system:
  // Round of 64: 1pt, Round of 32: 2pts, Sweet 16: 4pts, 
  // Elite 8: 8pts, Final Four: 16pts, Championship: 32pts
  const roundPoints = {
    'RoundOf64': 1,
    'RoundOf32': 2,
    'Sweet16': 4,
    'Elite8': 8,
    'FinalFour': 16,
    'Championship': 32
  };
  
  // Calculate scores for a user bracket compared to official results
  const calculateScores = (userBracket, tournamentResults) => {
    let points = 0;
    let correctPicks = 0;
    let possiblePoints = 0;
    let maxPossiblePoints = 0;
    let championCorrect = false;
    
    // Check each round
    Object.entries(roundPoints).forEach(([round, pointValue]) => {
      if (tournamentResults[round] && userBracket[round]) {
        // Handle Championship round (object)
        if (round === 'Championship') {
          const officialWinner = tournamentResults.Championship?.winner;
          const userPick = userBracket.Championship?.winner;
          
          // If official winner exists and matches user pick
          if (officialWinner && userPick && officialWinner === userPick) {
            points += pointValue;
            correctPicks += 1;
            championCorrect = true;
          }
          
          // If official winner exists, it was possible to get points
          if (officialWinner) {
            possiblePoints += pointValue;
          } 
          // If no official winner but user made a pick
          else if (userPick) {
            maxPossiblePoints += pointValue;
          }
        } 
        // Handle array rounds
        else if (Array.isArray(tournamentResults[round]) && Array.isArray(userBracket[round])) {
          // Check each matchup
          tournamentResults[round].forEach((officialMatchup, idx) => {
            const userMatchup = userBracket[round][idx];
            
            if (officialMatchup && userMatchup) {
              const officialWinner = officialMatchup.winner;
              const userPick = userMatchup.winner;
              
              // Correct pick
              if (officialWinner && userPick && officialWinner === userPick) {
                points += pointValue;
                correctPicks += 1;
              }
              
              // Points were possible
              if (officialWinner) {
                possiblePoints += pointValue;
              } 
              // Points still possible in the future
              else if (userPick) {
                maxPossiblePoints += pointValue;
              }
            }
          });
        }
      }
    });
    
    return {
      points,
      correctPicks,
      possiblePoints,
      maxPossiblePoints,
      totalPossible: possiblePoints + maxPossiblePoints,
      championPick: userBracket.Champion || "None Selected",
      championCorrect
    };
  };
  
  // Handle sorting change
  const handleSortChange = (criteria) => {
    if (criteria === sortCriteria) {
      // Toggle direction if same criteria
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // Default to descending for new criteria
      setSortCriteria(criteria);
      setSortDirection('desc');
    }
    
    // Resort the data
    setRankings(sortRankings(rankings, criteria, sortDirection === 'desc' ? 'asc' : 'desc'));
  };
  
  // Sort rankings based on criteria
  const sortRankings = (data, criteria, direction) => {
    return [...data].sort((a, b) => {
      let comparison = 0;
      
      switch (criteria) {
        case 'name':
          comparison = a.userName.localeCompare(b.userName);
          break;
        case 'points':
          comparison = b.points - a.points; // Default highest first
          break;
        case 'correctPicks':
          comparison = b.correctPicks - a.correctPicks;
          break;
        case 'maxPossible':
          comparison = (b.points + b.maxPossiblePoints) - (a.points + a.maxPossiblePoints);
          break;
        default:
          comparison = b.points - a.points;
      }
      
      return direction === 'asc' ? comparison : -comparison;
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
  
  // View a user's bracket
  const handleViewBracket = (userId) => {
    if (isEmbedded && onViewBracket) {
      // Use callback when embedded
      onViewBracket(userId);
    } else {
      // Regular navigation when not embedded
      navigate(`/league/${leagueId}/view?userId=${userId}`);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading leaderboard data...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
        {!isEmbedded && !hideBackButton && (
          <div className="flex items-center mb-6">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
          </div>
        )}
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
      {/* Header with back button - only show if not embedded */}
      {!isEmbedded && !hideBackButton && (
        <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
            
            <h1 className="text-2xl font-bold">Tournament Leaderboard</h1>
          </div>
        </div>
      )}
      
      {/* Tournament status */}
      <div className="mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex flex-wrap justify-between">
            <div>
              <p className="text-gray-600 text-sm mt-1">
                {tournamentData?.Champion 
                  ? "Tournament completed" 
                  : "Standings updated as games are completed"}
              </p>
            </div>
            
            {tournamentData?.Champion && (
              <div className="bg-yellow-100 px-4 py-2 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold">Tournament Champion</p>
                <p className="text-lg font-bold text-yellow-900">{tournamentData.Champion}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Rankings table */}
      {rankings.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg border">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Rankings Available</h3>
          <p className="text-gray-600">There are no brackets in this league yet, or the tournament has not started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('name')}
                >
                  <div className="flex items-center">
                    User
                    <FaSort className="ml-1" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('points')}
                >
                  <div className="flex items-center">
                    Points
                    <FaSort className="ml-1" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('maxPossible')}
                >
                  <div className="flex items-center">
                    Potential
                    <FaSort className="ml-1" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Champion Pick
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rankings.map((user, index) => (
                <tr key={user.userId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.userPhoto ? (
                        <img 
                          className="h-8 w-8 rounded-full mr-2" 
                          src={user.userPhoto} 
                          alt="" 
                        />
                      ) : (
                        <FaUser className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      <div className="text-sm font-medium text-gray-900">
                        {user.userName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-semibold">
                      {user.points}
                    </div>
                    <div className="text-xs text-gray-500">
                      of {user.possiblePoints} possible
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.points + user.maxPossiblePoints}
                    </div>
                    <div className="text-xs text-gray-500">
                      +{user.maxPossiblePoints} possible
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.championCorrect && (
                        <FaCheck className="text-green-500 mr-2" />
                      )}
                      <span className={`text-sm ${user.championCorrect ? 'text-green-800 font-bold' : 'text-gray-500'}`}>
                        {user.championPick}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewBracket(user.userId)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View Bracket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Scoring System - Fixed to work with both light and dark themes */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Scoring System</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="bg-white p-2 rounded border">
            <div className="font-semibold text-gray-800">Round of 64</div>
            <div className="text-gray-700">1 point each</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="font-semibold text-gray-800">Round of 32</div>
            <div className="text-gray-700">2 points each</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="font-semibold text-gray-800">Sweet 16</div>
            <div className="text-gray-700">4 points each</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="font-semibold text-gray-800">Elite 8</div>
            <div className="text-gray-700">8 points each</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="font-semibold text-gray-800">Final Four</div>
            <div className="text-gray-700">16 points each</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="font-semibold text-gray-800">Championship</div>
            <div className="text-gray-700">32 points</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
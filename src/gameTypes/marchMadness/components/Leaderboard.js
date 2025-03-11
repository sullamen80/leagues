// src/gameTypes/marchMadness/components/Leaderboard.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaTrophy, FaMedal, FaEye, FaChartBar, FaTimes, FaEyeSlash } from 'react-icons/fa';

/**
 * Leaderboard component for March Madness leagues
 */
const Leaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  onViewBracket = null
}) => {
  const [leagueData, setLeagueData] = useState(null);
  const [tournamentData, setTournamentData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scoringSettings, setScoringSettings] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Default point values
  const defaultPoints = {
    'RoundOf64': 1,
    'RoundOf32': 2,
    'Sweet16': 4,
    'Elite8': 8,
    'FinalFour': 16,
    'Championship': 32
  };
  
  // Use either the prop leagueId or the one from useParams
  const params = useParams();
  const navigate = useNavigate();
  const leagueId = propLeagueId || params.leagueId;
  const userId = auth.currentUser?.uid;
  
  // Fetch league data, tournament results, and player brackets
  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      let fetchedTournamentData = null;
      
      try {
        setIsLoading(true);
        
        // Get league data
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const leagueData = leagueSnap.data();
        setLeagueData(leagueData);
        
        // Check if user is admin/owner
        setIsAdmin(leagueData.ownerId === userId);
        
        // Get visibility settings (fog of war)
        try {
          const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
          const visibilitySnap = await getDoc(visibilityRef);
          
          if (visibilitySnap.exists()) {
            setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
          }
        } catch (err) {
          // Continue with default (fog of war disabled)
        }
        
        // Get tournament data (official results)
        const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (tournamentSnap.exists()) {
          fetchedTournamentData = tournamentSnap.data();
          setTournamentData(fetchedTournamentData);
          
          // Check if tournament is completed
          setTournamentCompleted(!!fetchedTournamentData.Champion);
        } else {
          setError("Tournament data not found");
          setIsLoading(false);
          return;
        }
        
        // Get scoring settings if they exist
        let fetchedScoringSettings = null;
        try {
          const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
          const scoringSnap = await getDoc(scoringRef);
          
          if (scoringSnap.exists()) {
            fetchedScoringSettings = scoringSnap.data();
            // If bonus type doesn't exist in settings, default to seed difference
            if (fetchedScoringSettings.bonusEnabled && !fetchedScoringSettings.bonusType) {
              fetchedScoringSettings.bonusType = 'seedDifference';
            }
            // If flat bonus value doesn't exist, default to 0.5
            if (!fetchedScoringSettings.flatBonusValue) {
              fetchedScoringSettings.flatBonusValue = 0.5;
            }
            setScoringSettings(fetchedScoringSettings);
          }
        } catch (err) {
          // Continue with default settings - don't throw error
        }
        
        // Get all user brackets
        try {
          const userBracketsRef = collection(db, "leagues", leagueId, "userData");
          const userBracketsSnap = await getDocs(userBracketsRef);
          
          if (userBracketsSnap.empty) {
            // No brackets yet - this is normal for a new league
            setPlayers([]);
            setIsLoading(false);
            return;
          }
          
          // Process each user's bracket and calculate scores
          const processPlayerData = async (bracketDoc) => {
            try {
              const userId = bracketDoc.id;
              const bracketData = bracketDoc.data();
              
              // Get user info - failures here should not stop processing
              let userName = "Unknown User";
              try {
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  userName = userData.displayName || userData.username || userData.email || "Unknown User";
                }
              } catch (userErr) {
                // Continue with default name
              }
              
              // Calculate score - catch and handle any errors in calculation
              let scoreData;
              try {
                // Use the locally scoped tournament data to ensure it's available
                scoreData = calculateScore(bracketData, fetchedTournamentData, fetchedScoringSettings);
              } catch (scoreErr) {
                // Use default score data
                scoreData = { 
                  points: 0, 
                  basePoints: 0, 
                  bonusPoints: 0, 
                  correctPicks: 0,
                  roundBreakdown: {} 
                };
              }
              
              return {
                id: userId,
                name: userName,
                ...scoreData,
                lastUpdated: bracketData.updatedAt ? new Date(bracketData.updatedAt) : null,
                isCurrentUser: userId === auth.currentUser?.uid
              };
            } catch (playerErr) {
              // Return a placeholder player rather than failing completely
              return {
                id: bracketDoc.id,
                name: "Error Loading User",
                points: 0,
                basePoints: 0,
                bonusPoints: 0,
                correctPicks: 0,
                roundBreakdown: {},
                lastUpdated: null,
                error: true,
                isCurrentUser: bracketDoc.id === auth.currentUser?.uid
              };
            }
          };
          
          // Process all players in parallel
          const playerPromises = userBracketsSnap.docs.map(processPlayerData);
          const results = await Promise.all(playerPromises);
          
          // Filter out any failed results
          const validPlayers = results.filter(player => !player.error);
          
          // Sort by score (highest first)
          validPlayers.sort((a, b) => b.points - a.points);
          
          // Update state with sorted player data
          setPlayers(validPlayers);
        } catch (bracketsErr) {
          setError("Error loading user brackets");
          setIsLoading(false);
          return;
        }
        
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load leaderboard data. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId, userId]);

  // Calculate score function
  const calculateScore = (userBracket, tournamentResults, scoringSettings = null) => {
    if (!userBracket || !tournamentResults) {
      return { 
        points: 0, 
        basePoints: 0, 
        bonusPoints: 0, 
        correctPicks: 0,
        roundBreakdown: {} 
      };
    }
    
    // Map scoring settings fields to round names - use component-level defaultPoints
    const roundPoints = {
      'RoundOf64': scoringSettings?.roundOf64 ?? defaultPoints.RoundOf64,
      'RoundOf32': scoringSettings?.roundOf32 ?? defaultPoints.RoundOf32,
      'Sweet16': scoringSettings?.sweet16 ?? defaultPoints.Sweet16,
      'Elite8': scoringSettings?.elite8 ?? defaultPoints.Elite8,
      'FinalFour': scoringSettings?.finalFour ?? defaultPoints.FinalFour,
      'Championship': scoringSettings?.championship ?? defaultPoints.Championship
    };
    
    const bonusEnabled = scoringSettings?.bonusEnabled ?? false;
    const bonusType = scoringSettings?.bonusType ?? 'seedDifference';
    const bonusPerSeedDifference = scoringSettings?.bonusPerSeedDifference ?? 0.5;
    const flatBonusValue = scoringSettings?.flatBonusValue ?? 0.5;
    
    let points = 0;
    let correctPicks = 0;
    let bonusPoints = 0;
    let roundBreakdown = {};
    
    // Check each round
    Object.entries(roundPoints).forEach(([round, pointValue]) => {
      roundBreakdown[round] = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
      
      // Make sure both tournament and user data exists for this round
      if (tournamentResults[round] && userBracket[round]) {
        // Handle Championship round (object)
        if (round === 'Championship') {
          // Safety check that Championship objects exist
          if (typeof tournamentResults[round] === 'object' && 
              typeof userBracket[round] === 'object') {
            
            const officialWinner = tournamentResults.Championship?.winner || '';
            const officialWinnerSeed = tournamentResults.Championship?.winnerSeed || null;
            const officialTeam1 = tournamentResults.Championship?.team1 || '';
            const officialTeam1Seed = tournamentResults.Championship?.team1Seed || null;
            const officialTeam2 = tournamentResults.Championship?.team2 || '';
            const officialTeam2Seed = tournamentResults.Championship?.team2Seed || null;
            const userPick = userBracket.Championship?.winner || '';
            
            roundBreakdown[round].possible = pointValue;
            
            // If official winner exists and matches user pick
            if (officialWinner && userPick && officialWinner === userPick) {
              const basePoints = pointValue;
              roundBreakdown[round].base = basePoints;
              roundBreakdown[round].correct = 1;
              
              points += basePoints;
              correctPicks += 1;
              
              // Add bonus points for upset (if enabled)
              if (bonusEnabled && officialWinnerSeed && officialTeam1Seed && officialTeam2Seed) {
                // Determine expected winner (lower seed number)
                const expectedWinnerSeed = Math.min(officialTeam1Seed, officialTeam2Seed);
                
                // If actual winner has higher seed number than expected, it's an upset
                if (officialWinnerSeed > expectedWinnerSeed) {
                  let roundBonus = 0;
                  
                  if (bonusType === 'seedDifference') {
                    // Seed difference-based bonus
                    const seedDifference = officialWinnerSeed - expectedWinnerSeed;
                    roundBonus = seedDifference * bonusPerSeedDifference;
                  } else {
                    // Flat bonus
                    roundBonus = flatBonusValue;
                  }
                  
                  bonusPoints += roundBonus;
                  roundBreakdown[round].bonus = roundBonus;
                  roundBreakdown[round].total = basePoints + roundBonus;
                } else {
                  roundBreakdown[round].total = basePoints;
                }
              } else {
                roundBreakdown[round].total = basePoints;
              }
            }
          }
        } 
        // Handle array rounds with proper type checking
        else if (Array.isArray(tournamentResults[round]) && Array.isArray(userBracket[round])) {
          // Check each matchup
          tournamentResults[round].forEach((officialMatchup, idx) => {
            // Safety check that the matchup is available in user bracket
            if (!officialMatchup || !userBracket[round][idx]) return;
            
            // Count total possible points for this round
            roundBreakdown[round].possible += pointValue;
            
            try {
              const officialWinner = officialMatchup.winner || '';
              const officialWinnerSeed = officialMatchup.winnerSeed || null;
              const officialTeam1 = officialMatchup.team1 || '';
              const officialTeam1Seed = officialMatchup.team1Seed || null;
              const officialTeam2 = officialMatchup.team2 || '';
              const officialTeam2Seed = officialMatchup.team2Seed || null;
              const userPick = userBracket[round][idx].winner || '';
              
              // Correct pick
              if (officialWinner && userPick && officialWinner === userPick) {
                const basePoints = pointValue;
                roundBreakdown[round].base += basePoints;
                roundBreakdown[round].correct += 1;
                
                points += basePoints;
                correctPicks += 1;
                
                // Add bonus points for upset (if enabled)
                if (bonusEnabled && officialWinnerSeed && officialTeam1Seed && officialTeam2Seed) {
                  // Determine expected winner (lower seed number)
                  const expectedWinnerSeed = Math.min(officialTeam1Seed, officialTeam2Seed);
                  
                  // If actual winner has higher seed number than expected, it's an upset
                  if (officialWinnerSeed > expectedWinnerSeed) {
                    let matchupBonus = 0;
                    
                    if (bonusType === 'seedDifference') {
                      // Seed difference-based bonus
                      const seedDifference = officialWinnerSeed - expectedWinnerSeed;
                      matchupBonus = seedDifference * bonusPerSeedDifference;
                    } else {
                      // Flat bonus
                      matchupBonus = flatBonusValue;
                    }
                    
                    bonusPoints += matchupBonus;
                    roundBreakdown[round].bonus += matchupBonus;
                  }
                }
              }
            } catch (matchupErr) {
              // Continue with next matchup
            }
          });
          
          // Calculate total for the round
          roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
        }
      }
    });
    
    // Add bonus points to total
    const totalPoints = points + bonusPoints;
    
    return { 
      points: totalPoints, 
      basePoints: points, 
      bonusPoints: bonusPoints, 
      correctPicks,
      roundBreakdown 
    };
  };
  
  // Get visible players based on fog of war settings
  const getVisiblePlayers = () => {
    // If fog of war is disabled or tournament is complete, show all players
    // Remove admin exception so fog of war applies to everyone
    if (!fogOfWarEnabled || tournamentCompleted) {
      return players;
    }
    
    // With fog of war enabled, only show current user (and their rank)
    return players.filter(player => player.isCurrentUser).map((player, idx) => {
      // Find the player's actual rank in the full leaderboard
      const playerRank = players.findIndex(p => p.id === player.id);
      return {
        ...player,
        rank: playerRank + 1
      };
    });
  };
  
  // Handle view bracket
  const handleViewBracket = (userId) => {
    if (isEmbedded && onViewBracket) {
      onViewBracket(userId); // Use the callback when embedded
    } else {
      navigate(`/league/${leagueId}/view?userId=${userId}`);
    }
  };
  
  // Handle view tournament
  const handleViewTournament = () => {
    if (isEmbedded && onViewBracket) {
      onViewBracket('tournament'); // Use the callback when embedded
    } else {
      navigate(`/league/${leagueId}/view`);
    }
  };
  
  // Handle showing score details
  const handleShowDetails = (player) => {
    setSelectedPlayer(player);
    setShowDetailsModal(true);
  };
  
  // Handle back
  const handleBack = () => {
    navigate(`/league/${leagueId}`);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading leaderboard...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className={`max-w-7xl mx-auto p-4 md:p-6 ${isEmbedded ? '' : 'bg-white dark:bg-gray-800'} rounded-lg ${isEmbedded ? '' : 'shadow-md'}`}>
        {!isEmbedded && !hideBackButton && (
          <div className="flex items-center mb-6">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
          </div>
        )}
        
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          {isEmbedded && (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Empty state when no players have submitted brackets
  if (players.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        {!isEmbedded && !hideBackButton && (
          <div className="flex items-center mb-6">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
          </div>
        )}
        
        <div className="text-center py-12">
          <FaTrophy className="text-gray-300 dark:text-gray-600 text-6xl mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-2">No Brackets Yet</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            No players have submitted brackets for this tournament yet. Check back later!
          </p>
          <button
            onClick={handleViewTournament}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
          >
            View Tournament Bracket
          </button>
        </div>
      </div>
    );
  }
  
  const visiblePlayers = getVisiblePlayers();
  
  // Get the current tournament status
  const getTournamentStatus = () => {
    if (!tournamentData) return 'Not Started';
    
    if (tournamentData.Champion) {
      return 'Completed';
    } else if (tournamentData.RoundOf64 && 
              Array.isArray(tournamentData.RoundOf64) &&
              tournamentData.RoundOf64.some(match => match && match.winner)) {
      return 'In Progress';
    } else {
      return 'Not Started';
    }
  };
  
  // Get scoring info text
  const getScoringInfoText = () => {
    if (!scoringSettings) {
      return "Standard point system: R64: 1pt, R32: 2pts, S16: 4pts, E8: 8pts, F4: 16pts, Champ: 32pts";
    }
    
    let text = `Points: R64: ${scoringSettings.roundOf64}pt, R32: ${scoringSettings.roundOf32}pts, `;
    text += `S16: ${scoringSettings.sweet16}pts, E8: ${scoringSettings.elite8}pts, `;
    text += `F4: ${scoringSettings.finalFour}pts, Champ: ${scoringSettings.championship}pts`;
    
    if (scoringSettings.bonusEnabled) {
      if (scoringSettings.bonusType === 'seedDifference') {
        text += `, Upset bonus: ${scoringSettings.bonusPerSeedDifference} per seed difference`;
      } else {
        text += `, Upset bonus: Flat ${scoringSettings.flatBonusValue} points per upset`;
      }
    }
    
    return text;
  };
  
  // Get display name for rounds
  const getRoundDisplayName = (roundKey) => {
    const displayNames = {
      'RoundOf64': 'Round of 64',
      'RoundOf32': 'Round of 32',
      'Sweet16': 'Sweet 16',
      'Elite8': 'Elite 8',
      'FinalFour': 'Final Four',
      'Championship': 'Championship'
    };
    
    return displayNames[roundKey] || roundKey;
  };
  
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {/* Header with navigation */}
      {!isEmbedded && !hideBackButton && (
        <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b dark:border-gray-700">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
            
            <h1 className="text-2xl font-bold dark:text-gray">Leaderboard</h1>
          </div>
          
          <div>
            <button
              onClick={handleViewTournament}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            >
              <FaTrophy className="mr-2" /> View Tournament Bracket
            </button>
          </div>
        </div>
      )}
      
      {/* Only show title when embedded */}
      {(isEmbedded || hideBackButton) && (
        <div className="mb-6 pb-4 border-b dark:border-gray-700">
          <h1 className="text-2xl font-bold  text-gray-900 dark:text-gray-200">Leaderboard</h1>
        </div>
      )}
      
      {/* Fog of War notice if enabled */}
      {fogOfWarEnabled && !tournamentCompleted && !isAdmin && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/30 dark:border-yellow-800">
          <div className="flex items-center">
            <FaEyeSlash className="text-yellow-600 dark:text-yellow-500 mr-3 text-xl flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-400">Fog of War Mode Active</h3>
              <p className="text-yellow-700 dark:text-yellow-300">
                The league administrator has enabled Fog of War mode. You can only see your own position on the leaderboard 
                until the tournament is completed.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Tournament info */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200">{leagueData?.title || 'March Madness Tournament'}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Status: {getTournamentStatus()}</p>
          </div>
          
          <div className="mt-2 md:mt-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{getScoringInfoText()}</p>
          </div>
        </div>
      </div>
      
      {/* Conditional message when only showing current user due to Fog of War */}
      {fogOfWarEnabled && !tournamentCompleted && !isAdmin && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-700 dark:text-blue-300 text-center">
            Your current position: {players.findIndex(p => p.isCurrentUser) + 1} out of {players.length}
            <br />
            <span className="text-sm">Full leaderboard will be revealed when fog of war is removed.</span>
          </p>
        </div>
      )}
      
      {/* Leaderboard Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
              <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Player</th>
              <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
              {scoringSettings?.bonusEnabled && (
                <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bonus</th>
              )}
              <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correct Picks</th>
              <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {visiblePlayers.map((player, index) => {
              // For Fog of War mode, use the actual rank from the full leaderboard
              const displayRank = player.rank || (index + 1);
              const isTopThree = displayRank <= 3;
              
              return (
                <tr key={player.id} className={`
                  ${isTopThree ? "bg-yellow-50 dark:bg-yellow-900/30" : ""} 
                  ${player.isCurrentUser ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                  hover:bg-gray-50 dark:hover:bg-gray-700/50
                `}>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {displayRank === 1 && (
                        <FaMedal className="text-yellow-500 mr-1" title="1st Place" />
                      )}
                      {displayRank === 2 && (
                        <FaMedal className="text-gray-400 dark:text-gray-300 mr-1" title="2nd Place" />
                      )}
                      {displayRank === 3 && (
                        <FaMedal className="text-amber-700 dark:text-amber-500 mr-1" title="3rd Place" />
                      )}
                      <span className={`${isTopThree ? "font-bold" : ""} text-gray-900 dark:text-gray-200`}>{displayRank}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`
                      ${isTopThree ? "font-bold" : ""} 
                      ${player.isCurrentUser ? "font-semibold" : ""}
                      text-gray-900 dark:text-gray-200
                    `}>
                      {player.name} 
                      {player.isCurrentUser && <span className="ml-1 text-blue-600 dark:text-blue-400">(You)</span>}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-gray-900 dark:text-gray-200">
                    {parseFloat(player.points).toFixed(1)}
                  </td>
                  {scoringSettings?.bonusEnabled && (
                    <td className="py-3 px-4 whitespace-nowrap text-right text-green-600 dark:text-green-400">
                      +{parseFloat(player.bonusPoints).toFixed(1)}
                    </td>
                  )}
                  <td className="py-3 px-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">
                    {player.correctPicks}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleShowDetails(player)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:border-green-800 focus:outline-none"
                      >
                        <FaChartBar className="mr-1" /> Details
                      </button>
                      <button
                        onClick={() => handleViewBracket(player.id)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:border-indigo-800 focus:outline-none"
                      >
                        <FaEye className="mr-1" /> View
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Score Details Modal */}
      {showDetailsModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Score Details: {selectedPlayer.name}
                {selectedPlayer.isCurrentUser && <span className="ml-1 text-blue-600 dark:text-blue-400">(You)</span>}
              </h2>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="p-6">
              {/* Score summary */}
              <div className="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Total Points</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{parseFloat(selectedPlayer.points).toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Base Points</p>
                    <p className="text-xl font-semibold dark:text-white">{parseFloat(selectedPlayer.basePoints).toFixed(1)}</p>
                  </div>
                  {selectedPlayer.bonusPoints > 0 && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Bonus Points</p>
                      <p className="text-xl font-semibold text-green-600 dark:text-green-400">+{parseFloat(selectedPlayer.bonusPoints).toFixed(1)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Correct Picks</p>
                    <p className="text-xl font-semibold dark:text-white">{selectedPlayer.correctPicks}</p>
                  </div>
                </div>
              </div>
              
              {/* Score breakdown by round */}
              <h3 className="text-lg font-semibold mb-4 dark:text-white">Round Breakdown</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Round</th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Correct Picks</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Base Points</th>
                      {scoringSettings?.bonusEnabled && (
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Bonus</th>
                      )}
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(selectedPlayer.roundBreakdown || {}).map(([round, data]) => (
                      <tr key={round} className={data.total > 0 ? "bg-green-50 dark:bg-green-900/20" : ""}>
                        <td className="py-2 px-4 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                          {getRoundDisplayName(round)}
                        </td>
                        <td className="py-2 px-4 text-center text-gray-700 dark:text-gray-300">
                          {data.correct} / {Math.floor(data.possible / (scoringSettings?.[`${round.charAt(0).toLowerCase() + round.slice(1)}`] || defaultPoints[round] || 1))}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                          {data.base}
                        </td>
                        {scoringSettings?.bonusEnabled && (
                          <td className="py-2 px-4 text-right text-green-600 dark:text-green-400">
                            {data.bonus > 0 ? `+${data.bonus.toFixed(1)}` : '—'}
                          </td>
                        )}
                        <td className="py-2 px-4 text-right font-bold text-gray-900 dark:text-gray-200">
                          {data.total.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <td className="py-2 px-4 font-bold text-gray-900 dark:text-gray-200">Total</td>
                      <td className="py-2 px-4 text-center font-bold text-gray-900 dark:text-gray-200">{selectedPlayer.correctPicks}</td>
                      <td className="py-2 px-4 text-right font-bold text-gray-900 dark:text-gray-200">{selectedPlayer.basePoints}</td>
                      {scoringSettings?.bonusEnabled && (
                        <td className="py-2 px-4 text-right font-bold text-green-600 dark:text-green-400">
                          {selectedPlayer.bonusPoints > 0 ? `+${selectedPlayer.bonusPoints.toFixed(1)}` : '—'}
                        </td>
                      )}
                      <td className="py-2 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedPlayer.points.toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Scoring explanation */}
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">Scoring Explanation</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                  {getScoringInfoText()}
                </p>
                {scoringSettings?.bonusEnabled && (
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>Upset Bonus:</strong> {scoringSettings.bonusType === 'seedDifference' 
                      ? 'Points are awarded for correctly picking upsets based on seed difference. When a higher-seeded team (e.g. 12 seed) beats a lower-seeded team (e.g. 5 seed), you earn bonus points based on the seed difference (7 in this example).'
                      : `A flat bonus of ${scoringSettings.flatBonusValue} points is awarded for any correctly predicted upset, regardless of the seed difference.`
                    }
                  </p>
                )}
              </div>
            </div>
            
            <div className="border-t dark:border-gray-700 p-4 flex justify-end">
              <button
                onClick={() => handleViewBracket(selectedPlayer.id)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              >
                <FaEye className="mr-2" /> View Full Bracket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
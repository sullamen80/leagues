// src/pages/stats/Stats.js
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, getDoc, doc, where, orderBy, limit } from 'firebase/firestore';
import { classNames, formatNumber } from '../../utils/formatters';
import StatsHeader from './components/common/StatsHeader';
import ViewToggle from './components/common/ViewToggle';
import LeagueStatsViewShell from './components/LeagueStatsViewShell';
import UserStatsViewShell from './components/UserStatsViewShell';
import LeaguesTableView from './components/LeaguesTableView';
import UsersTableView from './components/UsersTableView';
import LoadingSpinner from '../../components/common/Loading';
import { getColorClass } from '../../styles/tokens/colors';
import { Link } from 'react-router-dom';

// Import game type utilities
import {
  getLeagueViewRenderer,
  getUserViewRenderer,
  getLeagueExtraColumns,
  getUserExtraColumns,
  getCustomStatCards,
  getAdditionalContent
} from './components/gameTypes';

/**
 * Statistics Page Component
 * Handles fetching and displaying statistics for leagues and users
 */
const Stats = ({
  urlParams,
  type,
  id,
  statsRoot,
  navigateToLeague,
  navigateToUser,
  navigateToLeaguesList,
  navigateToUsersList,
  generateStatsUrl
}) => {
  
  // View state (league or user)
  const [activeView, setActiveView] = useState(type || 'league');
  
  // Selection state
  const [selectedId, setSelectedId] = useState(id || null);
  
  // Available options for selectors
  const [leagues, setLeagues] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Currently loaded stats data
  const [statsData, setStatsData] = useState(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State to track expanded rows
  const [expandedRows, setExpandedRows] = useState({});

  // Create leagueId to document ID mapping - this is used by UserStatsView
  const leagueDocMapping = useMemo(() => {
    return leagues.reduce((mapping, league) => {
      mapping[league.leagueId] = league.id;
      return mapping;
    }, {});
  }, [leagues]);

  // Update component state when URL parameters change
  useEffect(() => {
    
    if (type !== activeView) {
      setActiveView(type);
      setStatsData(null);
    }
    
    if (id !== selectedId) {
      setSelectedId(id);
      setStatsData(null);
    }
  }, [type, id]);

  // Reset expanded rows state when selectedId changes
  useEffect(() => {
    setExpandedRows({});
  }, [selectedId]);

  // Fetch available leagues
  useEffect(() => {
    const fetchLeagues = async () => {
      // Only fetch leagues for the league view or if we don't have any
      if (activeView !== 'league' && leagues.length > 0) return;
      
      try {
        setLoading(true);
        
        // Query the gameStats/root/leagues collection
        const leaguesCollRef = collection(statsRoot, 'leagues');
        const leaguesQuery = query(leaguesCollRef, orderBy('timestamp', 'desc'));
        const leaguesSnapshot = await getDocs(leaguesQuery);

        if (leaguesSnapshot.empty) {
          setLeagues([]);
        } else {
          // Process leagues
          const leagueData = [];
          leaguesSnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Find the winner if available
            let winner = "Not Available";
            if (data.winners && data.winners.length > 0) {
              // Find the rank 1 winner
              const rankOneWinner = data.winners.find(w => w.rank === 1);
              if (rankOneWinner) {
                winner = rankOneWinner.userName || "Unknown Winner";
              }
            }
            
            leagueData.push({
              id: doc.id,
              leagueId: data.leagueId,
              gameTypeId: data.gameTypeId || 'unknown',
              seasonId: data.seasonId || 'unknown',
              playerCount: data.playerCount || 0,
              timestamp: data.timestamp,
              displayName: `${data.seasonId || 'Unknown'} - ${data.gameTypeId || 'League'}`,
              // Include additional metadata for filtering and display
              metadata: {
                champion: data.nbaPlayoffsStats?.champion,
                gameType: data.gameTypeId,
                winner: winner,
                highestScore: data.stats?.highestScore || 0
              }
            });
          });

          setLeagues(leagueData);
        }
      } catch (err) {
        console.error('Error fetching leagues:', err);
        setError('Failed to load leagues: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [activeView, leagues.length, statsRoot]);

  // Fetch available users with stats
  useEffect(() => {
    const fetchUsers = async () => {
      // Only fetch users for the user view or if we don't have any
      if (activeView !== 'user' && users.length > 0) return;
      
      try {
        setLoading(true);
        
        // Query the gameStats/root/userStats collection
        const usersCollRef = collection(statsRoot, 'userStats');
        const usersQuery = query(usersCollRef);
        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
          setUsers([]);
        } else {
          // Process users
          const userData = [];
          usersSnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Skip any temporary documents
            if (data._metadata?.isTemporary) {
              return;
            }
            
            userData.push({
              id: doc.id, // Using document ID directly
              userId: data.userId,
              userName: data.userName,
              totalLeagues: data.stats?.totalLeagues || 0,
              totalWins: data.stats?.totalWins || 0,
              displayName: data.userName || 'Unknown User',
              // Include additional metadata for filtering
              metadata: {
                lastUpdated: data.lastUpdated,
                gameTypes: Object.keys(data.byGameType || {})
              }
            });
          });

          
          // Sort by most active (most leagues participated in)
          userData.sort((a, b) => b.totalLeagues - a.totalLeagues);
          
          setUsers(userData);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [activeView, users.length, statsRoot]);

  // Fetch data based on active view and selection
  useEffect(() => {
    if (!selectedId) {
      setStatsData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        
        if (activeView === 'league') {
          // Fetch league stats
          const statsRef = doc(statsRoot, 'leagues', selectedId);
          const statsSnapshot = await getDoc(statsRef);

          if (!statsSnapshot.exists()) {
            console.error(`No statistics found for league ${selectedId}`);
            setError(`No statistics found for league ${selectedId}`);
            setStatsData(null);
          } else {
            const leagueData = statsSnapshot.data();
            setStatsData(leagueData);
          }
        } else if (activeView === 'user') {
          // Fetch user stats directly from userStats collection
          const userStatsRef = doc(statsRoot, 'userStats', selectedId);
          const userStatsSnapshot = await getDoc(userStatsRef);

          if (!userStatsSnapshot.exists()) {
            console.error(`No statistics found for user ${selectedId}`);
            setError(`No statistics found for user ${selectedId}`);
            setStatsData(null);
          } else {
            // Get the user data
            const userData = userStatsSnapshot.data();
            
            // Sort the user's leagues by most recent first (if timestamp exists)
            const sortedLeagues = [...(userData.leagues || [])].sort((a, b) => {
              // Handle Firestore timestamps or date objects
              const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
              const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
              return dateB - dateA;
            });
            
            // Build the complete user stats data structure needed by UserStatsView
            const userStatsData = {
              ...userData,
              leagues: sortedLeagues, // Use ALL leagues, sorted by date
              completedLeagues: userData.leagues || [],
              processedLeagues: userData.leagues || []
            };
            
            setStatsData(userStatsData);
          }
        }
      } catch (err) {
        console.error(`Error fetching ${activeView} stats:`, err);
        setError(`Failed to load ${activeView} statistics: ${err.message}`);
        setStatsData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeView, selectedId, statsRoot]);

  // Handle view toggle
  const handleViewChange = (view) => {
    if (view === activeView) return; // Prevent unnecessary updates
    
    setActiveView(view);
    setSelectedId(null); // Clear selection when changing views
    setStatsData(null);   // Clear data when changing views
    
    // Update URL and state
    if (view === 'league') {
      navigateToLeaguesList();
    } else {
      navigateToUsersList();
    }
  };

  // Handle selection
  const handleSelectionChange = (id) => {
    if (id === selectedId) return; // Prevent unnecessary updates
    
    setSelectedId(id);
    
    // Update URL and state
    if (activeView === 'league') {
      navigateToLeague(id);
    } else {
      navigateToUser(id);
    }
  };
  
  // Handle back to list view
  const handleBackToList = () => {
    if (activeView === 'league') {
      navigateToLeaguesList();
    } else {
      navigateToUsersList();
    }
    
    // Clear selection state
    setSelectedId(null);
    setStatsData(null);
  };

  // Toggle an expanded row in the stats view
  const toggleExpand = (itemId) => {
    setExpandedRows(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Prepare data for the LeagueStatsViewShell
  const getLeagueViewData = useMemo(() => {
    if (!statsData) return null;

    const { 
      stats = {}, 
      playerCount = 0,
      winners = [],
      gameTypeId = 'unknown',
      players = []
    } = statsData;

    // Get player percentages
    const playerPercentages = stats.playerPercentages || [];

    // Get custom stat cards based on game type or use defaults
    const customStatCards = getCustomStatCards(gameTypeId, statsData);
    const statCards = customStatCards || [
      {
        title: 'Players',
        value: playerCount,
        description: 'Total participants',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
        variant: 'primary'
      },
      {
        title: 'Average Score',
        value: stats.averageScore ? formatNumber(stats.averageScore) : '0',
        description: 'Points per player',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        variant: 'info'
      },
      {
        title: 'Highest Score',
        value: stats.highestScore ? formatNumber(stats.highestScore) : '0',
        description: 'Best performance',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
        variant: 'success'
      },
      {
        title: 'Pick Accuracy',
        value: stats.correctPickPercentage ? `${(stats.correctPickPercentage * 100).toFixed(1)}%` : '0%',
        description: 'Overall correct picks',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        variant: 'primary'
      }
    ];

    // Process player leaderboard data
    let leaderboardData = [];
    if (Array.isArray(playerPercentages) && playerPercentages.length > 0) {
      leaderboardData = playerPercentages.map(player => {
        const winner = winners.find(w => w.userId === player.userId);
        const fullPlayerData = players ? players.find(p => p.userId === player.userId) : null;
        
        // IMPORTANT: Get the roundBreakdown data directly
        const playerRoundBreakdown = fullPlayerData?.roundBreakdown || {};
        
        // Create the player object with roundBreakdown as a direct property
        return {
          rank: winner?.rank || 99,
          userName: player.userName || 'Unknown Player',
          userId: player.userId,
          correctPicks: player.correctPicks || 0,
          totalPossible: player.totalPossible || 0,
          percentage: player.percentage || 0,
          formattedAccuracy: `${(player.percentage * 100).toFixed(1)}%`,
          score: winner?.score || 0,
          formattedScore: formatNumber(winner?.score || 0),
          championPick: player.championPick || 'Unknown',
          championCorrect: player.championCorrect || false,
          
          // CRITICAL FIX: Add the roundBreakdown data directly and explicitly
          roundBreakdown: playerRoundBreakdown,
          
          isExpanded: !!expandedRows[player.userId],
          profileLink: (
            <Link 
              to={`/stats/user/${player.userId}`}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Profile
            </Link>
          ),
          actions: (
            <div className="flex space-x-2">
              <Link 
                to={`/stats/user/${player.userId}`}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Profile
              </Link>
              <button
                onClick={() => toggleExpand(player.userId)}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {expandedRows[player.userId] ? 'Collapse' : 'Expand'}
              </button>
            </div>
          )
        };
      }).sort((a, b) => a.rank - b.rank);
    }

    // Get extra columns based on game type
    const extraColumns = getLeagueExtraColumns(gameTypeId) || [];
    
    // Get renderer for expanded content based on game type
    const renderExpandedContent = getLeagueViewRenderer(gameTypeId);

    // Get additional content based on game type
    const additionalContent = getAdditionalContent(gameTypeId, statsData);

    return {
      statCards,
      leaderboardData,
      extraColumns,
      renderExpandedContent,
      additionalContent
    };
  }, [statsData, expandedRows]);

  // Prepare data for the UserStatsViewShell
  const getUserViewData = useMemo(() => {
    if (!statsData) return null;

    const { userId, userName, stats = {}, leagues = [] } = statsData;

    // Get extra columns based on game types user has participated in
    const gameTypes = [...new Set(leagues.map(league => league.gameTypeId))];
    let allExtraColumns = [];
    gameTypes.forEach(gameType => {
      const gameTypeColumns = getUserExtraColumns(gameType);
      if (gameTypeColumns && gameTypeColumns.length > 0) {
        allExtraColumns = [...allExtraColumns, ...gameTypeColumns];
      }
    });

    // Find renderers for expanded content based on game types
    const rendererMap = {};
    gameTypes.forEach(gameType => {
      const renderer = getUserViewRenderer(gameType);
      if (renderer) {
        rendererMap[gameType] = renderer;
      }
    });

    // Custom renderer that delegates to appropriate game type renderer
    const renderExpandedContent = (league) => {
      const gameType = league.gameTypeId;
      const renderer = rendererMap[gameType];
      if (renderer) {
        return renderer(league);
      }
      
      // Default renderer
      return (
        <div className="p-4 border rounded-md">
          <h4 className="text-lg font-medium mb-3">Detailed Performance</h4>
          
          {/* General Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <h5 className="text-sm font-medium text-gray-500">Correct Picks</h5>
              <p className="text-lg font-semibold">
                {league.correctPicks} / {league.totalPossible}
              </p>
            </div>
            
            <div className="bg-white p-3 rounded shadow-sm">
              <h5 className="text-sm font-medium text-gray-500">Accuracy</h5>
              <p className="text-lg font-semibold">
                {(league.accuracy * 100).toFixed(1)}%
              </p>
            </div>
            
            <div className="bg-white p-3 rounded shadow-sm">
              <h5 className="text-sm font-medium text-gray-500">Score</h5>
              <p className="text-lg font-semibold">
                {formatNumber(league.score)}
              </p>
            </div>
          </div>
        </div>
      );
    };

    return {
      extraColumns: allExtraColumns,
      renderExpandedContent
    };
  }, [statsData, expandedRows]);

  // Loading state
  if (loading && !leagues.length && !users.length) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className={getColorClass('text', 'white', 'text') + " text-xl sm:text-2xl font-bold"}>Statistics</h1>
        <p className="mt-2 text-sm text-gray-500">
          View detailed statistics for leagues and players
        </p>
      </div>

      {/* View toggle */}
      <div className="mb-6">
        <ViewToggle 
          activeView={activeView} 
          onChange={handleViewChange} 
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* League view */}
      {activeView === 'league' && (
        <>
          {selectedId ? (
            <div>
              {/* Back button placed above the header */}
              {statsData && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleBackToList}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    ← Back to Leagues
                  </button>
                </div>
              )}

              {/* League stats content */}
              {statsData && getLeagueViewData ? (
                <div className="stats-content">
                  <StatsHeader 
                    data={statsData} 
                    type="league"
                  />
                  <LeagueStatsViewShell 
                    data={statsData}
                    statCards={getLeagueViewData.statCards}
                    leaderboardData={getLeagueViewData.leaderboardData}
                    extraColumns={getLeagueViewData.extraColumns}
                    renderExpandedContent={getLeagueViewData.renderExpandedContent}
                    expandedRows={expandedRows}
                    onToggleExpand={toggleExpand}
                  >
                    {getLeagueViewData.additionalContent}
                  </LeagueStatsViewShell>
                </div>
              ) : (
                <div className="flex justify-center items-center h-48">
                  <LoadingSpinner size="md" />
                </div>
              )}
            </div>
          ) : (
            /* Default view when no league is selected - show all leagues table */
            <LeaguesTableView 
              leagues={leagues} 
              navigateToStats={navigateToLeague} 
            />
          )}
        </>
      )}

      {/* User view */}
      {activeView === 'user' && (
        <>
          {selectedId ? (
            <div>
              {/* Back button placed above the header */}
              {statsData && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleBackToList}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    ← Back to Users
                  </button>
                </div>
              )}

              {/* User stats content */}
              {statsData && getUserViewData ? (
                <div className="stats-content">
                  <StatsHeader 
                    data={statsData} 
                    type="user"
                  />
                  <UserStatsViewShell 
                    data={statsData} 
                    leagueDocMapping={leagueDocMapping}
                    extraColumns={getUserViewData.extraColumns}
                    renderExpandedContent={getUserViewData.renderExpandedContent}
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center h-48">
                  <LoadingSpinner size="md" />
                </div>
              )}
            </div>
          ) : (
            /* Default view when no user is selected - show all users table */
            <UsersTableView 
              users={users} 
              navigateToStats={navigateToUser}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Stats;
// src/gameTypes/nflPlayoffs/components/AdminDashboard.js
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaFootballBall, FaUsers, FaClipboardCheck, FaLock, FaCog, FaCalculator, FaChartLine, FaDownload, FaTrophy, FaMedal } from 'react-icons/fa';
import BaseAdminDashboard from '../../common/components/BaseAdminDashboard';
import AdminMVPManagement from './AdminMVPManagement';
import AdminStats from './AdminStats';
import { ROUND_KEYS } from '../constants/playoffConstants';
import EndLeagueStats from '../services/EndLeagueStatsService';

/**
 * Admin dashboard for NFL Playoffs tournament
 * Extends the BaseAdminDashboard with football-specific functionality
 */
const AdminDashboard = ({ urlParams = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'mvp', 'stats'

  useEffect(() => {
    const subview = urlParams?.subview;
    if (!subview) {
      setActiveTab('dashboard');
      return;
    }
    if (subview === 'mvp' || subview === 'stats') {
      setActiveTab(subview);
      return;
    }
    setActiveTab('dashboard');
  }, [urlParams?.subview]);

  // NFL Playoffs rounds
  const playoffsRounds = [
    ROUND_KEYS.FIRST_ROUND,
    ROUND_KEYS.CONF_SEMIS,
    ROUND_KEYS.CONF_FINALS,
    ROUND_KEYS.SUPER_BOWL
  ];

  // Get playoffs status
  const getPlayoffsStatus = (playoffsData) => {
    if (!playoffsData) return 'Not Set Up';
    if (playoffsData[ROUND_KEYS.CHAMPION]) return 'Completed';

    const roundOrder = [
      ROUND_KEYS.FIRST_ROUND,
      ROUND_KEYS.CONF_SEMIS,
      ROUND_KEYS.CONF_FINALS,
      ROUND_KEYS.SUPER_BOWL
    ];

    const inProgress = roundOrder.some((round) => {
      const roundData = playoffsData[round];
      if (round === ROUND_KEYS.SUPER_BOWL) {
        return !!roundData?.winner || !!roundData?.team1 || !!roundData?.team2;
      }
      return Array.isArray(roundData) && roundData.some((match) => match && match.winner);
    });

    if (inProgress) return 'In Progress';
    if (getTeamCount(playoffsData) > 0) return 'Teams Set';
    return 'Not Started';
  };
  
  // Count filled teams in the playoffs
  const getTeamCount = (playoffsData) => {
    if (!playoffsData) return 0;
    
    let count = 0;
    
    // Check for Teams property first
    if (playoffsData.playoffTeams) {
      ['afcConference', 'nfcConference'].forEach((conference) => {
        if (Array.isArray(playoffsData.playoffTeams[conference])) {
          count += playoffsData.playoffTeams[conference].filter((team) => team && (team.name || team.teamId)).length;
        }
      });
      if (count > 0) return count;
    }
    
    // Check First Round matchups
    const firstRoundData = playoffsData[ROUND_KEYS.FIRST_ROUND];
    if (firstRoundData && Array.isArray(firstRoundData)) {
      const teamsSet = new Set();
      
      firstRoundData.forEach(matchup => {
        if (matchup) {
          const team1Name = matchup.team1?.name || matchup.team1;
          const team2Name = matchup.team2?.name || matchup.team2;
          if (team1Name) teamsSet.add(team1Name);
          if (team2Name) teamsSet.add(team2Name);
        }
      });
      
      if (teamsSet.size > 0) return teamsSet.size;
    }
    return 0;
  };
  
  // Get completion status
  const getCompletionStatus = (playoffsData) => {
    const teamCount = getTeamCount(playoffsData);
    const totalExpected = 14;
    return {
      completed: teamCount,
      total: totalExpected,
      text: teamCount > 0 ? `${teamCount}/${totalExpected}` : 'Not Set'
    };
  };
  
  // Navigation methods using parameter-based approach
  const navigateToSettings = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'settings');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);
  
  const navigateToTeams = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'teams');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);
  
  const navigateToScoring = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'scoring');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);

  const navigateToMVP = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'mvp');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);

  const navigateToAdminDashboard = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.delete('subview');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);
  
  const navigateToStats = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'stats');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);
  
 // Handle extending the end league process with stats collection
  const handleExtendEndLeague = async (leagueId, gameData, winners) => {
    try {
      // Set feedback to show stats are being captured
      setExportFeedback({ 
        message: "Capturing NFL Playoffs statistics...", 
        type: "info" 
      });
      
      // Create a new stats collector
      const statsCollector = new EndLeagueStats(leagueId);
      
      // First generate a preview to get all the detailed stats
      setExportFeedback({ 
        message: "Calculating detailed statistics...", 
        type: "info" 
      });
      
      const previewData = await statsCollector.generateStatsPreview(gameData);
      
      // Capture stats with preview data to include all the percentages
      setExportFeedback({ 
        message: "Saving statistics to database...", 
        type: "info" 
      });
      
      const result = await statsCollector.captureStats(gameData, winners, previewData);
      
      if (result.success) {
        setExportFeedback({ 
          message: "League statistics captured and stored successfully.", 
          type: "success" 
        });
        setTimeout(() => setExportFeedback(null), 5000);
        return result;
      } else {
        setExportFeedback({ 
          message: `Failed to capture stats: ${result.error}`, 
          type: "error" 
        });
        setTimeout(() => setExportFeedback(null), 5000);
        return null;
      }
    } catch (error) {
      setExportFeedback({ 
        message: `Error capturing stats: ${error.message}`, 
        type: "error" 
      });
      setTimeout(() => setExportFeedback(null), 5000);
      return null;
    }
  };
  
  // Custom stat cards for NFL Playoffs
  const PlayoffsStatCards = ({
    leagueData,
    gameData,
    userCount,
    lockStatus,
    completionStatus,
    gameStatus
  }) => {
    const hasMVP = Boolean(gameData?.[ROUND_KEYS.FINALS_MVP]);
    const hasProps = Array.isArray(gameData?.propBets) && gameData.propBets.length > 0;
    const isConfigured = hasMVP || hasProps;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FaUsers className="text-blue-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Players</p>
              <p className="text-2xl font-bold">{userCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <FaClipboardCheck className="text-green-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Teams Set</p>
              <p className="text-2xl font-bold">{completionStatus.text}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <FaFootballBall className="text-purple-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Playoffs Status</p>
              <p className="text-2xl font-bold">{gameStatus}</p>
            </div>
          </div>
        </div>

        {/* Props & MVP Status Card */}
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-amber-100 p-3 rounded-full mr-4">
              <FaMedal className="text-amber-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Props & MVP</p>
              <p className="text-2xl font-bold">{isConfigured ? 'Configured' : 'Review Needed'}</p>
              <button 
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={navigateToMVP}
              >
                {isConfigured ? 'View/Edit' : 'Configure'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Custom visibility settings for NFL Playoffs
  const PlayoffsSettings = ({
    fogOfWarEnabled,
    onToggleFogOfWar,
    isArchived
  }) => {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Bracket Visibility Settings</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold">Fog of War</h3>
              <p className="text-sm text-gray-600 max-w-3xl">
                When enabled, players cannot see other participants' brackets until the playoffs are completed.
                This creates more suspense and prevents players from copying each other's strategies or tracking
                their relative standings too closely.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Current status: <span className="font-medium">{fogOfWarEnabled ? 'Enabled' : 'Disabled'}</span>
              </p>
            </div>
            <button
              onClick={onToggleFogOfWar}
              disabled={isArchived}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                fogOfWarEnabled
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              } ${isArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {fogOfWarEnabled ? 'Show All Brackets' : 'Hide Other Brackets'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Custom actions for NFL Playoffs with export functionality
  const PlayoffsActions = ({
    leagueId,
    onGoToSettings,
    onGoToTeams,
    onGoToScoringSettings,
    onEndLeague,
    isEndingLeague,
    isArchived,
    gameData
  }) => {
    const handleExportWithUserData = async () => {
      if (isExporting) return;
      
      setIsExporting(true);
      setExportFeedback({ message: "Gathering data for export...", type: "info" });
      
      try {
        // Step 1: Get the playoffs data
        if (!gameData) {
          setExportFeedback({ message: "Error: Playoffs data not available", type: "error" });
          setIsExporting(false);
          return;
        }
        
        // Step 2: Create the export data structure with playoffs data
        const exportData = {
          playoffs: gameData,
          users: {}
        };
        
        // Step 3: Try different collection paths for user brackets
        const possibleCollections = [
          `leagues/${leagueId}/userBrackets`,
          `leagues/${leagueId}/brackets`,
          `leagues/${leagueId}/userPicks`,
          `leagues/${leagueId}/userData`
        ];
        
        let userDataCount = 0;
        let userDataFound = false;
        
        // Try each possible collection path
        for (const collectionPath of possibleCollections) {
          try {
            setExportFeedback({ 
              message: `Checking for user data in ${collectionPath}...`, 
              type: "info" 
            });
            
            const snapshot = await getDocs(collection(db, collectionPath));
            
            if (!snapshot.empty) {
              for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const userId = docSnap.id;
                
                // Check if this looks like bracket data
                if (hasPlayoffData(data)) {
                  userDataCount++;
                  
                  // Add user data with appropriate structure
                  if (!exportData.users[userId]) {
                    exportData.users[userId] = {};
                  }
                  
                  // Store the data
                  exportData.users[userId].bracket = data;
                  
                  // Add additional user data if available
                  if (data.displayName) {
                    exportData.users[userId].displayName = data.displayName;
                  }
                  
                  if (data.score !== undefined) {
                    exportData.users[userId].score = data.score;
                  }
                  
                  if (data.lastUpdated) {
                    exportData.users[userId].lastUpdated = data.lastUpdated;
                  }
                }
              }
              
              if (userDataCount > 0) {
                setExportFeedback({ 
                  message: `Found ${userDataCount} user data entries in ${collectionPath}`, 
                  type: "success" 
                });
                userDataFound = true;
                break; // Stop searching other collections if we found data
              }
            }
          } catch (err) {
            console.error(`Error checking collection ${collectionPath}:`, err);
            // Continue to the next collection path
          }
        }
        
        // If we didn't find brackets in standard locations, try to get basic user info
        if (!userDataFound) {
          try {
            setExportFeedback({ 
              message: "No user brackets found in standard locations. Fetching basic user data...", 
              type: "warning" 
            });
            
            const userDataSnapshot = await getDocs(collection(db, "leagues", leagueId, "userData"));
            
            for (const docSnap of userDataSnapshot.docs) {
              const userId = docSnap.id;
              const userData = docSnap.data();
              
              if (!exportData.users[userId]) {
                exportData.users[userId] = {
                  profile: {
                    displayName: userData.displayName || "Unknown User",
                    joinedAt: userData.joinedAt || null
                  }
                };
              }
            }
          } catch (err) {
            console.error("Error fetching basic user data:", err);
          }
        }
        
        // Step 4: Create and download the JSON file
        const jsonData = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create the download name with timestamp for uniqueness
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nflPlayoffs-export-${leagueId}-${timestamp}.json`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        if (Object.keys(exportData.users).length === 0) {
          setExportFeedback({ 
            message: "Export complete, but no user data was found. Playoffs configuration was exported.", 
            type: "warning" 
          });
        } else {
          setExportFeedback({ 
            message: `Export complete! Downloaded ${filename} with ${Object.keys(exportData.users).length} users.`, 
            type: "success" 
          });
        }
      } catch (error) {
        console.error("Export error:", error);
        setExportFeedback({ 
          message: `Export failed: ${error.message || "Unknown error"}`, 
          type: "error" 
        });
      } finally {
        setTimeout(() => {
          setIsExporting(false);
          setTimeout(() => setExportFeedback(null), 5000);
        }, 1000);
      }
    };
    
    // Helper function to determine if data contains playoff data
    const hasPlayoffData = (data) => {
      if (!data) return false;
      
      // Check for various possible data structures
      return (
        (data[ROUND_KEYS.FIRST_ROUND]) ||
        (data[ROUND_KEYS.CONF_SEMIS]) ||
        (data[ROUND_KEYS.CONF_FINALS]) ||
        (data[ROUND_KEYS.SUPER_BOWL]) ||
        data.picks ||
        data.predictions ||
        data.bracket
      );
    };

    return (
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Admin Actions</h2>
        
        {exportFeedback && (
          <div className={`mb-4 p-3 rounded border ${
            exportFeedback.type === 'error' 
              ? 'bg-red-100 text-red-800 border-red-200' 
              : exportFeedback.type === 'warning'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                : exportFeedback.type === 'success'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
          }`}>
            {exportFeedback.message}
          </div>
        )}
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Playoffs Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure teams, brackets, and other playoff settings.
              </p>
              <button
                onClick={onGoToSettings}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-indigo-700 transition w-full justify-center"
              >
                <FaCog className="mr-2" /> Settings
              </button>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Manage Participants</h3>
              <p className="text-sm text-gray-600 mb-4">
                View, manage and remove participants from the league.
              </p>
              <button
                onClick={onGoToTeams}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-green-700 transition w-full justify-center"
              >
                <FaUsers className="mr-2" /> Participants
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Scoring Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure point values and bonus settings for predictions.
              </p>
              <button
                onClick={onGoToScoringSettings}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-purple-700 transition w-full justify-center"
              >
                <FaCalculator className="mr-2" /> Scoring
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Props & MVP</h3>
              <p className="text-sm text-gray-600 mb-4">
                Manage prop bets, player lists, and set the official Super Bowl MVP.
              </p>
              <button
                onClick={navigateToMVP}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-pink-700 transition w-full justify-center"
              >
                <FaMedal className="mr-2" /> Props & MVP Settings
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Stats </h3>
              <p className="text-sm text-gray-600 mb-4">
                Manage stats collection for the league.
              </p>
              <button
                onClick={navigateToStats}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-teal-700 transition w-full justify-center"
              >
                <FaChartLine className="mr-2" /> Stats Tool
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Export Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download playoffs data with all user brackets as JSON.
              </p>
              <button
                onClick={handleExportWithUserData}
                disabled={isExporting}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full justify-center disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <FaDownload className="mr-2" /> Export All Data
                  </>
                )}
              </button>
            </div>

            {/* End League button */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">End League</h3>
              <p className="text-sm text-gray-600 mb-4">
                Determine winners, record results, and archive the league.
              </p>
              <button
                onClick={onEndLeague}
                disabled={isEndingLeague || isArchived}
                className={`flex items-center px-4 py-2 ${
                  isEndingLeague || isArchived
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white rounded transition w-full justify-center`}
              >
                {isEndingLeague ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaTrophy className="mr-2" /> 
                    {isArchived ? 'Archived' : 'End League'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Return the base dashboard with NFL Playoffs customizations
  return (
    <BaseAdminDashboard
      gameType="nflPlayoffs"
      rounds={playoffsRounds}
      getGameStatus={getPlayoffsStatus}
      getCompletionStatus={getCompletionStatus}
      CustomStatCards={PlayoffsStatCards}
      CustomSettings={activeTab === 'dashboard' ? PlayoffsSettings : null}
      CustomActions={activeTab === 'dashboard' ? PlayoffsActions : null}
      CustomContent={
        activeTab !== 'dashboard' 
          ? (props) => (
              <div>
                {/* Tab Navigation */}
                <div className="mb-6 border-b">
                  <div className="flex">
                    <button
                      className={`px-4 py-2 ${
                        activeTab === 'dashboard' 
                          ? 'border-b-2 border-blue-600 text-blue-600 font-medium' 
                          : 'text-gray-600 hover:text-blue-600'
                      }`}
                      onClick={navigateToAdminDashboard}
                    >
                      Dashboard
                    </button>
                    <button
                      className={`px-4 py-2 ${
                        activeTab === 'mvp' 
                          ? 'border-b-2 border-blue-600 text-blue-600 font-medium' 
                          : 'text-gray-600 hover:text-blue-600'
                      }`}
                      onClick={navigateToMVP}
                    >
                      Props & MVP
                    </button>
                    <button
                      className={`px-4 py-2 ${
                        activeTab === 'stats' 
                          ? 'border-b-2 border-blue-600 text-blue-600 font-medium' 
                          : 'text-gray-600 hover:text-blue-600'
                      }`}
                      onClick={navigateToStats}
                    >
                      Stats Debugger
                    </button>
                  </div>
                </div>
                
                {activeTab === 'mvp' && (
                  <AdminMVPManagement 
                    leagueId={props.leagueId}
                    gameData={props.gameData}
                    isArchived={props.isArchived}
                    onUpdateSuccess={() => {}}
                    onUpdateError={(error) => console.error("MVP update error:", error)}
                  />
                )}
                
                {activeTab === 'stats' && (
                  <AdminStats
                    leagueId={props.leagueId}
                    gameData={props.gameData}
                  />
                )}
              </div>
            )
          : null
      }
      onExtendEndLeague={handleExtendEndLeague}
      onGoToSettings={navigateToSettings}
      onGoToTeams={navigateToTeams}
      onGoToScoringSettings={navigateToScoring}
      urlParams={urlParams}
      useParameterNavigation={true}
      isExporting={isExporting}
      setIsExporting={setIsExporting}
      exportFeedback={exportFeedback}
      setExportFeedback={setExportFeedback}
    />
  );
};

export default AdminDashboard;

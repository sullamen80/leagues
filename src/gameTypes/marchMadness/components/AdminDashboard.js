// src/gameTypes/marchMadness/components/AdminDashboard.js
import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaBasketballBall, FaUsers, FaClipboardCheck, FaLock, FaCog, FaCalculator, FaDownload, FaTrophy } from 'react-icons/fa';
import BaseAdminDashboard from '../../common/components/BaseAdminDashboard';
import { useUrlParams } from '../../common/BaseGameModule';

/**
 * Admin dashboard for March Madness tournament
 * Extends the BaseAdminDashboard with basketball-specific functionality
 */
const AdminDashboard = ({ urlParams = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  // NCAA Tournament specific rounds
  const marchmadnessRounds = [
    'RoundOf64', 
    'RoundOf32', 
    'Sweet16', 
    'Elite8', 
    'FinalFour', 
    'Championship'
  ];
  
  // Get tournament status
  const getTournamentStatus = (tournamentData) => {
    if (!tournamentData) return 'Not Set Up';
    
    if (tournamentData.Champion) {
      return 'Completed';
    }
    
    if (tournamentData.RoundOf64 && tournamentData.RoundOf64.some(match => match && match.winner)) {
      return 'In Progress';
    }
    
    if (getTeamCount(tournamentData) > 0) {
      return 'Teams Set';
    }
    
    return 'Not Started';
  };
  
  // Count filled teams in the tournament
  const getTeamCount = (tournamentData) => {
    if (!tournamentData?.SetTeams) return 0;
    
    const regions = ['eastRegion', 'westRegion', 'midwestRegion', 'southRegion'];
    let count = 0;
    
    regions.forEach(region => {
      if (Array.isArray(tournamentData.SetTeams[region])) {
        count += tournamentData.SetTeams[region].filter(team => team && team.name).length;
      }
    });
    
    return count;
  };
  
  // Get completion status
  const getCompletionStatus = (tournamentData) => {
    const teamCount = getTeamCount(tournamentData);
    return { 
      completed: teamCount, 
      total: 64, 
      text: teamCount > 0 ? `${teamCount}/64` : 'Not Set'
    };
  };
  
  // Custom stat cards for March Madness
  const MarchMadnessStatCards = ({ 
    leagueData, 
    gameData, 
    userCount, 
    lockStatus,
    completionStatus,
    gameStatus 
  }) => {
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
              <p className="text-2xl font-bold">{completionStatus.completed}/64</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-full mr-4">
              <FaLock className="text-yellow-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bracket Status</p>
              <p className="text-2xl font-bold">{lockStatus.RoundOf64?.locked ? 'Locked' : 'Open'}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <FaBasketballBall className="text-purple-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tournament Status</p>
              <p className="text-2xl font-bold">{gameStatus}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Custom visibility settings for March Madness
  const MarchMadnessSettings = ({ 
    fogOfWarEnabled, 
    onToggleFogOfWar, 
    isArchived 
  }) => {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Bracket Visibility Settings</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Fog of War</h3>
              <p className="text-sm text-gray-600 max-w-3xl">
                When enabled, players cannot see other participants' brackets until the tournament is completed. 
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
  
  // Custom actions for March Madness
  const MarchMadnessActions = ({
    leagueId,
    onExportData,
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
        // Step 1: Get the tournament data
        if (!gameData) {
          setExportFeedback({ message: "Error: Tournament data not available", type: "error" });
          setIsExporting(false);
          return;
        }
        
        // Step 2: Create the export data structure with tournament data
        const exportData = {
          tournament: gameData,
          users: {}
        };
        
        // Step 3: Try different collection paths for user brackets
        // The possible collections where brackets might be stored
        const possibleCollections = [
          `leagues/${leagueId}/userBrackets`,
          `leagues/${leagueId}/brackets`,
          `leagues/${leagueId}/userData`
        ];
        
        let userBracketCount = 0;
        let userBracketsFound = false;
        
        // Try each possible collection path
        for (const collectionPath of possibleCollections) {
          try {
            setExportFeedback({ 
              message: `Checking for brackets in ${collectionPath}...`, 
              type: "info" 
            });
            
            const snapshot = await getDocs(collection(db, collectionPath));
            
            if (!snapshot.empty) {
              snapshot.forEach(doc => {
                const data = doc.data();
                const userId = doc.id;
                
                // Check if this looks like a bracket (has rounds data)
                if (data.RoundOf64 || data.bracket || data.picks) {
                  userBracketCount++;
                  
                  // Add bracket data with appropriate structure
                  if (!exportData.users[userId]) {
                    exportData.users[userId] = {};
                  }
                  
                  // Determine the correct structure based on the data
                  if (data.RoundOf64) {
                    // Direct bracket format
                    exportData.users[userId].bracket = data;
                  } else if (data.bracket) {
                    // Nested bracket format
                    exportData.users[userId].bracket = data.bracket;
                  } else if (data.picks) {
                    // Alternative "picks" format
                    exportData.users[userId].bracket = data.picks;
                  }
                  
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
              });
              
              if (userBracketCount > 0) {
                setExportFeedback({ 
                  message: `Found ${userBracketCount} user brackets in ${collectionPath}`, 
                  type: "success" 
                });
                userBracketsFound = true;
                break; // Stop searching other collections if we found brackets
              }
            }
          } catch (err) {
            console.error(`Error checking collection ${collectionPath}:`, err);
            // Continue to the next collection path
          }
        }
        
        // If we didn't find brackets in standard locations, try to get user info anyway
        if (!userBracketsFound) {
          try {
            setExportFeedback({ 
              message: "No brackets found in standard locations. Fetching basic user data...", 
              type: "warning" 
            });
            
            const userDataSnapshot = await getDocs(collection(db, "leagues", leagueId, "userData"));
            
            userDataSnapshot.forEach(doc => {
              const userId = doc.id;
              const userData = doc.data();
              
              if (!exportData.users[userId]) {
                exportData.users[userId] = {
                  profile: {
                    displayName: userData.displayName || "Unknown User",
                    joinedAt: userData.joinedAt || null,
                    photoURL: userData.photoURL || null
                  }
                };
              }
            });
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
        const filename = `marchMadness-export-${leagueId}-${timestamp}.json`;
        
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
            message: "Export complete, but no user data was found. Tournament configuration was exported.", 
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
              <h3 className="font-bold mb-2">Tournament Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure teams, brackets, and other tournament settings.
              </p>
              <button
                onClick={onGoToSettings}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition w-full justify-center"
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
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition w-full justify-center"
              >
                <FaUsers className="mr-2" /> Participants
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Scoring Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure point values and bonus scoring rules for the tournament.
              </p>
              <button
                onClick={onGoToScoringSettings}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition w-full justify-center"
              >
                <FaCalculator className="mr-2" /> Scoring
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Export Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download tournament data with all user brackets as JSON.
              </p>
              <button
                onClick={handleExportWithUserData}
                disabled={isExporting}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full justify-center"
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

  // Return the base dashboard with March Madness customizations
  return (
    <BaseAdminDashboard
      gameType="marchMadness"
      rounds={marchmadnessRounds}
      getGameStatus={getTournamentStatus}
      getCompletionStatus={getCompletionStatus}
      CustomStatCards={MarchMadnessStatCards}
      CustomSettings={MarchMadnessSettings}
      CustomActions={MarchMadnessActions}
      onGoToSettings={navigateToSettings}
      onGoToTeams={navigateToTeams}
      onGoToScoringSettings={navigateToScoring}
      urlParams={urlParams}
      useParameterNavigation={true}
    />
  );
};

export default AdminDashboard;
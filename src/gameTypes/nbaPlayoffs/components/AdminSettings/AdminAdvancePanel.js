// src/gameTypes/nbaPlayoffs/components/AdminSettings/PlayoffsAdvancedPanel.js
import React, { useState } from 'react';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase';
import { FaDownload, FaUserCog, FaUsers, FaTrash } from 'react-icons/fa';
import { ROUND_KEYS } from '../../constants/playoffConstants';

/**
 * Panel component for advanced NBA Playoffs settings
 * Uses standardized ROUND_KEYS as source of truth
 */
const AdminAdvancedPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  leagueId,
  generateInitialPlayoffMatchups,
  getEmptyTeamsData
}) => {
  const [isUpdatingUsers, setIsUpdatingUsers] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const { tournamentData, teamsData } = data || {};
  
  // Export tournament data as JSON with user data
  const handleExportData = async () => {
    if (!tournamentData) return;
    
    if (isExporting) return;
    
    setIsExporting(true);
    setFeedback("Gathering data for export...");
    
    try {
      // Step 1: Create the export data structure with playoffs data
      const exportData = {
        playoffs: tournamentData,
        users: {}
      };
      
      // Step 2: Try different collection paths for user brackets
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
          setFeedback(`Checking for user data in ${collectionPath}...`);
          
          const snapshot = await getDocs(collection(db, collectionPath));
          
          if (!snapshot.empty) {
            snapshot.forEach(doc => {
              const data = doc.data();
              const userId = doc.id;
              
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
            });
            
            if (userDataCount > 0) {
              setFeedback(`Found ${userDataCount} user data entries in ${collectionPath}`);
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
          setFeedback("No user brackets found in standard locations. Fetching basic user data...");
          
          const userDataSnapshot = await getDocs(collection(db, "leagues", leagueId, "userData"));
          
          userDataSnapshot.forEach(doc => {
            const userId = doc.id;
            const userData = doc.data();
            
            if (!exportData.users[userId]) {
              exportData.users[userId] = {
                profile: {
                  displayName: userData.displayName || "Unknown User",
                  joinedAt: userData.joinedAt || null
                }
              };
            }
          });
        } catch (err) {
          console.error("Error fetching basic user data:", err);
        }
      }
      
      // Step 3: Create and download the JSON file
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create the download name with timestamp for uniqueness
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nbaPlayoffs-export-${leagueId}-${timestamp}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      if (Object.keys(exportData.users).length === 0) {
        setFeedback("Export complete, but no user data was found. Playoffs configuration was exported.");
      } else {
        setFeedback(`Export complete! Downloaded ${filename} with ${Object.keys(exportData.users).length} users.`);
      }
    } catch (error) {
      console.error("Export error:", error);
      setFeedback(`Export failed: ${error.message || "Unknown error"}`);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
    }
  };
  
  // Helper function to determine if data contains playoff data
  const hasPlayoffData = (data) => {
    if (!data) return false;
    
    // Check for various possible data structures
    return (
      // Check for round data
      (data[ROUND_KEYS.FIRST_ROUND]) || 
      (data[ROUND_KEYS.PLAY_IN]) ||
      (data[ROUND_KEYS.CONF_SEMIS]) ||
      (data[ROUND_KEYS.CONF_FINALS]) ||
      (data[ROUND_KEYS.NBA_FINALS]) ||
      // Check for common bracket/picks data structures
      data.picks || 
      data.predictions || 
      data.bracket
    );
  };

// Handle clear all tournament data while preserving teams
const handleClearAllTeams = async () => {
  if (isArchived) {
    setFeedback("This league is archived and cannot be edited.");
    return;
  }
  
  if (!window.confirm("Are you sure you want to reset all tournament results and user brackets? Team names will be preserved, but all results and predictions will be cleared. This action CANNOT be undone.")) {
    return;
  }
  
  try {
    setIsUpdatingUsers(true);
    setFeedback("Clearing all tournament data while preserving teams...");
    
    // Keep existing teams data
    const currentTeams = data.teamsData || {};
    
    // Create a reset tournament structure
    const resetTournamentData = {
      // Preserve essential settings and team data
      status: tournamentData.status || "active",
      playInTournamentEnabled: tournamentData.playInTournamentEnabled || false,
      playInComplete: false,
      allTeams: tournamentData.allTeams, // Keep the existing teams
      
      // Reset Play-In Tournament results while preserving teams
      [ROUND_KEYS.PLAY_IN]: {
        east: {
          // Keep team assignments
          seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || { team: "", teamId: null, seed: 7 },
          eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || { team: "", teamId: null, seed: 8 },
          ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || { team: "", teamId: null, seed: 9 },
          tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || { team: "", teamId: null, seed: 10 },
          // Clear results
          seventhEighthWinner: { team: "", seed: null },
          ninthTenthWinner: { team: "", seed: null },
          finalWinner: { team: "", seed: null },
          loserTeam: { team: "", seed: null },
          winnerTeam: { team: "", seed: null }
        },
        west: {
          // Keep team assignments
          seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || { team: "", teamId: null, seed: 7 },
          eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || { team: "", teamId: null, seed: 8 },
          ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || { team: "", teamId: null, seed: 9 },
          tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || { team: "", teamId: null, seed: 10 },
          // Clear results
          seventhEighthWinner: { team: "", seed: null },
          ninthTenthWinner: { team: "", seed: null },
          finalWinner: { team: "", seed: null },
          loserTeam: { team: "", seed: null },
          winnerTeam: { team: "", seed: null }
        }
      },
      
      // Empty first round
      [ROUND_KEYS.FIRST_ROUND]: Array(8).fill().map((_, i) => ({
        team1: "",
        team1Seed: null,
        team2: "",
        team2Seed: null,
        winner: "",
        winnerSeed: null,
        numGames: null,
        conference: i < 4 ? 'East' : 'West'
      })),
      
      // Empty subsequent rounds
      [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({
        team1: "",
        team1Seed: null,
        team2: "",
        team2Seed: null,
        winner: "",
        winnerSeed: null,
        numGames: null,
        conference: i < 2 ? 'East' : 'West'
      })),
      
      [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({
        team1: "",
        team1Seed: null,
        team2: "",
        team2Seed: null,
        winner: "",
        winnerSeed: null,
        numGames: null,
        conference: i === 0 ? 'East' : 'West'
      })),
      
      [ROUND_KEYS.NBA_FINALS]: {
        team1: "",
        team1Seed: null,
        team1Conference: "East",
        team2: "",
        team2Seed: null,
        team2Conference: "West",
        winner: "",
        winnerSeed: null,
        winnerConference: "",
        numGames: null
      },
      
      // Reset champion and MVP data
      [ROUND_KEYS.CHAMPION]: "",
      [ROUND_KEYS.FINALS_MVP]: "",
      
      // Reset metadata
      resetAt: new Date().toISOString(),
      resetBy: auth.currentUser?.uid || 'admin'
    };
    
    // Update admin view
    onDataChange({
      ...data,
      teamsData: currentTeams, // Keep existing teams
      tournamentData: resetTournamentData,
      editMode: true
    });
    
    // Create a template for user data
    const userTemplate = {
      ...resetTournamentData,
      teamsData: currentTeams // Keep existing teams
    };
    
    // Save the template
    await setDoc(doc(db, "leagues", leagueId, "bracketTemplate", "current"), userTemplate);
    
    // Update all user data
    const collectionPaths = [
      `leagues/${leagueId}/brackets`,
      `leagues/${leagueId}/userBrackets`,
      `leagues/${leagueId}/userData`
    ];
    
    let userUpdateCount = 0;
    
    for (const collectionPath of collectionPaths) {
      try {
        const snapshot = await getDocs(collection(db, collectionPath));
        
        if (!snapshot.empty) {
          // Process each user's data
          await Promise.all(snapshot.docs.map(async (docSnap) => {
            try {
              const userData = docSnap.data();
              
              // Create user reset data
              const userResetData = {
                ...userData,
                // Keep user metadata
                userId: userData.userId || docSnap.id,
                displayName: userData.displayName || userData.username || null,
                updatedAt: new Date().toISOString(),
                resetBy: auth.currentUser?.uid,
                // Keep teams data
                teamsData: currentTeams,
                allTeams: tournamentData.allTeams,
                // Reset tournament data
                [ROUND_KEYS.PLAY_IN]: resetTournamentData[ROUND_KEYS.PLAY_IN],
                [ROUND_KEYS.FIRST_ROUND]: resetTournamentData[ROUND_KEYS.FIRST_ROUND],
                [ROUND_KEYS.CONF_SEMIS]: resetTournamentData[ROUND_KEYS.CONF_SEMIS],
                [ROUND_KEYS.CONF_FINALS]: resetTournamentData[ROUND_KEYS.CONF_FINALS],
                [ROUND_KEYS.NBA_FINALS]: resetTournamentData[ROUND_KEYS.NBA_FINALS],
                [ROUND_KEYS.CHAMPION]: "",
                [ROUND_KEYS.FINALS_MVP]: ""
              };
              
              // Update this user's data
              await setDoc(doc(db, collectionPath, docSnap.id), userResetData);
              userUpdateCount++;
            } catch (userErr) {
              console.error(`Error updating user ${docSnap.id}:`, userErr);
            }
          }));
        }
      } catch (err) {
        console.error(`Error with collection ${collectionPath}:`, err);
      }
    }
    
    setFeedback(`All tournament results have been reset while preserving team data. Updated ${userUpdateCount} user brackets.`);
  } catch (err) {
    console.error("Error resetting tournament:", err);
    setFeedback(`Error resetting tournament: ${err.message}`);
  } finally {
    setIsUpdatingUsers(false);
  }
};
  
  // Helper function to create a standardized bracket template including Play-In
  const createStandardizedTemplate = (teams) => {
    // Generate first round matchups based on teams
    const initialMatchups = generateInitialPlayoffMatchups(teams);
    
    // Create the template with empty data
    const template = {
      // First round with current teams but no user predictions
      [ROUND_KEYS.FIRST_ROUND]: initialMatchups[ROUND_KEYS.FIRST_ROUND].map(matchup => ({
        team1: matchup.team1 || "",
        team1Seed: matchup.team1Seed || null,
        team2: matchup.team2 || "",
        team2Seed: matchup.team2Seed || null,
        winner: "", // No winner
        winnerSeed: null,
        predictedWinner: "",
        predictedWinnerSeed: null,
        predictedNumGames: null,
        conference: matchup.conference
      })),
      
      // Empty subsequent rounds
      [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({ 
        team1: "", 
        team1Seed: null, 
        team2: "", 
        team2Seed: null,
        winner: "", 
        winnerSeed: null,
        predictedWinner: "", 
        predictedWinnerSeed: null,
        predictedNumGames: null,
        conference: i < 2 ? 'East' : 'West'
      })),
      
      [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({ 
        team1: "", 
        team1Seed: null,
        team2: "", 
        team2Seed: null,
        winner: "", 
        winnerSeed: null,
        predictedWinner: "", 
        predictedWinnerSeed: null,
        predictedNumGames: null,
        conference: i === 0 ? 'East' : 'West'
      })),
      
      [ROUND_KEYS.NBA_FINALS]: { 
        team1: "", 
        team1Seed: null, 
        team1Conference: "East",
        team2: "", 
        team2Seed: null, 
        team2Conference: "West",
        winner: "", 
        winnerSeed: null, 
        winnerConference: "",
        predictedWinner: "", 
        predictedWinnerSeed: null,
        predictedWinnerConference: "",
        predictedNumGames: null,
        predictedMVP: ""
      },
      
      // Champion and MVP
      [ROUND_KEYS.CHAMPION]: "",
      ChampionSeed: null,
      [ROUND_KEYS.FINALS_MVP]: ""
    };
    
    // Add Play-In Tournament data if enabled
    if (tournamentData.playInTournamentEnabled) {
      template.playInTournamentEnabled = true;
      
      // Create empty Play-In structure
      template[ROUND_KEYS.PLAY_IN] = {
        east: {
          seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || { team: "", teamId: null, seed: 7 },
          eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || { team: "", teamId: null, seed: 8 },
          ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || { team: "", teamId: null, seed: 9 },
          tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || { team: "", teamId: null, seed: 10 },
          seventhEighthWinner: { team: "", seed: null },
          ninthTenthWinner: { team: "", seed: null },
          finalWinner: { team: "", seed: null },
          loserTeam: { team: "", seed: null },
          winnerTeam: { team: "", seed: null }
        },
        west: {
          seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || { team: "", teamId: null, seed: 7 },
          eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || { team: "", teamId: null, seed: 8 },
          ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || { team: "", teamId: null, seed: 9 },
          tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || { team: "", teamId: null, seed: 10 },
          seventhEighthWinner: { team: "", seed: null },
          ninthTenthWinner: { team: "", seed: null },
          finalWinner: { team: "", seed: null },
          loserTeam: { team: "", seed: null },
          winnerTeam: { team: "", seed: null }
        }
      };
    }
    
    return {
      ...template,
      teamsData: teams,
      resetByAdmin: true,
      resetAt: new Date().toISOString()
    };
  };
  
  // Reset all user brackets
  const handleResetAllUserBrackets = async () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.", true);
      return;
    }
    
    try {
      setIsUpdatingUsers(true);
      
      // Create standardized template with current teams
      const templateData = createStandardizedTemplate(teamsData);
      
      // Save the template for new users
      await setDoc(doc(db, "leagues", leagueId, "bracketTemplate", "current"), templateData);
      
      // Get all user brackets - try multiple potential locations
      const collectionPaths = [
        `leagues/${leagueId}/brackets`,
        `leagues/${leagueId}/userBrackets`,
        `leagues/${leagueId}/userData`
      ];
      
      let updatedCount = 0;
      let foundCollection = false;
      
      for (const collectionPath of collectionPaths) {
        try {
          const userBracketsSnap = await getDocs(collection(db, collectionPath));
          
          if (!userBracketsSnap.empty) {
            foundCollection = true;
            
            // Process each user bracket
            const updatePromises = userBracketsSnap.docs.map(async (docSnapshot) => {
              const bracketId = docSnapshot.id;
              
              // Skip current user (admin) if needed
              if (docSnapshot.data().userId === auth.currentUser?.uid && 
                  !window.confirm("Do you want to reset your own bracket too?")) {
                return;
              }
              
              // Update with reset template data and keep track of previous data
              const bracketData = docSnapshot.data();
              await setDoc(doc(db, collectionPath, bracketId), {
                ...templateData,
                userId: bracketData.userId, // Preserve the user ID
                previousData: bracketData, // Store previous data in case of need to recover
                updatedAt: new Date().toISOString(),
                updatedBy: auth.currentUser?.uid || 'admin'
              });
              
              updatedCount++;
            });
            
            await Promise.all(updatePromises);
            break; // Stop after finding a collection with data
          }
        } catch (err) {
          console.error(`Error with collection ${collectionPath}:`, err);
        }
      }
      
      if (!foundCollection) {
        setFeedback("No user brackets found to reset.");
      } else {
        setFeedback(`Successfully reset ${updatedCount} user brackets with current team data.`);
      }
    } catch (err) {
      console.error("Error resetting user brackets:", err);
      setFeedback(`Error resetting user brackets: ${err.message}`, true);
    } finally {
      setIsUpdatingUsers(false);
    }
  };
  
  // Update team names in all user brackets
  const handleUpdateAllUserBracketTeams = async () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.", true);
      return;
    }
    
    try {
      setIsUpdatingUsers(true);
      
      // Generate fresh first round matchups based on current teams
      const initialMatchups = generateInitialPlayoffMatchups(teamsData);
      const firstRoundMatchups = initialMatchups[ROUND_KEYS.FIRST_ROUND];
      
      // Try multiple collection paths
      const collectionPaths = [
        `leagues/${leagueId}/brackets`,
        `leagues/${leagueId}/userBrackets`,
        `leagues/${leagueId}/userData`
      ];
      
      let updatedCount = 0;
      let foundCollection = false;
      
      for (const collectionPath of collectionPaths) {
        try {
          const userBracketsSnap = await getDocs(collection(db, collectionPath));
          
          if (!userBracketsSnap.empty) {
            foundCollection = true;
            
            // Process each user bracket
            const updatePromises = userBracketsSnap.docs.map(async (docSnapshot) => {
              const bracketId = docSnapshot.id;
              const bracketData = docSnapshot.data();
              
              // Create updated bracket with current team names but preserve user's picks
              const updatedBracketData = { ...bracketData };
              
              // Update teamsData directly to ensure they match the current configuration
              updatedBracketData.teamsData = teamsData;
              
              // Update Play-In tournament teams if enabled while preserving user picks
              if (tournamentData.playInTournamentEnabled && bracketData[ROUND_KEYS.PLAY_IN]) {
                updatedBracketData[ROUND_KEYS.PLAY_IN] = {
                  ...bracketData[ROUND_KEYS.PLAY_IN],
                  east: {
                    ...bracketData[ROUND_KEYS.PLAY_IN].east,
                    seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed,
                    eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed,
                    ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed,
                    tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed
                  },
                  west: {
                    ...bracketData[ROUND_KEYS.PLAY_IN].west,
                    seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed,
                    eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed,
                    ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed,
                    tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed
                  }
                };
              }
              
              // Update first round with current team names but keep user's predictions
              if (Array.isArray(bracketData[ROUND_KEYS.FIRST_ROUND])) {
                updatedBracketData[ROUND_KEYS.FIRST_ROUND] = firstRoundMatchups.map((newMatchup, index) => {
                  // Get the user's existing matchup if available
                  const userMatchup = bracketData[ROUND_KEYS.FIRST_ROUND][index] || {};
                  
                  // Check if the user had picked a winner and if it's still one of the teams
                  let predictedWinner = "";
                  let predictedWinnerSeed = null;
                  
                  // If user had predicted a winner, check if it's still valid with the new teams
                  if (userMatchup.predictedWinner) {
                    // Check if the user's prediction is still one of the teams in the matchup
                    if (userMatchup.predictedWinner === newMatchup.team1 || userMatchup.predictedWinner === newMatchup.team2) {
                      predictedWinner = userMatchup.predictedWinner;
                      predictedWinnerSeed = userMatchup.predictedWinner === newMatchup.team1 
                        ? newMatchup.team1Seed 
                        : newMatchup.team2Seed;
                    }
                  }
                  
                  // Return updated matchup with new teams but preserving valid predictions
                  return {
                    team1: newMatchup.team1,
                    team1Seed: newMatchup.team1Seed,
                    team2: newMatchup.team2,
                    team2Seed: newMatchup.team2Seed,
                    winner: "", // Clear any actual results
                    winnerSeed: null,
                    predictedWinner: predictedWinner,
                    predictedWinnerSeed: predictedWinnerSeed,
                    predictedNumGames: userMatchup.predictedNumGames,
                    conference: newMatchup.conference
                  };
                });
              }
              
              // Update the user's data
              await setDoc(doc(db, collectionPath, bracketId), {
                ...updatedBracketData,
                teamsUpdatedAt: new Date().toISOString(),
                teamsUpdatedBy: auth.currentUser?.uid || 'admin'
              });
              
              updatedCount++;
            });
            
            await Promise.all(updatePromises);
            break; // Stop after finding a collection with data
          }
        } catch (err) {
          console.error(`Error with collection ${collectionPath}:`, err);
        }
      }
      
      if (!foundCollection) {
        setFeedback("No user brackets found to update.");
      } else {
        setFeedback(`Successfully updated team names in ${updatedCount} user brackets.`);
      }
    } catch (err) {
      console.error("Error updating user bracket teams:", err);
      setFeedback(`Error updating user bracket teams: ${err.message}`, true);
    } finally {
      setIsUpdatingUsers(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Advanced Settings</h2>
      
      <div className="bg-white border rounded-lg p-6 mb-4">
        <h3 className="text-lg font-semibold mb-3">Data Management</h3>
        <p className="text-gray-600 mb-4">
          Export data and perform advanced operations on the tournament. Use with caution.
        </p>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Export Complete Data</h4>
            <p className="text-sm text-gray-600 mb-4">
              Download the complete tournament data with all user brackets as a JSON file.
            </p>
            <button
              onClick={handleExportData}
              disabled={!tournamentData || isExporting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2 inline-block"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <FaDownload className="inline mr-2" /> Export All Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white border rounded-lg p-6 mb-4">
        <h3 className="text-lg font-semibold mb-3">User Bracket Management</h3>
        <p className="text-gray-600 mb-4">
          These options affect all user brackets in the league. Use with caution.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Update Team Names</h4>
            <p className="text-sm text-gray-600 mb-4">
              Update team names in all user brackets while preserving their predictions where possible.
            </p>
            <button
              onClick={handleUpdateAllUserBracketTeams}
              disabled={isArchived || isUpdatingUsers || !tournamentData}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUserCog className="inline mr-2" /> 
              {isUpdatingUsers ? "Updating..." : "Update All Brackets"}
            </button>
          </div>
          
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Reset User Brackets</h4>
            <p className="text-sm text-gray-600 mb-4">
              Reset all user brackets to a blank state with current teams.
            </p>
            <button
              onClick={handleResetAllUserBrackets}
              disabled={isArchived || isUpdatingUsers || !tournamentData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUsers className="inline mr-2" /> 
              {isUpdatingUsers ? "Resetting..." : "Reset All Brackets"}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Danger Zone</h3>
        <p className="text-red-600 mb-4">
          These actions cannot be undone. Use extreme caution.
        </p>
        
        <div className="border border-red-300 rounded-lg p-4 bg-red-50">
          <h4 className="font-semibold mb-2">Clear All Teams</h4>
          <p className="text-sm text-gray-600 mb-4">
            Remove all team names from all conferences. This will also reset the bracket and all user predictions.
          </p>
          <button
            onClick={handleClearAllTeams}
            disabled={isArchived || !tournamentData}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaTrash className="inline mr-2" /> Clear All Teams
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminAdvancedPanel;
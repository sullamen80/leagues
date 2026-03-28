// src/gameTypes/marchMadness/components/AdminSettingsPanels/AdminAdvancedPanel.js
import React, { useState } from 'react';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase';
import { FaDownload, FaRedo, FaTrash, FaUserCog, FaUsers } from 'react-icons/fa';

/**
 * Panel component for advanced tournament settings
 */
const AdminAdvancedPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  leagueId,
  generateInitialRoundOf64,
  getEmptyTeamsData
}) => {
  const [isUpdatingUsers, setIsUpdatingUsers] = useState(false);
  
  const { tournamentData, teamsData } = data || {};
  
  // Export tournament data as JSON
  const handleExportData = () => {
    if (!tournamentData) return;
    
    // Create a copy of the data to export
    const exportData = {
      ...tournamentData,
      exportedAt: new Date().toISOString(),
    };
    
    // Convert to JSON string with formatting for readability
    const jsonContent = JSON.stringify(exportData, null, 2);
    
    // Create and download the file
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tournament_data_${leagueId}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setFeedback("Tournament data exported successfully!");
  };

  // Handle reset bracket
  const handleResetBracket = () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to reset the entire bracket? This will clear all results. This cannot be undone.")) {
      return;
    }
    
    const updatedTournament = {
      ...tournamentData,
      RoundOf64: generateInitialRoundOf64(teamsData),
      RoundOf32: Array(16).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Sweet16: Array(8).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Elite8: Array(4).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      FinalFour: Array(2).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Championship: { 
        team1: "", team1Seed: null,
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null
      },
      Champion: "",
      ChampionSeed: null
    };
    
    onDataChange({
      ...data,
      tournamentData: updatedTournament
    });
    
    setFeedback("Bracket has been reset to initial state");
  };

  // Handle clear all teams
  const handleClearAllTeams = () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to clear all team names? This cannot be undone.")) {
      return;
    }
    
    const emptyTeams = getEmptyTeamsData();
    
    onDataChange({
      ...data,
      teamsData: emptyTeams,
      editMode: true
    });
    
    setFeedback("All team names have been cleared");
  };
  
  // Reset all user brackets
  const handleResetAllUserBrackets = async () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.", true);
      return;
    }
    
    try {
      setIsUpdatingUsers(true);
      
      // Generate fresh Round of 64 matchups based on current teams
      const freshRoundOf64 = generateInitialRoundOf64(teamsData);
      
      // Create a template with the current teams but no winners
      const templateData = {
        // Use the current teams configuration from the tournament data
        RoundOf64: freshRoundOf64.map(matchup => ({
          team1: matchup.team1 || "",
          team1Seed: matchup.team1Seed || null,
          team2: matchup.team2 || "",
          team2Seed: matchup.team2Seed || null,
          winner: "", // No winner
          winnerSeed: null
        })),
        // Empty arrays for other rounds
        RoundOf32: Array(16).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        Sweet16: Array(8).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        Elite8: Array(4).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        FinalFour: Array(2).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        Championship: { 
          team1: "", team1Seed: null,
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null
        },
        Champion: "",
        ChampionSeed: null,
        // Include the team data to ensure it's carried along
        SetTeams: teamsData, 
        resetByAdmin: true,
        resetAt: new Date().toISOString()
      };
      
      // Save the template for new users
      await setDoc(doc(db, "leagues", leagueId, "bracketTemplate", "current"), templateData);
      
      // Get all user brackets
      const userDataRef = collection(db, "leagues", leagueId, "userData");
      const userDataSnap = await getDocs(userDataRef);
      
      // Count for feedback message
      let updatedCount = 0;
      
      // Process each user bracket
      const updatePromises = userDataSnap.docs.map(async (docSnapshot) => {
        const userId = docSnapshot.id;
        
        // Skip current user (admin) if needed
        if (userId === auth.currentUser?.uid && !window.confirm("Do you want to reset your own bracket too?")) {
          return;
        }
        
        // Update with reset template data and keep track of previous data
        const userData = docSnapshot.data();
        await setDoc(doc(db, "leagues", leagueId, "userData", userId), {
          ...templateData,
          previousData: userData, // Store previous data in case of need to recover
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'admin'
        });
        
        updatedCount++;
      });
      
      await Promise.all(updatePromises);
      
      setFeedback(`Successfully reset ${updatedCount} user brackets with current team data.`);
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
      
      // Generate fresh Round of 64 matchups based on current teams
      const freshRoundOf64 = generateInitialRoundOf64(teamsData);
      
      // Get all user brackets
      const userDataRef = collection(db, "leagues", leagueId, "userData");
      const userDataSnap = await getDocs(userDataRef);
      
      // Count for feedback message
      let updatedCount = 0;
      
      // Process each user bracket
      const updatePromises = userDataSnap.docs.map(async (docSnapshot) => {
        const userId = docSnapshot.id;
        const userData = docSnapshot.data();
        
        // Create updated bracket with current team names but preserve user's picks
        const updatedUserData = { ...userData };
        
        // Update SetTeams directly to ensure they match the current configuration
        updatedUserData.SetTeams = teamsData;
        
        // Update RoundOf64 with current team names but keep user's winners
        if (Array.isArray(userData.RoundOf64)) {
          updatedUserData.RoundOf64 = freshRoundOf64.map((newMatchup, index) => {
            // Get the user's existing matchup if available
            const userMatchup = userData.RoundOf64[index] || {};
            
            // Check if the user had picked a winner and if it's still one of the teams
            let winner = "";
            let winnerSeed = null;
            
            // If user had picked a winner, check if it's still valid with the new teams
            if (userMatchup.winner) {
              // Check if the user's winner is still one of the teams in the matchup
              if (userMatchup.winner === newMatchup.team1 || userMatchup.winner === newMatchup.team2) {
                winner = userMatchup.winner;
                winnerSeed = userMatchup.winner === newMatchup.team1 ? newMatchup.team1Seed : newMatchup.team2Seed;
              }
            }
            
            // Return updated matchup with new teams but preserving valid winners
            return {
              team1: newMatchup.team1,
              team1Seed: newMatchup.team1Seed,
              team2: newMatchup.team2,
              team2Seed: newMatchup.team2Seed,
              winner: winner,
              winnerSeed: winnerSeed
            };
          });
          
          // When team names change significantly, we need to reset subsequent rounds
          updatedUserData.RoundOf32 = Array(16).fill().map(() => ({ 
            team1: "", team1Seed: null, 
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null 
          }));
          updatedUserData.Sweet16 = Array(8).fill().map(() => ({ 
            team1: "", team1Seed: null, 
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null 
          }));
          updatedUserData.Elite8 = Array(4).fill().map(() => ({ 
            team1: "", team1Seed: null, 
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null 
          }));
          updatedUserData.FinalFour = Array(2).fill().map(() => ({ 
            team1: "", team1Seed: null, 
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null 
          }));
          updatedUserData.Championship = { 
            team1: "", team1Seed: null,
            team2: "", team2Seed: null,
            winner: "", winnerSeed: null
          };
          updatedUserData.Champion = "";
          updatedUserData.ChampionSeed = null;
          
          // Now propagate winners through the bracket to set up Round of 32, etc.
          for (let i = 0; i < updatedUserData.RoundOf64.length; i++) {
            const matchup = updatedUserData.RoundOf64[i];
            if (matchup.winner) {
              // Update next rounds if there's a winner
              const nextRound = 'RoundOf32';
              const nextMatchupIndex = Math.floor(i / 2);
              const isFirstTeam = i % 2 === 0;
              
              // Ensure next matchup exists
              if (!updatedUserData[nextRound][nextMatchupIndex]) {
                updatedUserData[nextRound][nextMatchupIndex] = {
                  team1: '', team1Seed: null,
                  team2: '', team2Seed: null,
                  winner: '', winnerSeed: null
                };
              }
              
              // Update the appropriate team in the next matchup
              if (isFirstTeam) {
                updatedUserData[nextRound][nextMatchupIndex].team1 = matchup.winner;
                updatedUserData[nextRound][nextMatchupIndex].team1Seed = matchup.winnerSeed;
              } else {
                updatedUserData[nextRound][nextMatchupIndex].team2 = matchup.winner;
                updatedUserData[nextRound][nextMatchupIndex].team2Seed = matchup.winnerSeed;
              }
            }
          }
        }
        
        // Update the user's data
        await setDoc(doc(db, "leagues", leagueId, "userData", userId), {
          ...updatedUserData,
          teamsUpdatedAt: new Date().toISOString(),
          teamsUpdatedBy: auth.currentUser?.uid || 'admin'
        });
        
        updatedCount++;
      });
      
      await Promise.all(updatePromises);
      
      setFeedback(`Successfully updated team names in ${updatedCount} user brackets.`);
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
          These options allow you to export and import tournament data. Use with caution.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Export Data</h4>
            <p className="text-sm text-gray-600 mb-4">
              Download the complete tournament data as a JSON file.
            </p>
            <button
              onClick={handleExportData}
              disabled={!tournamentData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaDownload className="inline mr-2" /> Export JSON
            </button>
          </div>
          
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Reset Bracket</h4>
            <p className="text-sm text-gray-600 mb-4">
              Clear all results while keeping team configurations.
            </p>
            <button
              onClick={handleResetBracket}
              disabled={isArchived || !tournamentData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaRedo className="inline mr-2" /> Reset Bracket
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
              Update team names in all user brackets while preserving their selections where possible.
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
            Remove all team names from all regions. This will also reset the bracket.
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
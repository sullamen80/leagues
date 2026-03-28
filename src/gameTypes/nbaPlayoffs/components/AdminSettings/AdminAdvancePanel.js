import React, { useState } from 'react';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase';
import { FaDownload, FaUserCog, FaUsers, FaTrash } from 'react-icons/fa';
import { ROUND_KEYS } from '../../constants/playoffConstants';

const AdminAdvancedPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  leagueId,
  generateInitialPlayoffMatchups,
  getEmptyTeamsData,
}) => {
  const [isUpdatingUsers, setIsUpdatingUsers] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { tournamentData, teamsData } = data || {};

  // Export tournament data as JSON with user data
  const handleExportData = async () => {
    if (!tournamentData) return;

    if (isExporting) return;

    setIsExporting(true);
    setFeedback('Gathering data for export...');

    try {
      const exportData = {
        playoffs: tournamentData,
        users: {},
      };

      const possibleCollections = [
        `leagues/${leagueId}/userBrackets`,
        `leagues/${leagueId}/brackets`,
        `leagues/${leagueId}/userPicks`,
        `leagues/${leagueId}/userData`,
      ];

      let userDataCount = 0;
      let userDataFound = false;

      for (const collectionPath of possibleCollections) {
        try {
          setFeedback(`Checking for user data in ${collectionPath}...`);
          const snapshot = await getDocs(collection(db, collectionPath));

          if (!snapshot.empty) {
            snapshot.forEach(doc => {
              const data = doc.data();
              const userId = doc.id;

              if (hasPlayoffData(data)) {
                userDataCount++;
                exportData.users[userId] = exportData.users[userId] || {};
                exportData.users[userId].bracket = data;

                if (data.displayName) exportData.users[userId].displayName = data.displayName;
                if (data.score !== undefined) exportData.users[userId].score = data.score;
                if (data.lastUpdated) exportData.users[userId].lastUpdated = data.lastUpdated;
              }
            });

            if (userDataCount > 0) {
              setFeedback(`Found ${userDataCount} user data entries in ${collectionPath}`);
              userDataFound = true;
              break;
            }
          }
        } catch (err) {
          console.error(`Error checking collection ${collectionPath}:`, err);
        }
      }

      if (!userDataFound) {
        try {
          setFeedback('No user brackets found in standard locations. Fetching basic user data...');
          const userDataSnapshot = await getDocs(collection(db, 'leagues', leagueId, 'userData'));

          userDataSnapshot.forEach(doc => {
            const userId = doc.id;
            const userData = doc.data();
            exportData.users[userId] = exportData.users[userId] || {
              profile: {
                displayName: userData.displayName || 'Unknown User',
                joinedAt: userData.joinedAt || null,
              },
            };
          });
        } catch (err) {
          console.error('Error fetching basic user data:', err);
        }
      }

      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nbaPlayoffs-export-${leagueId}-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      setFeedback(
        Object.keys(exportData.users).length === 0
          ? 'Export complete, but no user data was found. Playoffs configuration was exported.'
          : `Export complete! Downloaded ${filename} with ${Object.keys(exportData.users).length} users.`
      );
    } catch (error) {
      console.error('Export error:', error);
      setFeedback(`Export failed: ${error.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const hasPlayoffData = (data) =>
    data &&
    (data[ROUND_KEYS.FIRST_ROUND] ||
      data[ROUND_KEYS.PLAY_IN] ||
      data[ROUND_KEYS.CONF_SEMIS] ||
      data[ROUND_KEYS.CONF_FINALS] ||
      data[ROUND_KEYS.NBA_FINALS] ||
      data.picks ||
      data.predictions ||
      data.bracket);

  // Shared utility to update all user brackets
  const updateAllUserBrackets = async (newTournamentData, teamsData, options = {}) => {
    const { preservePredictions = false, resetAll = false } = options;
    try {
      setFeedback('Updating all user brackets...');
      const userDataRef = collection(db, 'leagues', leagueId, 'userData');
      const userDataSnap = await getDocs(userDataRef);

      if (userDataSnap.empty) {
        setFeedback('No user brackets found to update.');
        return 0;
      }

      const updatePromises = userDataSnap.docs.map(async (docSnap) => {
        const userId = docSnap.id;
        const currentUserData = docSnap.data();

        // Start with current user data to preserve unrelated fields
        const updatedUserData = { ...currentUserData };

        if (resetAll) {
          // Reset everything, including PLAY_IN and bracket choices
          Object.assign(updatedUserData, newTournamentData, {
            teamsData,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser?.uid || 'admin'
          });
        } else {
          // Update specific fields, preserving existing predictions
          updatedUserData.teamsData = teamsData;
          updatedUserData.updatedAt = new Date().toISOString();
          updatedUserData.updatedBy = auth.currentUser?.uid || 'admin';

          // Update FirstRound with new team names, preserving valid predictions
          if (newTournamentData[ROUND_KEYS.FIRST_ROUND]) {
            updatedUserData[ROUND_KEYS.FIRST_ROUND] = newTournamentData[ROUND_KEYS.FIRST_ROUND].map((newMatchup, index) => {
              const oldMatchup = currentUserData[ROUND_KEYS.FIRST_ROUND]?.[index] || {};
              if (preservePredictions && oldMatchup.winner) {
                const winner = (oldMatchup.winner === newMatchup.team1 || oldMatchup.winner === newMatchup.team2) ? oldMatchup.winner : '';
                const winnerSeed = winner === newMatchup.team1 ? newMatchup.team1Seed : (winner === newMatchup.team2 ? newMatchup.team2Seed : null);
                return {
                  ...newMatchup,
                  winner,
                  winnerSeed,
                  numGames: winner ? oldMatchup.numGames || null : null
                };
              }
              return { ...newMatchup };
            });
          }

          // Update PLAY_IN with new team names, preserving valid choices
          if (newTournamentData[ROUND_KEYS.PLAY_IN] && currentUserData[ROUND_KEYS.PLAY_IN]) {
            updatedUserData[ROUND_KEYS.PLAY_IN] = {
              east: {
                ...newTournamentData[ROUND_KEYS.PLAY_IN].east,
                seventhSeed: newTournamentData[ROUND_KEYS.PLAY_IN].east.seventhSeed,
                eighthSeed: newTournamentData[ROUND_KEYS.PLAY_IN].east.eighthSeed,
                ninthSeed: newTournamentData[ROUND_KEYS.PLAY_IN].east.ninthSeed,
                tenthSeed: newTournamentData[ROUND_KEYS.PLAY_IN].east.tenthSeed,
                seventhEighthWinner: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].east.seventhEighthWinner.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].east.seventhEighthWinner
                  : newTournamentData[ROUND_KEYS.PLAY_IN].east.seventhEighthWinner,
                ninthTenthWinner: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].east.ninthTenthWinner.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].east.ninthTenthWinner
                  : newTournamentData[ROUND_KEYS.PLAY_IN].east.ninthTenthWinner,
                finalWinner: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].east.finalWinner.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].east.finalWinner
                  : newTournamentData[ROUND_KEYS.PLAY_IN].east.finalWinner,
                loserTeam: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].east.loserTeam.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].east.loserTeam
                  : newTournamentData[ROUND_KEYS.PLAY_IN].east.loserTeam,
                winnerTeam: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].east.winnerTeam.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].east.winnerTeam
                  : newTournamentData[ROUND_KEYS.PLAY_IN].east.winnerTeam,
              },
              west: {
                ...newTournamentData[ROUND_KEYS.PLAY_IN].west,
                seventhSeed: newTournamentData[ROUND_KEYS.PLAY_IN].west.seventhSeed,
                eighthSeed: newTournamentData[ROUND_KEYS.PLAY_IN].west.eighthSeed,
                ninthSeed: newTournamentData[ROUND_KEYS.PLAY_IN].west.ninthSeed,
                tenthSeed: newTournamentData[ROUND_KEYS.PLAY_IN].west.tenthSeed,
                seventhEighthWinner: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].west.seventhEighthWinner.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].west.seventhEighthWinner
                  : newTournamentData[ROUND_KEYS.PLAY_IN].west.seventhEighthWinner,
                ninthTenthWinner: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].west.ninthTenthWinner.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].west.ninthTenthWinner
                  : newTournamentData[ROUND_KEYS.PLAY_IN].west.ninthTenthWinner,
                finalWinner: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].west.finalWinner.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].west.finalWinner
                  : newTournamentData[ROUND_KEYS.PLAY_IN].west.finalWinner,
                loserTeam: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].west.loserTeam.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].west.loserTeam
                  : newTournamentData[ROUND_KEYS.PLAY_IN].west.loserTeam,
                winnerTeam: preservePredictions && currentUserData[ROUND_KEYS.PLAY_IN].west.winnerTeam.team
                  ? currentUserData[ROUND_KEYS.PLAY_IN].west.winnerTeam
                  : newTournamentData[ROUND_KEYS.PLAY_IN].west.winnerTeam,
              },
            };
          } else if (currentUserData[ROUND_KEYS.PLAY_IN]) {
            // Preserve existing PLAY_IN if not updated
            updatedUserData[ROUND_KEYS.PLAY_IN] = { ...currentUserData[ROUND_KEYS.PLAY_IN] };
          }
        }

        await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), updatedUserData);
      });

      await Promise.all(updatePromises);
      setFeedback(`Updated ${userDataSnap.size} user brackets.`);
      return userDataSnap.size;
    } catch (error) {
      console.error('Error updating user brackets:', error);
      setFeedback(`Failed to update user brackets: ${error.message}`);
      return 0;
    }
  };

  // Handle clear all tournament data while preserving teams
  const handleClearAllTeams = async () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to reset all tournament results and user brackets? Team names will be preserved, but all results and predictions will be cleared. This action CANNOT be undone.'
      )
    ) {
      return;
    }

    setIsUpdatingUsers(true);
    setFeedback('Clearing all tournament data while preserving teams...');

    try {
      const currentTeams = data.teamsData || getEmptyTeamsData();
      const resetTournamentData = {
        status: tournamentData.status || 'active',
        playInTournamentEnabled: tournamentData.playInTournamentEnabled || false,
        playInComplete: false,
        allTeams: tournamentData.allTeams,
        [ROUND_KEYS.PLAY_IN]: tournamentData.playInTournamentEnabled
          ? {
              east: {
                seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || { team: '', teamId: null, seed: 7 },
                eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || { team: '', teamId: null, seed: 8 },
                ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || { team: '', teamId: null, seed: 9 },
                tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || { team: '', teamId: null, seed: 10 },
                seventhEighthWinner: { team: '', seed: null },
                ninthTenthWinner: { team: '', seed: null },
                finalWinner: { team: '', seed: null },
                loserTeam: { team: '', seed: null },
                winnerTeam: { team: '', seed: null },
              },
              west: {
                seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || { team: '', teamId: null, seed: 7 },
                eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || { team: '', teamId: null, seed: 8 },
                ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || { team: '', teamId: null, seed: 9 },
                tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || { team: '', teamId: null, seed: 10 },
                seventhEighthWinner: { team: '', seed: null },
                ninthTenthWinner: { team: '', seed: null },
                finalWinner: { team: '', seed: null },
                loserTeam: { team: '', seed: null },
                winnerTeam: { team: '', seed: null },
              },
            }
          : null,
        [ROUND_KEYS.FIRST_ROUND]: Array(8).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i < 4 ? 'East' : 'West',
        })),
        [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i < 2 ? 'East' : 'West',
        })),
        [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i === 0 ? 'East' : 'West',
        })),
        [ROUND_KEYS.NBA_FINALS]: {
          team1: '',
          team1Seed: null,
          team1Conference: 'East',
          team2: '',
          team2Seed: null,
          team2Conference: 'West',
          winner: '',
          winnerSeed: null,
          winnerConference: '',
          numGames: null,
        },
        [ROUND_KEYS.CHAMPION]: '',
        [ROUND_KEYS.FINALS_MVP]: '',
        resetAt: new Date().toISOString(),
        resetBy: auth.currentUser?.uid || 'admin',
      };

      onDataChange({ ...data, teamsData: currentTeams, tournamentData: resetTournamentData, editMode: true });
      await setDoc(doc(db, 'leagues', leagueId, 'bracketTemplate', 'current'), { ...resetTournamentData, teamsData: currentTeams });

      const updatedCount = await updateAllUserBrackets(resetTournamentData, currentTeams, { resetAll: true });
      setFeedback(`All tournament results have been reset while preserving team data. Updated ${updatedCount} user brackets.`);
    } catch (err) {
      console.error('Error resetting tournament:', err);
      setFeedback(`Error resetting tournament: ${err.message}`);
    } finally {
      setIsUpdatingUsers(false);
    }
  };

  // Reset all user brackets
  const handleResetAllUserBrackets = async () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    setIsUpdatingUsers(true);
    try {
      const initialMatchups = generateInitialPlayoffMatchups(teamsData);
      const templateData = {
        [ROUND_KEYS.FIRST_ROUND]: initialMatchups[ROUND_KEYS.FIRST_ROUND],
        [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i < 2 ? 'East' : 'West',
        })),
        [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({
          team1: '',
          team1Seed: null,
          team2: '',
          team2Seed: null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: i === 0 ? 'East' : 'West',
        })),
        [ROUND_KEYS.NBA_FINALS]: {
          team1: '',
          team1Seed: null,
          team1Conference: 'East',
          team2: '',
          team2Seed: null,
          team2Conference: 'West',
          winner: '',
          winnerSeed: null,
          winnerConference: '',
          numGames: null,
          predictedMVP: '',
        },
        [ROUND_KEYS.CHAMPION]: '',
        ChampionSeed: null,
        [ROUND_KEYS.FINALS_MVP]: '',
        resetByAdmin: true,
        resetAt: new Date().toISOString(),
      };

      if (tournamentData.playInTournamentEnabled) {
        templateData.playInTournamentEnabled = true;
        templateData[ROUND_KEYS.PLAY_IN] = {
          east: {
            seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || { team: '', teamId: null, seed: 7 },
            eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || { team: '', teamId: null, seed: 8 },
            ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || { team: '', teamId: null, seed: 9 },
            tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || { team: '', teamId: null, seed: 10 },
            seventhEighthWinner: { team: '', seed: null },
            ninthTenthWinner: { team: '', seed: null },
            finalWinner: { team: '', seed: null },
            loserTeam: { team: '', seed: null },
            winnerTeam: { team: '', seed: null },
          },
          west: {
            seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || { team: '', teamId: null, seed: 7 },
            eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || { team: '', teamId: null, seed: 8 },
            ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || { team: '', teamId: null, seed: 9 },
            tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || { team: '', teamId: null, seed: 10 },
            seventhEighthWinner: { team: '', seed: null },
            ninthTenthWinner: { team: '', seed: null },
            finalWinner: { team: '', seed: null },
            loserTeam: { team: '', seed: null },
            winnerTeam: { team: '', seed: null },
          },
        };
      }

      await setDoc(doc(db, 'leagues', leagueId, 'bracketTemplate', 'current'), { ...templateData, teamsData });
      const updatedCount = await updateAllUserBrackets(templateData, teamsData, { resetAll: true });
      setFeedback(`Successfully reset ${updatedCount} user brackets with current team data.`);
    } catch (err) {
      console.error('Error resetting user brackets:', err);
      setFeedback(`Error resetting user brackets: ${err.message}`);
    } finally {
      setIsUpdatingUsers(false);
    }
  };

  // Update team names in all user brackets
  const handleUpdateAllUserBracketTeams = async () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    setIsUpdatingUsers(true);
    try {
      const initialMatchups = generateInitialPlayoffMatchups(teamsData);
      const updatedTournamentData = {
        [ROUND_KEYS.FIRST_ROUND]: initialMatchups[ROUND_KEYS.FIRST_ROUND],
      };

      if (tournamentData.playInTournamentEnabled) {
        updatedTournamentData[ROUND_KEYS.PLAY_IN] = {
          east: {
            seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || { team: '', teamId: null, seed: 7 },
            eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || { team: '', teamId: null, seed: 8 },
            ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || { team: '', teamId: null, seed: 9 },
            tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || { team: '', teamId: null, seed: 10 },
            seventhEighthWinner: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhEighthWinner || { team: '', seed: null },
            ninthTenthWinner: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthTenthWinner || { team: '', seed: null },
            finalWinner: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.finalWinner || { team: '', seed: null },
            loserTeam: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.loserTeam || { team: '', seed: null },
            winnerTeam: tournamentData[ROUND_KEYS.PLAY_IN]?.east?.winnerTeam || { team: '', seed: null },
          },
          west: {
            seventhSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || { team: '', teamId: null, seed: 7 },
            eighthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || { team: '', teamId: null, seed: 8 },
            ninthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || { team: '', teamId: null, seed: 9 },
            tenthSeed: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || { team: '', teamId: null, seed: 10 },
            seventhEighthWinner: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhEighthWinner || { team: '', seed: null },
            ninthTenthWinner: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthTenthWinner || { team: '', seed: null },
            finalWinner: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.finalWinner || { team: '', seed: null },
            loserTeam: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.loserTeam || { team: '', seed: null },
            winnerTeam: tournamentData[ROUND_KEYS.PLAY_IN]?.west?.winnerTeam || { team: '', seed: null },
          },
        };
      }

      const updatedCount = await updateAllUserBrackets(updatedTournamentData, teamsData, { preservePredictions: true });
      setFeedback(`Successfully updated team names in ${updatedCount} user brackets.`);
    } catch (err) {
      console.error('Error updating user bracket teams:', err);
      setFeedback(`Error updating user bracket teams: ${err.message}`);
    } finally {
      setIsUpdatingUsers(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Advanced Settings</h2>

      <div className="bg-white border rounded-lg p-6 mb-4">
        <h3 className="text-lg font-semibold mb-3">Data Management</h3>
        <p className="text-gray-600 mb-4">Export data and perform advanced operations on the tournament. Use with caution.</p>

        <div className="grid grid-cols-1 gap-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Export Complete Data</h4>
            <p className="text-sm text-gray-600 mb-4">Download the complete tournament data with all user brackets as a JSON file.</p>
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
        <p className="text-gray-600 mb-4">These options affect all user brackets in the league. Use with caution.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Update Team Names</h4>
            <p className="text-sm text-gray-600 mb-4">Update team names in all user brackets while preserving their predictions where possible.</p>
            <button
              onClick={handleUpdateAllUserBracketTeams}
              disabled={isArchived || isUpdatingUsers || !tournamentData}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUserCog className="inline mr-2" />
              {isUpdatingUsers ? 'Updating...' : 'Update All Brackets'}
            </button>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Reset User Brackets</h4>
            <p className="text-sm text-gray-600 mb-4">Reset all user brackets to a blank state with current teams.</p>
            <button
              onClick={handleResetAllUserBrackets}
              disabled={isArchived || isUpdatingUsers || !tournamentData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUsers className="inline mr-2" />
              {isUpdatingUsers ? 'Resetting...' : 'Reset All Brackets'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Danger Zone</h3>
        <p className="text-red-600 mb-4">These actions cannot be undone. Use extreme caution.</p>

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
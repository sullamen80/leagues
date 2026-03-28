import React, { useState } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase';
import { FaDownload, FaSync, FaTrash } from 'react-icons/fa';
import { ROUND_KEYS } from '../../constants/playoffConstants';

const buildBlankBracket = (generateInitialPlayoffMatchups, teamsData, fallbackTeams) => {
  const baseTeams = teamsData || fallbackTeams;
  const structure = generateInitialPlayoffMatchups(baseTeams);
  return {
    ...structure,
    teamsData: baseTeams,
    playoffTeams: structure.playoffTeams
  };
};

const AdminAdvancedPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  leagueId,
  generateInitialPlayoffMatchups,
  getEmptyTeamsData
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const tournamentData = data?.tournamentData || {};
  const teamsData = data?.teamsData || getEmptyTeamsData();

  const exportLeagueData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setFeedback('Preparing export...');

    try {
      const exportData = {
        playoffs: tournamentData,
        teamsData,
        users: {}
      };

      const userDataSnap = await getDocs(collection(db, 'leagues', leagueId, 'userData'));
      userDataSnap.forEach((docSnap) => {
        exportData.users[docSnap.id] = docSnap.data();
      });

      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nflPlayoffs-export-${leagueId}-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFeedback(`Export complete: ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      setFeedback(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const syncUserBrackets = async (options = {}) => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    const { resetPredictions = false } = options;
    const baseStructure = resetPredictions
      ? buildBlankBracket(generateInitialPlayoffMatchups, teamsData, getEmptyTeamsData())
      : tournamentData;

    if (!baseStructure[ROUND_KEYS.FIRST_ROUND]) {
      setFeedback('Tournament data is incomplete. Please configure teams first.');
      return;
    }

    setIsProcessing(true);
    setFeedback('Updating user brackets...');

    try {
      const userDataSnap = await getDocs(collection(db, 'leagues', leagueId, 'userData'));
      if (userDataSnap.empty) {
        setFeedback('No user brackets found.');
        setIsProcessing(false);
        return;
      }

      const updatePromises = userDataSnap.docs.map(async (docSnap) => {
        const userId = docSnap.id;
        const currentData = docSnap.data();
        const updated = {
          ...currentData,
          teamsData,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'admin'
        };

        updated[ROUND_KEYS.FIRST_ROUND] = baseStructure[ROUND_KEYS.FIRST_ROUND].map(
          (matchup, index) => {
            if (!resetPredictions) {
              const previous = currentData[ROUND_KEYS.FIRST_ROUND]?.[index];
              if (
                previous?.winner &&
                (previous.winner === matchup.team1 || previous.winner === matchup.team2)
              ) {
                return { ...matchup, winner: previous.winner, winnerSeed: previous.winnerSeed };
              }
            }
            return { ...matchup, winner: resetPredictions ? '' : matchup.winner || '', winnerSeed: resetPredictions ? null : matchup.winnerSeed ?? null };
          }
        );

        updated[ROUND_KEYS.CONF_SEMIS] = baseStructure[ROUND_KEYS.CONF_SEMIS];
        updated[ROUND_KEYS.CONF_FINALS] = baseStructure[ROUND_KEYS.CONF_FINALS];
        updated[ROUND_KEYS.SUPER_BOWL] = {
          ...baseStructure[ROUND_KEYS.SUPER_BOWL],
          winner: resetPredictions ? '' : baseStructure[ROUND_KEYS.SUPER_BOWL].winner || '',
          winnerSeed: resetPredictions ? null : baseStructure[ROUND_KEYS.SUPER_BOWL].winnerSeed ?? null
        };
        updated[ROUND_KEYS.CHAMPION] = resetPredictions ? '' : baseStructure[ROUND_KEYS.CHAMPION] || '';
        updated.ChampionSeed = resetPredictions ? null : baseStructure.ChampionSeed ?? null;
        updated[ROUND_KEYS.FINALS_MVP] = resetPredictions ? '' : baseStructure[ROUND_KEYS.FINALS_MVP] || '';

        await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), updated);
      });

      await Promise.all(updatePromises);
      setFeedback(`Updated ${userDataSnap.size} user brackets.`);
    } catch (error) {
      console.error('Error updating user brackets:', error);
      setFeedback(`Failed to update user brackets: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearResults = async () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    if (
      !window.confirm(
        'Reset official results and clear all user predictions? Teams will remain seeded, but every round will be reset.'
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setFeedback('Resetting bracket structure...');

    try {
      const blankStructure = buildBlankBracket(
        generateInitialPlayoffMatchups,
        teamsData,
        getEmptyTeamsData()
      );

      const gameDataRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
      await setDoc(
        gameDataRef,
        {
          ...(tournamentData || {}),
          ...blankStructure,
          teamsData,
          lastUpdated: new Date().toISOString()
        },
        { merge: true }
      );

      onDataChange({
        ...data,
        teamsData,
        tournamentData: {
          ...(tournamentData || {}),
          ...blankStructure
        }
      });

      await syncUserBrackets({ resetPredictions: true });
      setFeedback('Bracket results cleared for the league and all participants.');
    } catch (error) {
      console.error('Error resetting bracket:', error);
      setFeedback(`Failed to reset bracket: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2 flex items-center">
          <FaDownload className="mr-2 text-blue-600" /> Export League Data
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Download a JSON snapshot of the current NFL playoffs configuration and user brackets for
          auditing or backup purposes.
        </p>
        <button
          onClick={exportLeagueData}
          disabled={isExporting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isExporting ? 'Exporting...' : 'Export Playoffs Data'}
        </button>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2 flex items-center">
          <FaSync className="mr-2 text-green-600" /> Sync Official Results
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Push the current official bracket (including scores and winners) to every participant. Use
          the “Reset” option to clear predictions and start fresh while keeping teams seeded.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => syncUserBrackets({ resetPredictions: false })}
            disabled={isProcessing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {isProcessing ? 'Updating...' : 'Sync Official Results'}
          </button>
          <button
            onClick={() => syncUserBrackets({ resetPredictions: true })}
            disabled={isProcessing}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400"
          >
            {isProcessing ? 'Updating...' : 'Reset User Picks'}
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2 flex items-center">
          <FaTrash className="mr-2 text-red-600" /> Reset Bracket Results
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Clear every round (Wild Card through Super Bowl) for the league and all participants while
          keeping the seeded teams intact. This action cannot be undone.
        </p>
        <button
          onClick={handleClearResults}
          disabled={isProcessing}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          {isProcessing ? 'Resetting...' : 'Reset Bracket For Everyone'}
        </button>
      </div>
    </div>
  );
};

export default AdminAdvancedPanel;

import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft } from 'react-icons/fa';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

// Import panel components
import AdminTeamsPanel from './AdminSettings/AdminTeamsPanel';
import AdminBracketPanel from './AdminSettings/AdminBracketPanel';
import AdminPlayInPanel from './AdminSettings/AdminPlayInPanel';
import AdminAdvancedPanel from './AdminSettings/AdminAdvancePanel';

import BaseAdminSettings from '../../common/components/BaseAdminSettings';

/**
 * Component for NBA Playoffs tournament administration and settings
 * Extends the BaseAdminSettings component with NBA Playoffs-specific functionality
 */
const AdminSettings = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Custom back handler using URL parameters
  const handleBack = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.delete('subview');
    navigate(`${location.pathname.split('/').slice(0, 3).join('/')}?${searchParams.toString()}`, { replace: true });
  };

  // Initialize empty teams data
  const getEmptyTeamsData = () => ({
    eastConference: Array(8).fill().map((_, i) => ({ name: '', seed: i + 1, teamId: null, division: null, colors: null })),
    westConference: Array(8).fill().map((_, i) => ({ name: '', seed: i + 1, teamId: null, division: null, colors: null })),
    playInEast: Array(4).fill().map((_, i) => ({ name: '', seed: i + 9, teamId: null, division: null, colors: null })),
    playInWest: Array(4).fill().map((_, i) => ({ name: '', seed: i + 9, teamId: null, division: null, colors: null })),
  });

  // Generate initial first round playoff matchups (1v8, 2v7, etc.)
  const generateInitialPlayoffMatchups = (teams) => {
    const seedPairs = [
      [0, 7], // 1 vs 8
      [3, 4], // 4 vs 5
      [2, 5], // 3 vs 6
      [1, 6], // 2 vs 7
    ];

    const matchups = [
      ...seedPairs.map(([seedIdx1, seedIdx2]) => ({
        team1: teams.eastConference[seedIdx1].name,
        team1Seed: teams.eastConference[seedIdx1].seed,
        team2: teams.eastConference[seedIdx2].name,
        team2Seed: teams.eastConference[seedIdx2].seed,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: 'East',
      })),
      ...seedPairs.map(([seedIdx1, seedIdx2]) => ({
        team1: teams.westConference[seedIdx1].name,
        team1Seed: teams.westConference[seedIdx1].seed,
        team2: teams.westConference[seedIdx2].name,
        team2Seed: teams.westConference[seedIdx2].seed,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: 'West',
      })),
    ];

    const result = {};
    result[ROUND_KEYS.FIRST_ROUND] = matchups;
    return result;
  };

  // Create a bracket template for new users
  const createBracketTemplate = async (leagueId, tournamentData) => {
    try {
      const templateData = {
        [ROUND_KEYS.FIRST_ROUND]: (tournamentData[ROUND_KEYS.FIRST_ROUND] || []).map(matchup => ({
          team1: matchup.team1 || '',
          team1Seed: matchup.team1Seed || null,
          team2: matchup.team2 || '',
          team2Seed: matchup.team2Seed || null,
          winner: '',
          winnerSeed: null,
          numGames: null,
          conference: matchup.conference,
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
          predictedMVP: '',
        },
        [ROUND_KEYS.CHAMPION]: '',
        ChampionSeed: null,
        [ROUND_KEYS.FINALS_MVP]: '',
        createdAt: new Date().toISOString(),
        isTemplate: true,
        playInTournamentEnabled: tournamentData.playInTournamentEnabled || false,
        playInComplete: tournamentData.playInComplete || false,
        [ROUND_KEYS.PLAY_IN]: tournamentData[ROUND_KEYS.PLAY_IN] || null,
      };

      await setDoc(doc(db, 'leagues', leagueId, 'bracketTemplate', 'current'), templateData);
      return true;
    } catch (error) {
      console.error('Error creating bracket template:', error);
      throw error;
    }
  };

  // Fetch tournament data
  const fetchTournamentData = async (leagueId, userId, leagueData) => {
    const tournamentRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
    const tournamentSnap = await getDoc(tournamentRef);

    let tournamentData = null;
    let teamsData = getEmptyTeamsData();
    let editMode = false;

    if (tournamentSnap.exists()) {
      tournamentData = tournamentSnap.data();
      if (tournamentData.teamsData) {
        teamsData = tournamentData.teamsData;
      }
    }

    return {
      tournamentData,
      teamsData,
      editMode,
      isLeagueArchived: leagueData.status === 'archived',
    };
  };

  // Update all user brackets with new tournament data
  const updateAllUserBrackets = async (leagueId, newTournamentData, teamsData, setFeedback) => {
    try {
      setFeedback('Updating all user brackets...');

      const userDataRef = collection(db, 'leagues', leagueId, 'userData');
      const userDataSnap = await getDocs(userDataRef);

      if (userDataSnap.empty) {
        setFeedback('No user brackets found to update.');
        return;
      }

      const updatePromises = userDataSnap.docs.map(async (docSnap) => {
        const userId = docSnap.id;
        const currentUserData = docSnap.data();

        const updatedUserData = {
          ...currentUserData,
          ...newTournamentData,
          teamsData: teamsData,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'admin',
        };

        if (currentUserData[ROUND_KEYS.FIRST_ROUND] && newTournamentData[ROUND_KEYS.FIRST_ROUND]) {
          updatedUserData[ROUND_KEYS.FIRST_ROUND] = newTournamentData[ROUND_KEYS.FIRST_ROUND].map((newMatchup, index) => {
            const oldMatchup = currentUserData[ROUND_KEYS.FIRST_ROUND][index] || {};
            let winner = '';
            let winnerSeed = null;
            let numGames = null;

            if (oldMatchup.winner && (oldMatchup.winner === newMatchup.team1 || oldMatchup.winner === newMatchup.team2)) {
              winner = oldMatchup.winner;
              winnerSeed = oldMatchup.winner === newMatchup.team1 ? newMatchup.team1Seed : newMatchup.team2Seed;
              numGames = oldMatchup.numGames || null;
            }

            return {
              ...newMatchup,
              winner,
              winnerSeed,
              numGames,
            };
          });
        }

        updatedUserData[ROUND_KEYS.CONF_SEMIS] = newTournamentData[ROUND_KEYS.CONF_SEMIS];
        updatedUserData[ROUND_KEYS.CONF_FINALS] = newTournamentData[ROUND_KEYS.CONF_FINALS];
        updatedUserData[ROUND_KEYS.NBA_FINALS] = newTournamentData[ROUND_KEYS.NBA_FINALS];
        updatedUserData[ROUND_KEYS.CHAMPION] = '';
        updatedUserData.ChampionSeed = null;
        updatedUserData[ROUND_KEYS.FINALS_MVP] = currentUserData[ROUND_KEYS.FINALS_MVP] || '';

        if (newTournamentData[ROUND_KEYS.PLAY_IN] && currentUserData[ROUND_KEYS.PLAY_IN]) {
          updatedUserData[ROUND_KEYS.PLAY_IN] = {
            ...currentUserData[ROUND_KEYS.PLAY_IN],
            east: {
              ...currentUserData[ROUND_KEYS.PLAY_IN].east,
              seventhSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || currentUserData[ROUND_KEYS.PLAY_IN].east.seventhSeed,
              eighthSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || currentUserData[ROUND_KEYS.PLAY_IN].east.eighthSeed,
              ninthSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || currentUserData[ROUND_KEYS.PLAY_IN].east.ninthSeed,
              tenthSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || currentUserData[ROUND_KEYS.PLAY_IN].east.tenthSeed,
            },
            west: {
              ...currentUserData[ROUND_KEYS.PLAY_IN].west,
              seventhSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || currentUserData[ROUND_KEYS.PLAY_IN].west.seventhSeed,
              eighthSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || currentUserData[ROUND_KEYS.PLAY_IN].west.eighthSeed,
              ninthSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || currentUserData[ROUND_KEYS.PLAY_IN].west.ninthSeed,
              tenthSeed: newTournamentData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || currentUserData[ROUND_KEYS.PLAY_IN].west.tenthSeed,
            },
          };
        }

        await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), updatedUserData);
      });

      await Promise.all(updatePromises);
      setFeedback(`Successfully updated ${userDataSnap.size} user brackets.`);
    } catch (error) {
      console.error('Error updating user brackets:', error);
      setFeedback(`Failed to update user brackets: ${error.message}`);
    }
  };

  // Save tournament changes
  const saveTournamentData = async (data, leagueId, userId, setFeedback) => {
    const { tournamentData, teamsData, editMode } = data;

    const updatedTournament = {
      ...tournamentData,
      teamsData: teamsData,
    };

    if (editMode) {
      const bracketData = generateInitialPlayoffMatchups(teamsData);
      updatedTournament[ROUND_KEYS.FIRST_ROUND] = bracketData[ROUND_KEYS.FIRST_ROUND];
      updatedTournament[ROUND_KEYS.CONF_SEMIS] = Array(4).fill().map((_, i) => ({
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: i < 2 ? 'East' : 'West',
      }));
      updatedTournament[ROUND_KEYS.CONF_FINALS] = Array(2).fill().map((_, i) => ({
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: i === 0 ? 'East' : 'West',
      }));
      updatedTournament[ROUND_KEYS.NBA_FINALS] = {
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
      };
      updatedTournament[ROUND_KEYS.CHAMPION] = '';
      updatedTournament.ChampionSeed = null;
      updatedTournament[ROUND_KEYS.FINALS_MVP] = '';
    }

    if (updatedTournament.playInTournamentEnabled) {
      if (!updatedTournament[ROUND_KEYS.PLAY_IN]) {
        updatedTournament[ROUND_KEYS.PLAY_IN] = {
          east: {
            seventhEighthWinner: { team: '', seed: null },
            ninthTenthWinner: { team: '', seed: null },
            finalWinner: { team: '', seed: null },
            loserTeam: { team: '', seed: null },
            winnerTeam: { team: '', seed: null },
          },
          west: {
            seventhEighthWinner: { team: '', seed: null },
            ninthTenthWinner: { team: '', seed: null },
            finalWinner: { team: '', seed: null },
            loserTeam: { team: '', seed: null },
            winnerTeam: { team: '', seed: null },
          },
        };
      }
    } else {
      delete updatedTournament[ROUND_KEYS.PLAY_IN];
    }

    updatedTournament.lastUpdated = new Date().toISOString();

    // Save to Firestore gameData
    await setDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), updatedTournament);

    // Update bracket template
    await createBracketTemplate(leagueId, updatedTournament);

    // Update all user brackets if in edit mode (i.e., teams were changed)
    if (editMode) {
      await updateAllUserBrackets(leagueId, updatedTournament, teamsData, setFeedback);
    } else {
      setFeedback('Tournament data saved successfully.');
    }

    return updatedTournament;
  };

  // Define tabs for the settings interface
  const tabs = [
    {
      id: 'teams',
      title: 'Teams',
      panel: (
        <AdminTeamsPanel
          leagueId={leagueId} // Pass leagueId explicitly
          getEmptyTeamsData={getEmptyTeamsData}
        />
      ),
    },
    {
      id: 'bracket',
      title: 'Bracket',
      panel: <AdminBracketPanel generateInitialPlayoffMatchups={generateInitialPlayoffMatchups} />,
    },
    {
      id: 'play-in',
      title: 'Play-In',
      panel: <AdminPlayInPanel />,
    },
    {
      id: 'advanced',
      title: 'Advanced',
      panel: (
        <AdminAdvancedPanel
          generateInitialPlayoffMatchups={generateInitialPlayoffMatchups}
          getEmptyTeamsData={getEmptyTeamsData}
        />
      ),
    },
  ];

  // Handle the case where BaseAdminSettings might not be available
  if (!BaseAdminSettings) {
    console.error('BaseAdminSettings component not found');
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 p-4 rounded mb-6">
          <p className="font-bold">Notice</p>
          <p>The base admin settings component couldn't be loaded. Using standalone mode.</p>
        </div>
        <div>
          <p>Settings for NBA Playoffs will appear here.</p>
          <p>Please check your console for error details.</p>
        </div>
      </div>
    );
  }

  // If BaseAdminSettings is available, use it
  return (
    <BaseAdminSettings
      gameType="nbaPlayoffs"
      tabs={tabs}
      defaultTab="teams"
      fetchData={fetchTournamentData}
      saveChanges={saveTournamentData}
      canSave={(data) => !data?.isLeagueArchived}
      pageTitle="NBA Playoffs Settings"
      onBack={handleBack}
    />
  );
};

export default AdminSettings;
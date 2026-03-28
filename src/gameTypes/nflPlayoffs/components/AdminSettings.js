import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { ROUND_KEYS } from '../constants/playoffConstants';

// Import panel components
import AdminTeamsPanel from './AdminSettings/AdminTeamsPanel';
import AdminBracketPanel from './AdminSettings/AdminBracketPanel';
import AdminAdvancedPanel from './AdminSettings/AdminAdvancePanel';

import BaseAdminSettings from '../../common/components/BaseAdminSettings';
import { updateLeagueScores } from '../services/scoringService';

/**
 * Component for NFL Playoffs tournament administration and settings
 * Extends the BaseAdminSettings component with NFL Playoffs-specific functionality
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
    afcConference: Array(7)
      .fill()
      .map((_, i) => ({ name: '', seed: i + 1, teamId: null, division: null, colors: null })),
    nfcConference: Array(7)
      .fill()
      .map((_, i) => ({ name: '', seed: i + 1, teamId: null, division: null, colors: null }))
  });

  const createEmptyMatchup = (conference) => ({
    team1: '',
    team1Seed: null,
    team2: '',
    team2Seed: null,
    winner: '',
    winnerSeed: null,
    gamesPlayed: null,
    numGames: 1,
    conference
  });

  const getTeamBySeed = (teams, conferenceKey, seed) =>
    teams?.[conferenceKey]?.find((team) => team.seed === seed) || null;

  // Generate initial NFL Wild Card bracket (top seeds get bye)
  const generateInitialPlayoffMatchups = (teams) => {
    const wildcardPairs = [
      [2, 7],
      [3, 6],
      [4, 5]
    ];
    const matchups = [];

    const pushConferenceMatchups = (conferenceKey, conferenceLabel) => {
      wildcardPairs.forEach(([seed1, seed2]) => {
        const team1 = getTeamBySeed(teams, conferenceKey, seed1);
        const team2 = getTeamBySeed(teams, conferenceKey, seed2);
        matchups.push({
          team1: team1?.name || '',
          team1Seed: team1?.seed || seed1,
          team2: team2?.name || '',
          team2Seed: team2?.seed || seed2,
          winner: '',
          winnerSeed: null,
          gamesPlayed: null,
          numGames: 1,
          conference: conferenceLabel
        });
      });
    };

    pushConferenceMatchups('afcConference', 'AFC');
    pushConferenceMatchups('nfcConference', 'NFC');

    const topAFC = getTeamBySeed(teams, 'afcConference', 1);
    const topNFC = getTeamBySeed(teams, 'nfcConference', 1);

    const result = {};
    result[ROUND_KEYS.FIRST_ROUND] = matchups;
    result[ROUND_KEYS.CONF_SEMIS] = [
      {
        ...createEmptyMatchup('AFC'),
        team1: topAFC?.name || '',
        team1Seed: topAFC ? topAFC.seed : 1
      },
      createEmptyMatchup('AFC'),
      {
        ...createEmptyMatchup('NFC'),
        team1: topNFC?.name || '',
        team1Seed: topNFC ? topNFC.seed : 1
      },
      createEmptyMatchup('NFC')
    ];

    result[ROUND_KEYS.CONF_FINALS] = [
      createEmptyMatchup('AFC'),
      createEmptyMatchup('NFC')
    ];

    result[ROUND_KEYS.SUPER_BOWL] = {
      team1: '',
      team1Seed: null,
      team1Conference: 'AFC',
      team2: '',
      team2Seed: null,
      team2Conference: 'NFC',
      winner: '',
      winnerSeed: null,
      winnerConference: '',
      gamesPlayed: null,
      numGames: 1,
      predictedMVP: ''
    };
    result[ROUND_KEYS.CHAMPION] = '';
    result.ChampionSeed = null;
    result[ROUND_KEYS.FINALS_MVP] = '';

    return result;
  };

  // Create a bracket template for new users
  const createBracketTemplate = async (leagueId, tournamentData) => {
    try {
      const baseTeams = tournamentData?.teamsData || getEmptyTeamsData();
      const defaultStructure = generateInitialPlayoffMatchups(baseTeams);

      const templateData = {
        [ROUND_KEYS.FIRST_ROUND]: (tournamentData[ROUND_KEYS.FIRST_ROUND] || defaultStructure[ROUND_KEYS.FIRST_ROUND]).map(
          (matchup = {}) => ({
            team1: matchup.team1 || '',
            team1Seed: matchup.team1Seed || null,
            team2: matchup.team2 || '',
            team2Seed: matchup.team2Seed || null,
            winner: '',
            winnerSeed: null,
            gamesPlayed: null,
            numGames: 1,
            conference: matchup.conference || 'AFC'
          })
        ),
        [ROUND_KEYS.CONF_SEMIS]: (tournamentData[ROUND_KEYS.CONF_SEMIS] || defaultStructure[ROUND_KEYS.CONF_SEMIS]).map(
          (matchup = {}) => ({
            ...createEmptyMatchup(matchup.conference || 'AFC'),
            team1: matchup.team1 || '',
            team1Seed: matchup.team1Seed || null,
            team2: matchup.team2 || '',
            team2Seed: matchup.team2Seed || null
          })
        ),
        [ROUND_KEYS.CONF_FINALS]: (tournamentData[ROUND_KEYS.CONF_FINALS] || defaultStructure[ROUND_KEYS.CONF_FINALS]).map(
          (matchup = {}, index) => ({
            ...createEmptyMatchup(index === 0 ? 'AFC' : 'NFC'),
            team1: matchup.team1 || '',
            team1Seed: matchup.team1Seed || null,
            team2: matchup.team2 || '',
            team2Seed: matchup.team2Seed || null
          })
        ),
        [ROUND_KEYS.SUPER_BOWL]: {
          ...defaultStructure[ROUND_KEYS.SUPER_BOWL],
          ...tournamentData[ROUND_KEYS.SUPER_BOWL],
          winner: '',
          winnerSeed: null,
          winnerConference: '',
          predictedMVP: ''
        },
        [ROUND_KEYS.CHAMPION]: '',
        ChampionSeed: null,
        [ROUND_KEYS.FINALS_MVP]: '',
        createdAt: new Date().toISOString(),
        isTemplate: true
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
      leaguePrivacy: Boolean(leagueData.private)
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
        updatedUserData[ROUND_KEYS.SUPER_BOWL] = newTournamentData[ROUND_KEYS.SUPER_BOWL];
        updatedUserData[ROUND_KEYS.CHAMPION] = '';
        updatedUserData.ChampionSeed = null;
        updatedUserData[ROUND_KEYS.FINALS_MVP] = currentUserData[ROUND_KEYS.FINALS_MVP] || '';

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
    const leaguePrivacy = Boolean(data?.leaguePrivacy);

    const updatedTournament = {
      ...tournamentData,
      teamsData: teamsData,
    };

    if (editMode) {
      const bracketData = generateInitialPlayoffMatchups(teamsData);
      updatedTournament.playoffTeams = {
        afcConference: teamsData.afcConference.map((team) => ({
          seed: team.seed,
          teamId: team.teamId,
          name: team.name,
          eliminated: false
        })),
        nfcConference: teamsData.nfcConference.map((team) => ({
          seed: team.seed,
          teamId: team.teamId,
          name: team.name,
          eliminated: false
        }))
      };
      updatedTournament[ROUND_KEYS.FIRST_ROUND] = bracketData[ROUND_KEYS.FIRST_ROUND];
      updatedTournament[ROUND_KEYS.CONF_SEMIS] = bracketData[ROUND_KEYS.CONF_SEMIS];
      updatedTournament[ROUND_KEYS.CONF_FINALS] = bracketData[ROUND_KEYS.CONF_FINALS];
      updatedTournament[ROUND_KEYS.SUPER_BOWL] = bracketData[ROUND_KEYS.SUPER_BOWL];
      updatedTournament[ROUND_KEYS.CHAMPION] = '';
      updatedTournament.ChampionSeed = null;
      updatedTournament[ROUND_KEYS.FINALS_MVP] = '';
    }

    updatedTournament.lastUpdated = new Date().toISOString();

    // Save to Firestore gameData
    console.log('[AdminSettings] Saving tournament data', {
      leagueId,
      editMode,
      updatedAt: updatedTournament.lastUpdated
    });

    await setDoc(
      doc(db, 'leagues', leagueId),
      {
        private: leaguePrivacy,
        updatedAt: updatedTournament.lastUpdated
      },
      { merge: true }
    );

    await setDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), updatedTournament);

    // Update bracket template
    await createBracketTemplate(leagueId, updatedTournament);

    // Update all user brackets if in edit mode (i.e., teams were changed)
    if (editMode) {
      await updateAllUserBrackets(leagueId, updatedTournament, teamsData, setFeedback);
    }

    try {
      const result = await updateLeagueScores(leagueId);
      const scoreSummary = result.rankings?.map((score) => ({
        userId: score.userId,
        userName: score.userName,
        actualScore: score.score,
        predictedPoints: score.scorePredictionPoints,
        correctPicks: score.correctPicks,
        winnerPoints: score.basePoints,
        spreadPoints: score.spreadPoints,
        gameScores: score.gameScores
      }));
      console.log(
        '[AdminSettings] Scores after update (winners/spread/predictions + games)',
        scoreSummary
      );
      setFeedback('Tournament data saved and scores updated.');
    } catch (err) {
      console.error('Failed to update league scores:', err);
      setFeedback(`Tournament saved, but updating scores failed: ${err.message}`);
    }

    return updatedTournament;
  };

  // Define tabs for the settings interface
  const AdminAccessPanel = ({ data, onDataChange, isArchived }) => (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">League Privacy</h3>
            <p className="text-sm text-gray-600">
              Private leagues are invite-only and will not appear in Join League search results.
            </p>
          </div>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              disabled={isArchived}
              checked={Boolean(data?.leaguePrivacy)}
              onChange={(event) =>
                onDataChange({
                  ...data,
                  leaguePrivacy: event.target.checked
                })
              }
              className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Private</span>
          </label>
        </div>
      </div>
    </div>
  );

  const tabs = [
    {
      id: 'access',
      title: 'Access',
      panel: <AdminAccessPanel />
    },
    {
      id: 'teams',
      title: 'Teams',
      panel: (
        <AdminTeamsPanel
          leagueId={leagueId}
          getEmptyTeamsData={getEmptyTeamsData}
        />
      )
    },
    {
      id: 'bracket',
      title: 'Bracket',
      panel: <AdminBracketPanel />
    },
    {
      id: 'advanced',
      title: 'Advanced',
      panel: (
        <AdminAdvancedPanel
          leagueId={leagueId}
          generateInitialPlayoffMatchups={generateInitialPlayoffMatchups}
          getEmptyTeamsData={getEmptyTeamsData}
        />
      )
    }
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
          <p>Settings for NFL Playoffs will appear here.</p>
          <p>Please check your console for error details.</p>
        </div>
      </div>
    );
  }

  // If BaseAdminSettings is available, use it
  return (
    <BaseAdminSettings
      gameType="nflPlayoffs"
      tabs={tabs}
      defaultTab="teams"
      fetchData={fetchTournamentData}
      saveChanges={saveTournamentData}
      canSave={(data) => !data?.isLeagueArchived}
      pageTitle="NFL Playoffs Settings"
      onBack={handleBack}
    />
  );
};

export default AdminSettings;

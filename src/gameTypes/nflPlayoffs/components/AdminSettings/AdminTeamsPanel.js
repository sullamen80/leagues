import React, { useState, useEffect, useMemo } from 'react';
import { FaInfoCircle, FaTrash, FaChevronDown, FaCheck } from 'react-icons/fa';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase';
import { ROUND_KEYS } from '../../constants/playoffConstants';

const WILDCARD_PAIRINGS = [
  [2, 7],
  [3, 6],
  [4, 5]
];

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

const buildPlayoffTeamsPayload = (teams) => ({
  afcConference: teams.afcConference.map((team) => ({
    seed: team.seed,
    teamId: team.teamId,
    name: team.name,
    eliminated: false
  })),
  nfcConference: teams.nfcConference.map((team) => ({
    seed: team.seed,
    teamId: team.teamId,
    name: team.name,
    eliminated: false
  }))
});

const buildBracketStructure = (teams) => {
  const getTeamBySeed = (conference, seed) =>
    teams?.[conference]?.find((team) => team.seed === seed) || null;

  const wildcardMatchups = [];
  const pushConferenceMatchups = (conferenceKey, label) => {
    WILDCARD_PAIRINGS.forEach(([seed1, seed2]) => {
      const team1 = getTeamBySeed(conferenceKey, seed1);
      const team2 = getTeamBySeed(conferenceKey, seed2);
      wildcardMatchups.push({
        ...createEmptyMatchup(label),
        team1: team1?.name || '',
        team1Seed: seed1,
        team2: team2?.name || '',
        team2Seed: seed2
      });
    });
  };

  pushConferenceMatchups('afcConference', 'AFC');
  pushConferenceMatchups('nfcConference', 'NFC');

  const topAFC = getTeamBySeed('afcConference', 1);
  const topNFC = getTeamBySeed('nfcConference', 1);

  return {
    playoffTeams: buildPlayoffTeamsPayload(teams),
    [ROUND_KEYS.FIRST_ROUND]: wildcardMatchups,
    [ROUND_KEYS.CONF_SEMIS]: [
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
    ],
    [ROUND_KEYS.CONF_FINALS]: [createEmptyMatchup('AFC'), createEmptyMatchup('NFC')],
    [ROUND_KEYS.SUPER_BOWL]: {
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
    },
    [ROUND_KEYS.CHAMPION]: '',
    ChampionSeed: null,
    [ROUND_KEYS.FINALS_MVP]: ''
  };
};

/**
 * Panel component for managing NFL Playoff teams
 */
const AdminTeamsPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  getEmptyTeamsData,
  leagueId
}) => {
  const [teams, setTeams] = useState(() => data?.teamsData || getEmptyTeamsData());
  const [allTeams, setAllTeams] = useState(data?.tournamentData?.allTeams || {});
  const [generatingMatchups, setGeneratingMatchups] = useState(false);

  useEffect(() => {
    if (data?.teamsData) {
      setTeams({
        afcConference: data.teamsData.afcConference || getEmptyTeamsData().afcConference,
        nfcConference: data.teamsData.nfcConference || getEmptyTeamsData().nfcConference
      });
    }
    if (data?.tournamentData) {
      setAllTeams(data.tournamentData.allTeams || {});
    }
  }, [data, getEmptyTeamsData]);

  const flattenedTeams = useMemo(() => {
    const processConference = (confKey, label) => {
      const teamsList = [];
      if (allTeams?.[confKey]) {
        Object.keys(allTeams[confKey]).forEach((division) => {
          const divisionTeams = allTeams[confKey][division];
          if (Array.isArray(divisionTeams)) {
            divisionTeams.forEach((team) =>
              teamsList.push({ ...team, division, conference: label })
            );
          }
        });
      }
      return teamsList.sort((a, b) => a.name.localeCompare(b.name));
    };

    return {
      afc: processConference('afcConference', 'AFC'),
      nfc: processConference('nfcConference', 'NFC')
    };
  }, [allTeams]);

  const getSelectedTeamIds = () => {
    const ids = new Set();
    teams.afcConference.forEach((team) => {
      if (team.teamId) ids.add(team.teamId);
    });
    teams.nfcConference.forEach((team) => {
      if (team.teamId) ids.add(team.teamId);
    });
    return ids;
  };

  const getAvailableTeams = (conference) => {
    const selected = getSelectedTeamIds();
    if (conference === 'afc') {
      return flattenedTeams.afc.filter((team) => !selected.has(team.id));
    }
    return flattenedTeams.nfc.filter((team) => !selected.has(team.id));
  };

  const handleTeamChange = (conference, index, teamId) => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    const updated = { ...teams };
    const conferenceKey = conference === 'afcConference' ? 'afc' : 'nfc';
    const available = flattenedTeams[conferenceKey];
    const selectedTeam = available.find((team) => team.id === teamId);

    if (selectedTeam) {
      updated[conference][index] = {
        ...updated[conference][index],
        name: selectedTeam.name,
        teamId: selectedTeam.id,
        division: selectedTeam.division,
        colors: selectedTeam.colors
      };
    } else {
      updated[conference][index] = {
        ...updated[conference][index],
        name: '',
        teamId: null,
        division: null,
        colors: null
      };
    }

    setTeams(updated);
    onDataChange({
      ...data,
      teamsData: updated,
      editMode: true
    });
  };

  const updateAllUserBrackets = async (league, newTournamentData, teamsDataState) => {
    try {
      setFeedback('Updating all user brackets...');
      const userDataRef = collection(db, 'leagues', league, 'userData');
      const userDataSnap = await getDocs(userDataRef);

      if (userDataSnap.empty) {
        setFeedback('No user brackets found to update.');
        return;
      }

      const promises = userDataSnap.docs.map(async (docSnap) => {
        const userId = docSnap.id;
        const currentUserData = docSnap.data();
        const updatedUserData = {
          ...currentUserData,
          ...newTournamentData,
          teamsData: teamsDataState,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'admin'
        };

        if (currentUserData[ROUND_KEYS.FIRST_ROUND] && newTournamentData[ROUND_KEYS.FIRST_ROUND]) {
          updatedUserData[ROUND_KEYS.FIRST_ROUND] = newTournamentData[ROUND_KEYS.FIRST_ROUND].map(
            (newMatchup, index) => {
              const oldMatchup = currentUserData[ROUND_KEYS.FIRST_ROUND][index] || {};
              let winner = '';
              let winnerSeed = null;

              if (
                oldMatchup.winner &&
                (oldMatchup.winner === newMatchup.team1 || oldMatchup.winner === newMatchup.team2)
              ) {
                winner = oldMatchup.winner;
                winnerSeed =
                  oldMatchup.winner === newMatchup.team1
                    ? newMatchup.team1Seed
                    : newMatchup.team2Seed;
              }

              return {
                ...newMatchup,
                winner,
                winnerSeed
              };
            }
          );
        }

        updatedUserData[ROUND_KEYS.CONF_SEMIS] = newTournamentData[ROUND_KEYS.CONF_SEMIS];
        updatedUserData[ROUND_KEYS.CONF_FINALS] = newTournamentData[ROUND_KEYS.CONF_FINALS];
        updatedUserData[ROUND_KEYS.SUPER_BOWL] = newTournamentData[ROUND_KEYS.SUPER_BOWL];
        updatedUserData[ROUND_KEYS.CHAMPION] = '';
        updatedUserData.ChampionSeed = null;
        updatedUserData[ROUND_KEYS.FINALS_MVP] = currentUserData[ROUND_KEYS.FINALS_MVP] || '';

        await setDoc(doc(db, 'leagues', league, 'userData', userId), updatedUserData);
      });

      await Promise.all(promises);
      setFeedback(`Successfully updated ${userDataSnap.size} user brackets.`);
    } catch (error) {
      console.error('Error updating user brackets:', error);
      setFeedback(`Failed to update user brackets: ${error.message}`);
    }
  };

  const handleGenerateMatchups = async () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    setGeneratingMatchups(true);

    try {
      const updatedTournamentData = buildBracketStructure(teams);
      const payload = {
        ...data,
        teamsData: teams,
        tournamentData: {
          ...(data?.tournamentData || {}),
          ...updatedTournamentData,
          playoffTeams: updatedTournamentData.playoffTeams,
          lastUpdated: new Date().toISOString()
        },
        editMode: true
      };

      onDataChange(payload);
      await updateAllUserBrackets(leagueId, updatedTournamentData, teams);

      setFeedback(
        'Playoff matchups generated and all user brackets updated successfully. Go to the Bracket tab to see the results.'
      );
    } catch (error) {
      console.error('Error generating matchups or updating brackets:', error);
      setFeedback('Error generating matchups or updating user brackets. Please try again.');
    } finally {
      setGeneratingMatchups(false);
    }
  };

  const handleClearAllTeams = () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    if (!window.confirm('Are you sure you want to clear all team names? This cannot be undone.')) {
      return;
    }

    const emptyTeams = getEmptyTeamsData();
    setTeams(emptyTeams);

    const emptyStructure = buildBracketStructure(emptyTeams);
    const tournamentData = {
      ...(data?.tournamentData || {}),
      ...emptyStructure
    };
    tournamentData[ROUND_KEYS.CHAMPION] = '';
    tournamentData.ChampionSeed = null;
    tournamentData[ROUND_KEYS.FINALS_MVP] = '';

    onDataChange({
      ...data,
      teamsData: emptyTeams,
      tournamentData,
      editMode: true
    });

    setFeedback('All teams have been cleared.');
  };

  const conferenceSections = [
    { key: 'afcConference', label: 'AFC', dropdownKey: 'afc' },
    { key: 'nfcConference', label: 'NFC', dropdownKey: 'nfc' }
  ];

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Playoff Teams</h2>
        <div className="flex gap-2">
          <button
            onClick={handleClearAllTeams}
            disabled={isArchived}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All Teams
          </button>
          <button
            onClick={handleGenerateMatchups}
            disabled={isArchived || generatingMatchups}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingMatchups ? 'Generating...' : 'Generate Matchups'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4 flex items-start">
        <FaInfoCircle className="mr-3 mt-1" />
        <div>
          <p className="font-bold">How it works:</p>
          <ul className="list-disc list-inside text-sm space-y-1 mt-1">
            <li>Select the seven AFC and seven NFC teams along with their seeds.</li>
            <li>Wild Card matchups will auto-generate (2v7, 3v6, 4v5 per conference).</li>
            <li>#1 seeds receive a bye and are slotted into the Divisional Round.</li>
            <li>Click “Generate Matchups” to push the bracket to every user in the league.</li>
          </ul>
        </div>
      </div>

      {conferenceSections.map(({ key, label, dropdownKey }) => (
        <div key={key} className="mb-6 border rounded-lg">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center">
              <FaChevronDown className="text-gray-400 mr-2" />
              <h3 className="font-semibold text-lg">{label} Seeds</h3>
            </div>
            <span className="text-sm text-gray-600">
              {teams[key].filter((team) => team.teamId).length}/7 teams selected
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams[key].map((team, index) => (
              <div key={`${key}-${team.seed}`} className="border rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-sm text-gray-500">Seed {team.seed}</p>
                    <p className="font-semibold">{team.name || 'Select team'}</p>
                  </div>
                  {team.teamId && <FaCheck className="text-green-500" />}
                </div>

                <div className="mt-2">
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={team.teamId || ''}
                    onChange={(e) => handleTeamChange(key, index, e.target.value || null)}
                    disabled={isArchived}
                  >
                    <option value="">Select team</option>
                    {getAvailableTeams(dropdownKey)
                      .concat(
                        team.teamId
                          ? flattenedTeams[dropdownKey].filter((t) => t.id === team.teamId)
                          : []
                      )
                      .map((teamOption) => (
                        <option key={teamOption.id} value={teamOption.id}>
                          {teamOption.name} ({teamOption.division})
                        </option>
                      ))}
                  </select>
                </div>

                {team.teamId && (
                  <button
                    onClick={() => handleTeamChange(key, index, null)}
                    className="mt-2 text-sm text-red-600 flex items-center"
                    disabled={isArchived}
                  >
                    <FaTrash className="mr-1" /> Remove team
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminTeamsPanel;

import React, { useState, useEffect, useMemo } from 'react';
import { FaInfoCircle, FaTrash, FaChevronDown, FaCheck } from 'react-icons/fa';
import { ROUND_KEYS } from '../../constants/playoffConstants';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase'; // Adjust path as needed

/**
 * Panel component for managing NBA Playoff teams
 * Simplified version without Play-In Tournament
 */
const AdminTeamsPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  getEmptyTeamsData,
  leagueId, // Added leagueId prop
}) => {
  const [teams, setTeams] = useState(() => {
    const initialTeams = data?.teamsData || getEmptyTeamsData();
    return {
      eastConference: initialTeams.eastConference || Array(8).fill().map((_, i) => ({ seed: i + 1, name: '', teamId: null, division: null, colors: null })),
      westConference: initialTeams.westConference || Array(8).fill().map((_, i) => ({ seed: i + 1, name: '', teamId: null, division: null, colors: null })),
    };
  });
  const [allTeams, setAllTeams] = useState(data?.tournamentData?.allTeams || {});
  const [generatingMatchups, setGeneratingMatchups] = useState(false);

  // Process all NBA teams into flattened arrays for dropdowns
  const flattenedTeams = useMemo(() => {
    const eastTeams = [];
    const westTeams = [];

    if (allTeams.eastConference) {
      Object.keys(allTeams.eastConference).forEach(division => {
        if (Array.isArray(allTeams.eastConference[division])) {
          allTeams.eastConference[division].forEach(team => {
            eastTeams.push({ ...team, division, conference: 'East' });
          });
        }
      });
    }

    if (allTeams.westConference) {
      Object.keys(allTeams.westConference).forEach(division => {
        if (Array.isArray(allTeams.westConference[division])) {
          allTeams.westConference[division].forEach(team => {
            westTeams.push({ ...team, division, conference: 'West' });
          });
        }
      });
    }

    return {
      east: eastTeams.sort((a, b) => a.name.localeCompare(b.name)),
      west: westTeams.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [allTeams]);

  // Update teams only if local state is empty and data provides new teams
  useEffect(() => {
    if (!teams.eastConference.length && !teams.westConference.length && data?.teamsData) {
      console.log('Initializing teams from data:', data.teamsData);
      setTeams({
        eastConference: data.teamsData.eastConference || Array(8).fill().map((_, i) => ({ seed: i + 1, name: '', teamId: null, division: null, colors: null })),
        westConference: data.teamsData.westConference || Array(8).fill().map((_, i) => ({ seed: i + 1, name: '', teamId: null, division: null, colors: null })),
      });
    }
    if (data?.tournamentData) {
      setAllTeams(data.tournamentData.allTeams || {});
    }
  }, [data, getEmptyTeamsData]);

  // Get all currently selected team IDs
  const getSelectedTeamIds = () => {
    const selectedIds = new Set();
    teams.eastConference.forEach(team => {
      if (team.teamId) selectedIds.add(team.teamId);
    });
    teams.westConference.forEach(team => {
      if (team.teamId) selectedIds.add(team.teamId);
    });
    return selectedIds;
  };

  // Get available teams for a specific conference
  const getAvailableTeams = (conference) => {
    const selectedIds = getSelectedTeamIds();
    return conference === 'east'
      ? flattenedTeams.east.filter(team => !selectedIds.has(team.id))
      : flattenedTeams.west.filter(team => !selectedIds.has(team.id));
  };

  // Create bracket matchups from team selections
  const generateMatchups = (updatedTeams) => {
    const tournamentData = { ...(data?.tournamentData || {}) };

    const teamIdToNameMap = {};
    updatedTeams.eastConference.forEach(team => {
      if (team.teamId && team.name) teamIdToNameMap[team.teamId] = team.name;
    });
    updatedTeams.westConference.forEach(team => {
      if (team.teamId && team.name) teamIdToNameMap[team.teamId] = team.name;
    });

    tournamentData[ROUND_KEYS.FIRST_ROUND] = [];

    const eastMatchups = [[1, 8], [4, 5], [3, 6], [2, 7]];
    eastMatchups.forEach(([seed1, seed2]) => {
      const team1 = updatedTeams.eastConference.find(t => t.seed === seed1);
      const team2 = updatedTeams.eastConference.find(t => t.seed === seed2);

      tournamentData[ROUND_KEYS.FIRST_ROUND].push({
        team1: team1?.teamId ? teamIdToNameMap[team1.teamId] : '',
        team1Seed: seed1,
        team2: team2?.teamId ? teamIdToNameMap[team2.teamId] : '',
        team2Seed: seed2,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: 'East',
      });
    });

    const westMatchups = [[1, 8], [4, 5], [3, 6], [2, 7]];
    westMatchups.forEach(([seed1, seed2]) => {
      const team1 = updatedTeams.westConference.find(t => t.seed === seed1);
      const team2 = updatedTeams.westConference.find(t => t.seed === seed2);

      tournamentData[ROUND_KEYS.FIRST_ROUND].push({
        team1: team1?.teamId ? teamIdToNameMap[team1.teamId] : '',
        team1Seed: seed1,
        team2: team2?.teamId ? teamIdToNameMap[team2.teamId] : '',
        team2Seed: seed2,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: 'West',
      });
    });

    tournamentData[ROUND_KEYS.CONF_SEMIS] = Array(4).fill().map((_, i) => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null,
      numGames: null,
      conference: i < 2 ? 'East' : 'West',
    }));

    tournamentData[ROUND_KEYS.CONF_FINALS] = Array(2).fill().map((_, i) => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null,
      numGames: null,
      conference: i === 0 ? 'East' : 'West',
    }));

    tournamentData[ROUND_KEYS.NBA_FINALS] = {
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

    tournamentData[ROUND_KEYS.CHAMPION] = '';
    tournamentData.ChampionSeed = null;
    tournamentData[ROUND_KEYS.FINALS_MVP] = '';

    tournamentData.lastUpdated = new Date().toISOString();

    return tournamentData;
  };

  // Handle team selection
  const handleTeamChange = (conference, index, teamId) => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    const updatedTeams = { ...teams };
    const teamConference = conference === 'eastConference' ? 'east' : 'west';
    const teamsList = flattenedTeams[teamConference];
    const selectedTeam = teamsList.find(team => team.id === teamId);

    if (selectedTeam) {
      updatedTeams[conference][index] = {
        ...updatedTeams[conference][index],
        seed: updatedTeams[conference][index].seed,
        name: selectedTeam.name,
        teamId: selectedTeam.id,
        division: selectedTeam.division,
        colors: selectedTeam.colors,
      };
    } else {
      updatedTeams[conference][index] = {
        ...updatedTeams[conference][index],
        seed: updatedTeams[conference][index].seed,
        name: '',
        teamId: null,
        division: null,
        colors: null,
      };
    }

    console.log('Updated teams after change:', updatedTeams);
    setTeams(updatedTeams);
    onDataChange({
      ...data,
      teamsData: updatedTeams,
      editMode: true,
    });
  };

  // Update all user brackets with new tournament data
  const updateAllUserBrackets = async (leagueId, newTournamentData, teamsData) => {
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

  // Generate bracket matchups from team selections
  const handleGenerateMatchups = async () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    console.log('Generating matchups with teams:', teams);
    setGeneratingMatchups(true);

    try {
      const updatedTournamentData = generateMatchups(teams);
      console.log('Generated tournamentData:', updatedTournamentData);

      onDataChange({
        ...data,
        teamsData: teams,
        tournamentData: updatedTournamentData,
        editMode: true,
      });

      await updateAllUserBrackets(leagueId, updatedTournamentData, teams);

      setFeedback('Playoff matchups generated and all user brackets updated successfully. Go to the Bracket tab to see the results.');
    } catch (error) {
      console.error('Error generating matchups or updating brackets:', error);
      setFeedback('Error generating matchups or updating user brackets. Please try again.');
    } finally {
      setGeneratingMatchups(false);
    }
  };

  // Handle clearing all teams
  const handleClearAllTeams = () => {
    if (isArchived) {
      setFeedback('This league is archived and cannot be edited.');
      return;
    }

    if (!window.confirm('Are you sure you want to clear all team names? This cannot be undone.')) {
      return;
    }

    const emptyTeams = {
      eastConference: Array(8).fill().map((_, i) => ({ seed: i + 1, name: '', teamId: null, division: null, colors: null })),
      westConference: Array(8).fill().map((_, i) => ({ seed: i + 1, name: '', teamId: null, division: null, colors: null })),
    };
    console.log('Empty teams after clear:', emptyTeams);
    setTeams(emptyTeams);

    const tournamentData = { ...(data?.tournamentData || {}) };

    if (Array.isArray(tournamentData[ROUND_KEYS.FIRST_ROUND])) {
      tournamentData[ROUND_KEYS.FIRST_ROUND] = tournamentData[ROUND_KEYS.FIRST_ROUND].map(match => ({
        ...match,
        team1: '',
        team2: '',
        winner: '',
        winnerSeed: null,
      }));
    } else {
      tournamentData[ROUND_KEYS.FIRST_ROUND] = Array(8).fill().map((_, i) => ({
        team1: '',
        team1Seed: null,
        team2: '',
        team2Seed: null,
        winner: '',
        winnerSeed: null,
        numGames: null,
        conference: i < 4 ? 'East' : 'West',
      }));
    }

    tournamentData[ROUND_KEYS.CONF_SEMIS] = Array(4).fill().map((_, i) => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null,
      numGames: null,
      conference: i < 2 ? 'East' : 'West',
    }));

    tournamentData[ROUND_KEYS.CONF_FINALS] = Array(2).fill().map((_, i) => ({
      team1: '',
      team1Seed: null,
      team2: '',
      team2Seed: null,
      winner: '',
      winnerSeed: null,
      numGames: null,
      conference: i === 0 ? 'East' : 'West',
    }));

    tournamentData[ROUND_KEYS.NBA_FINALS] = {
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

    tournamentData[ROUND_KEYS.CHAMPION] = '';
    tournamentData.ChampionSeed = null;
    tournamentData[ROUND_KEYS.FINALS_MVP] = '';

    tournamentData.lastUpdated = new Date().toISOString();

    onDataChange({
      ...data,
      teamsData: emptyTeams,
      tournamentData: tournamentData,
      editMode: true,
    });

    setFeedback('All team names have been cleared');
  };

  // CSS class for styled dropdown
  const dropdownClass = 'flex-1 block w-full p-2 pr-8 border border-gray-300 rounded shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 appearance-none bg-white';

  // Get available teams for each conference
  const availableEastTeams = getAvailableTeams('east');
  const availableWestTeams = getAvailableTeams('west');

  // Count selected teams
  const eastTeamsSelected = teams.eastConference.filter(t => t.teamId).length || 0;
  const westTeamsSelected = teams.westConference.filter(t => t.teamId).length || 0;
  const totalTeamsSelected = eastTeamsSelected + westTeamsSelected;
  const teamsComplete = eastTeamsSelected === 8 && westTeamsSelected === 8;

  console.log('Current teams state:', teams);
  console.log('Teams complete:', teamsComplete, 'East:', eastTeamsSelected, 'West:', westTeamsSelected);

  return (
    <div>
      {/* Help Text */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
        <h4 className="font-bold text-sm mb-2">Team Selection Instructions</h4>
        <ul className="text-sm list-disc list-inside space-y-1">
          <li>Select teams for each seed position using the dropdown menus</li>
          <li>Teams are removed from the list once they're selected</li>
          <li>Eastern Conference teams can only be selected for Eastern seeds</li>
          <li>Western Conference teams can only be selected for Western seeds</li>
          <li>After selecting all 16 teams, click "Generate Matchups" to create the bracket</li>
        </ul>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-xl font-bold">NBA Playoff Teams</h2>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateMatchups}
            disabled={isArchived || generatingMatchups || !teamsComplete}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaCheck className="mr-1" />
            {generatingMatchups ? 'Generating...' : 'Generate Matchups'}
          </button>
          <button
            onClick={handleClearAllTeams}
            disabled={isArchived}
            className="flex items-center px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaTrash className="mr-1" /> Clear All
          </button>
        </div>
      </div>

      {/* Team selection status */}
      <div className={`mb-4 p-3 rounded-lg ${teamsComplete ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
        <p className="font-medium">
          {teamsComplete ? (
            <>
              <FaCheck className="inline-block mr-1" />
              All teams selected! Click "Generate Matchups" to create the bracket.
            </>
          ) : (
            <>
              <FaInfoCircle className="inline-block mr-1" />
              Teams selected: {totalTeamsSelected}/16 (East: {eastTeamsSelected}/8, West: {westTeamsSelected}/8)
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Eastern Conference */}
        <div>
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-blue-700">Eastern Conference (Seeds 1-8)</h3>
            <div className="space-y-2">
              {teams.eastConference.map((team, index) => (
                <div key={`east-${index}`} className="flex items-center">
                  <span className="w-8 text-center font-bold">{team.seed}</span>
                  <div className="relative flex-1">
                    <select
                      value={team.teamId || ''}
                      onChange={(e) => handleTeamChange('eastConference', index, e.target.value)}
                      className={dropdownClass}
                      disabled={isArchived}
                    >
                      <option value="">Select East Team</option>
                      {team.teamId && !availableEastTeams.some(t => t.id === team.teamId) && (
                        <option value={team.teamId}>{team.name}</option>
                      )}
                      {availableEastTeams.map(nbaTeam => (
                        <option key={nbaTeam.id} value={nbaTeam.id}>
                          {nbaTeam.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <FaChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Western Conference */}
        <div>
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-red-700">Western Conference (Seeds 1-8)</h3>
            <div className="space-y-2">
              {teams.westConference.map((team, index) => (
                <div key={`west-${index}`} className="flex items-center">
                  <span className="w-8 text-center font-bold">{team.seed}</span>
                  <div className="relative flex-1">
                    <select
                      value={team.teamId || ''}
                      onChange={(e) => handleTeamChange('westConference', index, e.target.value)}
                      className={dropdownClass}
                      disabled={isArchived}
                    >
                      <option value="">Select West Team</option>
                      {team.teamId && !availableWestTeams.some(t => t.id === team.teamId) && (
                        <option value={team.teamId}>{team.name}</option>
                      )}
                      {availableWestTeams.map(nbaTeam => (
                        <option key={nbaTeam.id} value={nbaTeam.id}>
                          {nbaTeam.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <FaChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTeamsPanel;
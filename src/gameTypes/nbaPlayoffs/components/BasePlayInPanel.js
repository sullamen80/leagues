import React, { useMemo } from 'react';
import { FaInfoCircle, FaToggleOn, FaToggleOff, FaChevronRight, FaTrophy, FaChevronDown, FaTrash, FaArrowLeft } from 'react-icons/fa';
import { ROUND_KEYS } from '../constants/playoffConstants';

const BasePlayInPanel = ({ 
  isUserMode = false,
  onBack,
  data,
  onDataChange,
  isLoading = false, 
  isLeagueArchived = false,
  gameData,
  userBracket,
  onUpdateBracket,
  onSaveBracket,
  isLocked = false,
  showResults = false,
  isSaving = false,
  saveFeedback = null
}) => {
  const tournamentData = useMemo(() => {
    if (isUserMode) {
      const officialData = gameData || {};
      return {
        ...officialData,
        [ROUND_KEYS.PLAY_IN]: showResults 
          ? officialData[ROUND_KEYS.PLAY_IN] 
          : userBracket?.[ROUND_KEYS.PLAY_IN] || officialData[ROUND_KEYS.PLAY_IN] || {}
      };
    } else {
      return data?.tournamentData || {};
    }
  }, [isUserMode, data, gameData, userBracket, showResults]);

  const isPlayInEnabled = tournamentData?.playInTournamentEnabled || false;
  const isPlayInComplete = tournamentData?.playInComplete || false;
  const isInteractive = isUserMode 
    ? (!isLocked && !showResults) 
    : !isLeagueArchived;

  const flattenedTeams = useMemo(() => {
    const eastTeams = [];
    const westTeams = [];
    const allTeams = tournamentData?.allTeams || {};

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
      west: westTeams.sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [tournamentData?.allTeams]);

  const handleTogglePlayInEnabled = () => {
    if (isUserMode || isLeagueArchived) return;
    
    const updatedTournamentData = { ...tournamentData };
    updatedTournamentData.playInTournamentEnabled = !isPlayInEnabled;
    
    if (!updatedTournamentData.playInTournamentEnabled) {
      delete updatedTournamentData[ROUND_KEYS.PLAY_IN];
      updatedTournamentData.playInComplete = false;
    } else {
      updatedTournamentData[ROUND_KEYS.PLAY_IN] = {
        east: {
          seventhSeed: { team: "", teamId: null, seed: 7 },
          eighthSeed: { team: "", teamId: null, seed: 8 },
          ninthSeed: { team: "", teamId: null, seed: 9 },
          tenthSeed: { team: "", teamId: null, seed: 10 },
          seventhEighthWinner: { team: "", seed: null },
          ninthTenthWinner: { team: "", seed: null },
          finalWinner: { team: "", seed: null },
          loserTeam: { team: "", seed: null },
          winnerTeam: { team: "", seed: null }
        },
        west: {
          seventhSeed: { team: "", teamId: null, seed: 7 },
          eighthSeed: { team: "", teamId: null, seed: 8 },
          ninthSeed: { team: "", teamId: null, seed: 9 },
          tenthSeed: { team: "", teamId: null, seed: 10 },
          seventhEighthWinner: { team: "", seed: null },
          ninthTenthWinner: { team: "", seed: null },
          finalWinner: { team: "", seed: null },
          loserTeam: { team: "", seed: null },
          winnerTeam: { team: "", seed: null }
        }
      };
    }
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };
  
  const handleTogglePlayInComplete = () => {
    if (isUserMode || isLeagueArchived) return;
    
    const updatedTournamentData = { ...tournamentData };
    updatedTournamentData.playInComplete = !isPlayInComplete;
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };
  
  const handleClearResults = () => {
    if (isUserMode || isLeagueArchived || !isPlayInEnabled) return;

    const updatedTournamentData = { ...tournamentData };
    updatedTournamentData[ROUND_KEYS.PLAY_IN] = {
      east: {
        seventhSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].east.seventhSeed,
        eighthSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].east.eighthSeed,
        ninthSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].east.ninthSeed,
        tenthSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].east.tenthSeed,
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      },
      west: {
        seventhSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].west.seventhSeed,
        eighthSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].west.eighthSeed,
        ninthSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].west.ninthSeed,
        tenthSeed: updatedTournamentData[ROUND_KEYS.PLAY_IN].west.tenthSeed,
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      }
    };
    updatedTournamentData.playInComplete = false;
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };
  
  const handleTeamChange = (conference, seedKey, teamId) => {
    if (isUserMode || isLeagueArchived) return;
    
    const updatedTournamentData = { ...tournamentData };
    const confLower = conference.toLowerCase();
    const teamsList = flattenedTeams[confLower];
    const selectedTeam = teamsList.find(team => team.id === teamId);
    
    if (!updatedTournamentData[ROUND_KEYS.PLAY_IN]) {
      updatedTournamentData[ROUND_KEYS.PLAY_IN] = { east: {}, west: {} };
    }
    
    if (!updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower]) {
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower] = {};
    }
    
    const seedNum = { seventhSeed: 7, eighthSeed: 8, ninthSeed: 9, tenthSeed: 10 }[seedKey];
    
    updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower][seedKey] = selectedTeam ? {
      team: selectedTeam.name,
      teamId: selectedTeam.id,
      seed: seedNum,
      division: selectedTeam.division,
      colors: selectedTeam.colors
    } : { team: "", teamId: null, seed: seedNum, division: null, colors: null };
    
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };

  const handleUserClearPredictions = () => {
    if (isLocked || showResults) return;

    const updatedBracket = { ...userBracket } || {};
    updatedBracket[ROUND_KEYS.PLAY_IN] = {
      east: {
        seventhSeed: gameData[ROUND_KEYS.PLAY_IN]?.east?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: gameData[ROUND_KEYS.PLAY_IN]?.east?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: gameData[ROUND_KEYS.PLAY_IN]?.east?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: gameData[ROUND_KEYS.PLAY_IN]?.east?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      },
      west: {
        seventhSeed: gameData[ROUND_KEYS.PLAY_IN]?.west?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: gameData[ROUND_KEYS.PLAY_IN]?.west?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: gameData[ROUND_KEYS.PLAY_IN]?.west?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: gameData[ROUND_KEYS.PLAY_IN]?.west?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      }
    };
    onUpdateBracket(updatedBracket);
  };

  const handleUserSave = () => {
    if (isLocked || showResults) return;
    onSaveBracket();
  };

  const getOpponent = (conference, gameType, team) => {
    const confData = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confData] || {};
    let team1, team2;
    
    if (gameType === 'seventhEighthGame') {
      team1 = playInData.seventhSeed?.team || "";
      team2 = playInData.eighthSeed?.team || "";
    } else if (gameType === 'ninthTenthGame') {
      team1 = playInData.ninthSeed?.team || "";
      team2 = playInData.tenthSeed?.team || "";
    } else if (gameType === 'finalPlayInGame') {
      team1 = playInData.loserTeam?.team || "";
      team2 = playInData.winnerTeam?.team || "";
    }
    
    return team === team1 ? team2 : team1;
  };
  
  const getTeamNameBySeed = (conference, seed) => {
    const confData = conference.toLowerCase();
    const sourceData = isUserMode && !showResults ? gameData : tournamentData;
    const playInData = sourceData[ROUND_KEYS.PLAY_IN]?.[confData] || {};
    
    const seedKey = { 7: 'seventhSeed', 8: 'eighthSeed', 9: 'ninthSeed', 10: 'tenthSeed' }[seed];
    return playInData[seedKey]?.team || "";
  };
  
  const allGamesHaveWinners = (dataToCheck = tournamentData) => {
    const playInData = dataToCheck[ROUND_KEYS.PLAY_IN] || dataToCheck;
    if (!playInData) return false;
    if (!playInData.east || !playInData.west) return false;
    
    const eastComplete = playInData.east?.seventhEighthWinner?.team && 
                        playInData.east?.ninthTenthWinner?.team && 
                        playInData.east?.finalWinner?.team;
    const westComplete = playInData.west?.seventhEighthWinner?.team && 
                        playInData.west?.ninthTenthWinner?.team && 
                        playInData.west?.finalWinner?.team;
    
    return eastComplete && westComplete;
  };
  
  const getGameStatus = (conference, gameType) => {
    const confData = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confData] || {};
    const winnerKey = {
      'seventhEighthGame': 'seventhEighthWinner',
      'ninthTenthGame': 'ninthTenthWinner',
      'finalPlayInGame': 'finalWinner'
    }[gameType];
    
    return {
      hasWinner: !!playInData[winnerKey]?.team,
      winner: playInData[winnerKey]?.team || null,
      winnerSeed: playInData[winnerKey]?.seed || null
    };
  };
  
  const getSeedOutcome = (gameType, isWinner) => {
    if (gameType === 'seventhEighthGame' && isWinner) return '7th Seed';
    if (gameType === 'finalPlayInGame' && isWinner) return '8th Seed';
    if ((gameType === 'ninthTenthGame' && !isWinner) || (gameType === 'finalPlayInGame' && !isWinner)) return 'Eliminated';
    if (gameType === 'seventhEighthGame' && !isWinner) return 'Final Game';
    if (gameType === 'ninthTenthGame' && isWinner) return 'Final Game';
    return '';
  };

  const handleWinnerSelect = (conference, gameType, team, seed) => {
    if (isUserMode) {
      handleUserWinnerSelect(conference, gameType, team, seed);
    } else {
      handleAdminWinnerSelect(conference, gameType, team, seed);
    }
  };
  
  const handleAdminWinnerSelect = (conference, gameType, team, seed) => {
    if (isLeagueArchived) return;
    
    const updatedTournamentData = { ...tournamentData };
    const confLower = conference.toLowerCase();
    
    if (!updatedTournamentData[ROUND_KEYS.PLAY_IN]) {
      updatedTournamentData[ROUND_KEYS.PLAY_IN] = { east: {}, west: {} };
    }
    
    if (!updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower]) {
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower] = {};
    }
    
    const winnerKey = {
      'seventhEighthGame': 'seventhEighthWinner',
      'ninthTenthGame': 'ninthTenthWinner',
      'finalPlayInGame': 'finalWinner'
    }[gameType];
    
    updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower][winnerKey] = { team, seed };
    
    if (gameType === 'seventhEighthGame') {
      const loser = getOpponent(conference, 'seventhEighthGame', team);
      const loserSeed = loser === getTeamNameBySeed(conference, 7) ? 7 : 8;
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].loserTeam = { team: loser, seed: loserSeed };
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].finalWinner = {};
    } else if (gameType === 'ninthTenthGame') {
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].winnerTeam = { team, seed };
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].finalWinner = {};
    }
    
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };
  
  const handleUserWinnerSelect = (conference, gameType, team, seed) => {
    if (isLocked || showResults) return;
    
    const updatedBracket = { ...userBracket } || {};
    const confLower = conference.toLowerCase();
    
    if (!updatedBracket[ROUND_KEYS.PLAY_IN]) {
      updatedBracket[ROUND_KEYS.PLAY_IN] = { 
        east: { seventhEighthWinner: {}, ninthTenthWinner: {}, finalWinner: {}, loserTeam: {}, winnerTeam: {} },
        west: { seventhEighthWinner: {}, ninthTenthWinner: {}, finalWinner: {}, loserTeam: {}, winnerTeam: {} }
      };
    }
    
    if (!updatedBracket[ROUND_KEYS.PLAY_IN][confLower]) {
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower] = { 
        seventhEighthWinner: {}, ninthTenthWinner: {}, finalWinner: {}, loserTeam: {}, winnerTeam: {} 
      };
    }
    
    if (gameData?.[ROUND_KEYS.PLAY_IN]?.[confLower]) {
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].seventhSeed = gameData[ROUND_KEYS.PLAY_IN][confLower].seventhSeed;
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].eighthSeed = gameData[ROUND_KEYS.PLAY_IN][confLower].eighthSeed;
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].ninthSeed = gameData[ROUND_KEYS.PLAY_IN][confLower].ninthSeed;
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].tenthSeed = gameData[ROUND_KEYS.PLAY_IN][confLower].tenthSeed;
    }

    const winnerKey = {
      'seventhEighthGame': 'seventhEighthWinner',
      'ninthTenthGame': 'ninthTenthWinner',
      'finalPlayInGame': 'finalWinner'
    }[gameType];
    
    updatedBracket[ROUND_KEYS.PLAY_IN][confLower][winnerKey] = { team, seed };
    
    if (gameType === 'seventhEighthGame') {
      const loser = getOpponent(conference, 'seventhEighthGame', team);
      const loserSeed = loser === getTeamNameBySeed(conference, 7) ? 7 : 8;
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].loserTeam = { team: loser, seed: loserSeed };
      if (updatedBracket[ROUND_KEYS.PLAY_IN][confLower].ninthTenthWinner?.team) {
        updatedBracket[ROUND_KEYS.PLAY_IN][confLower].winnerTeam = updatedBracket[ROUND_KEYS.PLAY_IN][confLower].ninthTenthWinner;
      }
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].finalWinner = {};
    } else if (gameType === 'ninthTenthGame') {
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].winnerTeam = { team, seed };
      if (updatedBracket[ROUND_KEYS.PLAY_IN][confLower].seventhEighthWinner?.team) {
        const loser78 = getOpponent(conference, 'seventhEighthGame', updatedBracket[ROUND_KEYS.PLAY_IN][confLower].seventhEighthWinner.team);
        const loserSeed78 = loser78 === getTeamNameBySeed(conference, 7) ? 7 : 8;
        updatedBracket[ROUND_KEYS.PLAY_IN][confLower].loserTeam = { team: loser78, seed: loserSeed78 };
      }
      updatedBracket[ROUND_KEYS.PLAY_IN][confLower].finalWinner = {};
    }
    
    onUpdateBracket(updatedBracket);
  };

  const getAvailableTeams = (conference) => {
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    const selectedIds = new Set([
      playInData.seventhSeed?.teamId,
      playInData.eighthSeed?.teamId,
      playInData.ninthSeed?.teamId,
      playInData.tenthSeed?.teamId
    ].filter(id => id));
    
    return flattenedTeams[confLower].filter(team => !selectedIds.has(team.id));
  };

  const renderTeamSelection = (conference) => {
    if (isUserMode) return null;
    
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    const availableTeams = getAvailableTeams(conference);
    const dropdownClass = "flex-1 block w-full p-2 pr-8 border border-gray-300 rounded shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 appearance-none bg-white";

    const seeds = [
      { key: 'seventhSeed', seed: 7, label: '7th Seed' },
      { key: 'eighthSeed', seed: 8, label: '8th Seed' },
      { key: 'ninthSeed', seed: 9, label: '9th Seed' },
      { key: 'tenthSeed', seed: 10, label: '10th Seed' }
    ];

    return (
      <div className="mb-6">
        <h3 className="font-bold mb-3">{conference}ern Conference Teams</h3>
        <div className="space-y-2">
          {seeds.map(({ key, seed, label }) => (
            <div key={`${confLower}-${key}`} className="flex items-center">
              <span className="w-8 text-center font-bold">{seed}</span>
              <div className="relative flex-1">
                <select
                  value={playInData[key]?.teamId || ""}
                  onChange={(e) => handleTeamChange(conference, key, e.target.value)}
                  className={dropdownClass}
                  disabled={isLeagueArchived}
                >
                  <option value="">Select {label}</option>
                  {playInData[key]?.teamId && !availableTeams.some(t => t.id === playInData[key].teamId) && (
                    <option value={playInData[key].teamId}>{playInData[key].team}</option>
                  )}
                  {availableTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
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
    );
  };

  const renderPlayInGame = (conference, gameType, title, description) => {
    const confLower = conference.toLowerCase();
    let team1, team2, team1Seed, team2Seed;
    
    if (gameType === 'seventhEighthGame') {
      team1 = getTeamNameBySeed(conference, 7);
      team2 = getTeamNameBySeed(conference, 8);
      team1Seed = 7;
      team2Seed = 8;
    } else if (gameType === 'ninthTenthGame') {
      team1 = getTeamNameBySeed(conference, 9);
      team2 = getTeamNameBySeed(conference, 10);
      team1Seed = 9;
      team2Seed = 10;
    } else if (gameType === 'finalPlayInGame') {
      const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower];
      team1 = playInData?.loserTeam?.team || "";
      team2 = playInData?.winnerTeam?.team || "";
      team1Seed = playInData?.loserTeam?.seed || null;
      team2Seed = playInData?.winnerTeam?.seed || null;
    }
    
    const status = getGameStatus(conference, gameType);
    const hasTeams = team1 && team2;
    const isGameDecided = status?.hasWinner;
    
    return (
      <div className="mb-5 border rounded-lg overflow-hidden">
        <div className="bg-gray-100 p-3">
          <h4 className="font-medium">{title}</h4>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        <div className="p-4">
          {hasTeams ? (
            <div className="space-y-3">
              <div className="flex items-center">
                <div 
                  className={`flex-1 flex items-center p-3 rounded ${
                    isInteractive ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    status?.winner === team1 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => isInteractive && handleWinnerSelect(conference, gameType, team1, team1Seed)}
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-3">
                    {team1Seed}
                  </div>
                  <div className="flex-1 font-medium">{team1}</div>
                  {status?.winner === team1 && <FaChevronRight className="text-green-600 mr-2" />}
                </div>
                {isGameDecided && (
                  <div className={`ml-2 text-sm ${status.winner === team1 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                    {status.winner === team1 ? (
                      <div className="flex items-center">
                        <FaTrophy className="mr-1 text-yellow-500" />
                        {getSeedOutcome(gameType, true)}
                      </div>
                    ) : getSeedOutcome(gameType, false)}
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <div 
                  className={`flex-1 flex items-center p-3 rounded ${
                    isInteractive ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    status?.winner === team2 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => isInteractive && handleWinnerSelect(conference, gameType, team2, team2Seed)}
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-3">
                    {team2Seed}
                  </div>
                  <div className="flex-1 font-medium">{team2}</div>
                  {status?.winner === team2 && <FaChevronRight className="text-green-600 mr-2" />}
                </div>
                {isGameDecided && (
                  <div className={`ml-2 text-sm ${status.winner === team2 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                    {status.winner === team2 ? (
                      <div className="flex items-center">
                        <FaTrophy className="mr-1 text-yellow-500" />
                        {getSeedOutcome(gameType, true)}
                      </div>
                    ) : getSeedOutcome(gameType, false)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-4 text-gray-500">
              {isUserMode 
                ? (showResults ? "No teams set for this game" : "Select winners to make your predictions")
                : "Select teams above to set up this game"
              }
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderConferencePlayIn = (conference) => {
    return (
      <div>
        {renderTeamSelection(conference)}
        <h3 className="font-bold mb-4">{conference}ern Conference Play-In Games</h3>
        {renderPlayInGame(conference, 'seventhEighthGame', '7th vs 8th Seed', 'Winner secures 7th seed, loser plays in final Play-In game')}
        {renderPlayInGame(conference, 'ninthTenthGame', '9th vs 10th Seed', 'Winner advances to final Play-In game, loser is eliminated')}
        {renderPlayInGame(conference, 'finalPlayInGame', 'Final Play-In Game', 'Winner secures 8th seed, loser is eliminated')}
      </div>
    );
  };

  return (
    <div>
      {!isUserMode && onBack && (
        <button 
          onClick={onBack}
          className="mb-4 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition flex items-center"
        >
          <FaArrowLeft className="mr-1" /> Back to Bracket
        </button>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {isUserMode 
            ? (showResults ? "Play-In Tournament Results" : "Play-In Tournament Predictions")
            : "Play-In Tournament Manager"
          }
        </h2>
        {isUserMode && isLocked && (
          <div className="px-3 py-1 bg-gray-200 text-gray-700 rounded">
            {showResults ? "Official Results" : "Predictions Locked"}
          </div>
        )}
        {!isUserMode && isPlayInEnabled && (
          <button
            onClick={handleClearResults}
            disabled={isLeagueArchived}
            className={`flex items-center px-3 py-1 rounded ${
              isLeagueArchived ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            aria-label="Clear all Play-In results"
          >
            <FaTrash className="mr-2" /> Clear Results
          </button>
        )}
        {isUserMode && !isLocked && !showResults && (
          <div className="flex space-x-2">
            <button
              onClick={handleUserClearPredictions}
              className="flex items-center px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              aria-label="Clear all Play-In predictions"
            >
              <FaTrash className="mr-2" /> Clear
            </button>
            <button
              onClick={handleUserSave}
              disabled={isSaving}
              className={`flex items-center px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Save Play-In predictions"
            >
              <FaTrophy className="mr-2" /> {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
      {saveFeedback && (
        <div className={`mb-4 p-2 rounded ${saveFeedback.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {saveFeedback}
        </div>
      )}
      {isLoading && !isUserMode ? (
        <div className="text-center py-8">
          <p>Loading Play-In Tournament data...</p>
        </div>
      ) : (
        <div>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold flex items-center">
                  <FaInfoCircle className="text-blue-500 mr-2" />
                  About the Play-In Tournament
                </h3>
                <p className="mt-2">
                  The NBA Play-In Tournament determines the 7th and 8th playoff seeds in each conference.
                  Teams that finish the regular season 7th through 10th place qualify for the Play-In.
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• 7th vs 8th: Winner secures the 7th seed</li>
                  <li>• 9th vs 10th: Loser is eliminated</li>
                  <li>• Loser of 7/8 vs Winner of 9/10: Winner secures the 8th seed</li>
                </ul>
                {isUserMode ? (
                  showResults ? (
                    <p className="mt-2 font-medium text-blue-700">You are viewing the official Play-In Tournament results.</p>
                  ) : isLocked ? (
                    <p className="mt-2 font-medium text-blue-700">Predictions are locked. You can no longer make changes.</p>
                  ) : (
                    <p className="mt-2 font-medium text-blue-700">Click on a team to predict the winner of each Play-In game.</p>
                  )
                ) : null}
              </div>
              
              {!isUserMode && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">Enable Play-In:</span>
                    <button
                      onClick={handleTogglePlayInEnabled}
                      disabled={isLeagueArchived}
                      className={`text-2xl ${isLeagueArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label={isPlayInEnabled ? "Disable Play-In Tournament" : "Enable Play-In Tournament"}
                    >
                      {isPlayInEnabled ? <FaToggleOn className="text-green-600" /> : <FaToggleOff className="text-gray-400" />}
                    </button>
                  </div>
                  {isPlayInEnabled && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">Play-In Complete:</span>
                      <button
                        onClick={handleTogglePlayInComplete}
                        disabled={isLeagueArchived || !allGamesHaveWinners()}
                        className={`text-2xl ${isLeagueArchived || !allGamesHaveWinners() ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label={isPlayInComplete ? "Mark Play-In as incomplete" : "Mark Play-In as complete"}
                        title={!allGamesHaveWinners() ? "All games must have winners before marking as complete" : ""}
                      >
                        {isPlayInComplete ? <FaToggleOn className="text-green-600" /> : <FaToggleOff className="text-gray-400" />}
                      </button>
                    </div>
                  )}
                  {isPlayInEnabled && !allGamesHaveWinners() && (
                    <div className="text-xs text-gray-500 mt-1">All games must have winners</div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {isPlayInEnabled ? (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-4">Eastern Conference</h3>
                {renderConferencePlayIn('East')}
              </div>
              <div>
                <h3 className="font-bold text-lg text-red-800 mb-4">Western Conference</h3>
                {renderConferencePlayIn('West')}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-yellow-50 p-4 rounded-lg">
              <FaInfoCircle className="text-yellow-500 text-xl inline-block mb-2" />
              <p>
                {isUserMode 
                  ? "Play-In Tournament is not available for this season."
                  : "Play-In Tournament is disabled. Enable it to set up teams and games for seeds 7-10."
                }
              </p>
            </div>
          )}
          
          {!isUserMode && isPlayInEnabled && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="font-medium text-yellow-800 flex items-center">
                <FaInfoCircle className="mr-2" />
                Important Note
              </h4>
              <p className="mt-2 text-sm text-yellow-700">
                Once you have set winners for all Play-In games, toggle "Play-In Complete" above to finalize the Play-In Tournament results.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BasePlayInPanel;
import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore'; // Add Firestore imports
import { db, auth } from '../../../firebase'; // Add Firebase imports
import { FaInfoCircle, FaToggleOn, FaToggleOff, FaTrophy, FaTrash, FaUndo, FaArrowLeft, FaSave, FaLock } from 'react-icons/fa';
import { ROUND_KEYS } from '../constants/playoffConstants';
import Matchup from './Matchup';

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
  // onSaveBracket, <-- Remove this prop
  isLocked = false,
  showResults = false,
  // isSaving = false, <-- Remove this prop
  // saveFeedback = null, <-- Remove this prop
  hideAboutSection = false,
  hidePredictionsLockedMessage = false,
  scoringSettings = null,
  leagueId // Add leagueId prop
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  // Add local state for saving
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // Initialize empty Play-In bracket if missing for user mode
  useEffect(() => {
    if (!isUserMode || !gameData?.playInTournamentEnabled || userBracket?.[ROUND_KEYS.PLAY_IN] || isLocked || showResults || isInitialized) return;

    const playInData = gameData[ROUND_KEYS.PLAY_IN] || {};
    const emptyPlayInBracket = {
      east: {
        seventhSeed: playInData.east?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: playInData.east?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: playInData.east?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: playInData.east?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      },
      west: {
        seventhSeed: playInData.west?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: playInData.west?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: playInData.west?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: playInData.west?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      }
    };

    onUpdateBracket({ [ROUND_KEYS.PLAY_IN]: emptyPlayInBracket });
    setIsInitialized(true);
  }, [isUserMode, gameData, userBracket, onUpdateBracket, isLocked, showResults, isInitialized]);

  // Add this function to save Play-In data directly
  const savePlayInData = async () => {
    if (!isUserMode || isLocked || showResults) return;
    
    setIsSaving(true);
    setSaveFeedback(null);
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("No authenticated user");
      
      const playInData = userBracket?.[ROUND_KEYS.PLAY_IN];
      if (!playInData) {
        throw new Error("No Play-In data to save");
      }
      
      // Get the user bracket reference
      const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
      
      // Check if the document exists first
      const docSnap = await getDoc(userBracketRef);
      
      // Prepare data to save
      const updateData = {
        [ROUND_KEYS.PLAY_IN]: playInData,
        updatedAt: new Date().toISOString()
      };
      
      if (docSnap.exists()) {
        // Document exists, use updateDoc
        await updateDoc(userBracketRef, updateData);
      } else {
        // Document doesn't exist, initialize a complete bracket structure with First Round teams from gameData
        const emptyBracket = {
          [ROUND_KEYS.PLAY_IN]: playInData,
          // Copy the First Round matchups from gameData including team information
          [ROUND_KEYS.FIRST_ROUND]: (gameData[ROUND_KEYS.FIRST_ROUND] || []).map(matchup => ({
            ...matchup,
            winner: '',
            winnerSeed: null,
            numGames: null
          })),
          [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({ 
            team1: '',
            team1Seed: null,
            team2: '',
            team2Seed: null,
            winner: '',
            winnerSeed: null,
            numGames: null,
            conference: i < 2 ? 'East' : 'West'
          })),
          [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({ 
            team1: '',
            team1Seed: null,
            team2: '',
            team2Seed: null,
            winner: '',
            winnerSeed: null,
            numGames: null,
            conference: i === 0 ? 'East' : 'West'
          })),
          [ROUND_KEYS.NBA_FINALS]: { 
            team1: '',
            team1Seed: null,
            team2: '',
            team2Seed: null,
            winner: '',
            winnerSeed: null,
            numGames: null,
            predictedMVP: ''
          },
          [ROUND_KEYS.CHAMPION]: '',
          ChampionSeed: null,
          [ROUND_KEYS.FINALS_MVP]: '',
          updatedAt: new Date().toISOString()
        };
        
        // Document doesn't exist, use setDoc with complete structure
        await setDoc(userBracketRef, emptyBracket);
      }
      
      setSaveFeedback("Play-In predictions saved!");
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (error) {
      console.error("Error saving Play-In data:", error);
      setSaveFeedback("Failed to save: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Combine official and user data
  const tournamentData = useMemo(() => {
    if (isUserMode) {
      const officialData = gameData || {};
      const playInData = showResults
        ? officialData[ROUND_KEYS.PLAY_IN] || {}
        : userBracket?.[ROUND_KEYS.PLAY_IN] || officialData[ROUND_KEYS.PLAY_IN] || {};
      return {
        ...officialData,
        [ROUND_KEYS.PLAY_IN]: playInData
      };
    }
    return data?.tournamentData || {};
  }, [isUserMode, data, gameData, userBracket, showResults]);

  const isPlayInEnabled = tournamentData?.playInTournamentEnabled || false;

  // Determine interactivity
  const isInteractive = useMemo(() => {
    return isUserMode ? !isLocked && !showResults : !isLeagueArchived;
  }, [isUserMode, isLocked, showResults, isLeagueArchived]);

  // Process teams for dropdowns (Admin mode)
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

  // Get scoring settings based on game type
  const getPlayInPoints = (gameType) => {
    const effectiveSettings = scoringSettings ||
      gameData?.scoringSettings ||
      tournamentData?.scoringSettings ||
      gameData?.settings ||
      tournamentData?.settings || {};

    let pointValue = effectiveSettings[`playIn${gameType}Points`] ??
      effectiveSettings.playInCorrectPrediction ??
      0.5; // Default
    return typeof pointValue === 'string' ? parseFloat(pointValue) || 0.5 : pointValue;
  };

  // Determine prediction result
  const getPredictionResult = (conference, gameType) => {
    if (!isUserMode || !gameData?.[ROUND_KEYS.PLAY_IN] || !userBracket?.[ROUND_KEYS.PLAY_IN]) {
      return { hasResult: false };
    }

    const confLower = conference.toLowerCase();
    const officialData = gameData[ROUND_KEYS.PLAY_IN][confLower] || {};
    const userData = userBracket[ROUND_KEYS.PLAY_IN][confLower] || {};
    const winnerKey = { 'seventhEighthGame': 'seventhEighthWinner', 'ninthTenthGame': 'ninthTenthWinner', 'finalPlayInGame': 'finalWinner' }[gameType];

    if (!officialData[winnerKey]?.team) {
      return { hasResult: false };
    }

    if (!userData[winnerKey]?.team) {
      return { hasResult: true, isCorrect: false, points: 0, message: "No prediction made" };
    }

    const isCorrect = userData[winnerKey].team === officialData[winnerKey].team;
    const points = isCorrect ? getPlayInPoints(gameType) : 0;

    return {
      hasResult: true,
      isCorrect,
      points,
      message: isCorrect ? `Correct! +${points} pts` : "Incorrect (0 pts)"
    };
  };

  // ADMIN FUNCTIONS
  const handleTogglePlayInEnabled = () => {
    if (isUserMode || isLeagueArchived) return;
    const updatedTournamentData = { ...tournamentData, playInTournamentEnabled: !isPlayInEnabled };
    if (!updatedTournamentData.playInTournamentEnabled) {
      delete updatedTournamentData[ROUND_KEYS.PLAY_IN];
      updatedTournamentData.playInComplete = false;
    } else {
      updatedTournamentData[ROUND_KEYS.PLAY_IN] = {
        east: { seventhSeed: { team: "", teamId: null, seed: 7 }, eighthSeed: { team: "", teamId: null, seed: 8 }, ninthSeed: { team: "", teamId: null, seed: 9 }, tenthSeed: { team: "", teamId: null, seed: 10 }, seventhEighthWinner: { team: "", seed: null }, ninthTenthWinner: { team: "", seed: null }, finalWinner: { team: "", seed: null }, loserTeam: { team: "", seed: null }, winnerTeam: { team: "", seed: null } },
        west: { seventhSeed: { team: "", teamId: null, seed: 7 }, eighthSeed: { team: "", teamId: null, seed: 8 }, ninthSeed: { team: "", teamId: null, seed: 9 }, tenthSeed: { team: "", teamId: null, seed: 10 }, seventhEighthWinner: { team: "", seed: null }, ninthTenthWinner: { team: "", seed: null }, finalWinner: { team: "", seed: null }, loserTeam: { team: "", seed: null }, winnerTeam: { team: "", seed: null } }
      };
    }
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };

  const handleClearResults = () => {
    if (isUserMode || isLeagueArchived || !isPlayInEnabled) return;
    const updatedTournamentData = {
      ...tournamentData,
      [ROUND_KEYS.PLAY_IN]: {
        east: { ...tournamentData[ROUND_KEYS.PLAY_IN].east, seventhEighthWinner: { team: "", seed: null }, ninthTenthWinner: { team: "", seed: null }, finalWinner: { team: "", seed: null }, loserTeam: { team: "", seed: null }, winnerTeam: { team: "", seed: null } },
        west: { ...tournamentData[ROUND_KEYS.PLAY_IN].west, seventhEighthWinner: { team: "", seed: null }, ninthTenthWinner: { team: "", seed: null }, finalWinner: { team: "", seed: null }, loserTeam: { team: "", seed: null }, winnerTeam: { team: "", seed: null } }
      },
      playInComplete: false
    };
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };

  const handleTeamChange = (conference, seedKey, teamId) => {
    if (isUserMode || isLeagueArchived) return;
    const confLower = conference.toLowerCase();
    const teamsList = flattenedTeams[confLower];
    const selectedTeam = teamsList.find(team => team.id === teamId);
    const updatedTournamentData = {
      ...tournamentData,
      [ROUND_KEYS.PLAY_IN]: {
        ...tournamentData[ROUND_KEYS.PLAY_IN],
        [confLower]: {
          ...tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower],
          [seedKey]: selectedTeam ? { team: selectedTeam.name, teamId: selectedTeam.id, seed: { seventhSeed: 7, eighthSeed: 8, ninthSeed: 9, tenthSeed: 10 }[seedKey], division: selectedTeam.division, colors: selectedTeam.colors } : { team: "", teamId: null, seed: { seventhSeed: 7, eighthSeed: 8, ninthSeed: 9, tenthSeed: 10 }[seedKey] }
        }
      }
    };
    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };

  // USER FUNCTIONS
  const handleUserClearPredictions = () => {
    if (isLocked || showResults) return;
    const playInData = gameData[ROUND_KEYS.PLAY_IN] || {};
    const clearedPlayInBracket = {
      east: {
        seventhSeed: playInData.east?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: playInData.east?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: playInData.east?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: playInData.east?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      },
      west: {
        seventhSeed: playInData.west?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: playInData.west?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: playInData.west?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: playInData.west?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      }
    };
    onUpdateBracket({ [ROUND_KEYS.PLAY_IN]: clearedPlayInBracket });
  };

  // Update to use the local savePlayInData function
  const handleUserSave = () => {
    if (isLocked || showResults) return;
    savePlayInData();
  };

  // HELPER FUNCTIONS
  const getOpponent = (conference, gameType, team) => {
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    let team1, team2;
    if (gameType === 'seventhEighthGame') { team1 = playInData.seventhSeed?.team || ""; team2 = playInData.eighthSeed?.team || ""; }
    else if (gameType === 'ninthTenthGame') { team1 = playInData.ninthSeed?.team || ""; team2 = playInData.tenthSeed?.team || ""; }
    else if (gameType === 'finalPlayInGame') { team1 = playInData.loserTeam?.team || ""; team2 = playInData.winnerTeam?.team || ""; }
    return team === team1 ? team2 : team1;
  };

  const getTeamNameBySeed = (conference, seed) => {
    const confLower = conference.toLowerCase();
    const sourceData = isUserMode && !showResults ? gameData : tournamentData;
    const playInData = sourceData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    const seedKey = { 7: 'seventhSeed', 8: 'eighthSeed', 9: 'ninthSeed', 10: 'tenthSeed' }[seed];
    return playInData[seedKey]?.team || "";
  };

  const getGameStatus = (conference, gameType) => {
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    const winnerKey = { 'seventhEighthGame': 'seventhEighthWinner', 'ninthTenthGame': 'ninthTenthWinner', 'finalPlayInGame': 'finalWinner' }[gameType];
    return { hasWinner: !!playInData[winnerKey]?.team, winner: playInData[winnerKey]?.team || null, winnerSeed: playInData[winnerKey]?.seed || null };
  };

  const getSeedOutcome = (gameType, isWinner) => {
    if (gameType === 'seventhEighthGame' && isWinner) return '7th Seed';
    if (gameType === 'finalPlayInGame' && isWinner) return '8th Seed';
    if ((gameType === 'ninthTenthGame' && !isWinner) || (gameType === 'finalPlayInGame' && !isWinner)) return 'Eliminated';
    if (gameType === 'seventhEighthGame' && !isWinner) return 'Final Game';
    if (gameType === 'ninthTenthGame' && isWinner) return 'Final Game';
    return '';
  };

  // MAIN FUNCTIONS
  const handleWinnerSelect = (conference, gameType, team, seed) => {
    if (isUserMode && isLocked) return;
    isUserMode ? handleUserWinnerSelect(conference, gameType, team, seed) : handleAdminWinnerSelect(conference, gameType, team, seed);
  };

  const handleAdminWinnerSelect = (conference, gameType, team, seed) => {
    if (isLeagueArchived) return;
    const confLower = conference.toLowerCase();
    const updatedTournamentData = {
      ...tournamentData,
      [ROUND_KEYS.PLAY_IN]: {
        ...tournamentData[ROUND_KEYS.PLAY_IN],
        [confLower]: {
          ...tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower],
          [{ 'seventhEighthGame': 'seventhEighthWinner', 'ninthTenthGame': 'ninthTenthWinner', 'finalPlayInGame': 'finalWinner' }[gameType]]: { team, seed }
        }
      }
    };

    if (gameType === 'seventhEighthGame') {
      const loser = getOpponent(conference, 'seventhEighthGame', team);
      const loserSeed = loser === getTeamNameBySeed(conference, 7) ? 7 : 8;
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].loserTeam = { team: loser, seed: loserSeed };
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].finalWinner = { team: "", seed: null };
    } else if (gameType === 'ninthTenthGame') {
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].winnerTeam = { team, seed };
      updatedTournamentData[ROUND_KEYS.PLAY_IN][confLower].finalWinner = { team: "", seed: null };
    }

    onDataChange({ ...data, tournamentData: updatedTournamentData });
  };

  const handleUserWinnerSelect = (conference, gameType, team, seed) => {
    if (isLocked || showResults) return;
    const confLower = conference.toLowerCase();
    const currentPlayIn = { ...(userBracket?.[ROUND_KEYS.PLAY_IN] || {}) };
    const playInData = gameData?.[ROUND_KEYS.PLAY_IN] || {};

    if (!currentPlayIn.east || !currentPlayIn.west) {
      currentPlayIn.east = {
        seventhSeed: playInData.east?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: playInData.east?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: playInData.east?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: playInData.east?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      };
      currentPlayIn.west = {
        seventhSeed: playInData.west?.seventhSeed || { team: "", seed: 7 },
        eighthSeed: playInData.west?.eighthSeed || { team: "", seed: 8 },
        ninthSeed: playInData.west?.ninthSeed || { team: "", seed: 9 },
        tenthSeed: playInData.west?.tenthSeed || { team: "", seed: 10 },
        seventhEighthWinner: { team: "", seed: null },
        ninthTenthWinner: { team: "", seed: null },
        finalWinner: { team: "", seed: null },
        loserTeam: { team: "", seed: null },
        winnerTeam: { team: "", seed: null }
      };
    }

    const winnerKey = { 'seventhEighthGame': 'seventhEighthWinner', 'ninthTenthGame': 'ninthTenthWinner', 'finalPlayInGame': 'finalWinner' }[gameType];
    currentPlayIn[confLower] = {
      ...currentPlayIn[confLower],
      [winnerKey]: { team, seed }
    };

    if (gameType === 'seventhEighthGame') {
      const loser = getOpponent(conference, 'seventhEighthGame', team);
      const loserSeed = loser === getTeamNameBySeed(conference, 7) ? 7 : 8;
      currentPlayIn[confLower].loserTeam = { team: loser, seed: loserSeed };
      if (currentPlayIn[confLower].ninthTenthWinner?.team) {
        currentPlayIn[confLower].winnerTeam = currentPlayIn[confLower].ninthTenthWinner;
      } else {
        currentPlayIn[confLower].winnerTeam = { team: "", seed: null };
      }
      currentPlayIn[confLower].finalWinner = { team: "", seed: null };
    } else if (gameType === 'ninthTenthGame') {
      currentPlayIn[confLower].winnerTeam = { team, seed };
      if (currentPlayIn[confLower].seventhEighthWinner?.team) {
        const loser78 = getOpponent(conference, 'seventhEighthGame', currentPlayIn[confLower].seventhEighthWinner.team);
        const loserSeed78 = loser78 === getTeamNameBySeed(conference, 7) ? 7 : 8;
        currentPlayIn[confLower].loserTeam = { team: loser78, seed: loserSeed78 };
      } else {
        currentPlayIn[confLower].loserTeam = { team: "", seed: null };
      }
      currentPlayIn[confLower].finalWinner = { team: "", seed: null };
    }

    console.log('[BasePlayInPanel] User Play-In update:', currentPlayIn);
    onUpdateBracket({ [ROUND_KEYS.PLAY_IN]: currentPlayIn });
  };

  const getAvailableTeams = (conference) => {
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    const selectedIds = new Set([playInData.seventhSeed?.teamId, playInData.eighthSeed?.teamId, playInData.ninthSeed?.teamId, playInData.tenthSeed?.teamId].filter(id => id));
    return flattenedTeams[confLower].filter(team => !selectedIds.has(team.id));
  };

  // Convert play-in data to Matchup format
  const createMatchupData = (conference, gameType) => {
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    let team1, team2, team1Seed, team2Seed, winner, winnerSeed;

    if (gameType === 'seventhEighthGame') {
      team1 = playInData.seventhSeed?.team || "";
      team2 = playInData.eighthSeed?.team || "";
      team1Seed = 7;
      team2Seed = 8;
    } else if (gameType === 'ninthTenthGame') {
      team1 = playInData.ninthSeed?.team || "";
      team2 = playInData.tenthSeed?.team || "";
      team1Seed = 9;
      team2Seed = 10;
    } else if (gameType === 'finalPlayInGame') {
      team1 = playInData.loserTeam?.team || "";
      team2 = playInData.winnerTeam?.team || "";
      team1Seed = playInData.loserTeam?.seed || null;
      team2Seed = playInData.winnerTeam?.seed || null;
    }

    const status = getGameStatus(conference, gameType);
    winner = status.winner;
    winnerSeed = status.winnerSeed;

    if (!team1 || !team2) return null;

    return {
      team1,
      team1Seed,
      team2,
      team2Seed,
      winner,
      winnerSeed,
      conference,
      numGames: null
    };
  };

  const getOfficialResult = (conference, gameType) => {
    if (!isUserMode || !gameData?.[ROUND_KEYS.PLAY_IN]) return null;

    const confLower = conference.toLowerCase();
    const winnerKey = { 'seventhEighthGame': 'seventhEighthWinner', 'ninthTenthGame': 'ninthTenthWinner', 'finalPlayInGame': 'finalWinner' }[gameType];
    const officialData = gameData[ROUND_KEYS.PLAY_IN][confLower] || {};
    if (!officialData[winnerKey]?.team) return null;

    const userPrediction = userBracket?.[ROUND_KEYS.PLAY_IN]?.[confLower]?.[winnerKey]?.team;

    return {
      winner: officialData[winnerKey].team,
      winnerSeed: officialData[winnerKey].seed,
      userPrediction
    };
  };

  // RENDER FUNCTIONS
  const renderTeamSelection = (conference) => {
    if (isUserMode) return null;
    const confLower = conference.toLowerCase();
    const playInData = tournamentData[ROUND_KEYS.PLAY_IN]?.[confLower] || {};
    const availableTeams = getAvailableTeams(conference);
    return (
      <div className="mb-6">
        <h3 className="font-semibold mb-2 text-gray-700">{conference}ern Conference Teams</h3>
        <div className="space-y-2">
          {['seventhSeed', 'eighthSeed', 'ninthSeed', 'tenthSeed'].map((key, idx) => (
            <div key={`${confLower}-${key}`} className="flex items-center">
              <span className="w-8 text-center font-semibold text-gray-600">{7 + idx}</span>
              <select
                value={playInData[key]?.teamId || ""}
                onChange={(e) => handleTeamChange(conference, key, e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200"
                disabled={isLeagueArchived}
              >
                <option value="">Select {7 + idx}th Seed</option>
                {playInData[key]?.teamId && !availableTeams.some(t => t.id === playInData[key].teamId) && (
                  <option value={playInData[key].teamId}>{playInData[key].team}</option>
                )}
                {availableTeams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPlayInGame = (conference, gameType, title, description) => {
    const matchupData = createMatchupData(conference, gameType);
    const officialResult = getOfficialResult(conference, gameType);
    const predictionResult = getPredictionResult(conference, gameType);
    const pointValue = getPlayInPoints(gameType);

    return (
      <div className={`mb-4 ${conference === 'East' ? 'border-blue-300' : 'border-red-300'} rounded shadow-sm overflow-hidden`}>
        <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
          <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
          {description && <p className="text-xs text-gray-600">{description}</p>}
          <p className="text-xs text-indigo-600">Worth {pointValue} {pointValue === 1 ? 'point' : 'points'}</p>
        </div>
        <div className="p-3 bg-white">
          {matchupData ? (
            <>
              <Matchup
                matchup={matchupData}
                onWinnerSelect={(winner, winnerSeed) => handleWinnerSelect(conference, gameType, winner, winnerSeed)}
                isLocked={!isInteractive}
                showSeed={true}
                className=""
                roundKey="PlayIn"
                officialResult={officialResult}
                scoringSettings={(gameData?.scoringSettings || tournamentData?.scoringSettings || scoringSettings)}
              />
              {matchupData.winner && (
                <div className="mt-3 flex justify-between text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-2">Result:</span>
                    <div className="font-medium flex items-center">
                      {matchupData.winner === matchupData.team1 ? (
                        <>
                          <span className="text-green-700">{matchupData.team1}</span>
                          <span className="mx-2 text-gray-400">advances as</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                            {getSeedOutcome(gameType, true)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-green-700">{matchupData.team2}</span>
                          <span className="mx-2 text-gray-400">advances as</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                            {getSeedOutcome(gameType, true)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {isUserMode && predictionResult.hasResult && (
                <div className={`mt-2 text-xs p-2 rounded text-center flex items-center justify-center ${
                  predictionResult.isCorrect ? 'text-green-700 bg-green-100 border border-green-200' : 'text-amber-700 bg-amber-100 border border-amber-200'
                }`}>
                  {predictionResult.isCorrect && <FaTrophy className="text-yellow-500 mr-2" />}
                  <span className="font-medium">{predictionResult.message}</span>
                </div>
              )}
              {isUserMode && !isLocked && !showResults && gameType === 'finalPlayInGame' && (!matchupData.team1 || !matchupData.team2) && (
                <div className="mt-2 text-xs text-yellow-600 bg-yellow-100 border border-yellow-200 p-2 rounded text-center">
                  Complete earlier games to set teams for the final game
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-3 text-sm text-gray-500">
              {isUserMode ? (showResults ? "No teams set for this game" : "Select winners above to proceed") : "Select teams above to set up this game"}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConferencePlayIn = (conference) => {
    const confStyle = conference === 'East' ? "border-blue-300 bg-blue-50" : "border-red-300 bg-red-50";

    return (
      <div className={`border ${confStyle} rounded-lg p-4 shadow-sm`}>
        {renderTeamSelection(conference)}
        <h3 className={`font-semibold mb-3 px-3 py-2 ${conference === 'East' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'} rounded-md uppercase`}>
          {conference}ern Conference Play-In Tournament
        </h3>
        {renderPlayInGame(conference, 'seventhEighthGame', '7th vs 8th Seed', 'Winner secures 7th seed, loser plays in final game')}
        {renderPlayInGame(conference, 'ninthTenthGame', '9th vs 10th Seed', 'Winner advances to final game, loser is eliminated')}
        {renderPlayInGame(conference, 'finalPlayInGame', 'Final Play-In Game', 'Winner secures 8th seed, loser is eliminated')}
      </div>
    );
  };

  // MAIN RENDER
  return (
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
      <div className="flex flex-wrap justify-between items-center mb-4 pb-4 border-b">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          {!isUserMode && onBack && (
            <button onClick={onBack} className="flex items-center text-gray-600 hover:text-indigo-600 transition">
              <FaArrowLeft className="mr-2" /> Back to Bracket
            </button>
          )}
          <h1 className="text-xl font-semibold text-gray-800">
            {isUserMode ? (showResults ? "Play-In Results" : "Play-In Predictions") : "Play-In Manager"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isUserMode && isLocked && !hidePredictionsLockedMessage && (
            <div className="px-3 py-1 bg-gray-100 text-xs font-medium text-gray-700 rounded-full flex items-center">
              <FaLock className="mr-1 text-gray-500" />
              {showResults ? "Official Results" : "Predictions Locked"}
            </div>
          )}
          {!isUserMode && isPlayInEnabled && (
            <button
              onClick={handleClearResults}
              disabled={isLeagueArchived}
              className={`flex items-center px-3 py-1 rounded text-sm ${isLeagueArchived ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 transition'}`}
            >
              <FaTrash className="mr-1" /> Clear Results
            </button>
          )}
          {isUserMode && !isLocked && !showResults && (
            <>
              <button
                onClick={handleUserClearPredictions}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaUndo className="mr-2" /> Reset
              </button>
              <button
                onClick={handleUserSave}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaSave className="mr-2" /> {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveFeedback && (
        <div className={`mb-4 p-3 rounded flex items-center justify-center text-sm font-medium ${
          saveFeedback.includes('Failed') || saveFeedback.includes('Error')
            ? 'bg-red-100 text-red-800 border border-red-300'
            : 'bg-green-100 text-green-800 border border-green-300'
        }`}>
          {saveFeedback.includes('Failed') || saveFeedback.includes('Error') ? (
            <FaInfoCircle className="mr-2 text-red-600" />
          ) : (
            <FaTrophy className="mr-2 text-green-600" />
          )}
          {saveFeedback}
        </div>
      )}

      {isLoading && !isUserMode ? (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-gray-600">Loading Play-In Tournament data...</p>
        </div>
      ) : (
        <div>
          {!hideAboutSection && (
            <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg text-sm">
              <div className="flex items-start">
                <FaInfoCircle className="mt-1 mr-2 text-blue-500" />
                <div>
                  <h3 className="font-semibold mb-1">About the Play-In Tournament</h3>
                  <p>The NBA Play-In determines the 7th and 8th seeds. Teams 7-10 compete:</p>
                  <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
                    <li>7th vs 8th: Winner gets 7th seed</li>
                    <li>9th vs 10th: Loser is out</li>
                    <li>Loser of 7/8 vs Winner of 9/10: Winner gets 8th seed</li>
                  </ul>
                  {isUserMode && (showResults ? (
                    <p className="mt-2 font-medium">Official Results</p>
                  ) : isLocked && !hidePredictionsLockedMessage ? (
                    <p className="mt-2 font-medium flex items-center"><FaLock className="mr-1" /> Predictions Locked</p>
                  ) : (
                    <p className="mt-2 font-medium">Pick your winners!</p>
                  ))}
                </div>
                {!isUserMode && (
                  <div className="ml-4 flex items-center">
                    <span className="text-xs font-medium mr-2">Enable Play-In:</span>
                    <button onClick={handleTogglePlayInEnabled} disabled={isLeagueArchived} className={`text-lg ${isLeagueArchived ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {isPlayInEnabled ? <FaToggleOn className="text-green-600" /> : <FaToggleOff className="text-gray-400" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            {isPlayInEnabled ? (
              <>
                <div>{renderConferencePlayIn('East')}</div>
                <div>{renderConferencePlayIn('West')}</div>
              </>
            ) : (
              <div className="col-span-2 text-center py-8 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                <FaInfoCircle className="text-lg mb-2" />
                <p>{isUserMode ? "Play-In not available this season." : "Enable Play-In to set up teams."}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BasePlayInPanel;
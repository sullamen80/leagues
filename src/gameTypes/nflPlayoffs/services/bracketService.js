import { collection, doc, getDoc, setDoc, updateDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getDefaultGameData } from '../utils/bracketUtils';
import { ROUND_KEYS } from '../constants/playoffConstants';

const initializeLeagueGameData = async (leagueId, playoffsData = null) => {
  try {
    if (!leagueId) throw new Error('League ID is required');

    const gameData = getDefaultGameData();

    if (playoffsData && playoffsData.playoffTeams) {
      gameData.playoffTeams = playoffsData.playoffTeams;
      gameData.seasonYear = playoffsData.seasonYear || new Date().getFullYear();
    }

    await setDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), gameData);

    const defaultLocks = {
      [ROUND_KEYS.FIRST_ROUND]: { locked: false, lockedAt: null },
      [ROUND_KEYS.CONF_SEMIS]: { locked: false, lockedAt: null },
      [ROUND_KEYS.CONF_FINALS]: { locked: false, lockedAt: null },
      [ROUND_KEYS.SUPER_BOWL]: { locked: false, lockedAt: null },
      [ROUND_KEYS.FINALS_MVP]: { locked: false, lockedAt: null }
    };

    await setDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'), defaultLocks);
    return true;
  } catch (error) {
    console.error('Error initializing NFL Playoffs game data:', error);
    throw error;
  }
};

const getUserBracket = async (leagueId, userId) => {
  try {
    if (!leagueId || !userId) throw new Error('League ID and User ID are required');

    const bracketRef = doc(db, 'leagues', leagueId, 'userData', userId);
    const bracketSnap = await getDoc(bracketRef);
    return bracketSnap.exists() ? bracketSnap.data() : null;
  } catch (error) {
    console.error('Error fetching user bracket:', error);
    throw error;
  }
};

const saveUserBracket = async (leagueId, userId, bracketData) => {
  try {
    if (!leagueId || !userId) throw new Error('League ID and User ID are required');
    if (!bracketData) throw new Error('Bracket data is required');

    const cleanData = JSON.parse(JSON.stringify(bracketData));
    cleanData.updatedAt = new Date().toISOString();

    await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), cleanData, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving user bracket:', error);
    throw error;
  }
};

const saveUserBracketRound = async (leagueId, userId, roundName, roundData) => {
  try {
    if (!leagueId || !userId || !roundName) throw new Error('League ID, User ID, and Round name are required');
    if (!roundData) throw new Error('Round data is required');

    const cleanData = JSON.parse(JSON.stringify(roundData));

    await updateDoc(doc(db, 'leagues', leagueId, 'userData', userId), {
      [roundName]: cleanData,
      updatedAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error(`Error saving ${roundName}:`, error);
    throw error;
  }
};

const saveUserFinalsMVP = async (leagueId, userId, mvpId) => {
  try {
    if (!leagueId || !userId || !mvpId) throw new Error('League ID, User ID, and MVP ID are required');

    await updateDoc(doc(db, 'leagues', leagueId, 'userData', userId), {
      [ROUND_KEYS.FINALS_MVP]: mvpId,
      updatedAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Error saving Finals MVP prediction:', error);
    throw error;
  }
};

const createBracketTemplate = async (leagueId, playoffsData) => {
  try {
    if (!leagueId) throw new Error('League ID is required');

  const templateData = {
    playoffTeams: playoffsData.playoffTeams || getDefaultGameData().playoffTeams,
    seasonYear: playoffsData.seasonYear || new Date().getFullYear(),
    superWinnerPick: playoffsData.superWinnerPick || '',
    [ROUND_KEYS.FIRST_ROUND]: (playoffsData[ROUND_KEYS.FIRST_ROUND] || []).map((matchup) => ({
        team1: matchup.team1 || '',
        team1Seed: matchup.team1Seed || null,
        team2: matchup.team2 || '',
        team2Seed: matchup.team2Seed || null,
        team1Score: matchup.team1Score ?? null,
        team2Score: matchup.team2Score ?? null,
        spreadLine: matchup.spreadLine ?? null,
        overUnderLine: matchup.overUnderLine ?? null,
        spreadPick: matchup.spreadPick ?? null,
        overUnderPick: matchup.overUnderPick ?? null,
        winner: '',
        winnerSeed: null,
        gamesPlayed: null,
        numGames: 1,
        conference: matchup.conference
      })),
      [ROUND_KEYS.CONF_SEMIS]: (playoffsData[ROUND_KEYS.CONF_SEMIS] || []).map((matchup) => ({
        team1: matchup.team1 || '',
        team1Seed: matchup.team1Seed || null,
        team2: matchup.team2 || '',
        team2Seed: matchup.team2Seed || null,
        team1Score: matchup.team1Score ?? null,
        team2Score: matchup.team2Score ?? null,
        spreadLine: matchup.spreadLine ?? null,
        overUnderLine: matchup.overUnderLine ?? null,
        spreadPick: matchup.spreadPick ?? null,
        overUnderPick: matchup.overUnderPick ?? null,
        winner: '',
        winnerSeed: null,
        gamesPlayed: null,
        numGames: 1,
        conference: matchup.conference
      })),
      [ROUND_KEYS.CONF_FINALS]: (playoffsData[ROUND_KEYS.CONF_FINALS] || []).map((matchup) => ({
        team1: matchup.team1 || '',
        team1Seed: matchup.team1Seed || null,
        team2: matchup.team2 || '',
        team2Seed: matchup.team2Seed || null,
        team1Score: matchup.team1Score ?? null,
        team2Score: matchup.team2Score ?? null,
        spreadLine: matchup.spreadLine ?? null,
        overUnderLine: matchup.overUnderLine ?? null,
        spreadPick: matchup.spreadPick ?? null,
        overUnderPick: matchup.overUnderPick ?? null,
        winner: '',
        winnerSeed: null,
        gamesPlayed: null,
        numGames: 1,
        conference: matchup.conference
      })),
      [ROUND_KEYS.SUPER_BOWL]: {
        team1: playoffsData[ROUND_KEYS.SUPER_BOWL]?.team1 || '',
        team1Seed: playoffsData[ROUND_KEYS.SUPER_BOWL]?.team1Seed || null,
        team1Conference: 'AFC',
        team2: playoffsData[ROUND_KEYS.SUPER_BOWL]?.team2 || '',
        team2Seed: playoffsData[ROUND_KEYS.SUPER_BOWL]?.team2Seed || null,
        team2Conference: 'NFC',
        team1Score: playoffsData[ROUND_KEYS.SUPER_BOWL]?.team1Score ?? null,
        team2Score: playoffsData[ROUND_KEYS.SUPER_BOWL]?.team2Score ?? null,
        spreadLine: playoffsData[ROUND_KEYS.SUPER_BOWL]?.spreadLine ?? null,
        overUnderLine: playoffsData[ROUND_KEYS.SUPER_BOWL]?.overUnderLine ?? null,
        spreadPick: playoffsData[ROUND_KEYS.SUPER_BOWL]?.spreadPick ?? null,
        overUnderPick: playoffsData[ROUND_KEYS.SUPER_BOWL]?.overUnderPick ?? null,
        winner: '',
        winnerSeed: null,
        winnerConference: '',
        gamesPlayed: null,
        numGames: 1,
        predictedMVP: ''
      },
      [ROUND_KEYS.CHAMPION]: '',
      ChampionSeed: null,
      [ROUND_KEYS.FINALS_MVP]: '',
      propBets: playoffsData.propBets || [],
      propBetSelections: {},
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

const createUserBracketFromTemplate = async (leagueId, userId) => {
  try {
    if (!leagueId || !userId) throw new Error('League ID and User ID are required');

    const templateRef = doc(db, 'leagues', leagueId, 'bracketTemplate', 'current');
    const templateSnap = await getDoc(templateRef);

    let templateData;
    if (templateSnap.exists()) {
      templateData = templateSnap.data();
    } else {
      const playoffsRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
      const playoffsSnap = await getDoc(playoffsRef);
      if (!playoffsSnap.exists()) {
        throw new Error('No template or playoffs data available');
      }
      const playoffsData = playoffsSnap.data();
      await createBracketTemplate(leagueId, playoffsData);
      const newTemplateSnap = await getDoc(templateRef);
      if (!newTemplateSnap.exists()) {
        throw new Error('Failed to create bracket template');
      }
      templateData = newTemplateSnap.data();
    }

    const scrubMatchup = (matchup) => ({
      ...matchup,
      team1Score: null,
      team2Score: null,
      spreadPick: null,
      overUnderPick: null
    });

    const scrubRound = (roundKey) =>
      Array.isArray(templateData[roundKey])
        ? templateData[roundKey].map(scrubMatchup)
        : [];

    const scrubbedSuperBowl = templateData[ROUND_KEYS.SUPER_BOWL]
      ? scrubMatchup(templateData[ROUND_KEYS.SUPER_BOWL])
      : templateData[ROUND_KEYS.SUPER_BOWL];

    const userData = {
      ...templateData,
      [ROUND_KEYS.FIRST_ROUND]: scrubRound(ROUND_KEYS.FIRST_ROUND),
      [ROUND_KEYS.CONF_SEMIS]: scrubRound(ROUND_KEYS.CONF_SEMIS),
      [ROUND_KEYS.CONF_FINALS]: scrubRound(ROUND_KEYS.CONF_FINALS),
      [ROUND_KEYS.SUPER_BOWL]: scrubbedSuperBowl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId,
      isTemplate: false,
      propBetSelections: {},
      superWinnerPick: templateData.superWinnerPick || ''
    };

    await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), userData);
    return true;
  } catch (error) {
    console.error('Error creating user bracket from template:', error);
    throw error;
  }
};

const getAllUserBrackets = async (leagueId) => {
  try {
    if (!leagueId) throw new Error('League ID is required');

    const bracketsRef = collection(db, 'leagues', leagueId, 'userData');
    const bracketsSnap = await getDocs(bracketsRef);

    const brackets = [];
    bracketsSnap.forEach((docSnap) => {
      brackets.push({ id: docSnap.id, ...docSnap.data() });
    });

    return brackets;
  } catch (error) {
    console.error('Error fetching all user brackets:', error);
    throw error;
  }
};

const listenToUserBracket = (leagueId, userId, onData, onError) => {
  if (!leagueId || !userId) return () => {};

  const bracketRef = doc(db, 'leagues', leagueId, 'userData', userId);
  return onSnapshot(
    bracketRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData?.(snapshot.data());
      } else {
        onData?.(null);
      }
    },
    (error) => {
      console.error('Error listening to user bracket:', error);
      onError?.(error);
    }
  );
};

export {
  initializeLeagueGameData,
  getUserBracket,
  saveUserBracket,
  saveUserBracketRound,
  saveUserFinalsMVP,
  createBracketTemplate,
  createUserBracketFromTemplate,
  getAllUserBrackets,
  listenToUserBracket
};

export default initializeLeagueGameData;

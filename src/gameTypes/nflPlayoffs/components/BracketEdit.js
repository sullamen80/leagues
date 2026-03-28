import React, { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import BaseEditor from '../../common/components/BaseEditor';
import BracketEditor from './BracketEditor';
import { db } from '../../../firebase';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';
import { 
  getDefaultGameData
} from '../utils/bracketUtils';

const createEmptyMatchup = (conference) => ({
  team1: '',
  team1Seed: null,
  team2: '',
  team2Seed: null,
  team1Score: null,
  team2Score: null,
  spreadLine: null,
  overUnderLine: null,
  spreadPick: null,
  overUnderPick: null,
  winner: '',
  winnerSeed: null,
  gamesPlayed: null,
  numGames: null,
  conference
});

const buildEmptyBracket = (template = null) => {
  const source = template ? JSON.parse(JSON.stringify(template)) : getDefaultGameData();

  const firstRound = (source[ROUND_KEYS.FIRST_ROUND] || []).map((matchup) => ({
    ...createEmptyMatchup(matchup?.conference || 'AFC'),
    ...matchup,
    team1Score: null,
    team2Score: null,
    spreadPick: null,
    overUnderPick: null,
    winner: '',
    winnerSeed: null,
    gamesPlayed: null,
    numGames: matchup?.numGames ?? 1
  }));

  const semisTemplate = source[ROUND_KEYS.CONF_SEMIS] || [];
  const semis = [
    createEmptyMatchup('AFC'),
    createEmptyMatchup('AFC'),
    createEmptyMatchup('NFC'),
    createEmptyMatchup('NFC')
  ].map((matchup, idx) => ({
    ...matchup,
    ...semisTemplate[idx],
    team1Score: null,
    team2Score: null,
    spreadPick: null,
    overUnderPick: null
  }));

  const finalsTemplate = source[ROUND_KEYS.CONF_FINALS] || [];
  const finals = [
    createEmptyMatchup('AFC'),
    createEmptyMatchup('NFC')
  ].map((matchup, idx) => ({
    ...matchup,
    ...finalsTemplate[idx],
    team1Score: null,
    team2Score: null,
    spreadPick: null,
    overUnderPick: null
  }));

  const superBowlTemplate = source[ROUND_KEYS.SUPER_BOWL] || {};

  const superBowl = {
    team1: superBowlTemplate.team1 || '',
    team1Seed: superBowlTemplate.team1Seed ?? null,
    team1Conference: 'AFC',
    team2: superBowlTemplate.team2 || '',
    team2Seed: superBowlTemplate.team2Seed ?? null,
    team2Conference: 'NFC',
    team1Score: null,
    team2Score: null,
    spreadLine: superBowlTemplate.spreadLine ?? null,
    overUnderLine: superBowlTemplate.overUnderLine ?? null,
    spreadPick: null,
    overUnderPick: null,
    winner: '',
    winnerSeed: null,
    winnerConference: '',
    gamesPlayed: null,
    numGames: superBowlTemplate.numGames ?? 1,
    predictedMVP: ''
  };

  return {
    ...source,
    [ROUND_KEYS.FIRST_ROUND]: firstRound,
    [ROUND_KEYS.CONF_SEMIS]: semis,
    [ROUND_KEYS.CONF_FINALS]: finals,
    [ROUND_KEYS.SUPER_BOWL]: superBowl,
    [ROUND_KEYS.CHAMPION]: '',
    ChampionSeed: null,
    [ROUND_KEYS.FINALS_MVP]: '',
    propBetSelections: source.propBetSelections || {},
    superWinnerPick: source.superWinnerPick || ''
  };
};

const BracketEdit = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  lockStatus = {}
}) => {
  const bracketInstructions = {
    title: 'How to fill out your NFL Playoffs bracket:',
    items: [
      'Enter the score for each matchup to lock in your winner',
      'Each round opens after the previous round has finished officially',
      'You cannot advance future rounds until the real-life bracket is updated',
      `Don’t forget to select a ${ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} pick`,
    ]
  };

  const [scoringSettings, setScoringSettings] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!propLeagueId) {
      setScoringSettings(null);
      return () => {};
    }

    const loadScoringSettings = async () => {
      try {
        const scoringRef = doc(db, 'leagues', propLeagueId, 'settings', 'scoring');
        const scoringSnap = await getDoc(scoringRef);
        if (!mounted) return;
        setScoringSettings(scoringSnap.exists() ? scoringSnap.data() : null);
      } catch (err) {
        console.error('[BracketEdit] Failed to load scoring settings:', err);
        if (mounted) setScoringSettings(null);
      }
    };

    loadScoringSettings();
    return () => {
      mounted = false;
    };
  }, [propLeagueId]);

  const fetchBracketData = useCallback(async (leagueId, userId) => {
    if (!leagueId || !userId) throw new Error('League ID and User ID are required');

    const tournamentRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error('Tournament data not found');
    const gameData = tournamentSnap.data();

    const userRef = doc(db, 'leagues', leagueId, 'userData', userId);
    const userSnap = await getDoc(userRef);
    let userEntry = userSnap.exists() ? userSnap.data() : null;

    if (!userEntry) {
      userEntry = buildEmptyBracket(gameData);
      userEntry.createdAt = new Date().toISOString();
      await setDoc(userRef, userEntry);
    }

    return {
      gameData,
      userEntry,
      isLocked: false
    };
  }, []);

  const createEmptyBracket = useCallback((template) => buildEmptyBracket(template), []);
  const resetBracket = useCallback((gameData) => buildEmptyBracket(gameData), []);

  const saveBracket = useCallback(async (leagueId, userId, bracketData) => {
    if (!leagueId || !userId) throw new Error('League ID and User ID are required');
    if (!bracketData) throw new Error('Bracket data is required');

    const payload = JSON.parse(JSON.stringify(bracketData));
    if (payload[ROUND_KEYS.SUPER_BOWL]?.winner) {
      payload[ROUND_KEYS.CHAMPION] = payload[ROUND_KEYS.SUPER_BOWL].winner;
      payload.ChampionSeed = payload[ROUND_KEYS.SUPER_BOWL].winnerSeed ?? null;
    } else {
      payload[ROUND_KEYS.CHAMPION] = '';
      payload.ChampionSeed = null;
    }

    payload.updatedAt = new Date().toISOString();
    await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), payload, { merge: true });
  }, []);

  const BracketEditorWrapper = ({ data, gameData, onUpdate, isLocked, entryId, lockStatus = {} }) => {
    const teamPlayers = gameData?.mvpCandidates || {};
    const officialMVP = gameData?.[ROUND_KEYS.FINALS_MVP] || null;
    const propBets = Array.isArray(gameData?.propBets) ? gameData.propBets : [];
    const playoffTeams = gameData?.playoffTeams || {};
    const mergedScoringSettings = scoringSettings || gameData?.scoringSettings || null;

    const handleSeriesPrediction = (
      round,
      index,
      winner,
      winnerSeed,
      numGames,
      mvp,
      extraFields = {}
    ) => {
      const roundLocked = Boolean(lockStatus?.[round]?.locked);
      if (isLocked || roundLocked) return;
      const updatedBracket = JSON.parse(JSON.stringify(data));

      if (round === ROUND_KEYS.SUPER_BOWL) {
        updatedBracket[ROUND_KEYS.SUPER_BOWL] = {
          ...updatedBracket[ROUND_KEYS.SUPER_BOWL],
          ...extraFields,
          winner,
          winnerSeed,
          numGames,
          predictedMVP: mvp || updatedBracket[ROUND_KEYS.SUPER_BOWL]?.predictedMVP || ''
        };
        updatedBracket[ROUND_KEYS.CHAMPION] = winner || '';
        updatedBracket.ChampionSeed = winnerSeed ?? null;

        if (mvp) {
          updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
        }
      } else {
        if (!Array.isArray(updatedBracket[round])) return;
        updatedBracket[round][index] = {
          ...updatedBracket[round][index],
           ...extraFields,
          winner,
          winnerSeed,
          numGames
        };
      }

      onUpdate(updatedBracket);
    };

    const handleMVPSelect = (mvp) => {
      const finalsLocked = Boolean(
        lockStatus?.[ROUND_KEYS.FINALS_MVP]?.locked ||
        lockStatus?.[ROUND_KEYS.SUPER_BOWL]?.locked
      );
      if (isLocked || finalsLocked) return;
      const updatedBracket = JSON.parse(JSON.stringify(data));
      updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
      if (updatedBracket[ROUND_KEYS.SUPER_BOWL]) {
        updatedBracket[ROUND_KEYS.SUPER_BOWL].predictedMVP = mvp;
      }
      onUpdate(updatedBracket);
    };

    return (
      <BracketEditor
        bracketData={data}
        onBracketUpdate={onUpdate}
        onSeriesPrediction={handleSeriesPrediction}
        onMVPSelect={handleMVPSelect}
        isAdmin={false}
        isLocked={isLocked}
        hasPlayInTournament={false}
        mvpPredictionMode={false}
        teamPlayers={teamPlayers}
        officialMVP={officialMVP}
        propBets={propBets}
        playoffTeams={playoffTeams}
        scoringSettings={mergedScoringSettings}
        officialBracket={gameData}
        lockStatus={lockStatus}
        entryId={entryId}
      />
    );
  };

  return (
    <BaseEditor
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      hideBackButton={hideBackButton}
      entryType="Playoffs Bracket"
      fetchData={fetchBracketData}
      createEmptyEntry={createEmptyBracket}
      saveEntry={saveBracket}
      resetEntry={resetBracket}
      instructions={bracketInstructions}
      EditorComponent={BracketEditorWrapper}
      editorProps={{ lockStatus }}
    />
  );
};

export default BracketEdit;

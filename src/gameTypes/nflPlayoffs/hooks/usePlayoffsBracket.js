import { useState, useEffect, useCallback } from 'react';
import { auth } from '../../../firebase';
import {
  createUserBracketFromTemplate,
  saveUserBracket,
  saveUserBracketRound,
  saveUserFinalsMVP,
  listenToUserBracket
} from '../services/bracketService';
import { listenToLockStatus } from '../services/playoffsService';
import {
  getDefaultGameData,
  applyBracketAdvancement,
  ensureRoundStructure,
  ensureSuperBowlStructure
} from '../utils/bracketUtils';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Simplified NFL Playoffs hook for working directly with a user's bracket document.
 * Focuses on subscribing to Firestore, handling locks, and saving user predictions.
 */
const usePlayoffsBracket = (leagueId, userId = null, readOnly = false) => {
  const [bracketData, setBracketData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [lockStatus, setLockStatus] = useState({});

  const currentUserId = auth.currentUser?.uid;
  const targetUserId = userId || currentUserId;

  useEffect(() => {
    if (!leagueId || !targetUserId) {
      setError('League ID and user ID are required');
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);

    const unsubscribeLocks = listenToLockStatus(
      leagueId,
      (locks) => setLockStatus(locks || {}),
      (err) => console.error('Error listening to lock status:', err)
    );

    const unsubscribeBracket = listenToUserBracket(
      leagueId,
      targetUserId,
      (data) => {
        setBracketData(data || null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to bracket:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeLocks();
      unsubscribeBracket();
    };
  }, [leagueId, targetUserId]);

  const isRoundLocked = useCallback(
    (round) => lockStatus?.[round]?.locked || false,
    [lockStatus]
  );

  const initializeBracket = useCallback(async () => {
    if (!leagueId || !targetUserId || readOnly) return false;

    try {
      setIsLoading(true);
      await createUserBracketFromTemplate(leagueId, targetUserId);
      setFeedback('Bracket created!');
      setTimeout(() => setFeedback(''), 3000);
      return true;
    } catch (err) {
      console.error('Error creating bracket:', err);
      setError(err.message);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, targetUserId, readOnly]);

  const saveBracket = useCallback(
    async (data = bracketData) => {
      if (!leagueId || !targetUserId || readOnly) return false;
      if (!data) return false;

      try {
        setIsSaving(true);
        await saveUserBracket(leagueId, targetUserId, data);
        setFeedback('Bracket saved!');
        setTimeout(() => setFeedback(''), 3000);
        return true;
      } catch (err) {
        console.error('Error saving bracket:', err);
        setError(err.message);
        setFeedback(`Error: ${err.message}`);
        setTimeout(() => setFeedback(''), 3000);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [leagueId, targetUserId, readOnly, bracketData]
  );

  const saveRound = useCallback(
    async (roundName, roundData) => {
      if (!leagueId || !targetUserId || readOnly) return false;
      if (isRoundLocked(roundName)) return false;

      try {
        setIsSaving(true);
        await saveUserBracketRound(leagueId, targetUserId, roundName, roundData);
        setFeedback(`${roundName} saved`);
        setTimeout(() => setFeedback(''), 3000);
        return true;
      } catch (err) {
        console.error(`Error saving ${roundName}:`, err);
        setError(err.message);
        setFeedback(`Error: ${err.message}`);
        setTimeout(() => setFeedback(''), 3000);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [leagueId, targetUserId, readOnly, isRoundLocked]
  );

  const updateSeries = useCallback(
    async (round, index, winner, winnerSeed = null, gamesPlayed = 1, mvp = null) => {
      if (!leagueId || !targetUserId || readOnly) return false;
      if (isRoundLocked(round)) return false;
      if (!bracketData) return false;

      try {
        setIsSaving(true);

        const updated = JSON.parse(JSON.stringify(bracketData));
        if (round === ROUND_KEYS.SUPER_BOWL) {
          updated[ROUND_KEYS.SUPER_BOWL] = {
            ...ensureSuperBowlStructure(bracketData),
            winner,
            winnerSeed,
            gamesPlayed,
            predictedMVP: mvp || updated[ROUND_KEYS.SUPER_BOWL]?.predictedMVP || ''
          };
          updated[ROUND_KEYS.CHAMPION] = winner || '';
          updated.ChampionSeed = winnerSeed ?? null;
        } else {
          const roundData = ensureRoundStructure(updated, round);
          roundData[index] = {
            ...roundData[index],
            winner,
            winnerSeed,
            gamesPlayed
          };
          updated[round] = roundData;
          applyBracketAdvancement(updated, round, bracketData);
        }

        await saveUserBracket(leagueId, targetUserId, updated);
        setBracketData(updated);
        setFeedback('Series updated');
        setTimeout(() => setFeedback(''), 3000);
        return true;
      } catch (err) {
        console.error('Error updating matchup:', err);
        setError(err.message);
        setFeedback(`Error: ${err.message}`);
        setTimeout(() => setFeedback(''), 3000);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [leagueId, targetUserId, readOnly, bracketData, isRoundLocked]
  );

  const updateFinalsMVP = useCallback(
    async (playerId) => {
      if (!leagueId || !targetUserId || readOnly) return false;
      if (isRoundLocked(ROUND_KEYS.FINALS_MVP)) return false;

      try {
        setIsSaving(true);
        await saveUserFinalsMVP(leagueId, targetUserId, playerId);
        setBracketData((prev) => ({ ...(prev || {}), [ROUND_KEYS.FINALS_MVP]: playerId }));
        setFeedback('MVP pick saved');
        setTimeout(() => setFeedback(''), 3000);
        return true;
      } catch (err) {
        console.error('Error updating MVP pick:', err);
        setError(err.message);
        setFeedback(`Error: ${err.message}`);
        setTimeout(() => setFeedback(''), 3000);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [leagueId, targetUserId, readOnly, isRoundLocked]
  );

  const repairBracketData = useCallback(() => {
    if (!bracketData) return;
    const repaired = JSON.parse(JSON.stringify(bracketData));
    [ROUND_KEYS.FIRST_ROUND, ROUND_KEYS.CONF_SEMIS, ROUND_KEYS.CONF_FINALS].forEach((round) => {
      applyBracketAdvancement(repaired, round, bracketData);
    });
    applyBracketAdvancement(repaired, ROUND_KEYS.SUPER_BOWL, bracketData);
    setBracketData(repaired);
  }, [bracketData]);

  const getRoundData = useCallback(
    (roundName) => {
      if (roundName === ROUND_KEYS.SUPER_BOWL) {
        return ensureSuperBowlStructure(bracketData || getDefaultGameData());
      }
      if (roundName === ROUND_KEYS.FINALS_MVP) {
        return bracketData?.[ROUND_KEYS.FINALS_MVP] || '';
      }
      return ensureRoundStructure(bracketData || getDefaultGameData(), roundName);
    },
    [bracketData]
  );

  return {
    bracketData,
    isLoading,
    isSaving,
    error,
    feedback,
    lockStatus,
    initialized: Boolean(bracketData),
    isLocked: isRoundLocked(ROUND_KEYS.FIRST_ROUND),
    hasPlayInTournament: false,
    getRoundData,
    getEligibleMVPCandidates: () => [],
    initializeBracket,
    saveBracket,
    saveRound,
    updateSeries,
    updateFinalsMVP,
    repairBracket: repairBracketData,
    isRoundLocked
  };
};

export default usePlayoffsBracket;

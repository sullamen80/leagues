import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth } from '../../../firebase';
import {
  listenToPlayoffsData,
  savePlayoffsData,
  updateFinalsMVP
} from '../services/playoffsService';
import {
  saveUserBracket,
  saveUserFinalsMVP,
  listenToUserBracket
} from '../services/bracketService';
import {
  getDefaultGameData,
  applyBracketAdvancement,
  ensureRoundStructure,
  ensureSuperBowlStructure
} from '../utils/bracketUtils';
import { ROUND_KEYS } from '../constants/playoffConstants';

const usePlayoffs = (leagueId, mode = 'user', isLocked = false) => {
  const [playoffsData, setPlayoffsData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!leagueId) {
      setError('League ID is required');
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);
    const unsubscribePlayoffs = listenToPlayoffsData(
      leagueId,
      (data) => {
        setPlayoffsData(data || getDefaultGameData());
        if (mode !== 'user' || !userId) {
          setIsLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to playoffs data:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    let unsubscribeBracket = () => {};
    if (mode === 'user' && userId) {
      unsubscribeBracket = listenToUserBracket(
        leagueId,
        userId,
        (data) => {
          setUserBracket(data);
          setIsLoading(false);
        },
        (err) => {
          console.error('Error listening to user bracket:', err);
          setError(err.message);
          setIsLoading(false);
        }
      );
    } else {
      setUserBracket(null);
    }

    return () => {
      unsubscribePlayoffs();
      unsubscribeBracket();
    };
  }, [leagueId, mode, userId]);

  const activeData = useMemo(() => {
    if (mode === 'admin') {
      return playoffsData || getDefaultGameData();
    }
    return userBracket || playoffsData || getDefaultGameData();
  }, [mode, playoffsData, userBracket]);

  const getRound = useCallback(
    (roundName) => {
      if (roundName === ROUND_KEYS.SUPER_BOWL) {
        return ensureSuperBowlStructure(activeData);
      }
      if (roundName === ROUND_KEYS.FINALS_MVP) {
        return activeData?.[ROUND_KEYS.FINALS_MVP] || '';
      }
      return ensureRoundStructure(activeData, roundName);
    },
    [activeData]
  );

  const commitAdminUpdate = useCallback(
    async (updatedData) => {
      setPlayoffsData(updatedData);
      await savePlayoffsData(leagueId, updatedData);
    },
    [leagueId]
  );

  const commitUserUpdate = useCallback(
    async (updatedBracket) => {
      setUserBracket(updatedBracket);
      await saveUserBracket(leagueId, userId, updatedBracket);
    },
    [leagueId, userId]
  );

  const handleSelectWinner = useCallback(
    async (round, index, winner, winnerSeed = null, gamesPlayed = 1, mvp = null) => {
      if (!leagueId) return;

      const referenceData = playoffsData || getDefaultGameData();

      const finishWithFeedback = (message) => {
        setFeedbackMessage(message);
        setTimeout(() => setFeedbackMessage(''), 3000);
      };

      try {
        setIsSaving(true);

        if (round === ROUND_KEYS.FINALS_MVP) {
          if (mode === 'admin') {
            await updateFinalsMVP(leagueId, winner);
            setPlayoffsData((prev) => ({ ...(prev || {}), [ROUND_KEYS.FINALS_MVP]: winner }));
          } else if (mode === 'user' && userId && !isLocked) {
            await saveUserFinalsMVP(leagueId, userId, winner);
            setUserBracket((prev) => ({ ...(prev || {}), [ROUND_KEYS.FINALS_MVP]: winner }));
          }
          finishWithFeedback('MVP pick saved');
          setIsSaving(false);
          return;
        }

        if (mode === 'admin') {
          const updated = JSON.parse(JSON.stringify(playoffsData || getDefaultGameData()));

          if (round === ROUND_KEYS.SUPER_BOWL) {
            updated[ROUND_KEYS.SUPER_BOWL] = {
              ...ensureSuperBowlStructure(updated),
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
            applyBracketAdvancement(updated, round, referenceData);
          }

          await commitAdminUpdate(updated);
          finishWithFeedback('Playoffs updated');
        } else if (mode === 'user' && userId && !isLocked && userBracket) {
          const updatedBracket = JSON.parse(JSON.stringify(userBracket));

          if (round === ROUND_KEYS.SUPER_BOWL) {
            updatedBracket[ROUND_KEYS.SUPER_BOWL] = {
              ...ensureSuperBowlStructure(updatedBracket),
              winner,
              winnerSeed,
              gamesPlayed,
              predictedMVP: mvp || updatedBracket[ROUND_KEYS.SUPER_BOWL]?.predictedMVP || ''
            };
            updatedBracket[ROUND_KEYS.CHAMPION] = winner || '';
            updatedBracket.ChampionSeed = winnerSeed ?? null;
          } else {
            const roundData = ensureRoundStructure(updatedBracket, round);
            roundData[index] = {
              ...roundData[index],
              winner,
              winnerSeed,
              gamesPlayed
            };
            updatedBracket[round] = roundData;
            applyBracketAdvancement(updatedBracket, round, referenceData);
          }

          await commitUserUpdate(updatedBracket);
          finishWithFeedback('Bracket updated');
        }
      } catch (err) {
        console.error('Error updating bracket:', err);
        setError(err.message);
        finishWithFeedback(`Error: ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    },
    [leagueId, mode, playoffsData, userBracket, userId, isLocked, commitAdminUpdate, commitUserUpdate]
  );

  const saveBracket = useCallback(async () => {
    if (mode !== 'user' || !userId || !userBracket || isLocked) return;

    try {
      setIsSaving(true);
      await saveUserBracket(leagueId, userId, userBracket);
      setFeedbackMessage('Bracket saved successfully!');
      setTimeout(() => setFeedbackMessage(''), 3000);
    } catch (err) {
      console.error('Error saving bracket:', err);
      setError(err.message);
      setFeedbackMessage(`Error: ${err.message}`);
      setTimeout(() => setFeedbackMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [leagueId, mode, userId, userBracket, isLocked]);

  return {
    playoffsData,
    userBracket,
    activeData,
    isLoading,
    error,
    isSaving,
    feedbackMessage,
    getRound,
    handleSelectWinner,
    saveBracket
  };
};

export default usePlayoffs;

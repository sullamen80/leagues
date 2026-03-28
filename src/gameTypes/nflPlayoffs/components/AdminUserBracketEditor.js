import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import { db } from '../../../firebase';
import { useUrlParams } from '../../common/BaseGameModule';
import BracketEditor from './BracketEditor';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { applyBracketAdvancement } from '../utils/bracketUtils';
import { createUserBracketFromTemplate } from '../services/bracketService';

const AdminUserBracketEditor = ({ leagueId }) => {
  const params = useUrlParams();
  const targetUserId = params.targetUser || '';
  const navigate = useNavigate();
  const location = useLocation();

  const [gameData, setGameData] = useState(null);
  const [userEntry, setUserEntry] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const goBack = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'teams');
    searchParams.delete('targetUser');
    navigate(`${location.pathname}?${searchParams.toString()}`);
  }, [location, navigate]);

  useEffect(() => {
    const loadData = async () => {
      if (!leagueId || !targetUserId) {
        setError('Missing league or target user.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const gameSnap = await getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'));
        if (!gameSnap.exists()) {
          setError('Game data not found.');
          setLoading(false);
          return;
        }
        const data = gameSnap.data();
        setGameData(data);

        const entryRef = doc(db, 'leagues', leagueId, 'userData', targetUserId);
        let entrySnap = await getDoc(entryRef);
        if (!entrySnap.exists()) {
          await createUserBracketFromTemplate(leagueId, targetUserId);
          entrySnap = await getDoc(entryRef);
          if (!entrySnap.exists()) {
            throw new Error('Unable to initialize user bracket.');
          }
        }
        setUserEntry(entrySnap.data());

        const profileSnap = await getDoc(doc(db, 'users', targetUserId));
        setUserInfo(profileSnap.exists() ? profileSnap.data() : null);
        setLoading(false);
      } catch (err) {
        console.error('Error loading admin editor:', err);
        setError(err.message || 'Failed to load bracket data.');
        setLoading(false);
      }
    };

    loadData();
  }, [leagueId, targetUserId]);

  const updateBracketFlow = useCallback(
    (bracket, round) => {
      if (!gameData) return;
      applyBracketAdvancement(bracket, round, gameData);
    },
    [gameData]
  );

  const handleSeriesPrediction = (
    round,
    index,
    winner,
    winnerSeed,
    numGames,
    mvp,
    extraFields = {}
  ) => {
    if (!userEntry) return;
    const updatedBracket = JSON.parse(JSON.stringify(userEntry));

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
      updateBracketFlow(updatedBracket, round);
    }

    setUserEntry(updatedBracket);
  };

  const handleMVPSelect = (mvp) => {
    if (!userEntry) return;
    const updatedBracket = JSON.parse(JSON.stringify(userEntry));
    updatedBracket[ROUND_KEYS.FINALS_MVP] = mvp;
    if (updatedBracket[ROUND_KEYS.SUPER_BOWL]) {
      updatedBracket[ROUND_KEYS.SUPER_BOWL].predictedMVP = mvp;
    }
    setUserEntry(updatedBracket);
  };

  const handleSave = async () => {
    if (!leagueId || !targetUserId || !userEntry) {
      setFeedback('No bracket data to save.');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      setSaving(true);
      const payload = JSON.parse(JSON.stringify(userEntry));

      if (payload[ROUND_KEYS.SUPER_BOWL]?.winner) {
        payload[ROUND_KEYS.CHAMPION] = payload[ROUND_KEYS.SUPER_BOWL].winner;
        payload.ChampionSeed = payload[ROUND_KEYS.SUPER_BOWL].winnerSeed ?? null;
      } else {
        payload[ROUND_KEYS.CHAMPION] = '';
        payload.ChampionSeed = null;
      }

      payload.updatedAt = new Date().toISOString();
      await setDoc(doc(db, 'leagues', leagueId, 'userData', targetUserId), payload, { merge: true });
      setFeedback('Bracket saved successfully.');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error('Error saving bracket:', err);
      setFeedback(err.message || 'Failed to save bracket.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!targetUserId) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow">
        <button
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-indigo-600 mb-4"
        >
          <FaArrowLeft className="mr-2" /> Back to Participants
        </button>
        <p className="text-gray-600">No target user selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-center text-gray-600">Loading bracket editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow">
        <button
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-indigo-600 mb-4"
        >
          <FaArrowLeft className="mr-2" /> Back to Participants
        </button>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-indigo-600"
        >
          <FaArrowLeft className="mr-2" /> Back to Participants
        </button>
        <div>
          <div className="text-sm text-gray-500">Editing brackets for</div>
          <div className="text-lg font-semibold text-gray-800">
            {userInfo?.displayName || userInfo?.username || userInfo?.email || targetUserId}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded border ${
            feedback.toLowerCase().includes('fail') || feedback.toLowerCase().includes('error')
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}
        >
          {feedback}
        </div>
      )}

      <BracketEditor
        bracketData={userEntry}
        onBracketUpdate={setUserEntry}
        onSeriesPrediction={handleSeriesPrediction}
        onMVPSelect={handleMVPSelect}
        isAdmin
        isLocked={false}
        hasPlayInTournament={false}
        mvpPredictionMode={false}
        teamPlayers={gameData?.mvpCandidates || {}}
        officialMVP={gameData?.[ROUND_KEYS.FINALS_MVP] || null}
        propBets={Array.isArray(gameData?.propBets) ? gameData.propBets : []}
        playoffTeams={gameData?.playoffTeams || {}}
        scoringSettings={gameData?.scoringSettings || null}
        officialBracket={gameData}
        entryId={targetUserId}
      />

      <div className="flex justify-end gap-3">
        <button
          onClick={goBack}
          className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></span>
              Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <FaSave /> Save Changes
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminUserBracketEditor;

import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaExclamationTriangle, FaSave, FaTimes, FaTrash, FaUserEdit } from 'react-icons/fa';
import { auth, db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchWimbledonBundle,
  removeWimbledonParticipant,
  saveAdminWimbledonCorrection
} from '../services/wimbledonService';
import { countCompletedPredictions, getRequiredPredictionCount } from '../utils/drawUtils';
import DrawBracket from './DrawBracket';

const AdminParticipants = ({ leagueId }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [bundle, setBundle] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [picks, setPicks] = useState({});
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [participantToRemove, setParticipantToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const load = useCallback(async () => {
    const [nextBundle, snap] = await Promise.all([
      fetchWimbledonBundle(leagueId),
      getDocs(collection(db, 'leagues', leagueId, 'userData'))
    ]);
    const nextEntries = snap.docs.map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }));
    const selectedEntry = nextEntries.find((entry) => entry.id === selectedUserId) || nextEntries[0] || null;
    setBundle(nextBundle);
    setEntries(nextEntries);
    setSelectedUserId(selectedEntry?.id || '');
    setPicks(selectedEntry?.picksByMatchId || {});
  }, [leagueId, selectedUserId]);

  useEffect(() => { load(); }, [load]);

  const selectEntry = (entry) => {
    setSelectedUserId(entry.id);
    setPicks(entry.picksByMatchId || {});
    setFeedback('');
    setError('');
  };

  const saveCorrection = async () => {
    try {
      await saveAdminWimbledonCorrection(leagueId, selectedUserId, picks, {
        uid: auth.currentUser?.uid,
        reason
      });
      setFeedback('Correction saved with an audit entry.');
      setError('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const beginRemoveParticipant = (entry) => {
    setParticipantToRemove(entry);
    setFeedback('');
    setError('');
  };

  const confirmRemoveParticipant = async () => {
    if (!participantToRemove) return;

    try {
      setIsRemoving(true);
      await removeWimbledonParticipant(leagueId, participantToRemove.id, {
        uid: auth.currentUser?.uid,
        isAdmin,
        targetUserName: participantToRemove.userName || participantToRemove.id,
        reason: reason.trim() || 'Removed from Wimbledon participants admin'
      });
      setFeedback(`${participantToRemove.userName || participantToRemove.id} was removed from the league.`);
      setError('');
      setParticipantToRemove(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRemoving(false);
    }
  };

  if (!bundle) return <div className="p-8 text-center text-gray-500">Loading participants…</div>;
  if (bundle.league?.ownerId !== auth.currentUser?.uid && !isAdmin) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">You do not have permission to correct participant brackets.</div>;
  }
  const requiredPicks = getRequiredPredictionCount(bundle.gameData);
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(`/league/${leagueId}?view=admin`)}
        className="inline-flex items-center rounded bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
      >
        <FaArrowLeft className="mr-2" />Back to Admin
      </button>
      {feedback ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{feedback}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => (
          <div key={entry.id} className={`rounded-lg border-2 p-4 text-left shadow-sm transition ${selectedUserId === entry.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'}`}>
            <button type="button" onClick={() => selectEntry(entry)} className="block w-full text-left">
              <div className={`font-semibold ${selectedUserId === entry.id ? 'text-indigo-700' : 'text-gray-900'}`}>{entry.userName || entry.id}</div>
              <div className="mt-1 text-xs text-gray-500">{countCompletedPredictions(entry.picksByMatchId || {})}/{requiredPicks} picks</div>
            </button>
            <button
              type="button"
              onClick={() => beginRemoveParticipant(entry)}
              disabled={entry.id === auth.currentUser?.uid || bundle.league?.ownerId === entry.id || bundle.league?.status === 'archived'}
              className="mt-3 inline-flex items-center rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaTrash className="mr-1.5" /> Remove
            </button>
          </div>
        ))}
      </div>
      {!entries.length ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No Wimbledon participants found.
        </div>
      ) : null}
      {selectedUserId ? (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center font-bold text-amber-950"><FaUserEdit className="mr-2" />Bracket correction</div>
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 w-full rounded border border-amber-300 bg-white px-3 py-2" placeholder="Optional audit note" />
          </div>
          <DrawBracket gameData={bundle.gameData} picksByMatchId={picks} officialResultsByMatchId={bundle.gameData?.officialResultsByMatchId} editable={true} showResults={true} setPredictionEnabled={Boolean(bundle.scoring?.setPredictionEnabled)} scoringSettings={bundle.scoring} onChange={setPicks} />
          <button onClick={saveCorrection} className="inline-flex items-center rounded bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"><FaSave className="mr-2" />Save Audited Correction</button>
        </>
      ) : null}
      {participantToRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-3 text-red-600">
                <FaExclamationTriangle />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Remove participant?</h2>
                <p className="mt-2 text-sm text-gray-600">
                  This will remove <strong>{participantToRemove.userName || participantToRemove.id}</strong> from the league and delete their Wimbledon bracket.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setParticipantToRemove(null)}
                disabled={isRemoving}
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <FaTimes className="mr-2" /> Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveParticipant}
                disabled={isRemoving}
                className="inline-flex items-center justify-center rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <FaTrash className="mr-2" /> {isRemoving ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminParticipants;

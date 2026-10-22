import React, { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { FaArrowLeft, FaPlus, FaSyncAlt, FaUserMinus } from 'react-icons/fa';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';
import { DRAFT_STATUS } from '../constants/winsPoolConstants';
import { addWinsPoolParticipant, removeWinsPoolParticipant } from '../services/participantService';
import { buildParticipantRosters } from '../utils/participants';
import { updateLeagueLeaderboard } from '../services/scoringService';

const AdminParticipants = ({ leagueId, onBack }) => {
  const { currentUser, isAdmin } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [draftStatus, setDraftStatus] = useState(DRAFT_STATUS.NOT_STARTED);
  const [archived, setArchived] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const refresh = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
      if (!leagueSnap.exists()) throw new Error('League not found.');
      const league = leagueSnap.data();
      if (league.ownerId !== currentUser?.uid && !isAdmin) {
        throw new Error('You do not have permission to manage this league.');
      }

      const [rostersSnap, gameSnap] = await Promise.all([
        getDocs(collection(db, 'leagues', leagueId, 'userData')),
        getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'))
      ]);
      const rosters = rostersSnap.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
      const picks = gameSnap.data()?.draft?.picks || [];
      const rows = buildParticipantRosters(league, rosters).map((roster) => ({
        ...roster,
        teamCount: roster.teams.length,
        pickCount: picks.filter((pick) => pick.managerId === roster.id).length,
        isOwner: league.ownerId === roster.id
      }));

      setParticipants(rows.sort((a, b) => a.name.localeCompare(b.name)));
      setDraftStatus(gameSnap.data()?.draft?.status || DRAFT_STATUS.NOT_STARTED);
      setArchived(league.status === 'archived');
    } catch (error) {
      setParticipants([]);
      setFeedback({ tone: 'error', message: error.message || 'Failed to load participants.' });
    } finally {
      setLoading(false);
    }
  }, [leagueId, currentUser?.uid, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!identifier.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const user = await addWinsPoolParticipant({ leagueId, identifier });
      setIdentifier('');
      let leaderboardUpdated = true;
      try {
        await updateLeagueLeaderboard(leagueId);
      } catch (error) {
        leaderboardUpdated = false;
        console.warn('[WinsPool][AdminParticipants] Failed to recalculate leaderboard:', error);
      }
      await refresh();
      setFeedback({
        tone: leaderboardUpdated ? 'success' : 'warning',
        message: `${user.displayName || user.username || user.email || 'Participant'} was added.` +
          (leaderboardUpdated ? '' : ' Recalculate the leaderboard in Scoring Settings.')
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: error.message || 'Could not add participant.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (participant) => {
    if (!window.confirm(`Kick ${participant.name} from this league? Their roster and draft picks will be deleted.`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { removedPickCount } = await removeWinsPoolParticipant({ leagueId, userId: participant.id });
      let leaderboardUpdated = true;
      try {
        await updateLeagueLeaderboard(leagueId);
      } catch (error) {
        leaderboardUpdated = false;
        console.warn('[WinsPool][AdminParticipants] Failed to recalculate leaderboard:', error);
      }
      await refresh();
      setFeedback({
        tone: leaderboardUpdated ? 'success' : 'warning',
        message: `${participant.name} was removed${removedPickCount ? ` with ${removedPickCount} draft pick${removedPickCount === 1 ? '' : 's'}` : ''}.` +
          (leaderboardUpdated ? '' : ' Recalculate the leaderboard in Scoring Settings.')
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: error.message || 'Could not remove participant.' });
    } finally {
      setBusy(false);
    }
  };

  const filtered = participants.filter((participant) =>
    `${participant.name} ${participant.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const canAdd = !archived;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
            <FaArrowLeft /> Back to Admin Dashboard
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">Manage Participants</h1>
          <p className="text-sm text-gray-500">Add registered users and manage their Wins Pool membership.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50">
          <FaSyncAlt /> Refresh
        </button>
      </header>

      {feedback && (
        <div role="status" className={`rounded-md border px-4 py-3 text-sm ${
          feedback.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' :
          feedback.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' :
          'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>{feedback.message}</div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Add Participant</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="participant-identifier" className="sr-only">Email, username, or user ID</label>
          <input
            id="participant-identifier"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email, username, or user ID"
            disabled={!canAdd || busy}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button type="submit" disabled={!canAdd || busy || !identifier.trim()} className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            <FaPlus /> {busy ? 'Working…' : 'Add Person'}
          </button>
        </form>
        <p className="mt-2 text-sm text-gray-500">
          {archived ? 'Archived leagues cannot be changed.' :
            draftStatus === DRAFT_STATUS.NOT_STARTED
              ? 'The person must already have an account. They will be added to the draft order.'
              : 'The person must already have an account. Use Draft Console to make their picks.'}
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-800">Participants ({participants.length})</h2>
          <label htmlFor="participant-search" className="sr-only">Search participants</label>
          <input id="participant-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search participants" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {loading ? <p className="p-5 text-sm text-gray-500">Loading participants…</p> :
          filtered.length === 0 ? <p className="p-5 text-sm text-gray-500">No participants found.</p> : (
            <div className="divide-y divide-gray-100">
              {filtered.map((participant) => (
                <div key={participant.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium text-gray-800">{participant.name}{participant.isOwner ? ' · Owner' : ''}</p>
                    <p className="text-sm text-gray-500">{participant.email || participant.id}</p>
                    <p className="mt-1 text-xs text-gray-500">{participant.teamCount} teams · {participant.pickCount} picks</p>
                  </div>
                  {!participant.isOwner && (
                    <button type="button" onClick={() => handleRemove(participant)} disabled={busy || archived} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                      <FaUserMinus /> Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  );
};

export default AdminParticipants;

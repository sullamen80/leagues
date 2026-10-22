import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { FaArrowLeft, FaFileImport, FaLock, FaLockOpen, FaTrophy, FaUsers } from 'react-icons/fa';
import { auth, db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { endLeague } from '../../common/services/leagueService';
import { WIMBLEDON_LOCK_KEY } from '../constants/wimbledonConstants';
import { fetchWimbledonBundle } from '../services/wimbledonService';

const AdminDashboard = ({ leagueId }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [bundle, setBundle] = useState(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    fetchWimbledonBundle(leagueId).then(setBundle);
  }, [leagueId]);

  if (!bundle) return <div className="p-8 text-center text-gray-500">Loading admin…</div>;
  if (bundle.league?.ownerId !== auth.currentUser?.uid && !isAdmin) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">You do not have permission to administer this league.</div>;
  }
  const locked = Boolean(bundle.locks?.[WIMBLEDON_LOCK_KEY]?.locked);
  const go = (subview) => navigate(`/league/${leagueId}?view=admin&subview=${subview}`);

  const toggleLock = async () => {
    const nextLocked = !locked;
    const lockEntry = {
      locked: nextLocked,
      lockedAt: nextLocked ? new Date().toISOString() : null,
      lockedBy: auth.currentUser?.uid || null
    };
    await Promise.all([
      setDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'), {
        [WIMBLEDON_LOCK_KEY]: lockEntry
      }, { merge: true }),
      setDoc(doc(db, 'leagues', leagueId, 'settings', 'visibility'), {
        fogOfWarEnabled: !nextLocked,
        revealPolicy: 'afterLock',
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.uid || null
      }, { merge: true })
    ]);
    setBundle((current) => ({
      ...current,
      locks: { ...current.locks, [WIMBLEDON_LOCK_KEY]: lockEntry },
      visibility: { ...current.visibility, fogOfWarEnabled: !nextLocked }
    }));
    setFeedback(nextLocked ? 'Bracket locked and all entries revealed.' : 'Bracket reopened and other entries hidden.');
  };

  const handleEndLeague = async () => {
    if (!window.confirm('End and archive this Wimbledon league? The final result and current standings will be written to the stats pages.')) {
      return;
    }
    try {
      const result = await endLeague(leagueId, auth.currentUser?.uid);
      setFeedback(`League archived. ${result.winners.length} winner(s) recorded.`);
    } catch (error) {
      setFeedback(`Unable to end league: ${error.message}`);
    }
  };

  const cards = [
    { label: 'Draw and Results', copy: 'Import the 128-slot field, enter official winners, and configure scoring.', icon: FaFileImport, action: () => go('settings') },
    { label: 'Import Round of 32', copy: 'Paste the 32-player CSV and update the bracket from the Import 32 tab.', icon: FaFileImport, action: () => navigate(`/league/${leagueId}?view=admin&subview=settings&tab=round32`) },
    { label: 'Participants', copy: 'Review completion and make audited admin corrections.', icon: FaUsers, action: () => go('participants') },
    { label: locked ? 'Unlock Bracket' : 'Lock Whole Bracket', copy: locked ? 'Reopen user editing and hide other brackets.' : 'Stop user edits and reveal every league bracket.', icon: locked ? FaLockOpen : FaLock, action: toggleLock },
    { label: 'End League', copy: 'Capture Wimbledon stats, determine winners, and archive the league.', icon: FaTrophy, action: handleEndLeague }
  ];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(`/league/${leagueId}?view=edit`)}
        className="inline-flex items-center rounded bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
      >
        <FaArrowLeft className="mr-2" />Back to League
      </button>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wimbledon Administration</h1>
        <p className="mt-1 text-gray-600">{bundle.gameData?.eventLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-gray-100 px-3 py-1">{bundle.gameData?.edition}</span>
          <span className={`rounded-full px-3 py-1 ${locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {locked ? 'Locked / Revealed' : 'Open / Hidden'}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1">Draw revision {bundle.gameData?.drawRevision}</span>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700"><FaTrophy className="mr-1 inline" />{bundle.gameData?.status}</span>
        </div>
      </div>
      {feedback ? <div className="rounded border border-green-200 bg-green-50 p-3 text-green-800">{feedback}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, copy, icon: Icon, action }) => (
          <button key={label} type="button" onClick={action} className="rounded-lg border-2 border-gray-200 bg-white p-5 text-left shadow-md transition hover:border-indigo-300">
            <div className="inline-flex rounded-full bg-indigo-100 p-3">
              <Icon className="text-xl text-indigo-600" />
            </div>
            <h2 className="mt-4 font-semibold text-gray-900">{label}</h2>
            <p className="mt-2 text-sm text-gray-600">{copy}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;

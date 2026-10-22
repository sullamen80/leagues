import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCog, FaEdit, FaEye, FaLock, FaSave, FaTrophy, FaUser } from 'react-icons/fa';
import { auth } from '../../../firebase';
import {
  WIMBLEDON_LOCK_KEY
} from '../constants/wimbledonConstants';
import {
  countCompletedPredictions,
  getRequiredPredictionCount
} from '../utils/drawUtils';
import {
  fetchWimbledonBracketEntries,
  fetchWimbledonBundle,
  saveWimbledonEntry,
  upsertWimbledonEntry
} from '../services/wimbledonService';
import DrawBracket from './DrawBracket';
import Leaderboard from './Leaderboard';
import './Wimbledon.css';

const BracketDashboard = ({
  leagueId,
  activeTab = 'edit',
  urlParams = {},
  league = null,
  isEmbedded = false
}) => {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const viewedUserId = urlParams.userId || currentUser?.uid;
  const [bundle, setBundle] = useState(null);
  const [picks, setPicks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [viewBracketMode, setViewBracketMode] = useState('user');
  const [bracketEntries, setBracketEntries] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [loadedBundle, loadedEntries] = await Promise.all([
          fetchWimbledonBundle(leagueId, activeTab === 'view' ? viewedUserId : currentUser?.uid),
          fetchWimbledonBracketEntries(leagueId, currentUser?.uid)
        ]);
        let nextBundle = loadedBundle;
        if (
          activeTab === 'edit' &&
          currentUser?.uid &&
          !nextBundle.entry &&
          !nextBundle.locks?.[WIMBLEDON_LOCK_KEY]?.locked
        ) {
          await upsertWimbledonEntry(leagueId, currentUser.uid, nextBundle.gameData, currentUser);
          nextBundle = await fetchWimbledonBundle(leagueId, currentUser.uid);
        }
        if (mounted) {
          setBundle(nextBundle);
          setPicks(nextBundle.entry?.picksByMatchId || {});
          setBracketEntries(loadedEntries);
          setError('');
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load bracket');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [leagueId, activeTab, viewedUserId, currentUser]);

  useEffect(() => {
    if (activeTab !== 'view' || !bundle?.locks?.[WIMBLEDON_LOCK_KEY]?.locked) {
      setViewBracketMode('user');
    }
  }, [activeTab, bundle?.locks, viewedUserId]);

  const locked = Boolean(bundle?.locks?.[WIMBLEDON_LOCK_KEY]?.locked);
  const canRevealOtherEntry = locked || viewedUserId === currentUser?.uid;
  const completed = useMemo(() => countCompletedPredictions(picks), [picks]);
  const requiredPicks = useMemo(() => getRequiredPredictionCount(bundle?.gameData), [bundle?.gameData]);
  const visiblePicks = activeTab === 'view' && viewBracketMode === 'official'
    ? bundle?.gameData?.officialResultsByMatchId || {}
    : picks;

  const goTo = (view, extra = {}) => {
    const params = new URLSearchParams({ view, ...extra });
    navigate(`/league/${leagueId}?${params.toString()}`);
  };

  const handleBracketSelect = (entry) => {
    if (entry.isOfficial) {
      if (locked) {
        setViewBracketMode('official');
      }
      return;
    }

    if (!locked && entry.id !== currentUser?.uid) {
      return;
    }

    setViewBracketMode('user');
    if (entry.id !== viewedUserId) {
      goTo('view', { userId: entry.id });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const saved = await saveWimbledonEntry(leagueId, currentUser.uid, picks, { user: currentUser });
      setPicks(saved.picksByMatchId);
      setFeedback(countCompletedPredictions(saved.picksByMatchId) === requiredPicks ? 'Bracket submitted.' : 'Bracket saved.');
    } catch (err) {
      setError(err.message || 'Failed to save bracket');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Wimbledon bracket…</div>;
  if (error && !bundle) return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  const navigationCards = [
    {
      key: 'view',
      label: 'Bracket View',
      copy: 'View your submitted bracket and official results.',
      icon: FaEye,
      action: () => goTo('view', { userId: currentUser?.uid || '' })
    },
    {
      key: 'edit',
      label: 'My Bracket',
      copy: locked ? 'Review your locked tournament picks.' : 'Make and save your tournament picks.',
      icon: FaEdit,
      action: () => goTo('edit')
    },
    {
      key: 'leaderboard',
      label: 'Leaderboard',
      copy: 'Check league standings and pick accuracy.',
      icon: FaTrophy,
      action: () => goTo('leaderboard')
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${isEmbedded ? 'text-white' : 'text-gray-900'}`}>
          {bundle?.gameData?.eventLabel || league?.title || 'Singles Championship'}
        </h1>
        <p className={`mt-1 text-sm ${isEmbedded ? 'text-gray-200' : 'text-gray-600'}`}>
          {bundle?.gameData?.edition} · {bundle?.gameData?.maximumSets === 5 ? 'Best of five' : 'Best of three'} · {completed}/{requiredPicks} picks
        </p>
      </div>

      {bundle?.league?.ownerId === currentUser?.uid ? (
        <button
          type="button"
          onClick={() => goTo('admin')}
          className="w-full rounded-lg border-2 border-gray-200 bg-white p-4 text-left shadow-md transition hover:border-blue-300"
        >
          <div className="flex items-center">
            <div className="rounded-full bg-gray-100 p-3">
              <FaCog className="text-gray-500" />
            </div>
            <div className="ml-4">
              <h2 className="font-semibold text-gray-700">League Administration</h2>
              <p className="text-sm text-gray-500">Manage the draw, official results, participants, and scoring.</p>
            </div>
          </div>
        </button>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {navigationCards.map(({ key, label, copy, icon: Icon, action }) => {
          const selected = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={action}
              className={`h-full rounded-lg border-2 p-4 text-left shadow-md transition ${
                selected
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center">
                <div className={`rounded-full p-3 ${selected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  <Icon className={selected ? 'text-indigo-600' : 'text-gray-500'} />
                </div>
                <div className="ml-3">
                  <h2 className={`font-semibold ${selected ? 'text-indigo-700' : 'text-gray-900'}`}>{label}</h2>
                  <p className="text-sm text-gray-600">{copy}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeTab === 'leaderboard' ? <Leaderboard leagueId={leagueId} /> : null}

      {activeTab !== 'leaderboard' ? (
        <div className="rounded-lg border-t-4 border-indigo-500 bg-white p-4 shadow-md sm:p-5">
          {feedback ? <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{feedback}</div> : null}
          {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

          {activeTab === 'view' && !canRevealOtherEntry ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-8 text-center text-indigo-900">
              <FaLock className="mx-auto mb-3 text-2xl" />
              Other brackets reveal when the whole bracket locks.
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="text-sm text-gray-600">
                  {locked ? 'Bracket locked. Picks are read-only and league entries are revealed.' : 'Pick every match. The entire bracket locks together.'}
                </div>
                {activeTab === 'view' ? (
                  <div className="wimbledon-bracket-selector">
                    <div className="wimbledon-bracket-selector__label">Select Bracket</div>
                    <div className="wimbledon-bracket-selector__scroller">
                      <div className="wimbledon-bracket-selector__entries">
                        {bracketEntries.map((entry) => {
                          const unavailable = !locked && (entry.isOfficial || entry.id !== currentUser?.uid);
                          const selected = entry.isOfficial
                            ? viewBracketMode === 'official'
                            : viewBracketMode === 'user' && entry.id === viewedUserId;

                          return (
                            <button
                              key={entry.id}
                              type="button"
                              disabled={unavailable}
                              onClick={() => handleBracketSelect(entry)}
                              title={unavailable ? 'Brackets reveal when the tournament locks' : `View ${entry.name}`}
                              className={[
                                'wimbledon-bracket-selector__button',
                                selected ? 'is-active' : '',
                                unavailable ? 'is-disabled' : ''
                              ].filter(Boolean).join(' ')}
                            >
                              {entry.isOfficial
                                ? (locked ? <FaTrophy /> : <FaLock />)
                                : <FaUser />}
                              <span>
                                {entry.name}
                                {entry.isCurrentUser ? ' (You)' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'edit' && !locked ? (
                  <button disabled={saving} onClick={handleSave} className="inline-flex items-center rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                    <FaSave className="mr-2" />{saving ? 'Saving…' : 'Save Bracket'}
                  </button>
                ) : null}
              </div>
              <DrawBracket
                gameData={bundle.gameData}
                picksByMatchId={visiblePicks}
                officialResultsByMatchId={bundle.gameData?.officialResultsByMatchId}
                editable={activeTab === 'edit' && !locked}
                showResults={locked && viewBracketMode !== 'official'}
                setPredictionEnabled={Boolean(bundle.scoring?.setPredictionEnabled)}
                scoringSettings={bundle.scoring}
                onChange={setPicks}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default BracketDashboard;

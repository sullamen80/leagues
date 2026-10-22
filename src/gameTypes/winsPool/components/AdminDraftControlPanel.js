// src/gameTypes/winsPool/components/AdminDraftControlPanel.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  FaArrowLeft,
  FaCheck,
  FaHistory,
  FaPause,
  FaPlay,
  FaRedo,
  FaUndo
} from 'react-icons/fa';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  COLLECTION_KEYS,
  GAME_DATA_DOCUMENTS,
  DRAFT_STATUS,
  ASSIGNMENT_MODES,
  DEFAULT_ROSTER_SETTINGS
} from '../constants/winsPoolConstants';
import {
  makeDraftPick,
  undoLastPick,
  resetDraftState,
  computeNextPick,
  computePoolNextPicks,
  getAvailableTeams,
  getEligibleDraftTeams,
  getDraftConfigurationError,
  buildMemberDraftAccess
} from '../services/draftEngine';
import { normalizeDoubleSnakeConfig } from '../utils/draftConfig';
import useParticipants from '../hooks/useParticipants';
import { getPoolAllocationPlan } from '../utils/poolAllocation';
import { reconcileDraftOrder } from '../utils/participants';
import useMemberDraftAccess from '../hooks/useMemberDraftAccess';

const STATUS_TONE_CLASSNAMES = {
  info: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  error: 'bg-red-50 border-red-200 text-red-700'
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeDraftSnapshot = (draft) => {
  if (!draft || typeof draft !== 'object') return null;

  const picks = Array.isArray(draft.picks)
    ? draft.picks.map((pick) => ({ ...pick }))
    : [];

  const order = Array.isArray(draft.order) ? [...draft.order] : [];

  const doubleSnakeConfig = draft.doubleSnakeConfig
    ? {
        ...draft.doubleSnakeConfig,
        ...(Array.isArray(draft.doubleSnakeConfig.groups) ? {
          groups: draft.doubleSnakeConfig.groups.map((group) => ({
              ...group,
              ...(Array.isArray(group.teamIds) ? { teamIds: [...group.teamIds] } : {})
            }))
        } : {})
      }
    : draft.doubleSnakeConfig ?? null;

  return {
    ...draft,
    picks,
    order,
    doubleSnakeConfig
  };
};

const normalizeRosterSettings = (settings) => {
  if (!settings || typeof settings !== 'object') return null;
  return {
    ...settings,
    draftOrder: Array.isArray(settings.draftOrder) ? [...settings.draftOrder] : settings.draftOrder
  };
};

const AdminDraftControlPanel = ({ leagueId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [draftData, setDraftData] = useState(null);
  const [teamPool, setTeamPool] = useState([]);
  const [rosterSettings, setRosterSettings] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusTone, setStatusTone] = useState('info');
  const [processingAction, setProcessingAction] = useState(null);
  const { league, participants } = useParticipants(leagueId);
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [activePoolId, setActivePoolId] = useState('poolA');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [pickNotes, setPickNotes] = useState('');
  const { currentUser, isAdmin } = useAuth();
  const { error: memberAccessError } = useMemberDraftAccess({ leagueId, league,
    gameData: { draft: draftData, rosterSettings, teamPool: { teams: teamPool } },
    isCommissioner: Boolean(currentUser && (currentUser.uid === league?.ownerId || isAdmin)) });

  const gameDataRef = useMemo(() => {
    if (!leagueId) return null;
    return doc(
      db,
      'leagues',
      leagueId,
      COLLECTION_KEYS.GAME_DATA,
      GAME_DATA_DOCUMENTS.CURRENT
    );
  }, [leagueId]);

  useEffect(() => {
    if (!gameDataRef) return undefined;

    const unsubscribe = onSnapshot(
      gameDataRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDraftData(null);
          setTeamPool([]);
          setRosterSettings(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        const normalizedDraft = normalizeDraftSnapshot(data?.draft);
        const normalizedRosterSettings = normalizeRosterSettings(data?.rosterSettings);
        const normalizedTeamPool = Array.isArray(data?.teamPool?.teams)
          ? data.teamPool.teams.map((team) => ({ ...team }))
          : [];

        setDraftData(normalizedDraft);
        setTeamPool(normalizedTeamPool);
        setRosterSettings(normalizedRosterSettings);
        setLoading(false);
      },
      (error) => {
        console.error('[WinsPool][AdminDraftControlPanel] Failed to load draft data:', error);
        setDraftData(null);
        setTeamPool([]);
        setRosterSettings(null);
        setStatusTone('error');
        setStatusMessage(error.message || 'Failed to load draft data.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameDataRef]);

  const draftStatus = draftData?.status || DRAFT_STATUS.NOT_STARTED;
  const picks = useMemo(() => safeArray(draftData?.picks), [draftData?.picks]);
  const rawDraftOrder = useMemo(() => safeArray(draftData?.order), [draftData?.order]);
  const participantsList = participants.map((participant) => participant.id);
  const draftOrderConfigured = rawDraftOrder.length > 0;
  const displayDraftOrder = reconcileDraftOrder(league, draftData || {}, rosterSettings || {});
  const effectiveDraftOrder = displayDraftOrder;
  const totalManagers = displayDraftOrder.length;
  const totalTeams = teamPool.length;
  const rosterSize = rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize;
  const assignmentMode = draftData?.assignmentMode || ASSIGNMENT_MODES.DRAFT;
  const snakeEnabled = assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE ||
    (draftData?.useSnakeDraft !== undefined ? draftData.useSnakeDraft : true);
  const teamLookup = useMemo(() => {
    const map = new Map();
    (Array.isArray(teamPool) ? teamPool : []).forEach((team) => {
      if (team && team.id) {
        map.set(team.id, team);
      }
    });
    return map;
  }, [teamPool]);

  const managerLookup = useMemo(() => {
    const map = new Map();
    participants.forEach((participant) => {
      map.set(participant.id, participant.name);
    });
    return map;
  }, [participants]);

  const availableTeams = useMemo(
    () => getAvailableTeams(teamPool, picks),
    [teamPool, picks]
  );

  const doubleSnakeConfig = useMemo(() => {
    if (draftData?.assignmentMode !== ASSIGNMENT_MODES.DOUBLE_SNAKE) {
      return null;
    }
    return normalizeDoubleSnakeConfig(
      draftData.doubleSnakeConfig,
      teamPool,
      rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
    );
  }, [draftData, teamPool, rosterSettings]);

  const modeDescriptions = useMemo(() => {
    switch (assignmentMode) {
      case ASSIGNMENT_MODES.DOUBLE_SNAKE:
        return {
          label: 'Double-Headed Snake',
          description: 'Two independent snakes start at opposite ends. Each pool advances and reverses on its own.'
        };
      case ASSIGNMENT_MODES.AUCTION:
        return {
          label: 'Auction',
          description: 'Managers bid with budgets instead of picking in order.'
        };
      case ASSIGNMENT_MODES.AUTO_ASSIGN:
        return {
          label: 'Auto Assign',
          description: 'Teams are automatically distributed (no live draft).'
        };
      case ASSIGNMENT_MODES.MANUAL:
        return {
          label: 'Manual Assign',
          description: 'Admin assigns teams without a structured draft.'
        };
      default:
        return {
          label: 'Standard Snake',
          description: snakeEnabled
            ? 'Managers pick in order each round with the order reversing every other round.'
            : 'Managers pick in fixed order each round (snake disabled).'
        };
    }
  }, [assignmentMode, snakeEnabled]);

  const availableTeamsByPool = useMemo(() => {
    if (!doubleSnakeConfig) {
      return {
        all: {
          label: 'All Teams',
          teams: availableTeams
        }
      };
    }

    const map = new Map();
    safeArray(doubleSnakeConfig.groups).forEach((group) => {
      map.set(group.id, {
        label: group.label || group.id,
        teams: []
      });
    });

    const unassigned = { label: 'Unassigned', teams: [] };

    availableTeams.forEach((team) => {
      const targetGroup = safeArray(doubleSnakeConfig.groups).find((group) =>
        safeArray(group.teamIds).includes(team.id)
      );
      if (targetGroup && map.has(targetGroup.id)) {
        map.get(targetGroup.id).teams.push(team);
      } else {
        unassigned.teams.push(team);
      }
    });

    if (unassigned.teams.length) {
      map.set('unassigned', unassigned);
    }

    return Object.fromEntries(map.entries());
  }, [availableTeams, doubleSnakeConfig]);

  const nextPickInfo = useMemo(() => {
    if (!draftData || !rosterSettings) return null;
    return computeNextPick({
      draft: draftData,
      rosterSettings,
      draftOrder: effectiveDraftOrder,
      teamPool,
      poolId: doubleSnakeConfig ? activePoolId : null
    });
  }, [draftData, rosterSettings, effectiveDraftOrder, teamPool, doubleSnakeConfig, activePoolId]);

  const poolTurns = useMemo(() => doubleSnakeConfig ? computePoolNextPicks({ draft: draftData, rosterSettings, draftOrder: effectiveDraftOrder, teamPool }) : [],
    [doubleSnakeConfig, draftData, rosterSettings, effectiveDraftOrder, teamPool]);
  const hasOpenQueue = doubleSnakeConfig ? poolTurns.some((turn) => !turn.completed) : Boolean(nextPickInfo);

  const poolAllocationPlan = useMemo(() => doubleSnakeConfig
    ? getPoolAllocationPlan({ draft: draftData, rosterSettings, draftOrder: effectiveDraftOrder, teamPool })
    : null, [doubleSnakeConfig, draftData, rosterSettings, effectiveDraftOrder, teamPool]);

  const eligibleTeams = useMemo(() => getEligibleDraftTeams({
    draft: draftData || {}, rosterSettings: rosterSettings || {},
    draftOrder: effectiveDraftOrder, teamPool, poolId: doubleSnakeConfig ? activePoolId : null, nextPick: nextPickInfo
  }), [draftData, rosterSettings, effectiveDraftOrder, teamPool, nextPickInfo, doubleSnakeConfig, activePoolId]);
  const eligibleTeamIds = new Set(eligibleTeams.map((team) => team.id));

  useEffect(() => {
    setSelectedManagerId(nextPickInfo?.managerId || null);
  }, [nextPickInfo?.managerId]);

  useEffect(() => {
    setSelectedTeamId((current) => eligibleTeams.some((team) => team.id === current)
      ? current : eligibleTeams[0]?.id || '');
  }, [eligibleTeams]);

  const nextManagerId =
    draftStatus === DRAFT_STATUS.IN_PROGRESS && nextPickInfo
      ? nextPickInfo.managerId
      : null;

  const lastPick = picks[picks.length - 1] || null;
  const lastPickLabel = lastPick
    ? `${lastPick.teamName || lastPick.teamId || 'Team'} → ${lastPick.managerName || lastPick.managerId || 'Unknown'}`
    : 'No picks recorded yet.';

  const setFeedback = (message, tone = 'info') => {
    setStatusTone(tone);
    setStatusMessage(message);
  };

  const handleStartOrResumeDraft = async () => {
    if (!gameDataRef) return;
    setProcessingAction('start');
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(gameDataRef);
        if (!snapshot.exists()) {
          throw new Error('Draft data not found.');
        }

        const leagueSnap = await transaction.get(doc(db, 'leagues', leagueId));
        if (!leagueSnap.exists()) throw new Error('League not found.');
        const data = snapshot.data() || {};
        const draft = data.draft || {};
        const order = reconcileDraftOrder(leagueSnap.data(), draft, data.rosterSettings);
        if (!order.length) throw new Error('Add participants before starting the draft.');
        const configurationError = getDraftConfigurationError({ draft, rosterSettings: data.rosterSettings, draftOrder: order, teamPool: data.teamPool?.teams || [] });
        if (configurationError) throw new Error(configurationError);
        const next = computeNextPick({
          draft, rosterSettings: data.rosterSettings, draftOrder: order,
          teamPool: data.teamPool?.teams || []
        });
        if (next?.blockedReason) throw new Error(next.blockedReason);
        if (draft.status === DRAFT_STATUS.COMPLETED && !next) {
          throw new Error('All draft slots are already filled.');
        }

        const updates = {
          'draft.order': order,
          ...(draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE ? { 'draft.poolAllocations': getPoolAllocationPlan({ draft, rosterSettings: data.rosterSettings, draftOrder: order, teamPool: data.teamPool?.teams || [] }).allocations } : {}),
          'draft.status': DRAFT_STATUS.IN_PROGRESS,
          'draft.completedAt': null,
          'draft.updatedAt': serverTimestamp(),
          'draft.resumedAt': serverTimestamp()
        };

        if (!draft.startedAt) {
          updates['draft.startedAt'] = serverTimestamp();
        }

        updates['draft.memberAccess'] = buildMemberDraftAccess(leagueSnap.data(), { ...data, draft: {
          ...draft, order, poolAllocations: updates['draft.poolAllocations'] ?? draft.poolAllocations
        } });

        transaction.update(gameDataRef, updates);
      });
      setFeedback(
        draftStatus === DRAFT_STATUS.PAUSED ? 'Draft resumed.' :
          draftStatus === DRAFT_STATUS.COMPLETED ? 'Draft reopened.' : 'Draft started.',
        'success'
      );
    } catch (error) {
      console.error('[WinsPool][AdminDraftControlPanel] Failed to start draft:', error);
      setFeedback(error.message || 'Failed to start the draft.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handlePauseDraft = async () => {
    if (!gameDataRef) return;
    setProcessingAction('pause');
    try {
      await updateDoc(gameDataRef, {
        'draft.status': DRAFT_STATUS.PAUSED,
        'draft.pausedAt': serverTimestamp(),
        'draft.updatedAt': serverTimestamp()
      });
      setFeedback('Draft paused.', 'info');
    } catch (error) {
      console.error('[WinsPool][AdminDraftControlPanel] Failed to pause draft:', error);
      setFeedback(error.message || 'Failed to pause the draft.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCompleteDraft = async () => {
    if (!gameDataRef) return;
    setProcessingAction('complete');
    try {
      await runTransaction(db, async (transaction) => {
        const [snapshot, leagueSnap] = await Promise.all([
          transaction.get(gameDataRef), transaction.get(doc(db, 'leagues', leagueId))
        ]);
        if (!snapshot.exists() || !leagueSnap.exists()) throw new Error('Draft data not found.');
        const data = snapshot.data();
        if (data.draft?.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE) {
          const turns = computePoolNextPicks({ draft: data.draft, rosterSettings: data.rosterSettings,
            draftOrder: reconcileDraftOrder(leagueSnap.data(), data.draft, data.rosterSettings), teamPool: data.teamPool?.teams || [] });
          if (!turns.every((turn) => turn.completed)) throw new Error('Finish both pools before completing the draft.');
        }
        transaction.update(gameDataRef, { 'draft.status': DRAFT_STATUS.COMPLETED,
          'draft.completedAt': serverTimestamp(), 'draft.updatedAt': serverTimestamp() });
      });
      setFeedback('Draft marked as completed.', 'success');
    } catch (error) {
      console.error('[WinsPool][AdminDraftControlPanel] Failed to complete draft:', error);
      setFeedback(error.message || 'Failed to mark the draft as complete.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleResetDraft = async () => {
    if (!leagueId) return;
    if (!window.confirm('Reset draft? This clears picks and returns to pre-draft state.')) {
      return;
    }
    setProcessingAction('reset');
    try {
      await resetDraftState({ leagueId, preserveRosters: false });
      setFeedback('Draft reset to pre-draft state.', 'warning');
    } catch (error) {
      console.error('[WinsPool][AdminDraftControlPanel] Failed to reset draft:', error);
      setFeedback(error.message || 'Failed to reset the draft.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRollbackLastPick = async (poolId = null) => {
    if (!leagueId) return;
    setProcessingAction('rollback');
    try {
      await undoLastPick({ leagueId, poolId });
      setFeedback(poolId ? 'Last pick in this pool rolled back.' : 'Last pick rolled back.', 'info');
    } catch (error) {
      console.error('[WinsPool][AdminDraftControlPanel] Failed to roll back pick:', error);
      setFeedback(error.message || 'Failed to roll back the last pick.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRecordPick = async () => {
    if (!leagueId) return;
    if (!selectedManagerId) {
      setFeedback('Select a manager before recording a pick.', 'warning');
      return;
    }
    if (!selectedTeamId) {
      setFeedback('Select a team before recording a pick.', 'warning');
      return;
    }

    if (draftStatus !== DRAFT_STATUS.IN_PROGRESS || !nextPickInfo || nextPickInfo.blockedReason) {
      setFeedback(nextPickInfo?.blockedReason || 'Start or resume the draft before recording picks.', 'warning');
      return;
    }
    if (selectedManagerId !== nextPickInfo.managerId || !eligibleTeamIds.has(selectedTeamId)) {
      setFeedback('Select the current manager and a team from their required pool.', 'warning');
      return;
    }
    setProcessingAction('pick');
    try {
      const team = teamLookup.get(selectedTeamId);
      await makeDraftPick({
        leagueId, managerId: selectedManagerId, teamId: selectedTeamId,
        managerName: managerLookup.get(selectedManagerId) || null,
        teamName: team?.name || team?.shortName || null,
        actorId: currentUser?.uid || null,
        source: 'admin-console', notes: pickNotes || undefined,
        ...(doubleSnakeConfig ? { poolId: activePoolId, expectedPoolPickNumber: nextPickInfo.poolPickNumber } : { expectedPickNumber: nextPickInfo.pickNumber })
      });
      setFeedback('Draft pick recorded.', 'success');
      setSelectedTeamId('');
      setPickNotes('');
    } catch (error) {
      console.error('[WinsPool][AdminDraftControlPanel] Failed to record pick:', error);
      setFeedback(error.message || 'Failed to record the pick.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4" />
        <p className="text-gray-600">Loading draft controls…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {memberAccessError && <p role="alert" className="text-sm text-red-700">{memberAccessError}</p>}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition text-sm"
            >
              <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
            </button>
          )}
          <h1 className="text-2xl font-semibold text-gray-800">Draft Console</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              draftStatus === DRAFT_STATUS.IN_PROGRESS
                ? 'bg-green-100 text-green-700'
                : draftStatus === DRAFT_STATUS.COMPLETED
                ? 'bg-emerald-100 text-emerald-700'
                : draftStatus === DRAFT_STATUS.PAUSED
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <FaHistory />
            {draftStatus === DRAFT_STATUS.IN_PROGRESS
              ? 'In Progress'
              : draftStatus === DRAFT_STATUS.COMPLETED
              ? 'Completed'
              : draftStatus === DRAFT_STATUS.PAUSED
              ? 'Paused'
              : 'Not Started'}
          </span>
        </div>
      </header>

      {statusMessage && (
        <div className={`rounded-md border px-4 py-3 text-sm ${STATUS_TONE_CLASSNAMES[statusTone] || STATUS_TONE_CLASSNAMES.info}`}>
          {statusMessage}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total Picks</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">{picks.length}</p>
          <p className="text-xs text-gray-500 mt-2">Tracks recorded selections so far.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Managers</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">{totalManagers}</p>
          <p className="text-xs text-gray-500 mt-2">Current league participants.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Team Pool</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">{totalTeams}</p>
          <p className="text-xs text-gray-500 mt-2">Available teams to be drafted.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Next Up</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">
            {nextManagerId || 'Awaiting start'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {nextManagerId
              ? 'Make sure the manager is ready for their selection.'
              : 'Start the draft to generate turns.'}
          </p>
        </div>
      </section>

      {doubleSnakeConfig && (
        <section aria-label="Draft pools" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Draft Pools</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {doubleSnakeConfig.groups.map((group) => {
              const remaining = availableTeamsByPool[group.id]?.teams.length || 0;
              const turn = poolTurns.find((entry) => entry.poolId === group.id);
              const quota = poolAllocationPlan?.allocations?.[turn?.managerId]?.quotas[group.id];
              const used = picks.filter((pick) => pick.managerId === turn?.managerId && group.teamIds.includes(pick.teamId)).length;
              const required = activePoolId === group.id;
              return (
                <article key={group.id} aria-label={group.label}
                  className={`rounded-lg border p-4 ${required ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="font-semibold text-gray-800">{group.label}</p>
                  <p className="text-sm text-gray-600">{remaining} of {group.teamIds.length} teams available</p>
                  {quota !== undefined && <p className="text-sm text-gray-600">{managerLookup.get(turn.managerId) || turn.managerId}: {used} of {quota} picks</p>}
                  <p className="mt-1 text-sm font-semibold text-indigo-700">{turn?.completed ? 'Pool complete' : `On clock: ${managerLookup.get(turn?.managerId) || turn?.managerId || 'Pending'}`}</p>
                  {turn?.managerId && <p className="text-xs text-gray-600">Round {turn.round || 1} • Pool pick {turn.poolPickNumber}</p>}
                  {turn?.blockedReason && <p role="alert" className="text-sm text-red-700">{turn.blockedReason}</p>}
                  <button type="button" onClick={() => setActivePoolId(group.id)} disabled={processingAction !== null}
                    aria-pressed={required} className="mt-2 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                    {required ? `Selected ${group.label}` : `Select ${group.label}`}
                  </button>
                  <button type="button" onClick={() => handleRollbackLastPick(group.id)}
                    disabled={processingAction !== null || !(turn?.poolPicksTaken > 0)} className="mt-2 ml-2 rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-700 disabled:opacity-50">
                    Undo last {group.label} pick
                  </button>
                </article>
              );
            })}
          </div>
          <p className="text-sm text-gray-500">Choose either pool to record its next manager’s pick. Picks in one pool do not advance the other pool.</p>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-800">Draft Controls</h2>
            <p className="text-sm text-gray-500">
              Use these controls to manage the draft lifecycle and intervene when necessary.
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-800">Draft Mode</p>
            <p className="text-sm text-gray-600">{modeDescriptions.label}</p>
            <p className="mt-1 text-xs text-gray-500">{modeDescriptions.description}</p>
            <div className="mt-2 grid gap-1 text-xs text-gray-500">
              <span>
                Roster Size:{' '}
                <span className="font-semibold text-gray-700">{rosterSize}</span>
              </span>
              <span>
                Snake Order:{' '}
                <span className="font-semibold text-gray-700">{snakeEnabled ? 'Enabled' : 'Disabled'}</span>
              </span>
              <span>
                Participants:{' '}
                <span className="font-semibold text-gray-700">{totalManagers}</span>
              </span>
            </div>
            <div className="mt-2">
              <p className="font-semibold text-gray-800 text-sm">Draft Order</p>
              {!draftOrderConfigured && displayDraftOrder.length > 0 && (
                <p className="text-xs text-amber-600 mb-2">
                  Draft order not configured yet. Showing current league participants.
                </p>
              )}
              {displayDraftOrder.length === 0 ? (
                <p className="text-xs text-gray-500">No managers in this league yet.</p>
              ) : (
                <ol className="mt-1 space-y-1 text-xs text-gray-600">
                  {displayDraftOrder.map((managerId, index) => (
                    <li key={`${managerId}-${index}`}>
                      {index + 1}. {managerLookup.get(managerId) || managerId}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-3">
          {(draftStatus === DRAFT_STATUS.NOT_STARTED || draftStatus === DRAFT_STATUS.PAUSED ||
            (draftStatus === DRAFT_STATUS.COMPLETED && hasOpenQueue)) && (
            <button
              onClick={handleStartOrResumeDraft}
              disabled={processingAction !== null}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-60"
            >
              <FaPlay />
              {draftStatus === DRAFT_STATUS.PAUSED ? 'Resume Draft' :
                draftStatus === DRAFT_STATUS.COMPLETED ? 'Reopen Draft' : 'Start Draft'}
            </button>
          )}

          {draftStatus === DRAFT_STATUS.IN_PROGRESS && (
            <button
              onClick={handlePauseDraft}
              disabled={processingAction !== null}
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
            >
              <FaPause />
              Pause Draft
            </button>
          )}

          {(draftStatus === DRAFT_STATUS.IN_PROGRESS || draftStatus === DRAFT_STATUS.PAUSED) && (
            <button
              onClick={handleCompleteDraft}
              disabled={processingAction !== null || (doubleSnakeConfig && hasOpenQueue)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              <FaCheck />
              Complete Draft
            </button>
          )}

          <button
            onClick={handleResetDraft}
            disabled={processingAction !== null}
            className="inline-flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-60"
          >
            <FaRedo />
            Reset Draft
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Record Draft Pick</h2>
            <p className="text-sm text-gray-500">
              Select a manager and team to capture the next pick. The assistant will prefill the
              expected manager and pool based on the configured draft order.
            </p>
          </div>
          {nextPickInfo ? (
            <div className="rounded-md border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-sm text-indigo-700">
              <p className="font-semibold text-indigo-800">Upcoming Pick</p>
              {nextPickInfo.blockedReason && <p role="alert">{nextPickInfo.blockedReason}</p>}
              <p>
                Manager:{' '}
                <span className="font-medium">
                  {managerLookup.get(nextPickInfo.managerId) || nextPickInfo.managerId}
                </span>
              </p>
              {nextPickInfo.poolLabel && (
                <p>
                  Pool Requirement:{' '}
                  <span className="font-medium">{nextPickInfo.poolLabel}</span>
                </p>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500">{doubleSnakeConfig ? 'This pool is complete. Select the other pool to continue.' : 'All draft slots are filled.'}</span>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600" htmlFor="draft-manager-select">
              Manager
            </label>
            <select
              id="draft-manager-select"
              value={selectedManagerId || ''}
              onChange={(event) => setSelectedManagerId(event.target.value || null)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                Select manager…
              </option>
              {Array.from(
                new Set(
                  (displayDraftOrder.length ? displayDraftOrder : participantsList).map(
                    (id) => id
                  )
                )
              ).map((managerId) => (
                <option key={managerId} value={managerId} disabled={managerId !== nextPickInfo?.managerId}>
                  {managerLookup.get(managerId) || managerId}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600" htmlFor="draft-team-select">
              Team
            </label>
            <select
              id="draft-team-select"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                {availableTeams.length ? 'Select team…' : 'No teams available'}
              </option>
              {doubleSnakeConfig
                ? Object.entries(availableTeamsByPool).map(([poolId, details]) => (
                    <optgroup key={poolId} label={details.label}>
                      {details.teams.map((team) => (
                        <option key={team.id} value={team.id} disabled={!eligibleTeamIds.has(team.id)}>
                          {team.name || team.shortName || team.id}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : availableTeams.map((team) => (
                    <option key={team.id} value={team.id} disabled={!eligibleTeamIds.has(team.id)}>
                      {team.name || team.shortName || team.id}
                    </option>
                  ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600" htmlFor="draft-notes-input">
            Notes (optional)
          </label>
          <textarea
            id="draft-notes-input"
            value={pickNotes}
            onChange={(event) => setPickNotes(event.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
            placeholder="Add context for this selection"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRecordPick}
            disabled={processingAction !== null || draftStatus !== DRAFT_STATUS.IN_PROGRESS || !nextPickInfo || Boolean(nextPickInfo.blockedReason) || selectedManagerId !== nextPickInfo.managerId || !eligibleTeamIds.has(selectedTeamId)}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <FaCheck />
            {doubleSnakeConfig ? `Record ${doubleSnakeConfig.groups.find((group) => group.id === activePoolId)?.label || 'pool'} Pick` : 'Record Pick'}
          </button>
          <button
            onClick={() => {
              setSelectedTeamId('');
              setPickNotes('');
            }}
            className="inline-flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Clear Selection
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Manual Intervention</h2>
            <p className="text-sm text-gray-500">
              Roll back the most recent pick if a correction is needed.
            </p>
          </div>
          <button
            onClick={() => handleRollbackLastPick()}
            disabled={processingAction !== null || picks.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <FaUndo />
            Roll Back Last Pick
          </button>
        </header>
        <div className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-700">
          <p className="font-semibold text-indigo-800">Last Recorded Pick</p>
          <p className="mt-1">{lastPickLabel}</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Draft Log</h2>
          <span className="text-xs font-medium text-gray-500">Showing most recent picks first</span>
        </header>
        {picks.length === 0 ? (
          <p className="text-sm text-gray-500">No selections have been recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {[...picks]
              .slice()
              .reverse()
              .map((pick, index) => {
                const absoluteIndex = picks.length - index;
                return (
                  <li
                    key={`${pick.managerId || absoluteIndex}-${pick.teamId || index}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Pick {absoluteIndex}
                          {pick.round !== undefined ? ` • Round ${pick.round}` : ''}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Team:{' '}
                          <span className="font-medium text-gray-800">
                            {pick.teamName || pick.teamId || 'Unknown team'}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Manager:{' '}
                          <span className="font-medium text-gray-800">
                            {pick.managerName || pick.managerId || 'Unknown manager'}
                          </span>
                        </p>
                      </div>
                      {pick.poolId && (
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                          Pool {pick.poolLabel || pick.poolId}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
          </ol>
        )}
      </section>
    </div>
  );
};

export default AdminDraftControlPanel;

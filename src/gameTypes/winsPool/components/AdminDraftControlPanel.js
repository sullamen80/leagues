// src/gameTypes/winsPool/components/AdminDraftControlPanel.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  collection,
  getDocs,
  Timestamp
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
  getAvailableTeams
} from '../services/draftEngine';
import { normalizeDoubleSnakeConfig } from '../utils/draftConfig';

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
        groups: Array.isArray(draft.doubleSnakeConfig.groups)
          ? draft.doubleSnakeConfig.groups.map((group) => ({
              ...group,
              teamIds: Array.isArray(group.teamIds) ? [...group.teamIds] : []
            }))
          : []
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
  const [participants, setParticipants] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [pickNotes, setPickNotes] = useState('');

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

  useEffect(() => {
    if (!leagueId) return undefined;

    let mounted = true;

    const loadParticipants = async () => {
      try {
        const usersCollection = collection(
          db,
          'leagues',
          leagueId,
          COLLECTION_KEYS.USER_DATA
        );
        const snapshot = await getDocs(usersCollection);
        const leagueSnapshot = await getDoc(doc(db, 'leagues', leagueId));
        const leagueData = leagueSnapshot.exists() ? leagueSnapshot.data() : {};
        const ownerId = leagueData?.ownerId || null;

        const participantMap = new Map();
        if (!mounted) return;
        snapshot.docs.forEach((docSnap) => {
          const userData = docSnap.data() || {};
          participantMap.set(docSnap.id, {
            id: docSnap.id,
            name:
              userData.displayName ||
              userData.username ||
              userData.ownerName ||
              docSnap.id
          });
        });

        if (ownerId && !participantMap.has(ownerId)) {
          let ownerDisplayName =
            leagueData?.ownerName || leagueData?.ownerDisplayName || null;
          try {
            const ownerProfileSnap = await getDoc(doc(db, 'users', ownerId));
            if (ownerProfileSnap.exists()) {
              const profile = ownerProfileSnap.data() || {};
              ownerDisplayName =
                profile.displayName ||
                profile.username ||
                profile.fullName ||
                ownerDisplayName ||
                null;
            }
          } catch (profileError) {
            console.warn(
              '[WinsPool][AdminDraftControlPanel] Failed to load owner profile:',
              profileError
            );
          }
          participantMap.set(ownerId, {
            id: ownerId,
            name: ownerDisplayName || ownerId
          });
        }

        setParticipants(Array.from(participantMap.values()));
      } catch (error) {
        console.warn('[WinsPool][AdminDraftControlPanel] Failed to load participants:', error);
      }
    };

    loadParticipants();

    return () => {
      mounted = false;
    };
  }, [leagueId]);

  const draftStatus = draftData?.status || DRAFT_STATUS.NOT_STARTED;
  const picks = useMemo(() => safeArray(draftData?.picks), [draftData?.picks]);
  const rawDraftOrder = useMemo(() => safeArray(draftData?.order), [draftData?.order]);
  const participantsList = participants.map((participant) => participant.id);
  const draftOrderConfigured = rawDraftOrder.length > 0;
  const displayDraftOrder = draftOrderConfigured
    ? rawDraftOrder
    : participantsList;
  const effectiveDraftOrder = displayDraftOrder;
  const totalManagers = displayDraftOrder.length;
  const totalTeams = teamPool.length;
  const rosterSize = rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize;
  const assignmentMode = draftData?.assignmentMode || ASSIGNMENT_MODES.DRAFT;
  const snakeEnabled = draftData?.useSnakeDraft !== undefined ? draftData.useSnakeDraft : true;
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
          description: 'Managers alternate between two pools with a snake order.'
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
      teamPool
    });
  }, [draftData, rosterSettings, effectiveDraftOrder, teamPool]);

  useEffect(() => {
    if (nextPickInfo?.managerId) {
      setSelectedManagerId((current) => current || nextPickInfo.managerId);
    }
  }, [nextPickInfo?.managerId]);

  useEffect(() => {
    if (!availableTeams.length) {
      setSelectedTeamId('');
      return;
    }

    if (nextPickInfo?.poolId && doubleSnakeConfig) {
      const targetGroup = doubleSnakeConfig.groups?.find(
        (group) => group.id === nextPickInfo.poolId
      );
      if (targetGroup) {
        const matchingTeam = availableTeams.find((team) =>
          targetGroup.teamIds?.includes(team.id)
        );
        if (matchingTeam) {
          setSelectedTeamId((current) => current || matchingTeam.id);
          return;
        }
      }
    }

    setSelectedTeamId((current) => current || availableTeams[0].id);
  }, [availableTeams, nextPickInfo?.poolId, doubleSnakeConfig]);

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

        const data = snapshot.data() || {};
        const draft = data.draft || {};

        const updates = {
          'draft.status': DRAFT_STATUS.IN_PROGRESS,
          'draft.updatedAt': serverTimestamp(),
          'draft.resumedAt': serverTimestamp()
        };

        if (!draft.startedAt) {
          updates['draft.startedAt'] = serverTimestamp();
        }

        transaction.update(gameDataRef, updates);
      });
      setFeedback(
        draftStatus === DRAFT_STATUS.PAUSED ? 'Draft resumed.' : 'Draft started.',
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
      await updateDoc(gameDataRef, {
        'draft.status': DRAFT_STATUS.COMPLETED,
        'draft.completedAt': serverTimestamp(),
        'draft.updatedAt': serverTimestamp()
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

  const handleRollbackLastPick = async () => {
    if (!leagueId) return;
    setProcessingAction('rollback');
    try {
      await undoLastPick({ leagueId });
      setFeedback('Last pick rolled back.', 'info');
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

    setProcessingAction('pick');
    const now = Timestamp.now();
    const optimisticNextPick = nextPickInfo || null;
    const optimisticPickNumber = picks.length + 1;
    const optimisticRound =
      optimisticNextPick?.round ??
      (effectiveDraftOrder.length
        ? Math.floor(picks.length / Math.max(effectiveDraftOrder.length, 1)) + 1
        : 1);
    const optimisticOrderIndex =
      optimisticNextPick?.pickIndex ??
      (effectiveDraftOrder.length ? picks.length % Math.max(effectiveDraftOrder.length, 1) : 0);

    const team = teamLookup.get(selectedTeamId);
    const defaultTeamName =
      team?.name || team?.shortName || team?.displayName || selectedTeamId;

    const optimisticPickRecord = {
      pickNumber: optimisticPickNumber,
      round: optimisticRound,
      orderIndex: optimisticOrderIndex,
      managerId: selectedManagerId,
      managerName: managerLookup.get(selectedManagerId) || null,
      teamId: selectedTeamId,
      teamName: defaultTeamName,
      timestamp: now,
      source: 'admin-console',
      actorId: null,
      notes: pickNotes ? pickNotes : null,
      poolId: optimisticNextPick?.poolId || null,
      poolLabel: optimisticNextPick?.poolLabel || null
    };

    const isOverride =
      optimisticNextPick &&
      optimisticNextPick.managerId &&
      optimisticNextPick.managerId !== selectedManagerId;
    if (isOverride) {
      optimisticPickRecord.override = true;
    }

    let revertDraftState = null;
    let appliedOptimisticPick = false;

    try {
      setDraftData((currentDraft) => {
        if (!currentDraft) return currentDraft;
        const currentPicks = safeArray(currentDraft.picks);

        revertDraftState = {
          ...currentDraft,
          picks: currentPicks.map((pick) => ({ ...pick }))
        };

        const alreadyPresent = currentPicks.some(
          (existing) =>
            existing.pickNumber === optimisticPickRecord.pickNumber &&
            existing.managerId === optimisticPickRecord.managerId &&
            existing.teamId === optimisticPickRecord.teamId
        );
        if (alreadyPresent) {
          return currentDraft;
        }

        appliedOptimisticPick = true;
        return {
          ...currentDraft,
          picks: [...currentPicks, optimisticPickRecord]
        };
      });

      await makeDraftPick({
        leagueId,
        managerId: selectedManagerId,
        teamId: selectedTeamId,
        managerName: managerLookup.get(selectedManagerId) || null,
        teamName: team?.name || team?.shortName || null,
        source: 'admin-console',
        notes: pickNotes || undefined,
        orderFallback: effectiveDraftOrder,
        rosterSizeOverride: rosterSize
      });

      setFeedback('Draft pick recorded.', 'success');
      setSelectedTeamId('');
      setPickNotes('');
      setSelectedManagerId(null);
    } catch (error) {
      if (appliedOptimisticPick && revertDraftState) {
        setDraftData(revertDraftState);
      }
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
          <p className="text-xs text-gray-500 mt-2">Based on configured draft order.</p>
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
          {(draftStatus === DRAFT_STATUS.NOT_STARTED || draftStatus === DRAFT_STATUS.PAUSED) && (
            <button
              onClick={handleStartOrResumeDraft}
              disabled={processingAction !== null}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-60"
            >
              <FaPlay />
              {draftStatus === DRAFT_STATUS.PAUSED ? 'Resume Draft' : 'Start Draft'}
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
              disabled={processingAction !== null}
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
            <span className="text-sm text-gray-500">All draft slots are filled.</span>
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
                <option key={managerId} value={managerId}>
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
                        <option key={team.id} value={team.id}>
                          {team.name || team.shortName || team.id}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
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
            placeholder="Add context for this selection (override, trade, etc.)"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRecordPick}
            disabled={processingAction !== null || !selectedManagerId || !selectedTeamId}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <FaCheck />
            Record Pick
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
            onClick={handleRollbackLastPick}
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

// src/gameTypes/winsPool/services/draftEngine.js
import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  COLLECTION_KEYS,
  GAME_DATA_DOCUMENTS,
  DEFAULT_ROSTER_SETTINGS,
  ASSIGNMENT_MODES,
  DRAFT_STATUS
} from '../constants/winsPoolConstants';
import { normalizeDoubleSnakeConfig } from '../utils/draftConfig';

import { getPoolDraftTurns } from '../utils/poolDraft';
import { getPoolAllocationPlan } from '../utils/poolAllocation';
import { reconcileDraftOrder } from '../utils/participants';

const getGameDataRef = (leagueId) =>
  doc(db, 'leagues', leagueId, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);

const getUserRosterRef = (leagueId, userId) =>
  doc(db, 'leagues', leagueId, COLLECTION_KEYS.USER_DATA, userId);

const safeArray = (value) => (Array.isArray(value) ? value : []);

const buildTeamMap = (teamPool = []) => {
  const map = new Map();
  safeArray(teamPool).forEach((team) => {
    if (team && team.id) {
      map.set(team.id, team);
    }
  });
  return map;
};

const buildAvailableTeams = (teamPool = [], picks = []) => {
  const takenIds = new Set(safeArray(picks).map((pick) => pick?.teamId).filter(Boolean));
  return safeArray(teamPool).filter((team) => team && team.id && !takenIds.has(team.id));
};

const computeManagerCounts = (picks = []) => {
  const counts = new Map();
  safeArray(picks).forEach((pick) => {
    if (pick?.managerId) counts.set(pick.managerId, (counts.get(pick.managerId) || 0) + 1);
  });
  return counts;
};

export const getDraftConfigurationError = ({ draft, rosterSettings, draftOrder, teamPool }) => {
  const rosterSize = Number(rosterSettings?.rosterSize ?? DEFAULT_ROSTER_SETTINGS.rosterSize);
  if (!Number.isInteger(rosterSize) || rosterSize < 1) return 'Roster size must be a positive whole number.';
  if (draft?.assignmentMode !== ASSIGNMENT_MODES.DOUBLE_SNAKE) return null;
  return getPoolAllocationPlan({ draft, rosterSettings, draftOrder, teamPool }).error;
};

export const computeNextPick = ({
  draft,
  rosterSettings,
  draftOrder,
  teamPool,
  poolId = null
}) => {
  if (draft?.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE) {
    const turns = getPoolDraftTurns({ draft, rosterSettings, draftOrder, teamPool });
    const turn = poolId ? turns.find((entry) => entry.poolId === poolId) : turns.find((entry) => !entry.completed);
    return turn && !turn.completed ? turn : null;
  }
  const picks = safeArray(draft?.picks);
  const order = safeArray(draftOrder);
  const rosterSize =
    Math.max(0, Number(rosterSettings?.rosterSize ?? DEFAULT_ROSTER_SETTINGS.rosterSize));

  if (!order.length || rosterSize <= 0) {
    return null;
  }

  const totalSlots = rosterSize * order.length;
  if (picks.length >= totalSlots) {
    return null;
  }

  const useSnake =
    draft.assignmentMode !== ASSIGNMENT_MODES.AUCTION &&
    (draft.useSnakeDraft === undefined ? true : draft.useSnakeDraft);
  const availableTeams = buildAvailableTeams(teamPool, picks);

  const managerPickCounts = computeManagerCounts(picks);
  const configurationError = getDraftConfigurationError({ draft, rosterSettings, draftOrder: order, teamPool });

  const maxAttempts = totalSlots;
  let pickIndex = picks.length;
  let attempts = 0;

  while (attempts <= maxAttempts) {
    const round = Math.floor(pickIndex / order.length) + 1;
    const offset = pickIndex % order.length;

    let orderIndex = offset;
    if (useSnake && round % 2 === 0) {
      orderIndex = order.length - 1 - offset;
    }

    const managerId = order[orderIndex];
    if (!managerId) {
      attempts += 1;
      pickIndex += 1;
      continue;
    }

    const picksTaken = managerPickCounts.get(managerId) || 0;
    if (picksTaken >= rosterSize) {
      attempts += 1;
      pickIndex += 1;
      continue;
    }

    return {
      pickNumber: picks.length + 1,
      round,
      pickIndex: orderIndex,
      managerId,
      poolId: null,
      poolLabel: null,
      rosterSlotsRemaining: rosterSize - picksTaken,
      poolSlotsRemaining: null,
      blockedReason: configurationError ||
        (!availableTeams.length ? 'No teams remain available for this draft.' : null)
    };
  }

  return null;
};

export const computePoolNextPicks = getPoolDraftTurns;

export const getEligibleDraftTeams = ({ draft, rosterSettings, draftOrder, teamPool, poolId = null, nextPick = null }) => {
  const next = nextPick || computeNextPick({ draft, rosterSettings, draftOrder, teamPool, poolId });
  if (!next || next.blockedReason) return [];
  const available = buildAvailableTeams(teamPool, draft?.picks);
  if (!next.poolId) return available;
  const config = normalizeDoubleSnakeConfig(draft.doubleSnakeConfig, teamPool, rosterSettings?.rosterSize);
  const ids = new Set(config.groups.find((group) => group.id === next.poolId)?.teamIds || []);
  return available.filter((team) => ids.has(team.id));
};

export const getDraftOrderPreview = ({ draft, rosterSettings, draftOrder, teamPool, poolId = null, limit = 5 }) => {
  const preview = [];
  const simulated = { ...draft, picks: [...safeArray(draft?.picks)] };
  for (let index = 0; index < limit; index += 1) {
    const next = computeNextPick({ draft: simulated, rosterSettings, draftOrder, teamPool, poolId });
    if (!next) break;
    preview.push({ ...next, isCurrent: index === 0, currentPick: poolId ? next.poolPickNumber - 1 - index : safeArray(draft?.picks).length });
    if (next.blockedReason) break;
    const team = getEligibleDraftTeams({ draft: simulated, rosterSettings, draftOrder, teamPool, nextPick: next })[0];
    if (!team) break;
    simulated.picks.push({ managerId: next.managerId, teamId: team.id, poolId: next.poolId });
  }
  return preview;
};

// Only a commissioner may publish these schedules. Members can consume one
// scheduled slot; Firestore rules keep the schedule and configuration immutable.
const memberAccessContext = (league, gameData) => ({
  ownerId: league.ownerId,
  members: safeArray(league.members),
  order: safeArray(gameData.draft?.order),
  rosterSize: gameData.rosterSettings?.rosterSize ?? DEFAULT_ROSTER_SETTINGS.rosterSize,
  assignmentMode: gameData.draft?.assignmentMode ?? null,
  useSnakeDraft: gameData.draft?.useSnakeDraft ?? true,
  doubleSnakeConfig: gameData.draft?.doubleSnakeConfig ?? null,
  poolAllocations: gameData.draft?.poolAllocations ?? null,
  teams: safeArray(gameData.teamPool?.teams)
});

const canonicalValue = (value) => Array.isArray(value) ? value.map(canonicalValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])])) : value;
const sameValue = (a, b) => JSON.stringify(canonicalValue(a)) === JSON.stringify(canonicalValue(b));

export const isMemberDraftAccessCurrent = (league, gameData) => {
  if (!league || !gameData?.draft) return false;
  const access = gameData.draft.memberAccess;
  if (access?.version !== 1 || !sameValue(access.context, memberAccessContext(league, gameData))) return false;
  const picks = safeArray(gameData.draft.picks);
  return sameValue(access.takenTeamIds, picks.map((pick) => pick.teamId))
    && access.remaining === Object.entries(access.queues).reduce((sum, [key, queue]) => sum + queue.turns.length - access.positions[key], 0);
};

export const buildMemberDraftAccess = (league, gameData) => {
  const draft = gameData.draft || {};
  const rosterSettings = gameData.rosterSettings || DEFAULT_ROSTER_SETTINGS;
  const teamPool = safeArray(gameData.teamPool?.teams);
  const draftOrder = reconcileDraftOrder(league, draft, rosterSettings);
  const limit = Number(rosterSettings.rosterSize ?? DEFAULT_ROSTER_SETTINGS.rosterSize) * draftOrder.length;
  const config = draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE
    ? normalizeDoubleSnakeConfig(draft.doubleSnakeConfig, teamPool, rosterSettings.rosterSize) : null;
  const queues = {};
  const positions = {};
  for (const group of config?.groups || [{ id: 'single', teamIds: teamPool.map((team) => team.id) }]) {
    const turns = getDraftOrderPreview({ draft, rosterSettings, draftOrder, teamPool, poolId: config ? group.id : null, limit })
      .filter((turn) => !turn.blockedReason)
      .map((turn) => ({ managerId: turn.managerId, round: turn.round, orderIndex: turn.pickIndex,
        poolId: turn.poolId || null, poolLabel: turn.poolLabel || null,
        ...(config ? { poolPickNumber: turn.poolPickNumber } : {}) }));
    queues[group.id] = { turns, teamIds: group.teamIds };
    positions[group.id] = 0;
  }
  return { version: 1, context: memberAccessContext(league, gameData), queues, positions,
    rosterTeams: Object.fromEntries(teamPool.map((team) => [team.id, { ...team, wins: team.wins || 0,
      poolId: config?.groups.find((group) => group.teamIds.includes(team.id))?.id || null }])),
    takenTeamIds: safeArray(draft.picks).map((pick) => pick.teamId),
    remaining: Object.values(queues).reduce((sum, queue) => sum + queue.turns.length, 0) };
};

export const syncMemberDraftAccess = async ({ leagueId }) => runTransaction(db, async (transaction) => {
  const gameRef = getGameDataRef(leagueId);
  const gameSnap = await transaction.get(gameRef);
  const leagueSnap = await transaction.get(doc(db, 'leagues', leagueId));
  if (!gameSnap.exists() || !leagueSnap.exists()) return;
  const game = gameSnap.data();
  const league = leagueSnap.data();
  if (game.draft?.status !== DRAFT_STATUS.IN_PROGRESS || isMemberDraftAccessCurrent(league, game)) return;
  const order = reconcileDraftOrder(league, game.draft, game.rosterSettings);
  const draft = { ...game.draft, order,
    ...(game.draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE ? {
      poolAllocations: getPoolAllocationPlan({ draft: game.draft, rosterSettings: game.rosterSettings,
        draftOrder: order, teamPool: game.teamPool?.teams || [] }).allocations
    } : {}) };
  transaction.update(gameRef, { 'draft.order': order,
    ...(draft.poolAllocations ? { 'draft.poolAllocations': draft.poolAllocations } : {}),
    'draft.memberAccess': buildMemberDraftAccess(league, { ...game, draft }) });
});

export const makeDraftPick = async ({
  leagueId,
  managerId,
  teamId,
  actorId = null,
  managerName = null,
  teamName = null,
  source = 'manual',
  notes = null,
  expectedPickNumber = null,
  poolId = null,
  expectedPoolPickNumber = null
}) => {
  if (!leagueId || !managerId || !teamId) {
    throw new Error('League, manager, and team are required.');
  }

  await runTransaction(db, async (transaction) => {
    const gameDataRef = getGameDataRef(leagueId);
    const gameSnapshot = await transaction.get(gameDataRef);
    if (!gameSnapshot.exists()) {
      throw new Error('Draft data not found.');
    }

    const gameData = gameSnapshot.data() || {};
    const draft = gameData.draft || {};
    const teamPool = gameData.teamPool?.teams || [];
    const rosterSettings = {
      ...DEFAULT_ROSTER_SETTINGS,
      ...(gameData.rosterSettings || {})
    };

    if (draft.status !== DRAFT_STATUS.IN_PROGRESS) {
      throw new Error('Draft must be in progress to record a pick.');
    }

    const leagueSnap = await transaction.get(doc(db, 'leagues', leagueId));
    if (!leagueSnap.exists()) throw new Error('League not found.');
    const draftOrder = reconcileDraftOrder(leagueSnap.data(), draft, rosterSettings);
    if (!draftOrder.includes(managerId)) {
      throw new Error('Selected manager is no longer a league participant.');
    }

    const teamMap = buildTeamMap(teamPool);
    if (!teamMap.has(teamId)) {
      throw new Error('Selected team is not part of the configured team pool.');
    }

    const picks = safeArray(draft.picks).map((pick) => ({ ...pick }));
    const isDoubleSnake = draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE;
    const config = isDoubleSnake ? normalizeDoubleSnakeConfig(draft.doubleSnakeConfig, teamPool, rosterSettings.rosterSize) : null;
    const targetPoolId = isDoubleSnake ? poolId || config.groups.find((group) => group.teamIds.includes(teamId))?.id : null;
    if (isDoubleSnake && !config.groups.some((group) => group.id === targetPoolId)) throw new Error('Select a valid draft pool.');
    if (expectedPickNumber !== null && expectedPickNumber !== picks.length + 1) {
      throw new Error('The draft has advanced. Review the current pick and try again.');
    }
    const nextPick = computeNextPick({ draft, rosterSettings, draftOrder, teamPool, poolId: targetPoolId });
    if (!nextPick) throw new Error('All draft slots are already filled.');
    if (nextPick.blockedReason) throw new Error(nextPick.blockedReason);
    if (isDoubleSnake && expectedPoolPickNumber !== null && expectedPoolPickNumber !== nextPick.poolPickNumber) {
      throw new Error('This pool has advanced. Review its current pick and try again.');
    }
    if (managerId !== nextPick.managerId) {
      throw new Error('This manager is not on the clock. Review the current turn.');
    }
    const availableTeams = buildAvailableTeams(teamPool, picks);
    if (!availableTeams.some((team) => team.id === teamId)) throw new Error('Team has already been drafted.');
    const eligible = getEligibleDraftTeams({ draft, rosterSettings, draftOrder, teamPool, nextPick });
    if (!eligible.some((team) => team.id === teamId)) {
      throw new Error(`Manager must draft from ${nextPick.poolLabel || nextPick.poolId}.`);
    }

    const team = teamMap.get(teamId);
    const pickTimestamp = Timestamp.now();

    const pickRecord = {
      pickNumber: picks.length + 1,
      round: nextPick.round,
      orderIndex: nextPick.pickIndex,
      managerId,
      managerName: managerName || null,
      teamId,
      teamName: teamName || team?.name || team?.shortName || teamId,
      timestamp: pickTimestamp,
      source,
      actorId: actorId || null,
      notes: notes ?? null,
      ...(isDoubleSnake ? { poolPickNumber: nextPick.poolPickNumber } : {}),
      poolId: nextPick.poolId || null,
      poolLabel: nextPick.poolLabel || null
    };

    picks.push(pickRecord);

    const rosterRef = getUserRosterRef(leagueId, managerId);
    const rosterSnap = await transaction.get(rosterRef);
    const rosterData = rosterSnap.exists() ? rosterSnap.data() : {};
    const currentTeams = safeArray(rosterData.teams);

    if (currentTeams.length >= rosterSettings.rosterSize) throw new Error('This manager already has a full roster.');

    if (currentTeams.some((teamEntry) => teamEntry.id === teamId)) {
      throw new Error('Manager already rosters this team.');
    }

    const updatedTeams = [
      ...currentTeams,
      {
        ...(team || { id: teamId, name: pickRecord.teamName }),
        wins: (team && team.wins) || 0,
        draftPickNumber: pickRecord.pickNumber,
        poolId: pickRecord.poolId || null
      }
    ];
    const updatedTotalWins = updatedTeams.reduce(
      (sum, teamEntry) => sum + (teamEntry.wins || 0),
      0
    );

    transaction.set(
      rosterRef,
      {
        teams: updatedTeams,
        totalWins: updatedTotalWins,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const rosterSize =
      rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize;
    const totalSlots = rosterSize * draftOrder.length;
    const draftUpdates = {
      'draft.picks': picks,
      'draft.order': draftOrder,
      'draft.updatedAt': serverTimestamp(),
      ...(draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE ? {
        'draft.poolAllocations': getPoolAllocationPlan({ draft, rosterSettings, draftOrder, teamPool }).allocations
      } : {})
    };

    const complete = isDoubleSnake
      ? computePoolNextPicks({ draft: { ...draft, picks, poolAllocations: draftUpdates['draft.poolAllocations'] }, rosterSettings, draftOrder, teamPool }).every((turn) => turn.completed)
      : picks.length >= totalSlots;

    const accessGame = { ...gameData, draft: { ...draft, order: draftOrder,
      ...(isDoubleSnake ? { poolAllocations: draftUpdates['draft.poolAllocations'] } : {}) } };
    const access = isMemberDraftAccessCurrent(leagueSnap.data(), accessGame)
      ? draft.memberAccess : buildMemberDraftAccess(leagueSnap.data(), accessGame);
    const queueKey = nextPick.poolId || 'single';
    draftUpdates['draft.memberAccess'] = { ...access,
      positions: { ...access.positions, [queueKey]: access.positions[queueKey] + 1 },
      takenTeamIds: [...access.takenTeamIds, teamId], remaining: access.remaining - 1 };
    if (complete) {
      draftUpdates['draft.status'] = DRAFT_STATUS.COMPLETED;
      draftUpdates['draft.completedAt'] = serverTimestamp();
    }

    transaction.update(gameDataRef, draftUpdates);
  });
};

export const undoLastPick = async ({ leagueId, poolId = null }) => {
  if (!leagueId) {
    throw new Error('League is required.');
  }

  await runTransaction(db, async (transaction) => {
    const gameDataRef = getGameDataRef(leagueId);
    const snapshot = await transaction.get(gameDataRef);
    if (!snapshot.exists()) {
      throw new Error('Draft data not found.');
    }

    const data = snapshot.data() || {};
    const draft = data.draft || {};
    const picks = safeArray(draft.picks);
    if (picks.length === 0) {
      throw new Error('No picks to roll back.');
    }

    const config = draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE
      ? normalizeDoubleSnakeConfig(draft.doubleSnakeConfig, data.teamPool?.teams || [], data.rosterSettings?.rosterSize) : null;
    const actualPool = (pick) => config?.groups.find((group) => group.teamIds.includes(pick.teamId))?.id || pick.poolId;
    const index = poolId ? picks.map((pick) => actualPool(pick) === poolId).lastIndexOf(true) : picks.length - 1;
    if (index < 0) throw new Error('No picks to roll back in this pool.');
    const pick = picks[index];
    const remainingPicks = picks.filter((_entry, i) => i !== index).map((entry, i) => ({ ...entry, pickNumber: i + 1 }));
    const managers = [...new Set([pick.managerId, ...remainingPicks.map((entry) => entry.managerId)])];
    const refs = managers.map((id) => getUserRosterRef(leagueId, id));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    snapshots.forEach((rosterSnap, i) => {
      if (!rosterSnap.exists()) return;
      const managerId = managers[i];
      const numbers = new Map(remainingPicks.filter((entry) => entry.managerId === managerId).map((entry) => [entry.teamId, entry.pickNumber]));
      const teams = safeArray(rosterSnap.data().teams)
        .filter((team) => !(managerId === pick.managerId && team.id === pick.teamId))
        .map((team) => numbers.has(team.id) ? { ...team, draftPickNumber: numbers.get(team.id) } : team);
      transaction.update(refs[i], { teams, totalWins: teams.reduce((sum, team) => sum + (team.wins || 0), 0), updatedAt: serverTimestamp() });
    });

    transaction.update(gameDataRef, {
      'draft.picks': remainingPicks,
      'draft.status':
        draft.status === DRAFT_STATUS.COMPLETED
          ? DRAFT_STATUS.IN_PROGRESS
          : draft.status,
      'draft.updatedAt': serverTimestamp(),
      'draft.completedAt': null,
      'draft.rollbackAt': serverTimestamp(),
      'draft.lastRollback': {
        ...pick,
        rolledBackAt: serverTimestamp()
      }
    });
  });
};

export const resetDraftState = async ({ leagueId, preserveRosters = false }) => {
  if (!leagueId) {
    throw new Error('League is required.');
  }

  await runTransaction(db, async (transaction) => {
    const gameDataRef = getGameDataRef(leagueId);
    const snapshot = await transaction.get(gameDataRef);
    if (!snapshot.exists()) {
      throw new Error('Draft data not found.');
    }

    const draft = snapshot.data()?.draft || {};
    const picks = safeArray(draft.picks);

    if (!preserveRosters && picks.length) {
      const affectedManagers = Array.from(
        new Set(picks.map((pick) => pick.managerId).filter(Boolean))
      );

      const rosterRefs = affectedManagers.map((id) => getUserRosterRef(leagueId, id));
      const rosterSnaps = await Promise.all(rosterRefs.map((ref) => transaction.get(ref)));
      rosterSnaps.forEach((rosterSnap, index) => {
        const managerId = affectedManagers[index];
        const rosterRef = rosterRefs[index];
        if (!rosterSnap.exists()) return;
        const rosterData = rosterSnap.data() || {};
        const filteredTeams = safeArray(rosterData.teams).filter(
          (team) =>
            !picks.some(
              (pick) => pick.teamId === team.id && pick.managerId === managerId
            )
        );
        const totalWins = filteredTeams.reduce(
          (sum, teamEntry) => sum + (teamEntry.wins || 0),
          0
        );
        transaction.update(rosterRef, {
          teams: filteredTeams,
          totalWins,
          updatedAt: serverTimestamp()
        });
      });
    }

    transaction.update(gameDataRef, {
      'draft.picks': [],
      'draft.poolAllocations': null,
      'draft.status': DRAFT_STATUS.NOT_STARTED,
      'draft.startedAt': draft.startedAt || null,
      'draft.completedAt': null,
      'draft.pausedAt': null,
      'draft.resumedAt': null,
      'draft.rollbackAt': null,
      'draft.lastRollback': null,
      'draft.updatedAt': serverTimestamp()
    });
  });
};

export const getAvailableTeams = (teamPool = [], picks = []) =>
  buildAvailableTeams(teamPool, picks);

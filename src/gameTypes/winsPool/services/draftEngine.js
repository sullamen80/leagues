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
  const managerPickCounts = new Map();
  const managerPoolCounts = new Map();

  safeArray(picks).forEach((pick) => {
    if (!pick || !pick.managerId) return;
    managerPickCounts.set(pick.managerId, (managerPickCounts.get(pick.managerId) || 0) + 1);

    if (pick.poolId) {
      const poolCounts = managerPoolCounts.get(pick.managerId) || {};
      poolCounts[pick.poolId] = (poolCounts[pick.poolId] || 0) + 1;
      managerPoolCounts.set(pick.managerId, poolCounts);
    }
  });

  return { managerPickCounts, managerPoolCounts };
};

const resolvePoolRequirement = ({
  draft,
  config,
  managerId,
  managerPoolCounts,
  availableTeamsById
}) => {
  if (draft.assignmentMode !== ASSIGNMENT_MODES.DOUBLE_SNAKE) {
    return { poolId: null, poolLabel: null, remaining: null };
  }

  const pools = safeArray(config.groups);
  const picksPerPool = config.picksPerPool || {};
  const poolCounts = managerPoolCounts.get(managerId) || {};

  const rankedPools = pools
    .map((group) => {
      const limit = Number(picksPerPool[group.id] ?? 0);
      const used = Number(poolCounts[group.id] ?? 0);
      const remaining = Math.max(0, limit - used);
      if (remaining <= 0) {
        return null;
      }
      const hasAvailability = safeArray(group.teamIds || []).some((teamId) =>
        availableTeamsById.has(teamId)
      );
      if (!hasAvailability) {
        return null;
      }
      return {
        group,
        remaining
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.remaining - a.remaining);

  if (!rankedPools.length) {
    return { poolId: null, poolLabel: null, remaining: null };
  }

  const target = rankedPools[0];
  return {
    poolId: target.group.id,
    poolLabel: target.group.label,
    remaining: target.remaining
  };
};

export const computeNextPick = ({
  draft,
  rosterSettings,
  draftOrder,
  teamPool
}) => {
  const picks = safeArray(draft?.picks);
  const order = safeArray(draftOrder);
  const rosterSize =
    Math.max(0, rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize);

  if (!order.length || rosterSize <= 0) {
    return null;
  }

  const totalSlots = rosterSize * order.length;
  if (picks.length >= totalSlots) {
    return null;
  }

  const { managerPickCounts, managerPoolCounts } = computeManagerCounts(picks);
  const useSnake =
    draft.assignmentMode !== ASSIGNMENT_MODES.AUCTION &&
    (draft.useSnakeDraft === undefined ? true : draft.useSnakeDraft);
  const availableTeams = buildAvailableTeams(teamPool, picks);
  const availableTeamsById = new Map(
    availableTeams.map((team) => [team.id, team])
  );

  const config =
    draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE
      ? normalizeDoubleSnakeConfig(
          draft.doubleSnakeConfig,
          teamPool,
          rosterSize
        )
      : null;

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

    const poolRequirement = resolvePoolRequirement({
      draft,
      config: config || {},
      managerId,
      managerPoolCounts,
      availableTeamsById
    });

    return {
      pickNumber: pickIndex + 1,
      round,
      pickIndex: orderIndex,
      managerId,
      poolId: poolRequirement.poolId,
      poolLabel: poolRequirement.poolLabel,
      rosterSlotsRemaining: rosterSize - picksTaken,
      poolSlotsRemaining: poolRequirement.remaining
    };
  }

  return null;
};

export const makeDraftPick = async ({
  leagueId,
  managerId,
  teamId,
  actorId = null,
  managerName = null,
  teamName = null,
  source = 'manual',
  notes = null,
  orderFallback = null,
  rosterSizeOverride = null
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

    let draftOrder = safeArray(draft.order);
    if (!draftOrder.length && orderFallback && Array.isArray(orderFallback)) {
      draftOrder = safeArray(orderFallback);
    }

    const teamMap = buildTeamMap(teamPool);
    if (!teamMap.has(teamId)) {
      throw new Error('Selected team is not part of the configured team pool.');
    }

    const picks = safeArray(draft.picks).map((pick) => ({ ...pick }));
    const nextPick = computeNextPick({
      draft,
      rosterSettings: {
        ...rosterSettings,
        rosterSize:
          rosterSizeOverride !== null && rosterSizeOverride !== undefined
            ? rosterSizeOverride
            : rosterSettings?.rosterSize
      },
      draftOrder,
      teamPool
    });

    if (!nextPick) {
      throw new Error('All draft slots are already filled.');
    }

    const availableTeams = buildAvailableTeams(teamPool, picks);
    if (!availableTeams.some((team) => team.id === teamId)) {
      throw new Error('Team has already been drafted.');
    }

    const expectedManagerId = nextPick.managerId;
    const isOverride = managerId !== expectedManagerId;

    const config =
      draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE
        ? normalizeDoubleSnakeConfig(
            draft.doubleSnakeConfig,
            teamPool,
            rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
          )
        : null;

    if (draft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE && !isOverride) {
      const pools = config?.groups || [];
      const poolIdsForTeam = pools
        .filter((group) => safeArray(group.teamIds).includes(teamId))
        .map((group) => group.id);
      if (
        nextPick.poolId &&
        (!poolIdsForTeam.length || !poolIdsForTeam.includes(nextPick.poolId))
      ) {
        throw new Error(
          `Manager must draft from ${nextPick.poolLabel || nextPick.poolId}, but selected team belongs to a different pool.`
        );
      }
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
      poolId: nextPick.poolId || null,
      poolLabel: nextPick.poolLabel || null
    };

    if (isOverride) {
      pickRecord.override = true;
    }

    picks.push(pickRecord);

    const rosterRef = getUserRosterRef(leagueId, managerId);
    const rosterSnap = await transaction.get(rosterRef);
    const rosterData = rosterSnap.exists() ? rosterSnap.data() : {};
    const currentTeams = safeArray(rosterData.teams);

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
      'draft.updatedAt': serverTimestamp()
    };

    if (picks.length >= totalSlots) {
      draftUpdates['draft.status'] = DRAFT_STATUS.COMPLETED;
      draftUpdates['draft.completedAt'] = serverTimestamp();
    }

    transaction.update(gameDataRef, draftUpdates);
  });
};

export const undoLastPick = async ({ leagueId }) => {
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

    const pick = picks[picks.length - 1];
    const remainingPicks = picks.slice(0, -1);

    const rosterRef = getUserRosterRef(leagueId, pick.managerId);
    const rosterSnap = await transaction.get(rosterRef);
    if (rosterSnap.exists()) {
      const rosterData = rosterSnap.data() || {};
      const teams = safeArray(rosterData.teams).filter(
        (teamEntry) => teamEntry.id !== pick.teamId
      );
      const totalWins = teams.reduce(
        (sum, teamEntry) => sum + (teamEntry.wins || 0),
        0
      );
      transaction.update(rosterRef, {
        teams,
        totalWins,
        updatedAt: serverTimestamp()
      });
    }

    transaction.update(gameDataRef, {
      'draft.picks': remainingPicks,
      'draft.status':
        draft.status === DRAFT_STATUS.COMPLETED
          ? DRAFT_STATUS.IN_PROGRESS
          : draft.status,
      'draft.updatedAt': serverTimestamp(),
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

      for (const managerId of affectedManagers) {
        const rosterRef = getUserRosterRef(leagueId, managerId);
        const rosterSnap = await transaction.get(rosterRef);
        if (!rosterSnap.exists()) continue;
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
      }
    }

    transaction.update(gameDataRef, {
      'draft.picks': [],
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

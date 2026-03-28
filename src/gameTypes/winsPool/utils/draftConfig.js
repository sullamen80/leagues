// src/gameTypes/winsPool/utils/draftConfig.js
import { DEFAULT_DOUBLE_SNAKE_CONFIG, DOUBLE_SNAKE_POOLS, DEFAULT_ROSTER_SETTINGS } from '../constants/winsPoolConstants';

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const ensureTwoGroups = (groups = []) => {
  const existing = [...groups];
  const requiredIds = [DOUBLE_SNAKE_POOLS.POOL_A, DOUBLE_SNAKE_POOLS.POOL_B];

  const normalized = requiredIds.map((poolId, index) => {
    const fallbackLabel = index === 0 ? 'Pool A' : 'Pool B';
    const match = existing.find(group => group.id === poolId) || {};
    return {
      id: poolId,
      label: match.label || fallbackLabel,
      teamIds: Array.isArray(match.teamIds) ? [...new Set(match.teamIds)] : []
    };
  });

  return normalized;
};

const getTeamIdList = (teamPool = []) => {
  if (!Array.isArray(teamPool)) return [];
  return teamPool
    .filter(team => team && team.id)
    .map(team => team.id);
};

const createBuckets = (teamPool = [], key) => {
  const buckets = new Map();
  teamPool.forEach((team) => {
    const bucketKey = (team?.[key] || '').trim() || 'Uncategorized';
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey).push(team.id);
  });
  return buckets;
};

const distributeBuckets = (buckets, groups) => {
  const entries = Array.from(buckets.entries()).sort((a, b) => b[1].length - a[1].length);
  if (entries.length === 0) {
    return groups;
  }

  const [poolA, poolB] = groups;
  poolA.teamIds = [];
  poolB.teamIds = [];

  entries.forEach(([label, ids], index) => {
    const target = index % 2 === 0 ? poolA : poolB;
    const secondary = target === poolA ? poolB : poolA;
    if (!target.label || target.label.startsWith('Pool')) {
      target.label = label;
    }
    ids.forEach((id) => {
      if (!target.teamIds.includes(id)) {
        target.teamIds.push(id);
      }
    });
    if (entries.length === 1 && secondary.teamIds.length === 0) {
      secondary.teamIds = [];
    }
  });

  // Ensure both pools have at least one team; if not, rebalance
  const allIds = entries.flatMap(([, ids]) => ids);
  if (poolA.teamIds.length === 0 || poolB.teamIds.length === 0) {
    const midpoint = Math.ceil(allIds.length / 2);
    poolA.teamIds = allIds.slice(0, midpoint);
    poolB.teamIds = allIds.slice(midpoint);
  }

  return [poolA, poolB];
};

const balanceTeamAssignments = (config, teamPool = []) => {
  const allTeamIds = new Set(getTeamIdList(teamPool));
  const groups = ensureTwoGroups(config.groups);
  const assignments = new Map();

  groups.forEach((group) => {
    group.teamIds = group.teamIds.filter((id) => allTeamIds.has(id));
    group.teamIds.forEach((teamId) => {
      assignments.set(teamId, group.id);
    });
  });

  const unassignedTeams = [...allTeamIds].filter((teamId) => !assignments.has(teamId));
  unassignedTeams.forEach((teamId, index) => {
    const target = index % 2 === 0 ? groups[0] : groups[1];
    target.teamIds.push(teamId);
    assignments.set(teamId, target.id);
  });

  return groups;
};

const getEvenSplit = (totalPicks = DEFAULT_ROSTER_SETTINGS.rosterSize) => {
  const safeTotal = Math.max(0, Number(totalPicks) || 0);
  const poolA = Math.ceil(safeTotal / 2);
  const poolB = Math.max(0, safeTotal - poolA);
  return {
    [DOUBLE_SNAKE_POOLS.POOL_A]: poolA,
    [DOUBLE_SNAKE_POOLS.POOL_B]: poolB
  };
};

export const getDefaultDoubleSnakeConfig = () => deepClone(DEFAULT_DOUBLE_SNAKE_CONFIG);

export const generateAutoDoubleSnakeConfig = (
  teamPool = [],
  groupingMode = 'conference',
  rosterSize = DEFAULT_ROSTER_SETTINGS.rosterSize
) => {
  const config = getDefaultDoubleSnakeConfig();
  config.groupingMode = groupingMode;
  const groups = ensureTwoGroups(config.groups);
  config.picksPerPool = getEvenSplit(rosterSize);

  if (!Array.isArray(teamPool) || teamPool.length === 0) {
    config.groups = groups;
    return config;
  }

  if (groupingMode === 'conference' || groupingMode === 'division') {
    const key = groupingMode === 'conference' ? 'conference' : 'division';
    const buckets = createBuckets(teamPool, key);
    const splitGroups = distributeBuckets(buckets, groups);
    config.groups = balanceTeamAssignments({ groups: splitGroups }, teamPool);
    config.groups.forEach((group) => {
      if (!group.label || group.label.startsWith('Pool')) {
        group.label = `Pool ${group.id === DOUBLE_SNAKE_POOLS.POOL_A ? 'A' : 'B'}`;
      }
    });
    return config;
  }

  config.groups = balanceTeamAssignments({ groups }, teamPool);
  return config;
};

export const normalizeDoubleSnakeConfig = (
  config,
  teamPool = [],
  rosterSize = DEFAULT_ROSTER_SETTINGS.rosterSize
) => {
  if (!config) return generateAutoDoubleSnakeConfig(teamPool, 'conference', rosterSize);
  const normalized = getDefaultDoubleSnakeConfig();
  normalized.groupingMode = config.groupingMode || normalized.groupingMode;

  const incomingGroups = ensureTwoGroups(config.groups);
  const balancedGroups = balanceTeamAssignments({ groups: incomingGroups }, teamPool);
  normalized.groups = balancedGroups;

  normalized.picksPerPool = {
    ...normalized.picksPerPool,
    ...(config.picksPerPool || {})
  };

  const currentTotal = Object.values(normalized.picksPerPool).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (currentTotal === 0 && rosterSize > 0) {
    normalized.picksPerPool = getEvenSplit(rosterSize);
  } else {
    normalized.picksPerPool = {
      [DOUBLE_SNAKE_POOLS.POOL_A]: Number(normalized.picksPerPool[DOUBLE_SNAKE_POOLS.POOL_A] || 0),
      [DOUBLE_SNAKE_POOLS.POOL_B]: Number(normalized.picksPerPool[DOUBLE_SNAKE_POOLS.POOL_B] || 0)
    };
  }

  normalized.notes = config.notes || normalized.notes;

  return normalized;
};

export const updateTeamAssignment = (config, teamId, targetPool) => {
  const next = deepClone(config || getDefaultDoubleSnakeConfig());
  next.groups = ensureTwoGroups(next.groups).map((group) => {
    if (group.teamIds.includes(teamId)) {
      return { ...group, teamIds: group.teamIds.filter((id) => id !== teamId) };
    }
    return { ...group };
  });

  const targetGroup = next.groups.find((group) => group.id === targetPool);
  if (targetGroup && !targetGroup.teamIds.includes(teamId)) {
    targetGroup.teamIds.push(teamId);
  }

  return next;
};

export const renameDoubleSnakeGroup = (config, poolId, label) => {
  const next = deepClone(config || getDefaultDoubleSnakeConfig());
  next.groups = ensureTwoGroups(next.groups).map((group) => (
    group.id === poolId ? { ...group, label: label || group.label } : group
  ));
  return next;
};

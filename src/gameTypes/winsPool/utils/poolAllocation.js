import { normalizeDoubleSnakeConfig } from './draftConfig';
import { DEFAULT_ROSTER_SETTINGS } from '../constants/winsPoolConstants';

// Persist this plan at draft start. Pool quotas belong to each manager and must
// not move when someone joins/leaves or the displayed sequence changes.
export const getPoolAllocationPlan = ({ draft, rosterSettings, draftOrder, teamPool }) => {
  const size = Number(rosterSettings?.rosterSize ?? DEFAULT_ROSTER_SETTINGS.rosterSize);
  if (!Number.isInteger(size) || size < 1) return { error: 'Roster size must be a positive whole number.' };
  const config = normalizeDoubleSnakeConfig(draft.doubleSnakeConfig, teamPool, size);
  const [poolA, poolB] = config.groups;
  const ids = [...new Set(draftOrder || [])];
  const allocations = {};
  const totals = { [poolA.id]: 0, [poolB.id]: 0 };
  const stored = draft.poolAllocations || {};
  const pending = [];
  const add = (id, quotas, startingPoolId) => {
    allocations[id] = { quotas, startingPoolId };
    totals[poolA.id] += quotas[poolA.id];
    totals[poolB.id] += quotas[poolB.id];
  };
  for (const id of ids) {
    const allocation = stored[id];
    if (allocation) {
      const a = allocation.quotas?.[poolA.id];
      const b = allocation.quotas?.[poolB.id];
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a + b !== size) {
        return { error: 'Saved pool quotas do not match the roster size. Reset the draft before changing allocation.' };
      }
      add(id, { [poolA.id]: a, [poolB.id]: b }, allocation.startingPoolId);
    } else pending.push(id);
  }
  if (config.quotaMode === 'fixed') {
    const quotas = config.picksPerPool;
    if (quotas[poolA.id] + quotas[poolB.id] !== size) return { error: 'Double snake pool quotas must add up to the roster size.' };
    pending.forEach((id) => add(id, { ...quotas }, quotas[poolA.id] ? poolA.id : poolB.id));
  } else {
    const base = Math.floor(size / 2);
    const odd = size % 2;
    const remainingA = poolA.teamIds.length - totals[poolA.id] - pending.length * base;
    const remainingB = poolB.teamIds.length - totals[poolB.id] - pending.length * base;
    if (remainingA < 0 || remainingB < 0) return { error: `Each pool needs at least ${base} teams per manager for balanced allocation.` };
    let extrasA = 0;
    if (odd) {
      const minimum = Math.max(0, pending.length - remainingB);
      const maximum = Math.min(pending.length, remainingA);
      if (minimum > maximum) return { error: `${ids.length} managers × ${size} teams requires ${ids.length * size} available teams across the two pools.` };
      // Aim for equal aggregate demand, within each custom pool's capacity.
      const target = Math.round((totals[poolB.id] - totals[poolA.id] + pending.length) / 2);
      extrasA = Math.max(minimum, Math.min(maximum, target));
    }
    // Spread extra picks down the saved order. startingPoolId is retained for
    // saved-record compatibility; independent pool snakes set their own order.
    pending.forEach((id, index) => {
      const left = pending.length - index;
      const extraA = odd && (extrasA === left || (index % 2 === 0 && extrasA > 0));
      if (extraA) extrasA -= 1;
      const a = base + (extraA ? 1 : 0);
      const b = base + (odd && !extraA ? 1 : 0);
      add(id, { [poolA.id]: a, [poolB.id]: b }, odd && !extraA ? poolB.id : poolA.id);
    });
  }
  for (const pool of config.groups) {
    if (totals[pool.id] > pool.teamIds.length) {
      return { error: `${pool.label} needs ${totals[pool.id]} teams for this draft, but has ${pool.teamIds.length}. Reduce its quota or add teams.` };
    }
  }
  return { allocations, totals, config, error: null };
};

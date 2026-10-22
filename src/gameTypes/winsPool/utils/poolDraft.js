import { getPoolAllocationPlan } from './poolAllocation';
import { normalizeDoubleSnakeConfig } from './draftConfig';
import { DEFAULT_ROSTER_SETTINGS } from '../constants/winsPoolConstants';

// Each pool replays its own snake. Picks in the other pool never consume a slot.
export const getPoolDraftTurns = ({ draft = {}, rosterSettings, draftOrder = [], teamPool = [] }) => {
  const config = normalizeDoubleSnakeConfig(draft.doubleSnakeConfig, teamPool, rosterSettings?.rosterSize);
  const plan = getPoolAllocationPlan({ draft, rosterSettings, draftOrder, teamPool });
  const picks = Array.isArray(draft.picks) ? draft.picks : [];
  const taken = new Set(picks.map((pick) => pick.teamId));
  const assignments = new Map(config.groups.flatMap((group) => group.teamIds.map((id) => [id, group.id])));
  return config.groups.map((group, groupIndex) => {
    const poolPicks = picks.filter((pick) => (assignments.get(pick.teamId) || pick.poolId) === group.id);
    const counts = new Map();
    poolPicks.forEach((pick) => counts.set(pick.managerId, (counts.get(pick.managerId) || 0) + 1));
    const initialOrder = groupIndex === 0 ? [...draftOrder] : [...draftOrder].reverse();
    const base = {
      poolId: group.id, poolLabel: group.label,
      poolPickNumber: poolPicks.length + 1, pickNumber: picks.length + 1,
      poolPicksTaken: poolPicks.length, poolTotalPicks: plan.totals?.[group.id] || 0
    };
    if (plan.error) return { ...base, managerId: initialOrder[0] || null, completed: false, blockedReason: plan.error };
    const quotas = plan.allocations;
    const overfilled = draftOrder.find((id) => (counts.get(id) || 0) > quotas[id].quotas[group.id]);
    if (overfilled) return { ...base, managerId: overfilled, completed: false, blockedReason: 'A manager has exceeded this pool’s quota. Roll back the incorrect pick before continuing.' };
    const rounds = Math.max(0, ...draftOrder.map((id) => quotas[id].quotas[group.id]));
    for (let round = 1; round <= rounds; round += 1) {
      const order = round % 2 === 1 ? initialOrder : [...initialOrder].reverse();
      for (const managerId of order) {
        const quota = quotas[managerId].quotas[group.id];
        const used = counts.get(managerId) || 0;
        if (quota < round || used >= round) continue;
        const available = group.teamIds.some((id) => !taken.has(id));
        const totalUsed = picks.filter((pick) => pick.managerId === managerId).length;
        return {
          ...base, managerId, round, pickIndex: draftOrder.indexOf(managerId),
          rosterSlotsRemaining: Number(rosterSettings?.rosterSize ?? DEFAULT_ROSTER_SETTINGS.rosterSize) - totalUsed,
          poolSlotsRemaining: quota - used, completed: false,
          blockedReason: available ? null : `No teams remain in ${group.label}. The draft cannot continue with these pool quotas.`
        };
      }
    }
    return { ...base, managerId: null, completed: true, blockedReason: null };
  });
};

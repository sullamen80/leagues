import { getPoolAllocationPlan } from './poolAllocation';
import { generateAutoDoubleSnakeConfig, normalizeDoubleSnakeConfig, updateTeamAssignment } from './draftConfig';

test('joins and removals preserve existing quotas; capacity prevents impossible growth', () => {
  const teams = Array.from({ length: 12 }, (_, index) => ({ id: `t${index}`, conference: index < 6 ? 'East' : 'West' }));
  const draft = { doubleSnakeConfig: generateAutoDoubleSnakeConfig(teams, 'conference', 3) };
  const input = { draft, rosterSettings: { rosterSize: 3 }, teamPool: teams, draftOrder: ['owner', 'alice'] };
  const original = getPoolAllocationPlan(input).allocations;
  draft.poolAllocations = original;
  const joined = getPoolAllocationPlan({ ...input, draftOrder: ['owner', 'alice', 'bob'] });
  expect(joined.error).toBeNull();
  expect(joined.allocations.owner).toEqual(original.owner);
  expect(joined.allocations.alice).toEqual(original.alice);
  draft.poolAllocations = joined.allocations;
  expect(getPoolAllocationPlan({ ...input, draftOrder: ['owner', 'bob'] }).allocations.bob).toEqual(joined.allocations.bob);
  expect(getPoolAllocationPlan({ ...input, draftOrder: ['owner', 'alice', 'bob', 'carol', 'dave'] }).error).toBeTruthy();
  expect(getPoolAllocationPlan({ ...input, rosterSettings: { rosterSize: 0 } }).error).toContain('positive whole');
});

test('custom pool assignments survive exclusion, serialization, and restoration', () => {
  const teams = [{ id: 'a', conference: 'East' }, { id: 'b', conference: 'West' }, { id: 'c', conference: 'West' }];
  let config = generateAutoDoubleSnakeConfig(teams, 'conference', 3);
  config = { ...updateTeamAssignment(config, 'a', 'poolB'), groupingMode: 'custom' };
  config = normalizeDoubleSnakeConfig(config, teams.filter((team) => team.id !== 'a'), 3);
  const restored = normalizeDoubleSnakeConfig(JSON.parse(JSON.stringify(config)), teams, 3);
  expect(restored.groups.find((group) => group.id === 'poolB').teamIds).toContain('a');
  expect(restored.groups.find((group) => group.id === 'poolA').teamIds).not.toContain('a');
});

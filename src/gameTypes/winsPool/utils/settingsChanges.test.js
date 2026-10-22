import { mergeDraftSettings } from './settingsChanges';
import { generateAutoDoubleSnakeConfig, normalizeDoubleSnakeConfig } from './draftConfig';

test('scoring saves preserve picks, completion, and allocation from the current snapshot', () => {
  const teams = [{ id: 'a', conference: 'East' }, { id: 'b', conference: 'West' }];
  const current = {
    draft: { status: 'completed', picks: [{ managerId: 'owner', teamId: 'a' }], poolAllocations: { owner: { quotas: { poolA: 1, poolB: 0 } } },
      order: ['owner'], doubleSnakeConfig: generateAutoDoubleSnakeConfig(teams, 'conference', 1) },
    rosterSettings: { rosterSize: 1 }, teamPool: { id: 'custom', teams }
  };
  const requested = { ...current, draft: { ...current.draft, status: 'in_progress', picks: [], poolAllocations: null }, scoring: { pointsPerWin: 2 } };
  expect(mergeDraftSettings(current, requested)).toMatchObject({ draft: current.draft, scoring: { pointsPerWin: 2 } });
  expect(() => mergeDraftSettings(current, { ...requested, rosterSettings: { rosterSize: 2 } })).toThrow('locked');
  expect(() => mergeDraftSettings(current, { ...requested, teamPool: { ...current.teamPool, teams: [{ id: 'c' }] } })).toThrow('locked');
});

test('pre-draft custom quota edits clear the previous allocation', () => {
  const current = { draft: { status: 'not_started', poolAllocations: { owner: {} } } };
  const requested = { draft: { doubleSnakeConfig: { quotaMode: 'balanced' } }, rosterSettings: { rosterSize: 5 }, teamPool: { id: 'new' } };
  expect(mergeDraftSettings(current, requested).draft).toMatchObject({ poolAllocations: null, doubleSnakeConfig: { quotaMode: 'balanced' } });
});

test('legacy active settings tolerate UI defaults without overwriting live draft state', () => {
  const current = { draft: { status: 'in_progress', picks: [{ teamId: 'a' }] }, rosterSettings: { rosterSize: 3 }, teamPool: { id: 'pool', teams: [] } };
  const requested = { ...current, scoring: { pointsPerWin: 2 }, draft: { ...current.draft, auctionBudget: 200, useSnakeDraft: true, assignmentMode: 'draft', order: ['owner', 'alice'], doubleSnakeConfig: normalizeDoubleSnakeConfig(null, [], 3) } };
  expect(mergeDraftSettings(current, requested, { ownerId: 'owner', members: ['alice'] }).draft).toEqual(current.draft);
});

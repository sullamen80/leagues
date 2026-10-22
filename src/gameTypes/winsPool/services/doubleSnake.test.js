import { runTransaction } from 'firebase/firestore';
import { computeNextPick, computePoolNextPicks, getEligibleDraftTeams, getDraftOrderPreview, makeDraftPick, undoLastPick, resetDraftState } from './draftEngine';
import { getPoolAllocationPlan } from '../utils/poolAllocation';
import { hydrateTeamPool } from '../constants/teamPools';
import { generateAutoDoubleSnakeConfig, normalizeDoubleSnakeConfig } from '../utils/draftConfig';

jest.mock('../../../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => segments.join('/'),
  runTransaction: jest.fn(), serverTimestamp: () => 'server-time', Timestamp: { now: () => 'pick-time' }
}));

const order = ['owner', 'alice', 'bob'];
const teams = Array.from({ length: 12 }, (_, index) => ({
  id: `team${index}`, name: `Team ${index}`, conference: index < 6 ? 'East' : 'West'
}));
const fixture = (rosterSize = 3) => ({
  draft: { status: 'in_progress', assignmentMode: 'double_snake', useSnakeDraft: true, order, picks: [],
    doubleSnakeConfig: { ...generateAutoDoubleSnakeConfig(teams, 'conference', rosterSize), quotaMode: 'fixed' } },
  rosterSettings: { rosterSize }, teamPool: { teams }
});
const next = (game, poolId = null) => computeNextPick({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: order, teamPool: teams, poolId });
const eligible = (game, poolId = null) => getEligibleDraftTeams({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: order, teamPool: teams, poolId });

const setup = (initialGame = fixture(), members = order) => {
  const docs = {
    'leagues/pool': { ownerId: 'owner', members },
    'leagues/pool/gameData/current': initialGame
  };
  runTransaction.mockImplementation(async (_db, callback) => {
    let writesStarted = false;
    const writes = [];
    const transaction = {
      get: async (ref) => {
        if (writesStarted) throw new Error('All reads must happen before writes');
        return { exists: () => !!docs[ref], data: () => JSON.parse(JSON.stringify(docs[ref] || {})) };
      },
      set: (ref, data) => { writesStarted = true; writes.push([ref, data]); },
      update: (ref, data) => { writesStarted = true; writes.push([ref, data]); }
    };
    await callback(transaction);
    for (const [ref, data] of writes) {
      docs[ref] = docs[ref] || {};
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split('.');
        let target = docs[ref];
        keys.slice(0, -1).forEach((key) => { target[key] = target[key] || {}; target = target[key]; });
        target[keys[keys.length - 1]] = value;
      }
    }
  });
  return docs;
};

test('a full manually recorded double snake runs separate opposite-start queues', async () => {
  const docs = setup();
  const managers = [];
  const pools = [];
  for (let index = 0; index < 9; index += 1) {
    const game = docs['leagues/pool/gameData/current'];
    const turn = next(game);
    managers.push(turn.managerId); pools.push(turn.poolId);
    await makeDraftPick({ leagueId: 'pool', managerId: turn.managerId,
      teamId: eligible(game)[0].id, actorId: 'owner', source: 'admin-console', expectedPickNumber: index + 1 });
  }
  expect(managers).toEqual(['owner', 'alice', 'bob', 'bob', 'alice', 'owner', 'bob', 'alice', 'owner']);
  expect(pools).toEqual(['poolA', 'poolA', 'poolA', 'poolA', 'poolA', 'poolA', 'poolB', 'poolB', 'poolB']);
  expect(docs['leagues/pool/gameData/current'].draft.status).toBe('completed');
  expect(next(docs['leagues/pool/gameData/current'])).toBeNull();
  order.forEach((id) => expect(docs[`leagues/pool/userData/${id}`].teams.map((team) => team.poolId)).toEqual(['poolA', 'poolA', 'poolB']));
  expect(docs['leagues/pool/gameData/current'].draft.picks.every((pick) => pick.actorId === 'owner')).toBe(true);

  await undoLastPick({ leagueId: 'pool' });
  expect(docs['leagues/pool/gameData/current'].draft.completedAt).toBeNull();
  expect(next(docs['leagues/pool/gameData/current']).managerId).toBe('owner');
  expect(eligible(docs['leagues/pool/gameData/current'])).toHaveLength(4);
});

test('wrong manager, wrong pool, and duplicate submission cannot corrupt the next turn', async () => {
  const docs = setup();
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'alice', teamId: 'team0' })).rejects.toThrow('not on the clock');
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'owner', teamId: 'team6', poolId: 'poolA' })).rejects.toThrow('must draft from East');
  expect(docs['leagues/pool/gameData/current'].draft.picks).toHaveLength(0);
  for (let index = 0; index < 3; index += 1) {
    const game = docs['leagues/pool/gameData/current'];
    await makeDraftPick({ leagueId: 'pool', managerId: next(game).managerId, teamId: eligible(game)[0].id, expectedPickNumber: index + 1 });
  }
  // Bob has a consecutive pick in Pool A at its reversal, but this is a new pool pick.
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'bob', teamId: 'team3', poolId: 'poolA', expectedPoolPickNumber: 3 })).rejects.toThrow('pool has advanced');
  expect(docs['leagues/pool/gameData/current'].draft.picks).toHaveLength(3);
  await resetDraftState({ leagueId: 'pool' });
  order.forEach((id) => expect(docs[`leagues/pool/userData/${id}`].teams).toEqual([]));
});

test('preview uses the engine and quotas support an asymmetric split', () => {
  const game = fixture(4);
  game.draft.doubleSnakeConfig.quotaMode = 'fixed';
  game.draft.doubleSnakeConfig.picksPerPool = { poolA: 3, poolB: 1 };
  // Three managers need nine East teams for this split.
  const pool = Array.from({ length: 12 }, (_, index) => ({ id: `t${index}`, conference: index < 9 ? 'East' : 'West' }));
  game.draft.doubleSnakeConfig = generateAutoDoubleSnakeConfig(pool, 'conference', 4);
  game.draft.doubleSnakeConfig.quotaMode = 'fixed';
  game.draft.doubleSnakeConfig.picksPerPool = { poolA: 3, poolB: 1 };
  const preview = getDraftOrderPreview({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: order, teamPool: pool, poolId: 'poolA', limit: 12 });
  expect(preview.map((turn) => turn.poolId)).toEqual([
    'poolA', 'poolA', 'poolA', 'poolA', 'poolA', 'poolA', 'poolA', 'poolA', 'poolA'
  ]);
});

test('invalid capacity and exhausted required pools never unlock the other pool', () => {
  const game = fixture();
  game.draft.doubleSnakeConfig.picksPerPool = { poolA: 3, poolB: 0 };
  expect(next(game).blockedReason).toContain('needs 9 teams');
  expect(eligible(game)).toEqual([]);
  const valid = fixture();
  valid.draft.picks = teams.slice(0, 6).map((team) => ({ managerId: 'removed', teamId: team.id }));
  expect(next(valid).blockedReason).toContain('No teams remain in East');
  expect(eligible(valid)).toEqual([]);
});

test('legacy pool metadata is inferred from teams and duplicate assignments are removed', () => {
  const game = fixture();
  game.draft.picks = [{ managerId: 'owner', teamId: 'team0', poolId: 'poolB' },
    { managerId: 'alice', teamId: 'team1' }, { managerId: 'bob', teamId: 'team2' }];
  expect(next(game, 'poolA')).toMatchObject({ managerId: 'bob', poolId: 'poolA', poolPickNumber: 4 });
  expect(next(game, 'poolB')).toMatchObject({ managerId: 'bob', poolId: 'poolB', poolPickNumber: 1 });
  const config = game.draft.doubleSnakeConfig;
  config.groups[1].teamIds.push('team0');
  const normalized = normalizeDoubleSnakeConfig(config, teams, 3);
  expect(normalized.groups.filter((group) => group.teamIds.includes('team0'))).toHaveLength(1);
});

test('paused drafts, taken teams, and full rosters reject writes; double snake always reverses', async () => {
  const docs = setup();
  const game = docs['leagues/pool/gameData/current'];
  game.draft.status = 'paused';
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'owner', teamId: 'team0' })).rejects.toThrow('in progress');
  game.draft.status = 'in_progress';
  docs['leagues/pool/userData/owner'] = { teams: [{ id: 'other0' }, { id: 'other1' }, { id: 'other2' }] };
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'owner', teamId: 'team0' })).rejects.toThrow('full roster');
  expect(game.draft.picks).toHaveLength(0);
  delete docs['leagues/pool/userData/owner'];
  await makeDraftPick({ leagueId: 'pool', managerId: 'owner', teamId: 'team0' });
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'alice', teamId: 'team0' })).rejects.toThrow('already been drafted');
  const legacy = fixture();
  legacy.draft.useSnakeDraft = false;
  const preview = getDraftOrderPreview({ draft: legacy.draft, rosterSettings: legacy.rosterSettings, draftOrder: order, teamPool: teams, limit: 6 });
  expect(preview.map((turn) => turn.managerId)).toEqual(['owner', 'alice', 'bob', 'bob', 'alice', 'owner']);
});


test.each([[15, 15, 'balanced'], [18, 12, 'fixed']])('six people draft all thirty custom teams with %i/%i pools in %s mode', async (a, b, quotaMode) => {
  const ids = ['owner', 'alice', 'bob', 'carol', 'dave', 'eve'];
  const catalog = hydrateTeamPool({ name: 'Custom thirty', teams: Array.from({ length: a + b }, (_, index) => ({
    id: `custom${index}`, name: `Custom Team ${index}`, conference: index < a ? 'Group One' : 'Group Two'
  })) });
  const config = generateAutoDoubleSnakeConfig(catalog.teams, 'conference', 5);
  config.quotaMode = quotaMode;
  const initial = { draft: { status: 'in_progress', assignmentMode: 'double_snake', order: ids, picks: [], doubleSnakeConfig: config },
    rosterSettings: { rosterSize: 5 }, teamPool: catalog };
  const docs = setup(initial, ids);
  const plan = getPoolAllocationPlan({ draft: initial.draft, rosterSettings: initial.rosterSettings, draftOrder: ids, teamPool: catalog.teams });
  expect(plan.error).toBeNull();
  expect(plan.totals).toEqual({ poolA: a, poolB: b });
  for (let index = 0; index < 30; index += 1) {
    const game = docs['leagues/pool/gameData/current'];
    const context = { draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: ids, teamPool: catalog.teams };
    const requestedPool = index % 4 < 2 ? 'poolB' : 'poolA';
    const turn = computeNextPick({ ...context, poolId: requestedPool }) || computeNextPick(context);
    const otherPoolId = turn.poolId === 'poolA' ? 'poolB' : 'poolA';
    const otherBefore = computeNextPick({ ...context, poolId: otherPoolId });
    expect(turn.blockedReason).toBeNull();
    const selected = getEligibleDraftTeams({ ...context, poolId: turn.poolId })[0];
    expect(selected).toBeDefined();
    await makeDraftPick({ leagueId: 'pool', managerId: turn.managerId, teamId: selected.id, actorId: 'owner', poolId: turn.poolId, expectedPoolPickNumber: turn.poolPickNumber });
    const updated = docs['leagues/pool/gameData/current'];
    const otherAfter = computeNextPick({ ...context, draft: updated.draft, poolId: otherPoolId });
    if (otherBefore) expect(otherAfter).toMatchObject({ managerId: otherBefore.managerId, poolPickNumber: otherBefore.poolPickNumber, round: otherBefore.round });
    else expect(otherAfter).toBeNull();
    if (index < 29) expect(updated.draft.status).toBe('in_progress');
  }
  const game = docs['leagues/pool/gameData/current'];
  expect(game.draft.status).toBe('completed');
  expect(new Set(game.draft.picks.map((pick) => pick.teamId)).size).toBe(30);
  expect(game.draft.picks.filter((pick) => pick.poolId === 'poolA').slice(0, 6).map((pick) => pick.managerId)).toEqual(ids);
  expect(game.draft.picks.filter((pick) => pick.poolId === 'poolB').slice(0, 6).map((pick) => pick.managerId)).toEqual([...ids].reverse());
  expect(game.draft.picks.filter((pick) => pick.poolId === 'poolA').slice(6, 12).map((pick) => pick.managerId)).toEqual([...ids].reverse());
  expect(game.draft.picks.filter((pick) => pick.poolId === 'poolB').slice(6, 12).map((pick) => pick.managerId)).toEqual(ids);
  const allocations = game.draft.poolAllocations;
  ids.forEach((id) => {
    const roster = docs[`leagues/pool/userData/${id}`].teams;
    expect(roster).toHaveLength(5);
    ['poolA', 'poolB'].forEach((poolId) => expect(roster.filter((team) => team.poolId === poolId)).toHaveLength(allocations[id].quotas[poolId]));
  });
  if (quotaMode === 'balanced') expect(ids.filter((id) => allocations[id].quotas.poolA === 3)).toHaveLength(3);
  else expect(ids.every((id) => allocations[id].quotas.poolA === 3)).toBe(true);
  expect(getPoolAllocationPlan({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: [...ids].reverse(), teamPool: catalog.teams }).allocations).toEqual(allocations);
  await undoLastPick({ leagueId: 'pool' });
  expect(docs['leagues/pool/gameData/current'].draft.poolAllocations).toEqual(allocations);
});

test('a request captured before another pool advances succeeds; stale requests in its own pool fail', async () => {
  const docs = setup();
  const initial = docs['leagues/pool/gameData/current'];
  const west = next(initial, 'poolB');
  const east = next(initial, 'poolA');
  expect(west.managerId).toBe('bob');
  expect(east.managerId).toBe('owner');
  await makeDraftPick({ leagueId: 'pool', poolId: 'poolA', managerId: east.managerId, teamId: 'team0', expectedPoolPickNumber: east.poolPickNumber });
  await makeDraftPick({ leagueId: 'pool', poolId: 'poolB', managerId: west.managerId, teamId: 'team6', expectedPoolPickNumber: west.poolPickNumber });
  await expect(makeDraftPick({ leagueId: 'pool', poolId: 'poolB', managerId: west.managerId, teamId: 'team7', expectedPoolPickNumber: west.poolPickNumber })).rejects.toThrow('pool has advanced');
  expect(docs['leagues/pool/gameData/current'].draft.picks).toHaveLength(2);
  expect(next(docs['leagues/pool/gameData/current'], 'poolA')).toMatchObject({ managerId: 'alice', poolPickNumber: 2 });
  expect(next(docs['leagues/pool/gameData/current'], 'poolB')).toMatchObject({ managerId: 'alice', poolPickNumber: 2 });
});

test('rolling back an earlier pick in one pool preserves the other queue and reindexes surviving rosters', async () => {
  const docs = setup();
  await makeDraftPick({ leagueId: 'pool', poolId: 'poolA', managerId: 'owner', teamId: 'team0', expectedPoolPickNumber: 1 });
  await makeDraftPick({ leagueId: 'pool', poolId: 'poolB', managerId: 'bob', teamId: 'team6', expectedPoolPickNumber: 1 });
  const westBefore = next(docs['leagues/pool/gameData/current'], 'poolB');
  await undoLastPick({ leagueId: 'pool', poolId: 'poolA' });
  const game = docs['leagues/pool/gameData/current'];
  expect(next(game, 'poolA')).toMatchObject({ managerId: 'owner', poolPickNumber: 1 });
  expect(next(game, 'poolB')).toMatchObject({ managerId: westBefore.managerId, poolPickNumber: westBefore.poolPickNumber, round: westBefore.round });
  expect(game.draft.picks).toEqual([expect.objectContaining({ teamId: 'team6', poolId: 'poolB', poolPickNumber: 1, pickNumber: 1 })]);
  expect(docs['leagues/pool/userData/bob'].teams).toEqual([expect.objectContaining({ id: 'team6', draftPickNumber: 1 })]);
  expect(docs['leagues/pool/userData/owner'].teams).toEqual([]);
  expect(eligible(game, 'poolA').some((team) => team.id === 'team0')).toBe(true);
});

test('a completed pool leaves the other pool open and skips managers who reached their pool quota', async () => {
  const docs = setup();
  for (let index = 0; index < 3; index += 1) {
    const game = docs['leagues/pool/gameData/current'];
    const turn = next(game, 'poolB');
    await makeDraftPick({ leagueId: 'pool', poolId: 'poolB', managerId: turn.managerId, teamId: eligible(game, 'poolB')[0].id, expectedPoolPickNumber: turn.poolPickNumber });
  }
  const game = docs['leagues/pool/gameData/current'];
  expect(game.draft.status).toBe('in_progress');
  expect(next(game, 'poolB')).toBeNull();
  expect(next(game, 'poolA')).toMatchObject({ managerId: 'owner', poolPickNumber: 1 });
  expect(computePoolNextPicks({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: order, teamPool: teams }).find((turn) => turn.poolId === 'poolB').completed).toBe(true);
  await expect(makeDraftPick({ leagueId: 'pool', poolId: 'poolB', managerId: 'owner', teamId: 'team9' })).rejects.toThrow('filled');
});

test('fixed 3/2 quotas reject fifteen/fifteen for six managers', () => {
  const ids = ['owner', 'alice', 'bob', 'carol', 'dave', 'eve'];
  const pool = Array.from({ length: 30 }, (_, index) => ({ id: `t${index}`, conference: index < 15 ? 'East' : 'West' }));
  const config = { ...generateAutoDoubleSnakeConfig(pool, 'conference', 5), quotaMode: 'fixed' };
  expect(getPoolAllocationPlan({ draft: { doubleSnakeConfig: config }, rosterSettings: { rosterSize: 5 }, draftOrder: ids, teamPool: pool }).error).toContain('East needs 18');
});

/** @jest-environment node */
// Run against the local Firestore emulator with FIRESTORE_EMULATOR_HOST set.
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteField, writeBatch, terminate } from 'firebase/firestore';
import { buildMemberDraftAccess, isMemberDraftAccessCurrent, computePoolNextPicks, getEligibleDraftTeams, makeDraftPick, syncMemberDraftAccess, undoLastPick } from './draftEngine';
import { generateAutoDoubleSnakeConfig } from '../utils/draftConfig';
import { getPoolAllocationPlan } from '../utils/poolAllocation';

let mockDb;
jest.mock('../../../firebase', () => ({ get db() { return mockDb; } }));

const emulatorTest = process.env.FIRESTORE_EMULATOR_HOST ? test : test.skip;
const clients = new Map();
const apps = [];
let admin;
let sequence = 0;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const client = (uid, bypass = false) => {
  if (clients.has(uid)) return clients.get(uid);
  const app = initializeApp({ projectId: 'demo-wins-member-draft', apiKey: 'demo' }, `draft-${uid}`);
  apps.push(app);
  const db = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host, Number(port), { mockUserToken: bypass ? 'owner' : { sub: uid, user_id: uid } });
  clients.set(uid, db);
  return db;
};

beforeAll(() => { if (process.env.FIRESTORE_EMULATOR_HOST) admin = client('seed-admin', true); });
afterAll(async () => {
  await Promise.all([...clients.values()].map((db) => terminate(db)));
  await Promise.all(apps.map((app) => deleteApp(app)));
});

const seed = async ({ legacy = false, single = false, six = false } = {}) => {
  const leagueId = `draft-${runId}-${++sequence}`;
  const order = six ? ['alice', 'bob', 'carol', 'dave', 'erin', 'owner'] : ['alice', 'bob', 'owner'];
  const league = { ownerId: 'owner', members: order, gameTypeId: 'winsPool' };
  const size = six ? 30 : 12;
  const teams = Array.from({ length: size }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, conference: i < size / 2 ? 'East' : 'West' }));
  const game = { rosterSettings: { rosterSize: six ? 5 : 2 }, teamPool: { teams },
    draft: { status: 'in_progress', order, picks: [], assignmentMode: single ? 'draft' : 'double_snake', useSnakeDraft: true,
      doubleSnakeConfig: generateAutoDoubleSnakeConfig(teams, 'conference', six ? 5 : 2) } };
  if (!single) game.draft.poolAllocations = getPoolAllocationPlan({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: order, teamPool: teams }).allocations;
  if (!legacy) game.draft.memberAccess = buildMemberDraftAccess(league, game);
  await setDoc(doc(admin, 'leagues', leagueId), league);
  await setDoc(doc(admin, 'leagues', leagueId, 'gameData', 'current'), game);
  await Promise.all(order.map((uid) => setDoc(doc(admin, 'users', uid), { isAdmin: false, admin: false })));
  return { leagueId, order, teams, game, league };
};

const readGame = async (leagueId) => (await getDoc(doc(admin, 'leagues', leagueId, 'gameData', 'current'))).data();
const pick = async (fixture, uid, poolId, teamId = null) => {
  const game = await readGame(fixture.leagueId);
  expect(isMemberDraftAccessCurrent(fixture.league, game)).toBe(true);
  const turn = poolId ? computePoolNextPicks({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: fixture.order, teamPool: fixture.teams }).find((entry) => entry.poolId === poolId) : null;
  const team = teamId || getEligibleDraftTeams({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: fixture.order, teamPool: fixture.teams, poolId })[0].id;
  mockDb = client(uid);
  return makeDraftPick({ leagueId: fixture.leagueId, actorId: uid, managerId: uid, teamId: team, poolId, source: 'draft-room',
    ...(turn ? { expectedPoolPickNumber: turn.poolPickNumber } : {}) });
};

emulatorTest('members pick for themselves in either independent pool; owner can draft for another manager', async () => {
  const fixture = await seed();
  await pick(fixture, 'alice', 'poolA');
  let game = await readGame(fixture.leagueId);
  expect(game.draft.memberAccess.positions).toEqual({ poolA: 1, poolB: 0 });
  mockDb = client('owner');
  await makeDraftPick({ leagueId: fixture.leagueId, actorId: 'owner', managerId: 'bob', teamId: 't1', poolId: 'poolA', source: 'draft-room' });
  await pick(fixture, 'owner', 'poolB');
  await pick(fixture, 'bob', 'poolB');
  game = await readGame(fixture.leagueId);
  expect(game.draft.picks.map((entry) => entry.managerId)).toEqual(['alice', 'bob', 'owner', 'bob']);
  expect((await getDoc(doc(admin, 'leagues', fixture.leagueId, 'userData', 'bob'))).data().teams).toHaveLength(2);
});

emulatorTest('six members complete all 30 balanced picks without a commissioner staying online', async () => {
  const fixture = await seed({ six: true });
  for (let index = 0; index < 30; index++) {
    const game = await readGame(fixture.leagueId);
    const turns = computePoolNextPicks({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: fixture.order, teamPool: fixture.teams });
    const active = turns.filter((turn) => !turn.completed);
    const turn = active[index % active.length];
    await pick(fixture, turn.managerId, turn.poolId);
  }
  const game = await readGame(fixture.leagueId);
  expect(game.draft.status).toBe('completed');
  expect(game.draft.memberAccess.remaining).toBe(0);
  expect(new Set(game.draft.picks.map((entry) => entry.teamId)).size).toBe(30);
  const splits = await Promise.all(fixture.order.map(async (uid) => {
    const roster = (await getDoc(doc(admin, 'leagues', fixture.leagueId, 'userData', uid))).data();
    expect(roster.teams).toHaveLength(5);
    return roster.teams.filter((team) => team.poolId === 'poolA').length;
  }));
  expect(splits.sort()).toEqual([2, 2, 2, 3, 3, 3]);
}, 30000);

emulatorTest('single snake also permits self picks and completes on its last slot', async () => {
  const fixture = await seed({ single: true });
  for (const uid of ['alice', 'bob', 'owner', 'owner', 'bob', 'alice']) await pick(fixture, uid, null);
  expect((await readGame(fixture.leagueId)).draft.status).toBe('completed');
});

emulatorTest('existing drafts upgrade without resetting picks and rollbacks restore member turns', async () => {
  const fixture = await seed({ legacy: true });
  mockDb = client('owner');
  await makeDraftPick({ leagueId: fixture.leagueId, actorId: 'owner', managerId: 'alice', teamId: 't0', poolId: 'poolA', source: 'draft-room' });
  await updateDoc(doc(admin, 'leagues', fixture.leagueId, 'gameData', 'current'), { 'draft.memberAccess': deleteField() });
  await syncMemberDraftAccess({ leagueId: fixture.leagueId });
  expect((await readGame(fixture.leagueId)).draft.picks[0].teamId).toBe('t0');
  await pick(fixture, 'bob', 'poolA');
  mockDb = client('owner');
  await undoLastPick({ leagueId: fixture.leagueId, poolId: 'poolA' });
  await syncMemberDraftAccess({ leagueId: fixture.leagueId });
  await pick(fixture, 'bob', 'poolA');
  expect((await readGame(fixture.leagueId)).draft.picks).toHaveLength(2);
});

emulatorTest('rules reject impersonation, wrong pool, duplicate teams, roster edits and config edits', async () => {
  const fixture = await seed();
  const alice = client('alice');
  const gameRef = doc(alice, 'leagues', fixture.leagueId, 'gameData', 'current');
  const original = fixture.game;
  const access = original.draft.memberAccess;
  // Forge a direct atomic write, bypassing every client-side turn check.
  const forged = async (managerId, teamId, poolId = 'poolA', extra = {}) => {
    const key = poolId || 'single';
    const slot = access.queues[key].turns[0];
    const record = { ...slot, managerId, actorId: 'alice', teamId, pickNumber: 1, source: 'draft-room', timestamp: new Date() };
    const { serverTimestamp } = await import('firebase/firestore');
    const batch = writeBatch(alice);
    batch.update(gameRef, { 'draft.picks': [record], 'draft.updatedAt': serverTimestamp(),
      'draft.memberAccess': { ...access, positions: { ...access.positions, [key]: 1 }, remaining: access.remaining - 1, takenTeamIds: [teamId] }, ...extra });
    batch.set(doc(alice, 'leagues', fixture.leagueId, 'userData', managerId), {
      teams: [{ ...access.rosterTeams[teamId], draftPickNumber: 1 }], totalWins: 0, updatedAt: serverTimestamp()
    });
    return batch.commit();
  };
  await expect(forged('bob', 't0')).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(forged('alice', 't6')).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(forged('alice', 't6', 'poolB')).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(forged('alice', 't0', 'poolA', { 'rosterSettings.rosterSize': 99 })).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(setDoc(doc(alice, 'leagues', fixture.leagueId, 'userData', 'alice'), { teams: [{ id: 't0' }], totalWins: 999 })).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(updateDoc(gameRef, { 'draft.memberAccess.queues.poolA.turns': [{ managerId: 'alice' }] })).rejects.toMatchObject({ code: 'permission-denied' });
  await pick(fixture, 'alice', 'poolA');
  await expect(forged('alice', 't0')).rejects.toMatchObject({ code: 'permission-denied' });
});

emulatorTest('paused drafts and membership changes invalidate member authorization', async () => {
  const fixture = await seed();
  await updateDoc(doc(admin, 'leagues', fixture.leagueId, 'gameData', 'current'), { 'draft.status': 'paused' });
  await expect(pick(fixture, 'alice', 'poolA')).rejects.toThrow('in progress');
  await updateDoc(doc(admin, 'leagues', fixture.leagueId, 'gameData', 'current'), { 'draft.status': 'in_progress' });
  await updateDoc(doc(admin, 'leagues', fixture.leagueId), { members: fixture.order.filter((uid) => uid !== 'bob') });
  mockDb = client('alice');
  await expect(makeDraftPick({ leagueId: fixture.leagueId, managerId: 'alice', actorId: 'alice', teamId: 't0', poolId: 'poolA', source: 'draft-room' })).rejects.toMatchObject({ code: 'permission-denied' });
});

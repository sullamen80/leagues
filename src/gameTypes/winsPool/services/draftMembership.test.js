import { runTransaction } from 'firebase/firestore';
import { makeDraftPick } from './draftEngine';

jest.mock('../../../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => segments.join('/'),
  runTransaction: jest.fn(),
  serverTimestamp: () => 'server-time',
  Timestamp: { now: () => 'pick-time' }
}));

const setup = () => {
  const documents = {
    'leagues/pool': { ownerId: 'owner', members: ['owner', 'alice', 'bob'] },
    'leagues/pool/gameData/current': {
      draft: { status: 'in_progress', order: ['owner'], picks: [] },
      rosterSettings: { rosterSize: 1 },
      teamPool: { teams: [{ id: 'BOS', name: 'Boston' }, { id: 'LAL' }, { id: 'NYK' }] }
    }
  };
  const transaction = {
    get: jest.fn(async (ref) => ({ exists: () => !!documents[ref], data: () => documents[ref] })),
    set: jest.fn(),
    update: jest.fn()
  };
  runTransaction.mockImplementation(async (_db, callback) => callback(transaction));
  return transaction;
};

test('a stale one-person draft order cannot complete a three-person league after one pick', async () => {
  const transaction = setup();
  await makeDraftPick({ leagueId: 'pool', managerId: 'owner', teamId: 'BOS' });
  const updates = transaction.update.mock.calls[0][1];
  expect(updates['draft.order']).toEqual(['owner', 'alice', 'bob']);
  expect(updates['draft.picks']).toHaveLength(1);
  expect(updates['draft.status']).toBeUndefined();
  expect(transaction.set).toHaveBeenCalledWith('leagues/pool/userData/owner', expect.objectContaining({
    teams: [expect.objectContaining({ id: 'BOS' })]
  }), { merge: true });
});

test('a pick override cannot create a roster for a nonmember', async () => {
  const transaction = setup();
  await expect(makeDraftPick({ leagueId: 'pool', managerId: 'removed', teamId: 'BOS' }))
    .rejects.toThrow('no longer a league participant');
  expect(transaction.set).not.toHaveBeenCalled();
  expect(transaction.update).not.toHaveBeenCalled();
});

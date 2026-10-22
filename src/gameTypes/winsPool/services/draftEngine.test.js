import { computeNextPick } from './draftEngine';

jest.mock('../../../firebase', () => ({ db: {} }));

const draftOrder = ['owner', 'alice', 'bob'];
const rosterSettings = { rosterSize: 2 };
const teamPool = [
  { id: 'BOS' }, { id: 'LAL' }, { id: 'NYK' },
  { id: 'CHI' }, { id: 'DAL' }, { id: 'MIA' }
];

test('a pick for the manager on the clock advances to the next manager', () => {
  const draft = { picks: [], useSnakeDraft: true };
  expect(computeNextPick({ draft, rosterSettings, draftOrder, teamPool }).managerId).toBe('owner');

  draft.picks = [{ managerId: 'owner', teamId: 'BOS' }];
  expect(computeNextPick({ draft, rosterSettings, draftOrder, teamPool }).managerId).toBe('alice');

  draft.picks.push({ managerId: 'alice', teamId: 'LAL' });
  expect(computeNextPick({ draft, rosterSettings, draftOrder, teamPool }).managerId).toBe('bob');

  draft.picks.push({ managerId: 'bob', teamId: 'NYK' });
  expect(computeNextPick({ draft, rosterSettings, draftOrder, teamPool }).managerId).toBe('bob');
});

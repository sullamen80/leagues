import { addParticipantChanges, removeParticipantChanges } from './participantChanges';

const league = {
  ownerId: 'owner',
  members: ['owner', 'alice'],
  users: [{ id: 'owner' }, { id: 'alice' }],
  userIds: ['owner'],
  status: 'active'
};

test('adding a participant keeps league and configured draft order in sync', () => {
  const changes = addParticipantChanges(
    league,
    { draft: { status: 'not_started', order: ['owner', 'alice'] }, rosterSettings: { draftOrder: ['owner', 'alice'] } },
    { id: 'bob', displayName: 'Bob', email: 'bob@example.com' }
  );

  expect(changes.leagueUpdates.members).toEqual(['owner', 'alice', 'bob']);
  expect(changes.leagueUpdates.userIds).toEqual(['owner', 'alice', 'bob']);
  expect(changes.gameUpdates['draft.order']).toEqual(['owner', 'alice', 'bob']);
  expect(changes.gameUpdates['rosterSettings.draftOrder']).toEqual(['owner', 'alice', 'bob']);
});

test('adding after a completed draft opens draft picks for the new participant', () => {
  const changes = addParticipantChanges(
    league,
    { draft: { status: 'completed', order: ['owner', 'alice'] } },
    { id: 'bob', username: 'bob' }
  );

  expect(changes.gameUpdates['draft.order']).toEqual(['owner', 'alice', 'bob']);
  expect(changes.gameUpdates['draft.status']).toBe('in_progress');
  expect(changes.gameUpdates['draft.completedAt']).toBeNull();
});

test('removing a participant releases their picks and removes draft references', () => {
  const changes = removeParticipantChanges(
    league,
    {
      draft: {
        status: 'in_progress',
        order: ['owner', 'alice'],
        onClockUid: 'alice',
        picks: [
          { managerId: 'alice', teamId: 'BOS', pickNumber: 1 },
          { managerId: 'owner', teamId: 'LAL', pickNumber: 2 }
        ]
      },
      rosterSettings: { rosterSize: 2, draftOrder: ['owner', 'alice'] }
    },
    'alice'
  );

  expect(changes.leagueUpdates.members).toEqual(['owner']);
  expect(changes.leagueUpdates.userIds).toEqual(['owner']);
  expect(changes.gameUpdates['draft.order']).toEqual(['owner']);
  expect(changes.gameUpdates['draft.picks']).toEqual([{ managerId: 'owner', teamId: 'LAL', pickNumber: 1 }]);
  expect(changes.gameUpdates['draft.onClockUid']).toBeNull();
  expect(changes.removedPickCount).toBe(1);
});

test('removing a participant can complete a draft when the remaining slots are full', () => {
  const changes = removeParticipantChanges(
    league,
    {
      draft: {
        status: 'in_progress',
        order: ['owner', 'alice'],
        picks: [{ managerId: 'owner', teamId: 'LAL', pickNumber: 1 }]
      },
      rosterSettings: { rosterSize: 1 }
    },
    'alice'
  );

  expect(changes.gameUpdates['draft.status']).toBe('completed');
  expect(() => removeParticipantChanges(league, {}, 'owner')).toThrow('owner');
});

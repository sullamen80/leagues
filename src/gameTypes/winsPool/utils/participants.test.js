import { buildParticipantRosters, getParticipantIds, reconcileDraftOrder } from './participants';
import { calculateStandingsFromData } from './scoringUtils';

test('six members share one roster, standings, and draft membership despite a saved two-person order', () => {
  const league = {
    ownerId: 'owner',
    members: ['owner', 'alice', 'bob', 'carol', 'dave', 'eve'],
    users: [{ id: 'eve', displayName: 'Eve' }],
    userIds: ['owner', 'removed']
  };
  const rosters = buildParticipantRosters(league, [
    { id: 'owner', teams: [{ id: 'BOS', wins: 5 }] },
    { id: 'removed', teams: [{ id: 'LAL', wins: 99 }] }
  ]);
  const draftOrder = reconcileDraftOrder(league, { order: ['owner', 'eve'] });
  const standings = calculateStandingsFromData({ rosters });

  expect(rosters.map((row) => row.id)).toEqual(league.members);
  expect(draftOrder).toEqual(['owner', 'eve', 'alice', 'bob', 'carol', 'dave']);
  expect(standings.map((row) => row.userId).sort()).toEqual([...league.members].sort());
  expect(standings.find((row) => row.userId === 'eve')).toMatchObject({ displayName: 'Eve', wins: 0, points: 0 });
  expect(standings.find((row) => row.userId === 'owner').wins).toBe(5);
});

test('orphan rosters and legacy identity arrays cannot resurrect removed members', () => {
  const league = { ownerId: 'owner', members: ['alice', 'alice'], userIds: ['removed'], users: [null, { id: 'removed' }] };
  expect(getParticipantIds(league)).toEqual(['owner', 'alice']);
  expect(buildParticipantRosters(league, [{ id: 'removed' }]).map((row) => row.id)).toEqual(['owner', 'alice']);
  expect(reconcileDraftOrder(league, { order: ['removed', 'alice', 'alice', 'owner'] })).toEqual(['alice', 'owner']);
});

test('empty saved draft order uses configured sequence and appends members without a roster', () => {
  expect(reconcileDraftOrder({ ownerId: 'owner', members: ['bob', 'alice'] }, {}, { draftOrder: ['alice', 'owner'] }))
    .toEqual(['alice', 'owner', 'bob']);
  expect(reconcileDraftOrder(null)).toEqual([]);
});

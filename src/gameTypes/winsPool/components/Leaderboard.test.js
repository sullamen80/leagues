import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { onSnapshot } from 'firebase/firestore';
import Leaderboard from './Leaderboard';
import { buildParticipantRosters } from '../utils/participants';

jest.mock('../../../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => segments.join('/'),
  onSnapshot: jest.fn(() => jest.fn())
}));

test('joining and removing managers updates rankings without refreshing the saved leaderboard', () => {
  onSnapshot.mockImplementation(() => jest.fn());
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = (members, gameData = {}) => act(() => root.render(<Leaderboard
    leagueId="pool"
    gameData={gameData}
    allRosters={buildParticipantRosters({
      ownerId: 'owner', members,
      users: [{ id: 'owner', displayName: 'Owner' }, { id: 'new', displayName: 'New Manager' }]
    }, [{ id: 'owner', teams: [{ id: 'BOS', wins: 5 }] }])}
  />));

  render(['owner']);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  render(['owner', 'new']);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(container.textContent).toContain('New Manager');
  const [ref, snapshotCallback] = onSnapshot.mock.calls[0];
  expect(ref).toBe('leagues/pool/settings/scoring');
  act(() => snapshotCallback({ exists: () => true, data: () => ({ pointsPerWin: 3 }) }));
  expect(container.querySelector('tbody tr').textContent).toContain('15.0');
  render(['owner', 'new'], { scoring: { pointsPerWin: 4 } });
  expect(container.querySelector('tbody tr').textContent).toContain('20.0');
  render(['owner']);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(container.textContent).not.toContain('New Manager');
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

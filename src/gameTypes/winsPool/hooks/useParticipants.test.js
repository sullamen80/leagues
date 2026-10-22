import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { onSnapshot } from 'firebase/firestore';
import useParticipants from './useParticipants';

jest.mock('../../../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => segments.join('/'),
  collection: (_db, ...segments) => segments.join('/'),
  onSnapshot: jest.fn(() => jest.fn())
}));

test('membership events show new members before roster creation and remove them despite leftover rosters', () => {
  onSnapshot.mockImplementation(() => jest.fn());
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const Probe = () => {
    const { participants } = useParticipants('pool');
    return <span>{participants.map((row) => row.id).join(',')}</span>;
  };
  act(() => root.render(<Probe />));
  const listeners = new Map(onSnapshot.mock.calls.map(([ref, callback]) => [ref, callback]));
  const emitLeague = (members) => act(() => listeners.get('leagues/pool')({
    exists: () => true, data: () => ({ ownerId: 'owner', members })
  }));
  emitLeague(['owner']);
  emitLeague(['owner', 'new']);
  expect(container.textContent).toBe('owner,new');
  act(() => listeners.get('leagues/pool/userData')({ docs: [
    { id: 'owner', data: () => ({ teams: [] }) },
    { id: 'new', data: () => ({ teams: [] }) },
    { id: 'orphan', data: () => ({ teams: [] }) }
  ] }));
  expect(container.textContent).toBe('owner,new');
  emitLeague(['owner']);
  expect(container.textContent).toBe('owner');
  act(() => root.unmount());
  onSnapshot.mock.results.forEach(({ value: unsubscribe }) => expect(unsubscribe).toHaveBeenCalled());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

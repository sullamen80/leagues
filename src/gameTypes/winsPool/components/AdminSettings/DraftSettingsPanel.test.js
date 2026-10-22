import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import DraftSettingsPanel from './DraftSettingsPanel';
import { generateAutoDoubleSnakeConfig } from '../../utils/draftConfig';

jest.mock('../../hooks/useParticipants', () => {
  const ids = ['owner', 'alice', 'bob', 'carol', 'dave', 'eve'];
  const state = { league: { ownerId: 'owner', members: ids }, participants: ids.map((id) => ({ id, name: id })), loading: false };
  return () => state;
});

test('six-manager preview shows a feasible balanced plan and rejects fixed 3/2 on fifteen/fifteen', () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const teams = Array.from({ length: 30 }, (_, index) => ({ id: `t${index}`, name: `Team ${index}`, conference: index < 15 ? 'East' : 'West' }));
  const data = { draft: { status: 'not_started', assignmentMode: 'double_snake', order: ['owner', 'alice', 'bob', 'carol', 'dave', 'eve'],
    doubleSnakeConfig: generateAutoDoubleSnakeConfig(teams, 'conference', 5) }, rosterSettings: { rosterSize: 5 }, teamPool: { teams } };
  const update = jest.fn();
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<DraftSettingsPanel leagueId="pool" data={data} onUpdate={update} />));
  expect(container.textContent).toContain('East: 15 picks / 15 available teams');
  expect(container.textContent).toContain('West: 15 picks / 15 available teams');
  expect(container.textContent).toContain('owner: 3 East + 2 West');
  expect(container.textContent).toContain('alice: 2 East + 3 West');
  const allocation = container.querySelector('select[aria-label="Pool allocation"]');
  act(() => { allocation.value = 'fixed'; allocation.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[role="alert"]').textContent).toContain('East needs 18 teams');
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ draft: expect.objectContaining({ doubleSnakeConfig: expect.objectContaining({ quotaMode: 'fixed' }) }) }));
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminTeamPoolsPanel from './AdminTeamPoolsPanel';

jest.mock('../../../firebase', () => ({ db: {} }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
jest.mock('../services/teamPoolService', () => ({ saveCustomTeamPool: jest.fn() }));

test('excluded custom teams remain selectable and can be restored without a misleading count', () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const teams = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];
  const catalog = { id: 'custom', name: 'Custom', teams };
  const selected = { ...catalog, teams: teams.slice(0, 2), excludedTeamIds: ['c'] };
  const apply = jest.fn();
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<AdminTeamPoolsPanel leagueId="pool" existingTeamPool={selected} leaguePools={[catalog]} onApplyPool={apply} draftStatus="not_started" />));
  expect(container.textContent).toContain('Gamma');
  expect(container.textContent).toContain('1 teams excluded — 2 available');
  const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset selections');
  act(() => reset.click());
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Apply Selection').click());
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ teams, allTeams: teams, excludedTeamIds: [] }));
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

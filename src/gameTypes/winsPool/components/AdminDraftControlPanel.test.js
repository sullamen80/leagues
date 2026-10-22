import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { onSnapshot } from 'firebase/firestore';
import AdminDraftControlPanel from './AdminDraftControlPanel';
import { makeDraftPick, computeNextPick, syncMemberDraftAccess } from '../services/draftEngine';
import { generateAutoDoubleSnakeConfig } from '../utils/draftConfig';

jest.mock('../../../firebase', () => ({ db: {} }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'owner' } }) }));
jest.mock('../hooks/useParticipants', () => () => ({
  league: { ownerId: 'owner', members: ['owner', 'alice'] },
  participants: [{ id: 'owner', name: 'Owner' }, { id: 'alice', name: 'Alice' }]
}));
jest.mock('firebase/firestore', () => ({ doc: (_db, ...segments) => segments.join('/'), onSnapshot: jest.fn() }));
jest.mock('../services/draftEngine', () => ({ ...jest.requireActual('../services/draftEngine'), makeDraftPick: jest.fn(), syncMemberDraftAccess: jest.fn().mockResolvedValue(undefined) }));

const setupConsole = () => {
  syncMemberDraftAccess.mockResolvedValue(undefined);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const teams = Array.from({ length: 6 }, (_, index) => ({ id: `t${index}`, name: `Team ${index}`, conference: index < 4 ? 'East' : 'West' }));
  let game = {
    draft: { assignmentMode: 'double_snake', status: 'in_progress', useSnakeDraft: true, order: ['alice', 'owner'], picks: [],
      doubleSnakeConfig: { ...generateAutoDoubleSnakeConfig(teams, 'conference', 3), quotaMode: 'fixed' } },
    rosterSettings: { rosterSize: 3 }, teamPool: { teams }
  };
  let listener;
  onSnapshot.mockImplementation((_ref, callback) => { listener = callback; callback({ exists: () => true, data: () => game }); return jest.fn(); });
  makeDraftPick.mockImplementation(async ({ managerId, teamId, poolId }) => {
    const turn = computeNextPick({ draft: game.draft, rosterSettings: game.rosterSettings, draftOrder: game.draft.order, teamPool: teams, poolId });
    game = { ...game, draft: { ...game.draft, picks: [...game.draft.picks, { managerId, teamId, poolId: turn.poolId, pickNumber: turn.pickNumber }] } };
    if (game.draft.picks.length === 6) game.draft.status = 'completed';
    listener({ exists: () => true, data: () => game });
  });
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<AdminDraftControlPanel leagueId="pool" />));
  const poolSummary = container.querySelector('section[aria-label="Draft pools"]');
  expect(poolSummary.querySelectorAll('article')).toHaveLength(2);
  expect(poolSummary.textContent).toContain('4 of 4 teams available');
  expect(poolSummary.textContent).toContain('2 of 2 teams available');
  return { container, root, poolSummary };
};

test('commissioner can finish one pool and then draft the other independent queue', async () => {
  const { container, root, poolSummary } = setupConsole();
  const expectedManagers = ['alice', 'owner', 'owner', 'alice', 'owner', 'alice'];
  for (let index = 0; index < expectedManagers.length; index += 1) {
    if (index === 4) act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Select West').click());
    const manager = container.querySelector('#draft-manager-select');
    const team = container.querySelector('#draft-team-select');
    expect(manager.value).toBe(expectedManagers[index]);
    expect(team.selectedOptions[0].disabled).toBe(false);
    expect(team.selectedOptions[0].parentElement.label).toBe(index >= 4 ? 'West' : 'East');
    const requiredPool = [...poolSummary.querySelectorAll('article')].find((article) => article.querySelector('button[aria-pressed="true"]'));
    expect(requiredPool.getAttribute('aria-label')).toBe(index >= 4 ? 'West' : 'East');
    const record = [...container.querySelectorAll('button')].find((button) => /Record .*Pick/.test(button.textContent));
    expect(record.disabled).toBe(false);
    await act(async () => { record.click(); });
    expect(makeDraftPick).toHaveBeenLastCalledWith(expect.objectContaining({ managerId: expectedManagers[index], actorId: 'owner', poolId: index >= 4 ? 'poolB' : 'poolA', expectedPoolPickNumber: index >= 4 ? index - 3 : index + 1 }));
  }
  expect(container.querySelector('#draft-team-select').value).toBe('');
  expect(poolSummary.querySelector('article[aria-label="East"]').textContent).toContain('0 of 4 teams available');
  expect(poolSummary.querySelector('article[aria-label="West"]').textContent).toContain('0 of 2 teams available');
  expect([...container.querySelectorAll('button')].find((button) => /Record .*Pick/.test(button.textContent)).disabled).toBe(true);
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});


test('commissioner can start in Pool B and Pool A remains on its original manager', async () => {
  const { container, root, poolSummary } = setupConsole();
  expect(poolSummary.querySelector('article[aria-label="East"]').textContent).toContain('On clock: Alice');
  expect(poolSummary.querySelector('article[aria-label="West"]').textContent).toContain('On clock: Owner');
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Select West').click());
  expect(container.querySelector('#draft-manager-select').value).toBe('owner');
  expect(container.querySelector('#draft-team-select').selectedOptions[0].parentElement.label).toBe('West');
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Record West Pick')).click());
  expect(makeDraftPick).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'owner', poolId: 'poolB', expectedPoolPickNumber: 1 }));
  expect(poolSummary.querySelector('article[aria-label="East"]').textContent).toContain('On clock: Alice');
  expect(poolSummary.querySelector('article[aria-label="East"]').textContent).toContain('Pool pick 1');
  expect(poolSummary.querySelector('article[aria-label="West"]').textContent).toContain('On clock: Alice');
  expect(poolSummary.querySelector('article[aria-label="West"]').textContent).toContain('Pool pick 2');
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Select East').click());
  expect(container.querySelector('#draft-manager-select').value).toBe('alice');
  expect(container.querySelector('#draft-team-select').selectedOptions[0].parentElement.label).toBe('East');
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

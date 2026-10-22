import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from '../../../../contexts/AuthContext';
import { makeDraftPick, buildMemberDraftAccess, syncMemberDraftAccess } from '../../services/draftEngine';
import { generateAutoDoubleSnakeConfig } from '../../utils/draftConfig';
import DraftRoomTab from './DraftRoomTab';
import { fetchAvailableSeasons, fetchLatestTeamStandingsSnapshot, fetchLatestPlayerLeadersSnapshot } from '../../services/statsHistoryService';

jest.mock('../../../../firebase', () => ({ db: {} }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/draftEngine', () => ({ ...jest.requireActual('../../services/draftEngine'), makeDraftPick: jest.fn(), syncMemberDraftAccess: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/teamWinsService', () => ({ inferLeagueFromTeamPool: () => 'NBA' }));
jest.mock('../../services/statsHistoryService', () => ({ fetchAvailableSeasons: jest.fn(), fetchLatestPlayerLeadersSnapshot: jest.fn(), fetchLatestTeamStandingsSnapshot: jest.fn() }));

const setup = async (currentUserId, playerLeaders = undefined) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  useAuth.mockReturnValue({ isAdmin: false });
  makeDraftPick.mockResolvedValue(undefined);
  syncMemberDraftAccess.mockResolvedValue(undefined);
  fetchAvailableSeasons.mockResolvedValue([]);
  const teamPool = Array.from({ length: 6 }, (_, index) => ({ id: `t${index}`, name: `Team ${index}`, conference: index < 4 ? 'East' : 'West' }));
  const league = { ownerId: 'owner', members: ['alice', 'owner'], users: [{ id: 'alice', displayName: 'Alice' }] };
  const gameData = { playerLeaders, draft: { status: 'in_progress', assignmentMode: 'double_snake', order: ['alice', 'owner'], picks: [],
    doubleSnakeConfig: { ...generateAutoDoubleSnakeConfig(teamPool, 'conference', 3), quotaMode: 'fixed' } }, rosterSettings: { rosterSize: 3 }, teamPool: { teams: teamPool } };
  gameData.draft.memberAccess = buildMemberDraftAccess(league, gameData);
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = async () => act(async () => root.render(<DraftRoomTab leagueId="pool" league={league} currentUserId={currentUserId}
    gameData={{ ...gameData }} teamPool={teamPool} draftStatus="in_progress" />));
  await render();
  return { container, root, render, gameData };
};

test('owner drafts for another manager using only that turns eligible pool', async () => {
  const { container, root } = await setup('owner');
  const pick = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Draft for Alice');
  expect(pick.disabled).toBe(false);
  act(() => pick.click());
  expect(container.querySelector('.draft-modal').textContent).toContain('Draft for Alice • Required pool: East');
  expect(container.querySelector('.draft-modal').textContent).not.toContain('Team 4');
  const confirm = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Confirm Pick'));
  await act(async () => confirm.click());
  expect(makeDraftPick).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'alice', actorId: 'owner', poolId: 'poolA', expectedPoolPickNumber: 1 }));
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('changing the season updates list records, percentage, and sorting along with the details', async () => {
  fetchAvailableSeasons.mockResolvedValueOnce([{ season: '2024' }, { season: '2025' }]);
  fetchLatestTeamStandingsSnapshot.mockResolvedValue({ entries: [
    { teamId: 't0', wins: 30, losses: 50, winPct: 0.375 },
    { teamId: 't1', wins: 60, losses: 20, winPct: 0.75 }
  ] });
  fetchLatestPlayerLeadersSnapshot.mockResolvedValue({ categories: {} });
  const { container, root, gameData, render } = await setup('owner');
  gameData.teamWins = { t0: { wins: 5, losses: 1, winPct: 5 / 6 }, t1: { wins: 3, losses: 3, winPct: 0.5 }, t2: { wins: 10, losses: 2, winPct: 10 / 12 } };
  await render();
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Draft for Alice').click());
  const modal = container.querySelector('.draft-modal');
  const row = (name) => [...modal.querySelectorAll('.draft-modal__list button')].find((button) => button.textContent.includes(name));
  expect(row('Team 0').textContent).toContain('5 W • 1 L');
  act(() => row('Team 0').click());
  const season = modal.querySelector('select');
  await act(async () => { season.value = '2024'; season.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(row('Team 0').textContent).toContain('30 W • 50 L');
  expect(row('Team 0').textContent).toContain('37.5%');
  expect(modal.querySelector('.draft-modal__list button').textContent).toContain('Team 1');
  expect(modal.querySelector('.draft-modal__details').textContent).toContain('37.5%');
  expect(row('Team 2').textContent).toContain('— W • — L');
  expect(row('Team 2').textContent).not.toContain('10 W');
  act(() => row('Team 2').click());
  expect(modal.querySelector('.draft-modal__details').textContent).toContain('Wins—');
  expect(modal.querySelector('.draft-modal__details').textContent).toContain('Losses—');
  expect(modal.querySelector('.draft-modal__details').textContent).toContain('Points—');
  await act(async () => { season.value = 'current'; season.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(row('Team 0').textContent).toContain('5 W • 1 L');
  expect(modal.querySelector('.draft-modal__list button').textContent).toContain('Team 2');
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('loading a historical season hides current records and a late response cannot overwrite a switch back', async () => {
  fetchAvailableSeasons.mockResolvedValueOnce([{ season: '2024' }]);
  let resolveStandings;
  const pending = new Promise((resolve) => { resolveStandings = resolve; });
  fetchLatestTeamStandingsSnapshot.mockReturnValueOnce(pending);
  fetchLatestPlayerLeadersSnapshot.mockResolvedValue({ categories: {} });
  const { container, root, gameData, render } = await setup('owner');
  gameData.teamWins = { t0: { wins: 5, losses: 1, winPct: 5 / 6 } };
  await render();
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Draft for Alice').click());
  const modal = container.querySelector('.draft-modal');
  const row = () => [...modal.querySelectorAll('.draft-modal__list button')].find((button) => button.textContent.includes('Team 0'));
  const season = modal.querySelector('select');
  await act(async () => { season.value = '2024'; season.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(row().textContent).toContain('— W • — L');
  expect(modal.querySelector('.draft-modal__details').textContent).toContain('Loading season data');
  await act(async () => { season.value = 'current'; season.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(row().textContent).toContain('5 W • 1 L');
  await act(async () => { resolveStandings({ entries: [{ teamId: 't0', wins: 30, losses: 50 }] }); await pending; });
  expect(row().textContent).toContain('5 W • 1 L');
  expect(row().textContent).not.toContain('30 W');
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('user lobby renders an active double snake when NBA player stats are null', async () => {
  const { container, root } = await setup('alice', null);
  expect(container.textContent).toContain('On Clock: Alice');
  expect(container.textContent).toContain('Pool: East');
  expect(container.textContent).toContain('Pick your team');
  expect(container.textContent).not.toContain('Draft for');
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('a live external pick closes the stale picker; members pick only for themselves', async () => {
  const { container, root, render, gameData } = await setup('owner');
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Draft for Alice').click());
  gameData.draft = { ...gameData.draft, picks: [{ managerId: 'alice', teamId: 't0', pickNumber: 1 }] };
  await render();
  expect(container.querySelector('.draft-modal')).toBeNull();
  act(() => root.unmount());
  const member = await setup('alice');
  const button = [...member.container.querySelectorAll('button')].find((node) => node.textContent === 'Pick your team');
  expect(button.disabled).toBe(false);
  act(() => button.click());
  expect(member.container.querySelector('.draft-modal').textContent).not.toContain('Draft for');
  await act(async () => [...member.container.querySelector('.draft-modal').querySelectorAll('button')].find((node) => node.textContent.includes('Confirm Pick')).click());
  expect(makeDraftPick).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'alice', actorId: 'alice', poolId: 'poolA' }));
  act(() => [...member.container.querySelectorAll('button')].find((node) => node.textContent === 'Select West').click());
  expect([...member.container.querySelectorAll('button')].find((node) => node.textContent === 'Waiting for your turn').disabled).toBe(true);
  expect(member.container.querySelector('.draft-modal')).toBeNull();
  act(() => member.root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('spectators cannot draft and an unprepared legacy draft waits for its commissioner', async () => {
  const { container, root } = await setup('outsider');
  expect(container.textContent).not.toContain('Draft for');
  expect(container.textContent).not.toContain('Pick your team');
  expect([...container.querySelectorAll('button')].find((node) => node.textContent === 'Waiting for your turn').disabled).toBe(true);
  act(() => root.unmount());
  const member = await setup('alice');
  delete member.gameData.draft.memberAccess;
  await member.render();
  expect(member.container.textContent).toContain('Waiting for the commissioner to enable member picks');
  expect(member.container.textContent).not.toContain('Pick your team');
  act(() => member.root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});


test('both lobby clocks have opposite heads and the owner can draft in either pool', async () => {
  const { container, root } = await setup('owner', null);
  const clocks = container.querySelector('section[aria-label="Pool draft clocks"]');
  expect(clocks.querySelector('article[aria-label="East"]').textContent).toContain('On clock: Alice');
  expect(clocks.querySelector('article[aria-label="West"]').textContent).toContain('On clock: owner');
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Select West').click());
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Draft for owner').click());
  const modal = container.querySelector('.draft-modal');
  expect(modal.textContent).toContain('Required pool: West');
  expect(modal.textContent).not.toContain('Team 0');
  await act(async () => [...modal.querySelectorAll('button')].find((button) => button.textContent.includes('Confirm Pick')).click());
  expect(makeDraftPick).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'owner', poolId: 'poolB', expectedPoolPickNumber: 1 }));
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('an external pick in the other pool keeps the selected pool picker open on its original turn', async () => {
  const { container, root, render, gameData } = await setup('owner');
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Draft for Alice').click());
  gameData.draft = { ...gameData.draft, picks: [{ managerId: 'owner', teamId: 't4', poolId: 'poolB', poolPickNumber: 1, pickNumber: 1 }] };
  await render();
  expect(container.querySelector('.draft-modal').textContent).toContain('Draft for Alice • Required pool: East');
  await act(async () => [...container.querySelector('.draft-modal').querySelectorAll('button')].find((button) => button.textContent.includes('Confirm Pick')).click());
  expect(makeDraftPick).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'alice', poolId: 'poolA', expectedPoolPickNumber: 1 }));
  act(() => root.unmount());
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

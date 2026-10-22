import { getParticipantIds, reconcileDraftOrder } from './participants';
import { DRAFT_STATUS } from '../constants/winsPoolConstants';

const withoutUser = (entries = [], userId) =>
  entries.filter((entry) => (typeof entry === 'string' ? entry : entry?.id || entry?.uid) !== userId);

export const addParticipantChanges = (league, gameData, user) => {
  const userId = user.id;
  const members = getParticipantIds(league);
  if (members.includes(userId) || userId === league.ownerId) {
    throw new Error('This person is already in the league.');
  }
  if (league.status === 'archived') {
    throw new Error('Archived leagues cannot accept participants.');
  }

  const users = withoutUser(Array.isArray(league.users) ? league.users : [], userId);
  const participant = {
    id: userId,
    username: user.username || user.displayName || user.email || userId,
    displayName: user.displayName || user.username || user.email || userId,
    email: user.email || ''
  };
  const nextMembers = [...members, userId];
  const leagueUpdates = {
    members: nextMembers,
    users: [...users, participant],
    userIds: nextMembers
  };

  const order = reconcileDraftOrder({ ...league, members: nextMembers }, gameData?.draft, gameData?.rosterSettings);
  const gameUpdates = {
    'draft.order': order,
    'rosterSettings.draftOrder': order
  };
  if (gameData?.draft?.status === DRAFT_STATUS.COMPLETED) {
    gameUpdates['draft.status'] = DRAFT_STATUS.IN_PROGRESS;
    gameUpdates['draft.completedAt'] = null;
  }

  return { leagueUpdates, gameUpdates, participant };
};

export const removeParticipantChanges = (league, gameData, userId) => {
  if (userId === league.ownerId) {
    throw new Error('The league owner cannot be removed.');
  }
  if (league.status === 'archived') {
    throw new Error('Archived leagues cannot remove participants.');
  }
  const members = getParticipantIds(league);
  if (!members.includes(userId)) {
    throw new Error('This person is no longer in the league.');
  }

  const leagueUpdates = {
    members: members.filter((id) => id !== userId),
    users: withoutUser(Array.isArray(league.users) ? league.users : [], userId),
    userIds: members.filter((id) => id !== userId)
  };

  const draft = gameData?.draft || {};
  const order = reconcileDraftOrder({ ...league, members: leagueUpdates.members }, draft, gameData?.rosterSettings);
  const allPicks = Array.isArray(draft.picks) ? draft.picks : [];
  const picks = allPicks
    .filter((pick) => pick.managerId !== userId)
    .map((pick, index) => ({ ...pick, pickNumber: index + 1 }));
  const gameUpdates = {
    'draft.order': order,
    'draft.picks': picks
  };
  if (draft.onClockUid === userId) gameUpdates['draft.onClockUid'] = null;
  if (Array.isArray(gameData?.rosterSettings?.draftOrder)) {
    gameUpdates['rosterSettings.draftOrder'] = order;
  }
  const rosterSize = Number(gameData?.rosterSettings?.rosterSize || 3);
  if (draft.status === DRAFT_STATUS.COMPLETED && picks.length < order.length * rosterSize) {
    gameUpdates['draft.status'] = DRAFT_STATUS.IN_PROGRESS;
    gameUpdates['draft.completedAt'] = null;
  } else if (
    order.length && picks.length >= order.length * rosterSize &&
    [DRAFT_STATUS.IN_PROGRESS, DRAFT_STATUS.PAUSED].includes(draft.status)
  ) {
    gameUpdates['draft.status'] = DRAFT_STATUS.COMPLETED;
  }

  return { leagueUpdates, gameUpdates, removedPickCount: allPicks.length - picks.length };
};

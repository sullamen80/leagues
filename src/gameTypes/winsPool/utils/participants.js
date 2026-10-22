const safeArray = (value) => (Array.isArray(value) ? value : []);

// Membership belongs to the league, never to roster or leaderboard documents.
export const getParticipantIds = (league = {}) =>
  [...new Set([league?.ownerId, ...safeArray(league?.members)].filter(Boolean))];

export const buildParticipantRosters = (league = {}, rosters = []) => {
  const rosterLookup = new Map(safeArray(rosters).map((roster) => [roster.id, roster]));
  const identities = new Map(safeArray(league.users).filter((user) =>
    typeof user === 'string' || user?.id || user?.uid
  ).map((user) =>
    typeof user === 'string' ? [user, {}] : [user.id || user.uid, user]
  ));

  return getParticipantIds(league).map((id) => {
    const identity = identities.get(id) || {};
    const roster = rosterLookup.get(id) || {};
    const displayName = identity.displayName || identity.username ||
      roster.displayName || roster.username || roster.ownerName ||
      (id === league.ownerId && (league.ownerDisplayName || league.ownerName)) ||
      identity.email || roster.email || id;
    return {
      ...roster,
      id,
      displayName,
      name: displayName,
      email: identity.email || roster.email || '',
      teams: safeArray(roster.teams),
      pendingPicks: safeArray(roster.pendingPicks),
      totalWins: roster.totalWins || 0
    };
  });
};

// A saved order determines sequence only. Retain that sequence, drop departed
// managers, and append members who joined after the order was saved.
export const reconcileDraftOrder = (league, draft = {}, rosterSettings = {}) => {
  const ids = getParticipantIds(league);
  const members = new Set(ids);
  const saved = safeArray(draft.order).length
    ? draft.order
    : safeArray(rosterSettings.draftOrder);
  return [...new Set([...saved.filter((id) => members.has(id)), ...ids])];
};

export const shuffleDraftOrder = (order) => {
  const shuffled = [...order];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
};

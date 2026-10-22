export const isWorldCupEntryVisible = (entry, currentUserId) =>
  Boolean(entry?.isOfficial || entry?.isCurrentUser || entry?.id === currentUserId || entry?.userId === currentUserId);

export const filterWorldCupEntries = (
  entries = [],
  { fogOfWarEnabled = false, tournamentCompleted = false, currentUserId = null } = {}
) => {
  if (!fogOfWarEnabled || tournamentCompleted) {
    return entries;
  }

  return entries.filter((entry) => isWorldCupEntryVisible(entry, currentUserId));
};

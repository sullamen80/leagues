export const currentNbaSeasonYear = (date = new Date()) => {
  const calendarYear = date.getFullYear();
  const seasonHasStarted = date.getMonth() > 8 ||
    (date.getMonth() === 8 && date.getDate() >= 30);
  return calendarYear + (seasonHasStarted ? 1 : 0);
};

export const isOlderNbaPlayerSnapshot = (playerLeaders, date = new Date()) => {
  const seasonYear = Number(
    playerLeaders?.meta?.seasonYear ?? playerLeaders?.seasonYear
  );
  return Number.isFinite(seasonYear) && seasonYear >= 2000 &&
    seasonYear < currentNbaSeasonYear(date);
};

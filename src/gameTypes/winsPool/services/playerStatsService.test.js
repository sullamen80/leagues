import axios from 'axios';
import { fetchNbaPlayerStats } from './playerStatsService';

jest.mock('axios', () => ({ get: jest.fn() }));

test('loads 2025–26 leaders through secure season-specific ESPN references', async () => {
  const athleteRef = 'http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2026/athletes/3945274?lang=en&region=us';
  const statsRef = 'http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2026/types/2/athletes/3945274/statistics?lang=en&region=us';
  const teamRef = 'http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2026/teams/13?lang=en&region=us';

  axios.get.mockImplementation(async (url) => {
    expect(url).toMatch(/^https:\/\//);
    if (url.endsWith('/leagues/nba')) return { data: { season: { year: 2027 } } };
    if (url.includes('/types/2/leaders')) {
      expect(url).toContain('/seasons/2026/');
      return {
        data: {
          categories: ['pointsPerGame', 'reboundsPerGame', 'assistsPerGame', 'stealsPerGame', 'blocksPerGame'].map((name) => ({
            name,
            leaders: [{ athlete: { $ref: athleteRef } }]
          }))
        }
      };
    }
    if (url.includes('/athletes/3945274/statistics')) {
      return {
        data: {
          splits: {
            categories: [{
              stats: [
                { name: 'gamesPlayed', value: 70 },
                { name: 'avgPoints', value: 33.5 },
                { name: 'avgRebounds', value: 7.7 },
                { name: 'avgAssists', value: 8.3 },
                { name: 'avgSteals', value: 1.6 },
                { name: 'avgBlocks', value: 0.5 }
              ]
            }]
          }
        }
      };
    }
    if (url.includes('/athletes/3945274')) {
      return { data: { id: '3945274', fullName: 'Luka Doncic', statistics: { $ref: statsRef }, team: { $ref: teamRef } } };
    }
    if (url.includes('/teams/13')) return { data: { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers' } };
    throw new Error(`Unexpected ESPN request: ${url}`);
  });

  const result = await fetchNbaPlayerStats({ season: '2025-26' });

  expect(result.seasonYear).toBe(2026);
  expect(result.seasonLabel).toBe('2025-26');
  expect(result.players).toHaveLength(1);
  expect(result.categories.ppg[0]).toMatchObject({ name: 'Luka Doncic', value: 33.5, gamesPlayed: 70, teamAbbr: 'LAL' });
  expect(result.categories.bpg[0]).toMatchObject({ value: 0.5 });
  expect(axios.get).toHaveBeenCalledTimes(5);
});

test('does not use 2025–26 data for the empty 2026–27 current season', async () => {
  axios.get.mockClear();
  const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/leagues/nba')) return { data: { season: { year: 2027 } } };
    if (url.includes('/types/2/leaders')) return { data: { categories: [] } };
    if (url.includes('/teams/') && url.endsWith('/athletes')) return { data: { items: [] } };
    throw new Error(`Unexpected ESPN request: ${url}`);
  });

  try {
    await expect(fetchNbaPlayerStats()).rejects.toThrow('ESPN returned no player stats for 2026-27');
    const seasonRequests = axios.get.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('/seasons/'));
    expect(seasonRequests.length).toBeGreaterThan(0);
    expect(seasonRequests.every((url) => url.includes('/seasons/2027/'))).toBe(true);
  } finally {
    warningSpy.mockRestore();
  }
});

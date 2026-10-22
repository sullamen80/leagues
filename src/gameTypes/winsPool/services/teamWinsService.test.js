import axios from 'axios';
import { fetchEspnTeamWins } from './teamWinsService';

jest.mock('axios', () => ({ get: jest.fn() }));

test('requests NBA 2025–26 standings using ESPN season 2026', async () => {
  axios.get.mockResolvedValue({ data: { children: [] } });

  await fetchEspnTeamWins({ league: 'NBA', season: '2025-26' });

  expect(axios.get).toHaveBeenCalledWith(
    expect.stringContaining('/basketball/nba/standings'),
    expect.objectContaining({ params: expect.objectContaining({ season: 2026 }) })
  );
});

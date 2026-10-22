import {
  ACTIVE_MENS_PLAYERS,
  createActiveMensDrawRows
} from './activeMensPlayers';

describe('Wimbledon active men fixture', () => {
  test('provides exactly 128 unique players and fills every draw slot', () => {
    const rows = createActiveMensDrawRows();

    expect(ACTIVE_MENS_PLAYERS).toHaveLength(128);
    expect(new Set(ACTIVE_MENS_PLAYERS.map((player) => player.name)).size).toBe(128);
    expect(rows).toHaveLength(128);
    expect(rows.every((row) => row.name && row.externalId)).toBe(true);
    expect(rows[0]).toMatchObject({ slotId: 'slot-1', seed: 1 });
    expect(rows[127]).toMatchObject({ slotId: 'slot-128', seed: 2 });
    expect(rows[127].slotId).toBe('slot-128');
    const openingMatches = Array.from(
      { length: 64 },
      (_, index) => rows.slice(index * 2, index * 2 + 2)
    );
    expect(openingMatches.every(
      (openingMatch) => openingMatch.filter((player) => player.seed).length <= 1
    )).toBe(true);
  });
});

import {
  countCompletedPredictions,
  createDefaultWimbledonGameData,
  getChampionSlotId,
  getRequiredPredictionCount,
  parseEntrantsImport,
  resolveDrawMatches,
  updateDrawPrediction
} from './drawUtils';

describe('Wimbledon draw utilities', () => {
  test('creates and resolves a 128-slot, 127-match draw', () => {
    const gameData = createDefaultWimbledonGameData();
    expect(Object.keys(gameData.entrantsBySlot)).toHaveLength(128);
    expect(Object.keys(gameData.matchesById)).toHaveLength(127);
    expect(resolveDrawMatches(gameData, {}).matchesById['roundOf128-1'].participantSlotIds)
      .toEqual(['slot-1', 'slot-2']);
  });

  test('propagates winners and clears invalid downstream picks', () => {
    const gameData = createDefaultWimbledonGameData();
    let picks = updateDrawPrediction(gameData, {}, 'roundOf128-1', { winnerSlotId: 'slot-1' });
    picks = updateDrawPrediction(gameData, picks, 'roundOf128-2', { winnerSlotId: 'slot-3' });
    picks = updateDrawPrediction(gameData, picks, 'roundOf64-1', { winnerSlotId: 'slot-1' });

    expect(picks['roundOf64-1'].winnerSlotId).toBe('slot-1');

    picks = updateDrawPrediction(gameData, picks, 'roundOf128-1', { winnerSlotId: 'slot-2' });
    expect(picks['roundOf64-1'].winnerSlotId).toBeNull();
  });

  test('tracks a completed champion pick', () => {
    const gameData = createDefaultWimbledonGameData();
    let picks = {};

    gameData.roundOrder.forEach((roundKey) => {
      const roundMatches = Object.values(gameData.matchesById).filter((match) => match.roundKey === roundKey);
      roundMatches.forEach((match) => {
        const resolved = resolveDrawMatches(gameData, picks);
        const winnerSlotId = resolved.matchesById[match.id].participantSlotIds[0];
        picks = updateDrawPrediction(gameData, picks, match.id, { winnerSlotId });
      });
    });

    expect(countCompletedPredictions(picks)).toBe(127);
    expect(getChampionSlotId(picks)).toBe('slot-1');
  });

  test('supports a trimmed blank bracket that starts at round of 32', () => {
    const gameData = {
      ...createDefaultWimbledonGameData(),
      startRoundKey: 'roundOf32',
      startRoundSlotIds: Array.from({ length: 32 }, (_, index) => `slot-${index + 33}`)
    };
    const resolved = resolveDrawMatches(gameData, {});

    expect(getRequiredPredictionCount(gameData)).toBe(31);
    expect(resolved.matchesById['roundOf32-1'].participantSlotIds).toEqual(['slot-33', 'slot-34']);
    expect(resolved.matchesById['roundOf32-16'].participantSlotIds).toEqual(['slot-63', 'slot-64']);
    expect(resolved.predictionsByMatchId['roundOf128-1'].winnerSlotId).toBeNull();
  });

  test('parses entrant CSV rows with slot and player columns', () => {
    const rows = parseEntrantsImport([
      'slot,name,seed,countryCode,entryStatus,externalId',
      '1,Player One,1,ESP,,atp-1',
      'slot-2,Player Two,,USA,Q,atp-2'
    ].join('\n'));

    expect(rows).toEqual([
      {
        slotId: 'slot-1',
        name: 'Player One',
        seed: '1',
        countryCode: 'ESP',
        entryStatus: '',
        externalId: 'atp-1'
      },
      {
        slotId: 'slot-2',
        name: 'Player Two',
        seed: null,
        countryCode: 'USA',
        entryStatus: 'Q',
        externalId: 'atp-2'
      }
    ]);
  });

  test('parses quoted CSV values that contain commas', () => {
    const rows = parseEntrantsImport([
      'position,player,seed,country',
      '3,"Last, First",12,GBR'
    ].join('\n'));

    expect(rows[0]).toMatchObject({
      slotId: 'slot-3',
      name: 'Last, First',
      seed: '12',
      countryCode: 'GBR'
    });
  });

  test('parses CSV headers with a UTF-8 BOM', () => {
    const rows = parseEntrantsImport('\uFEFFslot,name\n4,Player Four');

    expect(rows[0]).toMatchObject({
      slotId: 'slot-4',
      name: 'Player Four'
    });
  });
});

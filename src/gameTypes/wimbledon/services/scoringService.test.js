import { createDefaultWimbledonScoring } from '../constants/wimbledonConstants';
import {
  createDefaultWimbledonGameData,
  resolveDrawMatches,
  updateDrawPrediction
} from '../utils/drawUtils';
import { calculateWimbledonScore, sortWimbledonScores } from './scoringService';

const fillDraw = (gameData) => {
  let picks = {};
  gameData.roundOrder.forEach((roundKey) => {
    Object.values(gameData.matchesById)
      .filter((match) => match.roundKey === roundKey)
      .forEach((match) => {
        const resolved = resolveDrawMatches(gameData, picks);
        picks = updateDrawPrediction(gameData, picks, match.id, {
          winnerSlotId: resolved.matchesById[match.id].participantSlotIds[0],
          winnerSets: 2,
          loserSets: 0
        });
      });
  });
  return picks;
};

describe('Wimbledon scoring', () => {
  test('scores a perfect bracket and set tie-break predictions', () => {
    const gameData = createDefaultWimbledonGameData({ maximumSets: 3 });
    const picks = fillDraw(gameData);
    gameData.officialResultsByMatchId = picks;
    const settings = { ...createDefaultWimbledonScoring(), setPredictionEnabled: true };
    const result = calculateWimbledonScore({ picksByMatchId: picks }, gameData, settings);

    expect(result.correctPicks).toBe(127);
    expect(result.setPredictionHits).toBe(127);
    expect(result.championCorrect).toBe(true);
    expect(result.finalistHits).toBe(2);
  });

  test('uses late picks and set hits as standings tie-breakers', () => {
    const sorted = sortWimbledonScores([
      { userName: 'B', score: 10, championCorrect: false, finalistHits: 1, setPredictionHits: 5, correctPicks: 8 },
      { userName: 'A', score: 10, championCorrect: true, finalistHits: 1, setPredictionHits: 1, correctPicks: 8 }
    ]);
    expect(sorted[0].userName).toBe('A');
  });
});

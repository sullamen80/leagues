import {
  WIMBLEDON_ROUNDS,
  createDefaultWimbledonScoring
} from '../constants/wimbledonConstants';
import {
  getChampionSlotId,
  getFinalistSlotIds,
  resolveDrawMatches
} from '../utils/drawUtils';

const isScorePredictionCorrect = (prediction = {}, official = {}) =>
  official.completionReason === 'completed' &&
  prediction.winnerSlotId === official.winnerSlotId &&
  prediction.winnerSets !== null &&
  prediction.loserSets !== null &&
  Number(prediction.winnerSets) === Number(official.winnerSets) &&
  Number(prediction.loserSets) === Number(official.loserSets);

export const calculateWimbledonScore = (
  entry = {},
  gameData = {},
  scoringSettings = createDefaultWimbledonScoring()
) => {
  const userResolved = resolveDrawMatches(gameData, entry.picksByMatchId || {});
  const officialResolved = resolveDrawMatches(gameData, gameData.officialResultsByMatchId || {});
  const roundBreakdown = {};
  let score = 0;
  let correctPicks = 0;
  let possiblePicks = 0;
  let setPredictionHits = 0;
  let setPredictionAttempts = 0;

  WIMBLEDON_ROUNDS.forEach((round) => {
    const roundPoints = Number(scoringSettings?.roundPoints?.[round.key] ?? round.points);
    const breakdown = { correct: 0, possible: 0, points: 0 };

    for (let index = 0; index < round.matchCount; index += 1) {
      const matchId = `${round.key}-${index + 1}`;
      const official = officialResolved.predictionsByMatchId[matchId];
      const prediction = userResolved.predictionsByMatchId[matchId];

      if (!official?.winnerSlotId) {
        continue;
      }

      possiblePicks += 1;
      breakdown.possible += 1;
      if (prediction?.winnerSlotId === official.winnerSlotId) {
        correctPicks += 1;
        breakdown.correct += 1;
        breakdown.points += roundPoints;
        score += roundPoints;
      }

      if (
        scoringSettings?.setPredictionEnabled &&
        prediction?.winnerSets !== null &&
        prediction?.loserSets !== null
      ) {
        setPredictionAttempts += 1;
        if (isScorePredictionCorrect(prediction, official)) {
          setPredictionHits += 1;
        }
      }
    }

    roundBreakdown[round.key] = {
      ...breakdown,
      percentage: breakdown.possible > 0 ? breakdown.correct / breakdown.possible : 0
    };
  });

  const officialChampion = getChampionSlotId(officialResolved.predictionsByMatchId);
  const userChampion = getChampionSlotId(userResolved.predictionsByMatchId);
  const officialFinalists = new Set(getFinalistSlotIds(gameData, officialResolved.predictionsByMatchId));
  const userFinalists = getFinalistSlotIds(gameData, userResolved.predictionsByMatchId);
  const finalistHits = userFinalists.filter((slotId) => officialFinalists.has(slotId)).length;

  return {
    score,
    correctPicks,
    possiblePicks,
    accuracy: possiblePicks > 0 ? correctPicks / possiblePicks : 0,
    roundBreakdown,
    championSlotId: userChampion,
    championCorrect: Boolean(officialChampion && userChampion === officialChampion),
    finalistHits,
    setPredictionHits,
    setPredictionAttempts,
    setPredictionAccuracy: setPredictionAttempts > 0 ? setPredictionHits / setPredictionAttempts : 0
  };
};

export const sortWimbledonScores = (scores = []) =>
  [...scores].sort((left, right) =>
    Number(right.score || 0) - Number(left.score || 0) ||
    Number(right.championCorrect || 0) - Number(left.championCorrect || 0) ||
    Number(right.finalistHits || 0) - Number(left.finalistHits || 0) ||
    Number(right.setPredictionHits || 0) - Number(left.setPredictionHits || 0) ||
    Number(right.correctPicks || 0) - Number(left.correctPicks || 0) ||
    String(left.userName || '').localeCompare(String(right.userName || ''))
  );

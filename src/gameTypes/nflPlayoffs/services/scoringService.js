import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { fetchPlayoffsData } from './playoffsService';
import { getAllUserBrackets } from './bracketService';
import {
  ROUND_KEYS
} from '../constants/playoffConstants';
import {
  getRoundConfigs,
  normalizeScoringSettings,
  getUIPointValues as buildUIPointValues
} from '../config/scoringConfig';

const ROUND_ORDER = getRoundConfigs().map((config) => config.key);
const SUPER_WINNER_KEY = 'Super Winner Pick';
const PROP_BETS_KEY = 'Prop Bets';
const cloneValue = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return value;
  }
};

const buildRoundRecord = () => ({
  correctPicks: 0,
  basePoints: 0,
  upsetPoints: 0,
  spreadPoints: 0,
  overUnderPoints: 0,
  scoreBonusPoints: 0,
  perfectScorePoints: 0,
  totalPoints: 0,
  possiblePoints: 0
});

const deriveSpreadPickFromScores = (matchup, overrideSpreadLine = null) => {
  if (!matchup) return null;
  const team1Score = toNumber(matchup.team1Score);
  const team2Score = toNumber(matchup.team2Score);
  const hasOverrideSpreadLine = overrideSpreadLine !== null && overrideSpreadLine !== undefined;
  const spreadLine = toNumber(
    hasOverrideSpreadLine ? overrideSpreadLine : matchup.spreadLine
  );
  if (
    team1Score === null ||
    team2Score === null ||
    spreadLine === null ||
    !Number.isFinite(team1Score) ||
    !Number.isFinite(team2Score) ||
    !Number.isFinite(spreadLine)
  ) {
    return null;
  }
  const diff = team1Score + spreadLine - team2Score;
  if (Math.abs(diff) < 1e-9) return 'push';
  return diff > 0 ? 'team1' : 'team2';
};

const deriveOverUnderPickFromScores = (matchup, overrideTotalLine = null) => {
  if (!matchup) return null;
  const team1Score = toNumber(matchup.team1Score);
  const team2Score = toNumber(matchup.team2Score);
  const hasOverrideTotalLine = overrideTotalLine !== null && overrideTotalLine !== undefined;
  const totalLine = toNumber(
    hasOverrideTotalLine ? overrideTotalLine : matchup.overUnderLine
  );
  if (
    team1Score === null ||
    team2Score === null ||
    totalLine === null ||
    !Number.isFinite(team1Score) ||
    !Number.isFinite(team2Score) ||
    !Number.isFinite(totalLine)
  ) {
    return null;
  }
  const total = team1Score + team2Score;
  if (Math.abs(total - totalLine) < 1e-9) return 'push';
  return total > totalLine ? 'over' : 'under';
};

const applyDerivedPicksToMatchup = (matchup, officialMatchup = null) => {
  if (!matchup) return false;
  let changed = false;
  const spreadPick = deriveSpreadPickFromScores(
    matchup,
    officialMatchup?.spreadLine
  );
  if (spreadPick !== null && spreadPick !== matchup.spreadPick) {
    matchup.spreadPick = spreadPick;
    changed = true;
  }
  const overUnderPick = deriveOverUnderPickFromScores(
    matchup,
    officialMatchup?.overUnderLine
  );
  if (overUnderPick !== null && overUnderPick !== matchup.overUnderPick) {
    matchup.overUnderPick = overUnderPick;
    changed = true;
  }
  return changed;
};

const applyDerivedPicksToBracket = (bracket, officialBracket = null) => {
  if (!bracket) return false;
  let changed = false;
  ROUND_ORDER.forEach((roundKey) => {
    const matchups = getMatchupsForRound(bracket, roundKey);
    const officialMatchups = getMatchupsForRound(officialBracket, roundKey);
    matchups.forEach((matchup, index) => {
      const officialMatchup = officialMatchups[index] ?? null;
      if (applyDerivedPicksToMatchup(matchup, officialMatchup)) {
        changed = true;
      }
    });
  });
  return changed;
};

const buildGameScoreSummary = (userBracket = {}, officialBracket = {}, userId = null) => {
  const summary = [];
  const normalizedUserId = userId ? String(userId) : null;

  const hasWinnerId = (list) =>
    normalizedUserId &&
    Array.isArray(list) &&
    list.some((value) => String(value) === normalizedUserId);

  const createEntry = (roundKey, officialMatchup, userMatchup, index) => {
    if (!officialMatchup && !userMatchup) return;
    const resolvedSpreadPick =
      userMatchup?.spreadPick ??
      deriveSpreadPickFromScores(userMatchup, officialMatchup?.spreadLine);
    const resolvedOverUnderPick =
      userMatchup?.overUnderPick ??
      deriveOverUnderPickFromScores(userMatchup, officialMatchup?.overUnderLine);
    const normalizedMatchup = {
      ...userMatchup,
      spreadPick: resolvedSpreadPick ?? userMatchup?.spreadPick ?? null,
      overUnderPick: resolvedOverUnderPick ?? userMatchup?.overUnderPick ?? null,
      team1: userMatchup?.team1 ?? officialMatchup?.team1 ?? null,
      team2: userMatchup?.team2 ?? officialMatchup?.team2 ?? null
    };
    const spreadLine = toNumber(officialMatchup?.spreadLine);
    const favoriteTeam =
      spreadLine === null
        ? null
        : spreadLine < 0
          ? officialMatchup?.team1 ?? null
          : officialMatchup?.team2 ?? null;
    const underdogTeam =
      spreadLine === null
        ? null
        : spreadLine < 0
          ? officialMatchup?.team2 ?? null
          : officialMatchup?.team1 ?? null;
    const spreadPickTeam = getSpreadPickTeamName(normalizedMatchup, officialMatchup) ?? null;
    const officialSpreadOutcome = getSpreadOutcomeTeamName(officialMatchup);
    const spreadCorrect =
      spreadPickTeam &&
      officialSpreadOutcome &&
      stringsEqual(spreadPickTeam, officialSpreadOutcome);
    const winnerCorrect =
      userMatchup?.winner &&
      officialMatchup?.winner &&
      stringsEqual(userMatchup.winner, officialMatchup.winner);
    const overUnderOutcome = getOverUnderOutcome(officialMatchup);
    const overUnderCorrect =
      overUnderOutcome &&
      userMatchup?.overUnderPick &&
      stringsEqual(userMatchup.overUnderPick, overUnderOutcome);
    const perfectScorePoints = hasWinnerId(officialMatchup?.perfectScoreWinners)
      ? officialMatchup?.perfectScorePoints ?? 0
      : 0;
    const rawClosestScorePoints = hasWinnerId(officialMatchup?.scoreBonusWinners)
      ? officialMatchup?.scoreBonusPoints ?? 0
      : 0;
    const perfectScoreAwarded = perfectScorePoints > 0;
    const closestScoreAwarded = perfectScoreAwarded ? false : rawClosestScorePoints > 0;
    const closestScorePoints = perfectScoreAwarded ? 0 : rawClosestScorePoints;

    summary.push({
      round: roundKey,
      matchupIndex: index,
      userTeam1Score: userMatchup?.team1Score ?? null,
      userTeam2Score: userMatchup?.team2Score ?? null,
      officialTeam1Score: officialMatchup?.team1Score ?? null,
      officialTeam2Score: officialMatchup?.team2Score ?? null,
      userWinner: userMatchup?.winner ?? null,
      officialWinner: officialMatchup?.winner ?? null,
      spreadPick: normalizedMatchup?.spreadPick ?? null,
      spreadLine: officialMatchup?.spreadLine ?? null,
      overUnderPick: normalizedMatchup?.overUnderPick ?? null,
      overUnderLine: officialMatchup?.overUnderLine ?? null,
      spreadFavoriteTeam: favoriteTeam,
      spreadUnderdogTeam: underdogTeam,
      spreadPickTeamName: spreadPickTeam,
      officialSpreadOutcome,
      spreadCorrect,
      winnerCorrect,
      overUnderCorrect,
      closestScorePoints,
      perfectScorePoints,
      scoreBonusPoints: officialMatchup?.scoreBonusPoints ?? 0,
      perfectScoreAwarded: perfectScorePoints > 0,
      closestScoreAwarded: closestScorePoints > 0,
      overUnderOutcome
    });
  };

  ROUND_ORDER.forEach((roundKey) => {
      const officialMatchups = getMatchupsForRound(officialBracket, roundKey);
      const userMatchups = getMatchupsForRound(userBracket, roundKey);
      const matchupCount = Math.max(officialMatchups.length, userMatchups.length);

      for (let index = 0; index < matchupCount; index += 1) {
        createEntry(roundKey, officialMatchups[index], userMatchups[index], index);
      }
    });

  return summary;
};

export const getPointValue = (round, settings = null) =>
  normalizeScoringSettings(settings)[round];

export const getSeriesBonus = () => 0;

export const getUIPointValues = (customSettings = null) => buildUIPointValues(customSettings);

const stringsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
};

const getPropOfficialAnswer = (prop) => {
  if (!prop) return null;
  if (Object.prototype.hasOwnProperty.call(prop, 'officialAnswer')) {
    return prop.officialAnswer;
  }
  return prop.correctAnswer ?? null;
};

const isPropResolved = (prop) => {
  const officialAnswer = getPropOfficialAnswer(prop);
  return officialAnswer !== null && officialAnswer !== undefined && String(officialAnswer).trim() !== '';
};

export const teamsMatch = (matchupA, matchupB) => {
  if (!matchupA || !matchupB) return false;
  const normalize = (team) => (team || '').toString().trim().toLowerCase();
  const a1 = normalize(matchupA.team1);
  const a2 = normalize(matchupA.team2);
  const b1 = normalize(matchupB.team1);
  const b2 = normalize(matchupB.team2);
  if (!a1 || !a2 || !b1 || !b2) return false;
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
};

const evaluatePropAnswer = (prop, answer) => {
  const officialAnswer = getPropOfficialAnswer(prop);
  if (!prop || !answer || officialAnswer === null || String(officialAnswer).trim() === '') {
    return null;
  }
  if (prop.type === 'multiple_choice') {
    return stringsEqual(officialAnswer, answer);
  }
  return stringsEqual(officialAnswer, answer);
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const hasResolvedScore = (matchup) => {
  if (!matchup) return false;
  const team1Score = toNumber(matchup.team1Score);
  const team2Score = toNumber(matchup.team2Score);
  return team1Score !== null && team2Score !== null;
};

const getSpreadOutcome = (matchup) => {
  if (!matchup || !hasResolvedScore(matchup)) return null;
  const line = toNumber(matchup.spreadLine);
  if (line === null) return null;
  const team1Score = toNumber(matchup.team1Score);
  const team2Score = toNumber(matchup.team2Score);
  const adjustedTeam1 = team1Score + line;
  if (adjustedTeam1 > team2Score) return 'team1';
  if (adjustedTeam1 < team2Score) return 'team2';
  return 'push';
};

const getSpreadOutcomeTeamName = (matchup) => {
  if (!matchup || !hasResolvedScore(matchup)) return null;
  const line = toNumber(matchup.spreadLine);
  if (line === null) return null;
  const team1Score = toNumber(matchup.team1Score);
  const team2Score = toNumber(matchup.team2Score);
  const adjustedTeam1 = team1Score + line;
  if (Math.abs(adjustedTeam1 - team2Score) < 1e-9) return 'push';
  if (adjustedTeam1 > team2Score) return matchup.team1 || 'team1';
  return matchup.team2 || 'team2';
};

const getTeamNameByKey = (officialMatchup, userMatchup, key) =>
  officialMatchup?.[key] || userMatchup?.[key] || null;

const getSpreadPickTeamName = (matchup, officialMatchup = null) => {
  if (!matchup || !matchup.spreadPick) return null;
  if (matchup.spreadPick === 'push') return 'push';
  if (matchup.spreadPick === 'team1') return getTeamNameByKey(officialMatchup, matchup, 'team1');
  if (matchup.spreadPick === 'team2') return getTeamNameByKey(officialMatchup, matchup, 'team2');
  return null;
};

const getOverUnderOutcome = (matchup) => {
  if (!matchup || !hasResolvedScore(matchup)) return null;
  const line = toNumber(matchup.overUnderLine);
  if (line === null) return null;
  const team1Score = toNumber(matchup.team1Score);
  const team2Score = toNumber(matchup.team2Score);
  const total = team1Score + team2Score;
  if (total > line) return 'over';
  if (total < line) return 'under';
  return 'push';
};

const applyUpsetBonus = (official, user, bonusPerSeedDifference) => {
  if (!official?.winnerSeed) return 0;
  const userSeed = user?.winnerSeed ?? official.winnerSeed;
  const diff = userSeed - official.winnerSeed;
  return diff > 0 ? diff * bonusPerSeedDifference : 0;
};

const getMatchupsForRound = (bracket, round) => {
  if (!bracket) return [];
  if (round === ROUND_KEYS.SUPER_BOWL) {
    return bracket[round] ? [bracket[round]] : [];
  }
  return Array.isArray(bracket[round]) ? bracket[round] : [];
};

const ensureRoundRecord = (entry, round) => {
  entry.roundBreakdown = entry.roundBreakdown || {};
  if (!entry.roundBreakdown[round]) {
    entry.roundBreakdown[round] = buildRoundRecord();
  }
  return entry.roundBreakdown[round];
};

const applyBonusToEntry = (entry, round, field, amount, aggregateKey) => {
  if (!entry || amount <= 0) return;
  entry[aggregateKey] = (entry[aggregateKey] || 0) + amount;
  entry.score += amount;
  entry.possiblePoints = entry.score + entry.maxPossible;
  const roundRecord = ensureRoundRecord(entry, round);
  roundRecord[field] = (roundRecord[field] || 0) + amount;
  roundRecord.totalPoints += amount;
};

const calculatePropBetSummary = (userBracket = {}, officialBracket = {}, settings = null) => {
  const normalized = normalizeScoringSettings(settings);
  const propBets = Array.isArray(officialBracket?.propBets) ? officialBracket.propBets : [];
  const selections = userBracket?.propBetSelections || {};
  if (!propBets.length) {
    return { points: 0, results: [] };
  }

  const defaults = normalized.propBetDefaults || {};
  const overrides = normalized.propBetOverrides || {};
  const results = [];
  let totalPoints = 0;

  propBets.forEach((prop) => {
    if (!prop || prop.active === false) return;
    const selection = selections[prop.id];
    if (!selection || !selection.answer) return;

    const maxWager = overrides?.[prop.id]?.maxWager ?? defaults.maxWager ?? 3;
    const wager = Math.max(0, Math.min(maxWager, Number(selection.wager) || 0));
    const selectionAnswer = selection.answer ?? null;
    const officialAnswer = getPropOfficialAnswer(prop);
    const matchupLabel = prop.matchupLabel ?? prop.matchupInfo ?? null;
    const baseResult = {
      id: prop.id,
      title: prop.line || prop.title || 'Prop Bet',
      line: prop.line ?? null,
      round: prop.round ?? null,
      matchupLabel,
      type: prop.type ?? null,
      userAnswer: selectionAnswer,
      officialAnswer
    };

    if (wager <= 0) {
      results.push({
        ...baseResult,
        wager,
        points: 0,
        correct: false,
        pending: false
      });
      return;
    }

    if (!isPropResolved(prop)) {
      results.push({
        ...baseResult,
        wager,
        points: 0,
        correct: null,
        pending: true
      });
      return;
    }

    const isCorrect = evaluatePropAnswer(prop, selectionAnswer);
    const points = isCorrect === true ? wager : -wager;
    totalPoints += points;

    results.push({
      ...baseResult,
      wager,
      points,
      correct: isCorrect,
      pending: false
    });
  });

  return { points: totalPoints, results };
};

const logScoreBonus = (stage, payload) => {
  try {
    console.log(`[ScoreBonus] ${stage}`, payload);
  } catch (err) {
    // ignore logging errors
  }
};

const applyScorePredictionBonus = (
  userBrackets,
  officialBracket,
  scores,
  scoringSettings = null
) => {
  if (!Array.isArray(userBrackets) || !Array.isArray(scores)) return;

  const normalized = normalizeScoringSettings(scoringSettings);
  const enabledRounds = normalized.scoreBonusEnabledRounds || {};
  const teamThreshold = normalized.scoreBonusTeamThreshold ?? 7;
  const totalThreshold = normalized.scoreBonusTotalThreshold ?? 10;
  const perfectRounds = normalized.perfectScoreEnabledRounds || {};
  const getRoundScoreBonus = (round) => Number(normalized.scoreBonusPoints?.[round]) || 0;
  const getRoundPerfectBonus = (round) => Number(normalized.perfectScorePoints?.[round]) || 0;

  const scoreMap = new Map(scores.map((entry) => [entry.userId, entry]));
  const roundKeys = getRoundConfigs().map(({ key }) => key);

  roundKeys.forEach((round) => {
    const roundAccuracyPoints = getRoundScoreBonus(round);
    const roundPerfectPoints = getRoundPerfectBonus(round);
    const roundHasAccuracy = Boolean(enabledRounds[round]) && roundAccuracyPoints > 0;
    const roundHasPerfect = Boolean(perfectRounds[round]) && roundPerfectPoints > 0;
    logScoreBonus('round-start', {
      round,
      roundHasAccuracy,
      roundHasPerfect,
      accuracyPoints: roundAccuracyPoints,
      perfectPoints: roundPerfectPoints
    });
    if (!roundHasAccuracy && !roundHasPerfect) return;
    const officialMatchups = getMatchupsForRound(officialBracket, round);
    if (!officialMatchups.length) {
      logScoreBonus('round-skip', { round, reason: 'no official matchups' });
      return;
    }

    officialMatchups.forEach((officialMatchup, index) => {
      const actualTeam1 = toNumber(officialMatchup?.team1Score);
      const actualTeam2 = toNumber(officialMatchup?.team2Score);
      if (actualTeam1 === null || actualTeam2 === null) {
        logScoreBonus('skip-matchup', { round, index, reason: 'missing official score' });
        return;
      }

      const candidates = [];

      userBrackets.forEach((bracket) => {
        const userMatchups = getMatchupsForRound(bracket, round);
        const prediction = userMatchups[index];
        if (!prediction) return;
        const predictedTeam1 = toNumber(prediction.team1Score);
        const predictedTeam2 = toNumber(prediction.team2Score);
        if (predictedTeam1 === null || predictedTeam2 === null) return;

        const predictedWinner = prediction.winner || (predictedTeam1 > predictedTeam2 ? prediction.team1 : prediction.team2);
        if (!stringsEqual(predictedWinner, officialMatchup?.winner)) return;

        const maxTeamDiff =
          Math.max(
            Math.abs(predictedTeam1 - actualTeam1),
            Math.abs(predictedTeam2 - actualTeam2)
          );
        if (maxTeamDiff > teamThreshold) return;

        const combinedDiff =
          Math.abs(predictedTeam1 - actualTeam1) + Math.abs(predictedTeam2 - actualTeam2);
        if (combinedDiff > totalThreshold) return;

        candidates.push({
          userId: bracket.id,
          combinedDiff,
          isPerfect: maxTeamDiff === 0 && combinedDiff === 0
        });
      });

      logScoreBonus('candidates-built', {
        round,
        index,
        actualScore: `${actualTeam1}-${actualTeam2}`,
        candidateCount: candidates.length,
        sample: candidates.slice(0, 5)
      });

      if (roundHasPerfect) {
        const perfectCandidates = candidates.filter((candidate) => candidate.isPerfect);
        if (perfectCandidates.length) {
          perfectCandidates.forEach((candidate) => {
            const entry = scoreMap.get(candidate.userId);
            applyBonusToEntry(
              entry,
              round,
              'perfectScorePoints',
              roundPerfectPoints,
              'perfectScorePoints'
            );
          });
          officialMatchup.perfectScoreWinners = perfectCandidates.map((candidate) => candidate.userId);
          officialMatchup.perfectScorePoints = roundPerfectPoints;
          logScoreBonus('perfect-score-winners', {
            round,
            index,
            winners: officialMatchup.perfectScoreWinners
          });
          delete officialMatchup.scoreBonusWinners;
          delete officialMatchup.scoreBonusPoints;
          return;
        }
        delete officialMatchup.perfectScoreWinners;
        delete officialMatchup.perfectScorePoints;
      } else {
        delete officialMatchup.perfectScoreWinners;
        delete officialMatchup.perfectScorePoints;
      }

      if (!roundHasAccuracy || !candidates.length) {
        logScoreBonus('closest-score-none', {
          round,
          index,
          roundHasAccuracy,
          candidateCount: candidates.length
        });
        delete officialMatchup.scoreBonusWinners;
        delete officialMatchup.scoreBonusPoints;
        return;
      }
      const minDiff = Math.min(...candidates.map((candidate) => candidate.combinedDiff));
      const winners = candidates.filter((candidate) => candidate.combinedDiff === minDiff);

      const share = roundAccuracyPoints / winners.length;
      winners.forEach(({ userId }) => {
        const entry = scoreMap.get(userId);
        if (!entry) return;
        applyBonusToEntry(entry, round, 'scoreBonusPoints', share, 'scorePredictionPoints');
      });
      officialMatchup.scoreBonusWinners = winners.map((winner) => winner.userId);
      officialMatchup.scoreBonusPoints = share;
      logScoreBonus('closest-score-winners', {
        round,
        index,
        share,
        winners: officialMatchup.scoreBonusWinners
      });
    });
  });
};

export const calculateUserScore = (
  userBracket = {},
  officialBracket = {},
  scoringSettings = null,
  options = {}
) => {
  const { userId = null, includeScoreBonusFromMetadata = false } = options || {};
  const normalizedUserId = userId ? String(userId) : null;
  const settings = normalizeScoringSettings(scoringSettings);
  const roundPoints = ROUND_ORDER.reduce(
    (acc, round) => ({
      ...acc,
      [round]: settings[round]
    }),
    {}
  );

  const bonusPerSeedDifference = settings.bonusPerSeedDifference ?? 1;
  const upsetBonusEnabled = settings.upsetBonusEnabled ?? true;

  let basePoints = 0;
  let upsetPoints = 0;
  let finalsMVPPoints = 0;
  let spreadPointsEarned = 0;
  let overUnderPointsEarned = 0;
  let scorePredictionPoints = 0;
  let perfectScorePoints = 0;
  let superWinnerPoints = 0;
  let propBetPoints = 0;
  let correctPicks = 0;

  const roundBreakdown = {};
  const spreadEnabledRounds = settings.spreadEnabledRounds || {};
  const overUnderEnabledRounds = settings.overUnderEnabledRounds || {};
  const getSpreadPointValue = (round) =>
    Number(settings.spreadPoints?.[round]) || 0;
  const getOverUnderPointValue = (round) =>
    Number(settings.overUnderPoints?.[round]) || 0;

  ROUND_ORDER.forEach((round) => {
    roundBreakdown[round] = buildRoundRecord();
    const official = officialBracket[round];
    const user = userBracket[round];
    if (!official || !user) return;

    if (round === ROUND_KEYS.SUPER_BOWL) {
      const roundSpreadPoints = getSpreadPointValue(round);
      const roundTotalsPoints = getOverUnderPointValue(round);
      roundBreakdown[round].possiblePoints += roundPoints[round];
      const roundSpreadEnabled = Boolean(spreadEnabledRounds[round]) && roundSpreadPoints > 0;
      const roundTotalsEnabled =
        Boolean(overUnderEnabledRounds[round]) && roundTotalsPoints > 0;

      if (roundSpreadEnabled && user?.spreadPick) {
        roundBreakdown[round].possiblePoints += roundSpreadPoints;
      }
      if (roundTotalsEnabled && user?.overUnderPick) {
        roundBreakdown[round].possiblePoints += roundTotalsPoints;
      }

      const applyFinalExtras = () => {
        if (roundSpreadEnabled && user?.spreadPick) {
          const outcome = getSpreadOutcome(official);
          if (outcome) {
            const earned =
              outcome === 'push'
                ? user.spreadPick === 'push'
                  ? roundSpreadPoints
                  : 0
                : user.spreadPick === outcome
                  ? roundSpreadPoints
                  : 0;
            if (earned > 0) {
              spreadPointsEarned += earned;
              roundBreakdown[round].spreadPoints += earned;
            }
          }
        }

        if (roundTotalsEnabled && user?.overUnderPick) {
          const totalOutcome = getOverUnderOutcome(official);
          if (totalOutcome) {
            const earned =
              totalOutcome === 'push'
                ? user.overUnderPick === 'push'
                  ? roundTotalsPoints
                  : 0
                : user.overUnderPick === totalOutcome
                  ? roundTotalsPoints
                  : 0;
            if (earned > 0) {
              overUnderPointsEarned += earned;
              roundBreakdown[round].overUnderPoints += earned;
            }
          }
        }
      };

      if (!official.winner || !user.winner) {
        applyFinalExtras();
        return;
      }
      if (official.winner !== user.winner) {
        applyFinalExtras();
        return;
      }

      basePoints += roundPoints[round];
      correctPicks += 1;
      roundBreakdown[round].correctPicks += 1;

      roundBreakdown[round].basePoints += roundPoints[round];

      if (upsetBonusEnabled) {
        const bonus = applyUpsetBonus(official, user, bonusPerSeedDifference);
        upsetPoints += bonus;
        roundBreakdown[round].upsetPoints += bonus;
      }

      applyFinalExtras();

      roundBreakdown[round].totalPoints =
        roundBreakdown[round].basePoints +
        roundBreakdown[round].upsetPoints +
        roundBreakdown[round].spreadPoints +
        roundBreakdown[round].overUnderPoints +
        roundBreakdown[round].scoreBonusPoints +
        roundBreakdown[round].perfectScorePoints;

      return;
    }

    official.forEach((officialMatchup, idx) => {
      const roundSpreadPoints = getSpreadPointValue(round);
      const roundTotalsPoints = getOverUnderPointValue(round);
      roundBreakdown[round].possiblePoints += roundPoints[round];
      const userMatchup = user[idx];
      const roundSpreadEnabled = Boolean(spreadEnabledRounds[round]) && roundSpreadPoints > 0;
      const roundTotalsEnabled =
        Boolean(overUnderEnabledRounds[round]) && roundTotalsPoints > 0;

      if (roundSpreadEnabled && userMatchup?.spreadPick) {
        roundBreakdown[round].possiblePoints += roundSpreadPoints;
      }
      if (roundTotalsEnabled && userMatchup?.overUnderPick) {
        roundBreakdown[round].possiblePoints += roundTotalsPoints;
      }

      const applyExtraPredictions = () => {
        if (roundSpreadEnabled && userMatchup?.spreadPick) {
          const outcomeTeam = getSpreadOutcomeTeamName(officialMatchup);
          const userSpreadPickTeam = getSpreadPickTeamName(userMatchup, officialMatchup);
          if (outcomeTeam) {
            const earned =
              outcomeTeam === 'push'
                ? userSpreadPickTeam === 'push'
                  ? roundSpreadPoints
                  : 0
                : userSpreadPickTeam && stringsEqual(userSpreadPickTeam, outcomeTeam)
                  ? roundSpreadPoints
                  : 0;
            if (earned > 0) {
              spreadPointsEarned += earned;
              roundBreakdown[round].spreadPoints += earned;
            }
          }
        }

        if (roundTotalsEnabled && userMatchup?.overUnderPick) {
          const totalOutcome = getOverUnderOutcome(officialMatchup);
          if (totalOutcome) {
            const earned =
              totalOutcome === 'push'
                ? userMatchup.overUnderPick === 'push'
                  ? roundTotalsPoints
                  : 0
                : userMatchup.overUnderPick === totalOutcome
                  ? roundTotalsPoints
                  : 0;
            if (earned > 0) {
              overUnderPointsEarned += earned;
              roundBreakdown[round].overUnderPoints += earned;
            }
          }
        }
      };

      if (!officialMatchup?.winner || !userMatchup?.winner) {
        applyExtraPredictions();
        return;
      }
      if (officialMatchup.winner !== userMatchup.winner) {
        applyExtraPredictions();
        return;
      }

      basePoints += roundPoints[round];
      correctPicks += 1;
      roundBreakdown[round].basePoints += roundPoints[round];
      roundBreakdown[round].correctPicks += 1;

      if (upsetBonusEnabled) {
        const bonus = applyUpsetBonus(officialMatchup, userMatchup, bonusPerSeedDifference);
        upsetPoints += bonus;
        roundBreakdown[round].upsetPoints += bonus;
      }

      applyExtraPredictions();
    });
    roundBreakdown[round].totalPoints =
      roundBreakdown[round].basePoints +
      roundBreakdown[round].upsetPoints +
      roundBreakdown[round].spreadPoints +
      roundBreakdown[round].overUnderPoints +
      roundBreakdown[round].scoreBonusPoints +
      roundBreakdown[round].perfectScorePoints;
  });

  const officialChampion =
    officialBracket[ROUND_KEYS.CHAMPION] ||
    officialBracket[ROUND_KEYS.SUPER_BOWL]?.winner ||
    '';

  if (settings.superWinnerPoints > 0 && officialChampion && userBracket?.superWinnerPick) {
    const isCorrect = stringsEqual(userBracket.superWinnerPick, officialChampion);
    if (isCorrect) {
      superWinnerPoints = settings.superWinnerPoints;
    }
    roundBreakdown[SUPER_WINNER_KEY] = {
      pick: userBracket.superWinnerPick,
      correctPrediction: isCorrect,
      basePoints: superWinnerPoints,
      totalPoints: superWinnerPoints
    };
  }

  if (
    officialBracket[ROUND_KEYS.FINALS_MVP] &&
    userBracket[ROUND_KEYS.FINALS_MVP] &&
    officialBracket[ROUND_KEYS.FINALS_MVP] === userBracket[ROUND_KEYS.FINALS_MVP]
  ) {
    finalsMVPPoints = settings[ROUND_KEYS.FINALS_MVP];
    roundBreakdown[ROUND_KEYS.FINALS_MVP] = {
      correctPrediction: true,
      basePoints: finalsMVPPoints,
      totalPoints: finalsMVPPoints
    };
  } else if (officialBracket[ROUND_KEYS.FINALS_MVP]) {
    roundBreakdown[ROUND_KEYS.FINALS_MVP] = {
      correctPrediction: false,
      basePoints: 0,
      totalPoints: 0
    };
  }

  const propBetSummary = calculatePropBetSummary(userBracket, officialBracket, settings);
  propBetPoints = propBetSummary.points;
  if (propBetSummary.results.length) {
    roundBreakdown[PROP_BETS_KEY] = {
      totalPoints: propBetPoints,
      wagers: propBetSummary.results
    };
  }

  const awardBonusFromMetadata = () => {
    if (!includeScoreBonusFromMetadata || !normalizedUserId) return;

    const hasWinner = (list) =>
      Array.isArray(list) && list.some((value) => String(value) === normalizedUserId);

    const addMetadataPoints = (roundKey, matchup, winnersKey, pointsKey, field) => {
      if (!matchup || !hasWinner(matchup?.[winnersKey])) return;
      const amount = Number(matchup?.[pointsKey]);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const roundRecord = roundBreakdown[roundKey];
      if (!roundRecord) return;
      roundRecord[field] = (roundRecord[field] || 0) + amount;
      if (field === 'scoreBonusPoints') {
        scorePredictionPoints += amount;
      } else if (field === 'perfectScorePoints') {
        perfectScorePoints += amount;
      }
    };

    const applyToMatchup = (roundKey, matchup) => {
      addMetadataPoints(roundKey, matchup, 'scoreBonusWinners', 'scoreBonusPoints', 'scoreBonusPoints');
      addMetadataPoints(roundKey, matchup, 'perfectScoreWinners', 'perfectScorePoints', 'perfectScorePoints');
    };

    applyToMatchup(ROUND_KEYS.SUPER_BOWL, officialBracket[ROUND_KEYS.SUPER_BOWL]);
    ROUND_ORDER.forEach((roundKey) => {
      if (roundKey === ROUND_KEYS.SUPER_BOWL) return;
      const matchups = officialBracket[roundKey];
      if (!Array.isArray(matchups)) return;
      matchups.forEach((matchup) => applyToMatchup(roundKey, matchup));
    });
  };

  const recomputeRoundTotals = () => {
    ROUND_ORDER.forEach((roundKey) => {
      const roundRecord = roundBreakdown[roundKey];
      if (!roundRecord) return;
      roundRecord.totalPoints =
        roundRecord.basePoints +
        roundRecord.upsetPoints +
        roundRecord.spreadPoints +
        roundRecord.overUnderPoints +
        roundRecord.scoreBonusPoints +
        roundRecord.perfectScorePoints;
    });
  };

  awardBonusFromMetadata();
  recomputeRoundTotals();

  const totalScore =
    basePoints +
    upsetPoints +
    finalsMVPPoints +
    spreadPointsEarned +
    overUnderPointsEarned +
    scorePredictionPoints +
    perfectScorePoints +
    superWinnerPoints +
    propBetPoints;
  const maxPossible = calculateMaxPossiblePoints(userBracket, officialBracket, settings);

  return {
    points: totalScore,
    basePoints,
    upsetPoints,
    finalsMVPPoints,
    scorePredictionPoints,
    perfectScorePoints,
    superWinnerPoints,
    propBetPoints,
    spreadPoints: spreadPointsEarned,
    overUnderPoints: overUnderPointsEarned,
    correctPicks,
    possiblePoints: totalScore + maxPossible,
    maxPossible,
    roundBreakdown,
    propBetResults: propBetSummary.results
  };
};

export const calculatePlayInScore = () => ({ points: 0, correctPicks: 0 });

export const calculateMaxPossiblePoints = (userBracket = {}, officialBracket = {}, settings = null) => {
  const resolvedSettings = normalizeScoringSettings(settings);
  const spreadEnabledRounds = resolvedSettings.spreadEnabledRounds || {};
  const overUnderEnabledRounds = resolvedSettings.overUnderEnabledRounds || {};
  const getSpreadPointValue = (round) =>
    Number(resolvedSettings.spreadPoints?.[round]) || 0;
  const getOverUnderPointValue = (round) =>
    Number(resolvedSettings.overUnderPoints?.[round]) || 0;
  const propDefaults = resolvedSettings.propBetDefaults || {};
  const propOverrides = resolvedSettings.propBetOverrides || {};
  const officialChampion =
    officialBracket[ROUND_KEYS.CHAMPION] ||
    officialBracket[ROUND_KEYS.SUPER_BOWL]?.winner ||
    '';
  const superWinnerValue = resolvedSettings.superWinnerPoints || 0;
  let maxPossible = 0;

  ROUND_ORDER.forEach((round) => {
    const pointValue = resolvedSettings[round];
    const roundSpreadPoints = getSpreadPointValue(round);
    const roundTotalsPoints = getOverUnderPointValue(round);
    const roundSpreadEnabled = Boolean(spreadEnabledRounds[round]) && roundSpreadPoints > 0;
    const roundTotalsEnabled = Boolean(overUnderEnabledRounds[round]) && roundTotalsPoints > 0;

    if (round === ROUND_KEYS.SUPER_BOWL) {
      const officialMatchup = officialBracket[round];
      const userMatchup = userBracket[round];
      if (!officialMatchup?.winner && userMatchup?.winner) {
        maxPossible += pointValue;
      }

      if (
        roundSpreadEnabled &&
        userMatchup?.spreadPick &&
        !hasResolvedScore(officialMatchup) &&
        toNumber(officialMatchup?.spreadLine) !== null
      ) {
        maxPossible += roundSpreadPoints;
      }

      if (
        roundTotalsEnabled &&
        userMatchup?.overUnderPick &&
        !hasResolvedScore(officialMatchup) &&
        toNumber(officialMatchup?.overUnderLine) !== null
      ) {
        maxPossible += roundTotalsPoints;
      }
      return;
    }

    const officialArray = Array.isArray(officialBracket[round]) ? officialBracket[round] : [];
    const userArray = Array.isArray(userBracket[round]) ? userBracket[round] : [];

    userArray.forEach((matchup, idx) => {
      const officialMatchup = officialArray[idx];
      if (!officialMatchup?.winner && matchup?.winner) {
        maxPossible += pointValue;
      }

      if (
        roundSpreadEnabled &&
        matchup?.spreadPick &&
        toNumber(officialMatchup?.spreadLine) !== null &&
        !hasResolvedScore(officialMatchup)
      ) {
        maxPossible += roundSpreadPoints;
      }

      if (
        roundTotalsEnabled &&
        matchup?.overUnderPick &&
        toNumber(officialMatchup?.overUnderLine) !== null &&
        !hasResolvedScore(officialMatchup)
      ) {
        maxPossible += roundTotalsPoints;
      }
    });
  });

  if (!officialBracket[ROUND_KEYS.FINALS_MVP] && userBracket[ROUND_KEYS.FINALS_MVP]) {
    maxPossible += resolvedSettings[ROUND_KEYS.FINALS_MVP];
  }

  if (!officialChampion && userBracket?.superWinnerPick && superWinnerValue > 0) {
    maxPossible += superWinnerValue;
  }

  const propBets = Array.isArray(officialBracket?.propBets) ? officialBracket.propBets : [];
  const propSelections = userBracket?.propBetSelections || {};
  propBets.forEach((prop) => {
    if (!prop || prop.active === false) return;
    if (isPropResolved(prop)) return;
    const selection = propSelections[prop.id];
    if (!selection || !selection.answer) return;
    const maxWager = propOverrides?.[prop.id]?.maxWager ?? propDefaults.maxWager ?? 3;
    const wager = Math.max(0, Math.min(maxWager, Number(selection.wager) || 0));
    if (wager > 0) {
      maxPossible += wager;
    }
  });

  return maxPossible;
};

export const calculateLeagueScores = async (leagueId, customSettings = null) => {
  if (!leagueId) throw new Error('League ID is required');

  const officialBracket = await fetchPlayoffsData(leagueId);
  if (!officialBracket) throw new Error('Playoffs data not found');

  const userBrackets = await getAllUserBrackets(leagueId);

  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  const leagueData = leagueSnap.exists() ? leagueSnap.data() : {};
  const usersMap = {};

  if (Array.isArray(leagueData.users)) {
    leagueData.users.forEach((user) => {
      if (typeof user === 'string') {
        usersMap[user] = { id: user };
      } else if (user?.id) {
        usersMap[user.id] = user;
      }
    });
  }

  const scores = [];
  const derivedBracketUpdates = new Map();
  const bracketSnapshots = new Map();

  let scoringSettings = customSettings;
  if (!scoringSettings) {
    const scoringRef = doc(db, 'leagues', leagueId, 'settings', 'scoring');
    const scoringSnap = await getDoc(scoringRef);
    scoringSettings = scoringSnap.exists() ? scoringSnap.data() : null;
  }

  for (const bracket of userBrackets) {
    const userId = bracket.id;
    const userData = usersMap[userId] || { id: userId };
    const picksChanged = applyDerivedPicksToBracket(bracket, officialBracket);
    if (picksChanged) {
      bracket.updatedAt = new Date().toISOString();
      derivedBracketUpdates.set(userId, bracket);
    }
    bracketSnapshots.set(userId, cloneValue(bracket));
    const scoreData = calculateUserScore(bracket, officialBracket, scoringSettings);

    let enrichedUser = { ...userData };
    if (!enrichedUser.username) {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          enrichedUser.username =
            userSnap.data().username || userSnap.data().displayName || 'Unknown User';
          enrichedUser.photoURL = userSnap.data().photoURL;
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    }

    const superWinnerRecord = scoreData.roundBreakdown?.[SUPER_WINNER_KEY];
    scores.push({
      userId,
      userName: enrichedUser.username || enrichedUser.displayName || 'Unknown User',
      userPhoto: enrichedUser.photoURL,
      score: scoreData.points,
      basePoints: scoreData.basePoints,
      upsetPoints: scoreData.upsetPoints,
      finalsMVPPoints: scoreData.finalsMVPPoints,
      superWinnerPoints: scoreData.superWinnerPoints,
      propBetPoints: scoreData.propBetPoints,
      propBetResults: scoreData.propBetResults,
      propPoints: scoreData.propBetPoints,
      superWinnerPick: bracket.superWinnerPick || '',
      superWinnerCorrect: Boolean(superWinnerRecord?.correctPrediction),
      scorePredictionPoints: scoreData.scorePredictionPoints,
      perfectScorePoints: scoreData.perfectScorePoints,
      spreadPoints: scoreData.spreadPoints,
      overUnderPoints: scoreData.overUnderPoints,
      correctPicks: scoreData.correctPicks,
      possiblePoints: scoreData.possiblePoints,
      maxPossible: scoreData.maxPossible,
      championPick: bracket[ROUND_KEYS.SUPER_BOWL]?.winner || 'None Selected',
      championCorrect:
        bracket[ROUND_KEYS.SUPER_BOWL]?.winner === officialBracket[ROUND_KEYS.SUPER_BOWL]?.winner,
      finalsMVPPick: bracket[ROUND_KEYS.FINALS_MVP] || 'None Selected',
      finalsMVPCorrect:
        bracket[ROUND_KEYS.FINALS_MVP] === officialBracket[ROUND_KEYS.FINALS_MVP],
      roundBreakdown: scoreData.roundBreakdown,
      gameScores: buildGameScoreSummary(bracket, officialBracket, userId)
    });
  }

  applyScorePredictionBonus(userBrackets, officialBracket, scores, scoringSettings);
  scores.forEach((score) => {
    const bracketSnapshot = bracketSnapshots.get(score.userId);
    if (bracketSnapshot) {
      score.gameScores = buildGameScoreSummary(bracketSnapshot, officialBracket, score.userId);
    }
  });

  const rankings = scores.sort((a, b) => b.score - a.score);
  rankings.forEach((score, idx) => {
    score.rank = idx + 1;
  });
  return { rankings, officialBracket, derivedBracketUpdates };
};

export const updateLeagueScores = async (leagueId, customSettings = null) => {
  const { rankings, officialBracket, derivedBracketUpdates } = await calculateLeagueScores(
    leagueId,
    customSettings
  );
  const sanitize = (value) => JSON.parse(JSON.stringify(value));
  const sanitizedRankings = sanitize(rankings);
  const MAX_PROP_LOG_ITEMS = 5;
  const formatPropLogSummary = (results = []) => {
    if (!results.length) return '';
    return results
      .slice(0, MAX_PROP_LOG_ITEMS)
      .map((prop) => {
        const title = prop.title || prop.line || 'Prop Bet';
        const user = prop.userAnswer ?? '—';
        const official = getPropOfficialAnswer(prop) ?? '—';
        const status = prop.pending ? 'pending' : prop.correct ? 'correct' : 'incorrect';
        return `${title}: ${user} vs ${official} (${status})`;
      })
      .concat(results.length > MAX_PROP_LOG_ITEMS ? [`+${results.length - MAX_PROP_LOG_ITEMS} more`] : [])
      .join(' | ');
  };

  for (const userScore of sanitizedRankings) {
    const userScoreRef = doc(db, 'leagues', leagueId, 'scores', userScore.userId);
    await setDoc(userScoreRef, { ...userScore, updatedAt: new Date().toISOString() });
  }

  const scoreboardEntries = sanitizedRankings.map((score, index) => {
    if (score.propBetResults?.length) {
      const summary = formatPropLogSummary(score.propBetResults);
      console.info(
        `[Scoring][Props] ${score.userName || score.userId}: ${summary}`
      );
    }
    const closestScorePoints = Math.max(score.scorePredictionPoints - score.perfectScorePoints, 0);
    return {
      rank: index + 1,
      id: score.userId,
      userId: score.userId,
      userName: score.userName,
      name: score.userName,
      userPhoto: score.userPhoto || null,
      points: score.score,
      actualScore: score.score,
      correctWinners: score.correctPicks,
      winnerPoints: score.basePoints,
      upsetPoints: score.upsetPoints,
      mvpPoints: score.finalsMVPPoints,
      mvpCorrect: Boolean(score.finalsMVPCorrect),
      championCorrect: Boolean(score.championCorrect),
      superWinnerPoints: score.superWinnerPoints,
      superWinnerPick: score.superWinnerPick,
      superWinnerCorrect: Boolean(score.superWinnerCorrect),
      spreadPoints: score.spreadPoints,
      spreadCorrect: score.spreadPoints > 0,
      overUnderPoints: score.overUnderPoints,
      overUnderCorrect: score.overUnderPoints > 0,
      scorePredictionPoints: score.scorePredictionPoints,
      perfectScorePoints: score.perfectScorePoints,
      closestScorePoints,
      propBetPoints: score.propBetPoints,
      propPoints: score.propPoints,
      propBetResults: score.propBetResults,
      roundBreakdown: score.roundBreakdown,
      gameScores: score.gameScores,
      championPick: score.championPick,
      finalsMVPPick: score.finalsMVPPick
    };
  });
  const scoreboardSnapshot = {
    entries: scoreboardEntries,
    map: scoreboardEntries.reduce((acc, entry) => {
      acc[entry.userId] = entry;
      return acc;
    }, {}),
    updatedAt: new Date().toISOString()
  };

  if (derivedBracketUpdates && derivedBracketUpdates.size) {
    for (const [userId, bracketData] of derivedBracketUpdates.entries()) {
      const sanitizedBracket = sanitize(bracketData);
      delete sanitizedBracket.id;
      await setDoc(
        doc(db, 'leagues', leagueId, 'userData', userId),
        sanitizedBracket,
        { merge: true }
      );
    }
  }

  if (officialBracket) {
    const sanitizedOfficial = sanitize(officialBracket);
    sanitizedOfficial.scoreboard = scoreboardSnapshot;
    await setDoc(
      doc(db, 'leagues', leagueId, 'gameData', 'current'),
      sanitizedOfficial,
      { merge: true }
    );
  } else {
    console.warn('[Scoring] updateLeagueScores called without officialBracket payload');
  }

  return {
    rankings: sanitizedRankings,
    officialBracket: officialBracket ? sanitize(officialBracket) : null
  };
};

export const fetchLeaderboard = async (leagueId, forceRecalculate = false, customSettings = null) => {
  if (!leagueId) throw new Error('League ID is required');

  if (forceRecalculate) {
    await updateLeagueScores(leagueId, customSettings);
  }

  const { rankings, officialBracket } = await calculateLeagueScores(leagueId, customSettings);
  return { rankings, officialBracket };
};

export const getTopUsers = async (leagueId, maxUsers = 10) => {
  if (!leagueId) throw new Error('League ID is required');

  const scoresRef = collection(db, 'leagues', leagueId, 'scores');
  const scoresQuery = query(scoresRef, orderBy('score', 'desc'), limit(maxUsers));
  const scoresSnap = await getDocs(scoresQuery);

  if (!scoresSnap.empty) {
    const topUsers = [];
    scoresSnap.forEach((docSnap) => topUsers.push(docSnap.data()));
    return topUsers;
  }

  const { rankings } = await calculateLeagueScores(leagueId);
  return rankings.slice(0, maxUsers);
};

export const getUserScore = async (leagueId, userId, forceRecalculate = false, customSettings = null) => {
  if (!leagueId || !userId) throw new Error('League ID and User ID are required');

  if (!forceRecalculate) {
    const savedRef = doc(db, 'leagues', leagueId, 'scores', userId);
    const savedSnap = await getDoc(savedRef);
    if (savedSnap.exists()) return savedSnap.data();
  }

  const officialBracket = await fetchPlayoffsData(leagueId);
  if (!officialBracket) throw new Error('Playoffs data not found');

  const userBracketRef = doc(db, 'leagues', leagueId, 'userData', userId);
  const userBracketSnap = await getDoc(userBracketRef);
  if (!userBracketSnap.exists()) throw new Error('User bracket not found');

  const userBracket = userBracketSnap.data();
  const scoreData = calculateUserScore(userBracket, officialBracket, customSettings, {
    userId,
    includeScoreBonusFromMetadata: true
  });

  let userName = 'Unknown User';
  let userPhoto = null;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      userName = userSnap.data().username || userSnap.data().displayName || 'Unknown User';
      userPhoto = userSnap.data().photoURL;
    }
  } catch (err) {
    console.error('Error fetching user data:', err);
  }

  const userScore = {
    userId,
    userName,
    userPhoto,
    score: scoreData.points,
    basePoints: scoreData.basePoints,
    upsetPoints: scoreData.upsetPoints,
    finalsMVPPoints: scoreData.finalsMVPPoints,
    correctPicks: scoreData.correctPicks,
    possiblePoints: scoreData.possiblePoints,
    maxPossible: scoreData.maxPossible,
    championPick: userBracket[ROUND_KEYS.SUPER_BOWL]?.winner || 'None Selected',
    championCorrect:
      userBracket[ROUND_KEYS.SUPER_BOWL]?.winner === officialBracket[ROUND_KEYS.SUPER_BOWL]?.winner,
    finalsMVPPick: userBracket[ROUND_KEYS.FINALS_MVP] || 'None Selected',
    finalsMVPCorrect:
      userBracket[ROUND_KEYS.FINALS_MVP] === officialBracket[ROUND_KEYS.FINALS_MVP],
    roundBreakdown: scoreData.roundBreakdown,
    updatedAt: new Date().toISOString()
  };

  const userScoreRef = doc(db, 'leagues', leagueId, 'scores', userId);
  await setDoc(userScoreRef, userScore);

  return userScore;
};

const scoringService = {
  calculateUserScore,
  calculateLeagueScores,
  updateLeagueScores,
  fetchLeaderboard,
  getTopUsers,
  getUserScore,
  teamsMatch,
  getUIPointValues,
  getPointValue,
  getSeriesBonus,
  calculatePlayInScore
};

export default scoringService;

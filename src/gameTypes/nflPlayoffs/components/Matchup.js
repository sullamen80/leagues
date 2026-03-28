// src/gameTypes/nflPlayoffs/components/Matchup.js
import React from 'react';
import { formatTeamWithSeed } from '../utils/bracketUtils';
import { getPointValue } from '../services/scoringService';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

const parseNumeric = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatSpreadValue = (value) => {
  const numeric = parseNumeric(value);
  if (numeric === null) return '';
  if (numeric === 0) return 'EVEN';
  return numeric > 0 ? `+${numeric}` : `${numeric}`;
};

const formatTotalValue = (value) => {
  const numeric = parseNumeric(value);
  return numeric === null ? 'TBD' : numeric.toString();
};

const determineSpreadOutcome = (matchup, officialResult, spreadLineValue) => {
  if (spreadLineValue === null || spreadLineValue === undefined) return null;
  const source = officialResult || matchup;
  const team1Score = parseNumeric(source?.team1Score);
  const team2Score = parseNumeric(source?.team2Score);
  if (team1Score === null || team2Score === null) return null;
  const adjustedDiff = team1Score + spreadLineValue - team2Score;
  if (Math.abs(adjustedDiff) < 1e-9) return 'push';
  return adjustedDiff > 0 ? 'team1' : 'team2';
};

const determineOverUnderOutcome = (matchup, officialResult, overUnderValue) => {
  if (overUnderValue === null || overUnderValue === undefined) return null;
  const source = officialResult || matchup;
  const team1Score = parseNumeric(source?.team1Score);
  const team2Score = parseNumeric(source?.team2Score);
  if (team1Score === null || team2Score === null) return null;
  const total = team1Score + team2Score;
  if (Math.abs(total - overUnderValue) < 1e-9) return 'push';
  return total > overUnderValue ? 'over' : 'under';
};

const CHIP_BASE_CLASSES =
  'px-3 py-1 rounded text-xs border font-medium transition select-none';

const SELECTION_PALETTES = {
  spread: {
    default: 'bg-white text-gray-700 border-gray-300 hover:bg-indigo-50',
    defaultReadOnly: 'bg-gray-50 text-gray-600 border-gray-200',
    active: 'bg-indigo-600 text-white border-indigo-600 shadow',
    correct: 'bg-green-600 text-white border-green-600 shadow',
    incorrect: 'bg-red-600 text-white border-red-600 shadow',
    result: 'bg-green-50 text-green-700 border-green-200',
    neutral: 'bg-white text-gray-600 border-gray-200'
  },
  total: {
    default: 'bg-white text-gray-700 border-gray-300 hover:bg-green-50',
    defaultReadOnly: 'bg-gray-50 text-gray-600 border-gray-200',
    active: 'bg-green-600 text-white border-green-600 shadow',
    correct: 'bg-green-600 text-white border-green-600 shadow',
    incorrect: 'bg-red-600 text-white border-red-600 shadow',
    result: 'bg-green-50 text-green-700 border-green-200',
    neutral: 'bg-white text-gray-600 border-gray-200'
  }
};

const buildSelectionClasses = ({
  variant,
  isSelected,
  hasResult,
  isCorrectSelection,
  isResultOption,
  readOnly,
  disabled
}) => {
  const palette = SELECTION_PALETTES[variant];
  const interactive = !readOnly && !disabled;
  let classes = `${CHIP_BASE_CLASSES} ${interactive ? 'cursor-pointer' : 'cursor-default'}`;

  if (hasResult) {
    if (isSelected) {
      classes += ` ${isCorrectSelection ? palette.correct : palette.incorrect}`;
    } else if (isResultOption) {
      classes += ` ${palette.result}`;
    } else {
      classes += ` ${palette.neutral}`;
    }
  } else if (isSelected) {
    classes += ` ${palette.active}`;
  } else {
    classes += ` ${readOnly ? palette.defaultReadOnly : palette.default}`;
  }

  if (disabled && !readOnly) {
    classes += ' opacity-60 cursor-not-allowed';
  }

  return classes.trim();
};

/**
 * NFL Playoffs matchup component
 * Extends the BaseMatchup with NFL-specific single elimination behavior
 */
const Matchup = ({
  matchup,
  onScoreChange,
  onLineChange,
  isLocked = false,
  isAdmin = false,
  showSeed = true,
  className = '',
  roundKey = ROUND_KEYS.FIRST_ROUND,
  officialResult = null,
  scoringSettings = null,
  readOnly = false,
  onCompareScore = null,
  entryId = null,
  scoreboardGame = null
}) => {
  const team1ScoreValue = parseNumeric(matchup.team1Score);
  const team2ScoreValue = parseNumeric(matchup.team2Score);

  const deriveWinnerFromScores = () => {
    if (team1ScoreValue === null || team2ScoreValue === null) return null;
    if (team1ScoreValue === team2ScoreValue) return null;
    if (!matchup.team1 || !matchup.team2) return null;
    return team1ScoreValue > team2ScoreValue
      ? { name: matchup.team1, seed: matchup.team1Seed }
      : { name: matchup.team2, seed: matchup.team2Seed };
  };

  const scoreDrivenWinner = deriveWinnerFromScores();
  const winnerName = matchup.winner || scoreDrivenWinner?.name || '';
  const selectedWinnerSeed = matchup.winnerSeed ?? scoreDrivenWinner?.seed ?? null;

  const handleScoreInput = (field, value) => {
    if (isLocked || readOnly || !onScoreChange) return;
    const parsed = value === '' ? null : Number(value);
    if (value !== '' && !Number.isFinite(parsed)) return;
    onScoreChange(field, value === '' ? null : parsed);
  };

  const handleLineInput = (field, value) => {
    if (isLocked || readOnly || !isAdmin || !onLineChange) return;
    const parsed = value === '' ? null : Number(value);
    if (value !== '' && !Number.isFinite(parsed)) return;
    onLineChange(field, value === '' ? null : parsed);
  };

  const resolvedSpreadLine =
    officialResult && officialResult.spreadLine !== undefined
      ? officialResult.spreadLine
      : matchup.spreadLine;
  const resolvedTotalLine =
    officialResult && officialResult.overUnderLine !== undefined
      ? officialResult.overUnderLine
      : matchup.overUnderLine;
  const spreadLineValue = parseNumeric(resolvedSpreadLine);
  const overUnderValue = parseNumeric(resolvedTotalLine);
  const hasSpreadLine = spreadLineValue !== null;
  const hasTotalLine = overUnderValue !== null;
  const spreadResultKey = hasSpreadLine
    ? determineSpreadOutcome(matchup, officialResult, spreadLineValue)
    : null;
  const overUnderResultKey = hasTotalLine
    ? determineOverUnderOutcome(matchup, officialResult, overUnderValue)
    : null;

  const entryMatches = (list) => {
    if (!entryId || !Array.isArray(list)) return false;
    const normalized = String(entryId);
    return list.some((value) => String(value) === normalized);
  };

  const calculatePointSummary = () => {
    if (!officialResult?.winner) return null;

    const summary = [];
    let total = 0;

    const basePoints =
      winnerName && officialResult.winner === winnerName ? getPointValue(roundKey, scoringSettings) : 0;
    if (basePoints > 0) {
      summary.push({ label: 'W', description: 'Winner', points: basePoints });
      total += basePoints;
    }

    const officialWinnerSeed =
      officialResult.winnerSeed ??
      (officialResult.team1 === officialResult.winner
        ? officialResult.team1Seed
        : officialResult.team2Seed) ??
      null;
    const loserSeed =
      officialResult.team1 === officialResult.winner
        ? officialResult.team2Seed
        : officialResult.team1Seed;
    const isUpset = officialWinnerSeed && loserSeed ? officialWinnerSeed > loserSeed : false;
    if (
      basePoints > 0 &&
      isUpset &&
      scoringSettings?.upsetBonusEnabled &&
      scoringSettings?.bonusPerSeedDifference
    ) {
      const diff =
        Math.max((selectedWinnerSeed ?? officialWinnerSeed ?? 0) - (officialWinnerSeed ?? 0), 0) *
        scoringSettings.bonusPerSeedDifference;
      if (diff > 0) {
        summary.push({ label: 'U', description: 'Upset bonus', points: diff });
        total += diff;
      }
    }

    const spreadEnabled =
      scoringSettings?.spreadEnabledRounds?.[roundKey] && Number(scoringSettings?.spreadPoints?.[roundKey]) > 0;
    const totalsEnabled =
      scoringSettings?.overUnderEnabledRounds?.[roundKey] && Number(scoringSettings?.overUnderPoints?.[roundKey]) > 0;
    const spreadPoints = Number(scoringSettings?.spreadPoints?.[roundKey]) || 0;
    const totalPoints = Number(scoringSettings?.overUnderPoints?.[roundKey]) || 0;

    const scoreboardAvailable = Boolean(scoreboardGame);
    const scoreboardSpreadCorrect = Boolean(scoreboardGame?.spreadCorrect);
    const scoreboardTotalsCorrect = Boolean(scoreboardGame?.overUnderCorrect);

    if (spreadEnabled && spreadPoints > 0) {
      if (scoreboardAvailable ? scoreboardSpreadCorrect : false) {
        summary.push({ label: 'S', description: 'Spread', points: spreadPoints });
        total += spreadPoints;
      } else if (!scoreboardAvailable && matchup.spreadPick && spreadResultKey && spreadResultKey !== 'push') {
        if (matchup.spreadPick === spreadResultKey) {
          summary.push({ label: 'S', description: 'Spread', points: spreadPoints });
          total += spreadPoints;
        }
      }
    }

    if (totalsEnabled && totalPoints > 0) {
      if (scoreboardAvailable ? scoreboardTotalsCorrect : false) {
        summary.push({ label: 'O/U', description: 'Total', points: totalPoints });
        total += totalPoints;
      } else if (!scoreboardAvailable && matchup.overUnderPick && overUnderResultKey && overUnderResultKey !== 'push') {
        if (matchup.overUnderPick === overUnderResultKey) {
          summary.push({ label: 'O/U', description: 'Total', points: totalPoints });
          total += totalPoints;
        }
      }
    }

    const scoreboardClosestPoints = scoreboardGame?.closestScorePoints ?? 0;
    const scoreboardPerfectPoints = scoreboardGame?.perfectScorePoints ?? 0;
    const scoreboardClosest = Boolean(scoreboardGame?.closestScoreAwarded);
    const scoreboardPerfect = Boolean(scoreboardGame?.perfectScoreAwarded);

    if (scoreboardAvailable && scoreboardClosest && scoreboardClosestPoints > 0) {
      summary.push({
        label: 'CS',
        description: 'Closest score',
        points: scoreboardClosestPoints
      });
      total += scoreboardClosestPoints;
    } else if (!scoreboardAvailable && entryMatches(officialResult.scoreBonusWinners) && officialResult.scoreBonusPoints) {
      summary.push({
        label: 'CS',
        description: 'Closest score',
        points: officialResult.scoreBonusPoints
      });
      total += officialResult.scoreBonusPoints;
    }

    if (scoreboardAvailable && scoreboardPerfect && scoreboardPerfectPoints > 0) {
      summary.push({
        label: 'Perfect',
        description: 'Perfect score',
        points: scoreboardPerfectPoints
      });
      total += scoreboardPerfectPoints;
    } else if (!scoreboardAvailable && entryMatches(officialResult.perfectScoreWinners) && officialResult.perfectScorePoints) {
      summary.push({
        label: 'Perfect',
        description: 'Perfect score',
        points: officialResult.perfectScorePoints
      });
      total += officialResult.perfectScorePoints;
    }

    return summary.length ? { total, breakdown: summary } : null;
  };

  const pointSummary = calculatePointSummary();

  const normalizeName = (value) => (value ? value.toString().trim().toLowerCase() : '');
  const pickStatus = (() => {
    if (!winnerName || !officialResult?.winner) return 'pending';
    return officialResult.winner === winnerName ? 'correct' : 'incorrect';
  })();

  const getTeamRowClasses = (teamKey) => {
    const isWinner =
      winnerName &&
      matchup[teamKey] &&
      normalizeName(matchup[teamKey]) === normalizeName(winnerName);
    if (!isWinner) {
      return 'bg-white border-gray-200';
    }
    if (pickStatus === 'correct') return 'bg-green-50 border-green-300';
    if (pickStatus === 'incorrect') return 'bg-red-50 border-red-300';
    return 'bg-indigo-50 border-indigo-200';
  };

  const getWinnerSupportText = () => {
    if (pickStatus === 'correct') return 'Winner • Correct pick';
    if (pickStatus === 'incorrect') return 'Incorrect pick';
    return 'Leading based on your score';
  };

  const getDisplayName = (teamKey, fallback) => {
    const name = matchup[teamKey];
    if (showSeed) {
      return formatTeamWithSeed(name || fallback, matchup[`${teamKey}Seed`]);
    }
    if (name && name.trim() !== '') return name;
    const seed = matchup[`${teamKey}Seed`];
    if (typeof seed === 'number') return `#${seed} Seed`;
    return fallback;
  };

  const renderScoreRow = (teamKey, fallback) => {
    const scoreField = teamKey === 'team1' ? 'team1Score' : 'team2Score';
    const isWinner =
      winnerName &&
      matchup[teamKey] &&
      normalizeName(matchup[teamKey]) === normalizeName(winnerName);
    const officialScoreValue =
      officialResult && officialResult[scoreField] !== undefined
        ? officialResult[scoreField]
        : null;
    const showOfficialScore =
      officialScoreValue !== null && officialScoreValue !== undefined && officialScoreValue !== '';
    const officialScoreDisplay =
      showOfficialScore && Number.isFinite(Number(officialScoreValue))
        ? Number(officialScoreValue)
        : officialScoreValue;

    return (
      <div
        key={teamKey}
        className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition ${getTeamRowClasses(
          teamKey
        )}`}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {getDisplayName(teamKey, fallback)}
          </div>
          {isWinner && (
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {getWinnerSupportText()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            onWheel={(e) => e.currentTarget.blur()}
            min="0"
            className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-lg font-bold text-center text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100 disabled:text-gray-400"
            value={matchup[scoreField] ?? ''}
            onChange={(e) => handleScoreInput(scoreField, e.target.value)}
            disabled={isLocked || readOnly}
          />
          {showOfficialScore && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
              Actual {officialScoreDisplay}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSelectionGroup = ({
    variant,
    options,
    selection,
    resultKey,
    displayOnly = false
  }) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selection === option.key;
        const hasResult = Boolean(resultKey);
        const isCorrectSelection = hasResult && isSelected && resultKey === option.key;
        const isResultOption = hasResult && resultKey === option.key;
        const classes = buildSelectionClasses({
          variant,
          isSelected,
          hasResult,
          isCorrectSelection,
          isResultOption,
          readOnly: displayOnly || readOnly,
          disabled: isLocked
        });

        return (
          <div key={option.key} className={classes}>
            {option.label}
          </div>
        );
      })}
    </div>
  );

  const conferenceBorder =
    matchup.conference === 'AFC'
      ? 'border-blue-200'
      : matchup.conference === 'NFC'
      ? 'border-red-200'
      : 'border-gray-200';

  const roundLabel = (ROUND_DISPLAY_NAMES && ROUND_DISPLAY_NAMES[roundKey]) || roundKey;

  return (
    <div className={`rounded-2xl border bg-white dark:bg-gray-800 shadow ${conferenceBorder} ${className} p-4 space-y-4`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold pb-2 border-b border-gray-100 dark:border-gray-700">
        <span>{roundLabel}</span>
        {matchup.conference && <span>{matchup.conference}</span>}
      </div>

      <div className="space-y-4">
        {renderScoreRow('team1', 'Team 1')}
        {renderScoreRow('team2', 'Team 2')}
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {onCompareScore && (
          <button
            type="button"
            onClick={onCompareScore}
            className="px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition self-start sm:self-auto"
          >
            Compare Scores
          </button>
        )}
      </div>

        {(isAdmin || hasSpreadLine) && (
          <div className="border-t pt-3">
            {isAdmin ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="number"
                  onWheel={(e) => e.currentTarget.blur()}
                  step="0.5"
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Team 1 line"
                  value={matchup.spreadLine ?? ''}
                  onChange={(e) => handleLineInput('spreadLine', e.target.value)}
                  disabled={isLocked}
                />
              </div>
            ) : null}

            {hasSpreadLine &&
              renderSelectionGroup({
                variant: 'spread',
                options: [
                  { key: 'team1', label: `${matchup.team1 || 'Team 1'} ${formatSpreadValue(spreadLineValue)}` },
                  { key: 'team2', label: `${matchup.team2 || 'Team 2'} ${formatSpreadValue(-spreadLineValue)}` },
                  { key: 'push', label: 'Push' }
                ],
                selection: matchup.spreadPick ?? null,
                resultKey: spreadResultKey,
                displayOnly: true
              })}
          </div>
        )}

        {(isAdmin || hasTotalLine) && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
              <span>Over / Under</span>
              <span className="font-semibold">
                {hasTotalLine ? `O/U ${formatTotalValue(overUnderValue)}` : 'TBD'}
              </span>
            </div>
            {isAdmin ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="number"
                  onWheel={(e) => e.currentTarget.blur()}
                  step="0.5"
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Total points line"
                  value={matchup.overUnderLine ?? ''}
                  onChange={(e) => handleLineInput('overUnderLine', e.target.value)}
                  disabled={isLocked}
                />
              </div>
            ) : null}

            {hasTotalLine &&
              renderSelectionGroup({
                variant: 'total',
                options: [
                  { key: 'over', label: `Over ${formatTotalValue(overUnderValue)}` },
                  { key: 'under', label: `Under ${formatTotalValue(overUnderValue)}` },
                  { key: 'push', label: 'Push' }
                ],
                selection: matchup.overUnderPick ?? null,
                resultKey: overUnderResultKey,
                displayOnly: true
              })}
          </div>
        )}

        {pointSummary && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500 mb-1">
              <span>Points from this game</span>
              <span className="text-sm font-bold text-indigo-700">
                {pointSummary.total.toFixed(1)} pts
              </span>
            </div>
            {pointSummary.breakdown.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pointSummary.breakdown.map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    type="button"
                    className="text-xs font-semibold px-2 py-1 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50"
                    title={`${item.description} (+${item.points} pts)`}
                  >
                    {item.label} +{item.points}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No points earned for this matchup</div>
            )}
          </div>
        )}
      </div>
  );
};

export default Matchup;

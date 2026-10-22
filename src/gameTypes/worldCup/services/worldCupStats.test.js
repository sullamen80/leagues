jest.mock('../../../firebase', () => ({ db: {} }));

import {
  calculateUserTotals,
  createDefaultScoringSettings,
  createEmptyKnockoutRounds
} from './worldCupService';
import { buildWorldCupRoundStats } from './EndLeagueStatsService';
import { statsAdapter } from '../stats/adapter';

const createFixture = () => {
  const groups = [{
    id: 'A',
    name: 'Group A',
    teams: [
      { id: 'alpha', name: 'Alpha' },
      { id: 'bravo', name: 'Bravo' },
      { id: 'charlie', name: 'Charlie' },
      { id: 'delta', name: 'Delta' }
    ],
    officialOrder: ['alpha', 'bravo', 'charlie', 'delta']
  }];
  const knockoutRounds = createEmptyKnockoutRounds();
  knockoutRounds.roundOf32[0] = {
    ...knockoutRounds.roundOf32[0],
    homeTeamId: 'alpha',
    awayTeamId: 'bravo',
    winnerTeamId: 'alpha',
    homeScore: 2,
    awayScore: 1
  };
  knockoutRounds.final[0] = {
    ...knockoutRounds.final[0],
    homeTeamId: 'alpha',
    awayTeamId: 'charlie',
    winnerTeamId: 'alpha',
    homeScore: 1,
    awayScore: 0
  };

  const userKnockoutPicks = createEmptyKnockoutRounds();
  userKnockoutPicks.roundOf32[0] = {
    ...userKnockoutPicks.roundOf32[0],
    homeTeamId: 'alpha',
    awayTeamId: 'bravo',
    winnerTeamId: 'alpha',
    homeScore: 3,
    awayScore: 1
  };
  userKnockoutPicks.final[0] = {
    ...userKnockoutPicks.final[0],
    homeTeamId: 'alpha',
    awayTeamId: 'charlie',
    winnerTeamId: 'alpha',
    homeScore: 1,
    awayScore: 0
  };

  return {
    gameData: {
      edition: 2026,
      groups,
      knockoutRounds
    },
    userData: {
      groupPicks: { A: ['alpha', 'bravo', 'delta', 'charlie'] },
      knockoutPicks: userKnockoutPicks
    }
  };
};

test('World Cup round accuracy counts picks independently from point values', () => {
  const { gameData, userData } = createFixture();
  const settings = {
    ...createDefaultScoringSettings(),
    roundOf32Points: 8,
    finalPoints: 25
  };
  const totals = calculateUserTotals(userData, gameData, settings);

  expect(totals.roundBreakdown.groupStage).toMatchObject({
    correctPicks: 2,
    possiblePicks: 2,
    accuracy: 1
  });
  expect(totals.roundBreakdown.roundOf32).toMatchObject({
    correctPicks: 1,
    possiblePicks: 1,
    possiblePoints: 8,
    accuracy: 1
  });
  expect(totals.roundBreakdown.final).toMatchObject({
    correctPicks: 1,
    possiblePicks: 1,
    possiblePoints: 25,
    accuracy: 1
  });
  expect(totals.correctPicks).toBe(4);
  expect(totals.possiblePicks).toBe(4);
});

test('World Cup canonical stats aggregate round picks across players', () => {
  const { gameData, userData } = createFixture();
  const settings = {
    ...createDefaultScoringSettings(),
    roundOf32Points: 8,
    finalPoints: 25
  };
  const first = calculateUserTotals(userData, gameData, settings);
  const second = {
    ...first,
    correctPicks: 2,
    percentRight: 0.5,
    roundBreakdown: {
      ...first.roundBreakdown,
      roundOf32: {
        ...first.roundBreakdown.roundOf32,
        correct: 0,
        correctPicks: 0,
        accuracy: 0
      },
      final: {
        ...first.roundBreakdown.final,
        correct: 0,
        correctPicks: 0,
        accuracy: 0
      }
    }
  };
  const userScores = [
    {
      userId: 'one',
      userName: 'One',
      score: first.totalPoints,
      correctPicks: first.correctPicks,
      correctPickPercentage: first.percentRight,
      totalPossible: first.possiblePicks,
      roundBreakdown: first.roundBreakdown,
      championTeamId: first.championTeamId,
      championCorrect: first.championCorrect,
      exactScoreHits: first.exactScoreHits
    },
    {
      userId: 'two',
      userName: 'Two',
      score: second.totalPoints,
      correctPicks: second.correctPicks,
      correctPickPercentage: second.percentRight,
      totalPossible: second.possiblePicks,
      roundBreakdown: second.roundBreakdown,
      championTeamId: 'charlie',
      championCorrect: false,
      exactScoreHits: 0
    }
  ];
  const roundStats = buildWorldCupRoundStats(userScores);

  expect(roundStats.roundOf32).toMatchObject({
    correctPicks: 1,
    possiblePicks: 2,
    possiblePoints: 16,
    accuracy: 0.5
  });
  expect(roundStats.final).toMatchObject({
    correctPicks: 1,
    possiblePicks: 2,
    possiblePoints: 50,
    accuracy: 0.5
  });

  const detail = statsAdapter.buildLeagueDetail({
    leagueId: 'league-1',
    gameTypeId: 'worldCup',
    seasonId: '2026',
    completedAt: new Date('2026-07-20T00:00:00Z'),
    playerCount: 2,
    winner: { userId: 'one', userName: 'One', score: first.totalPoints },
    userScores,
    settings,
    previewData: { roundStats },
    legacyLeagueDoc: gameData,
    adapterVersion: 1,
    sourceVersion: 'test'
  });

  expect(detail.highlights.champion).toBe('Alpha');
  expect(detail.summary.accuracy).toBe(0.75);
  expect(detail.stats.roundStats.roundOf32.possiblePicks).toBe(2);
  expect(detail.leaders[0].roundBreakdown.final.possiblePicks).toBe(1);

  const historyEntry = statsAdapter.buildUserHistoryEntry({
    userScore: userScores[0],
    leagueId: 'league-1',
    seasonId: '2026',
    completedAt: new Date('2026-07-20T00:00:00Z'),
    rank: 1,
    adapterVersion: 1,
    sourceVersion: 'test'
  });
  const userSummary = statsAdapter.buildUserSummaryStats({
    userHistoryEntries: [historyEntry]
  });

  expect(historyEntry.roundBreakdown.roundOf32).toMatchObject({
    correctPicks: 1,
    possiblePicks: 1,
    possiblePoints: 8
  });
  expect(userSummary.summary).toMatchObject({ totalLeagues: 1, totalWins: 1 });
  expect(userSummary.byGameType.worldCup.championPickSuccessRate).toBe(1);
});

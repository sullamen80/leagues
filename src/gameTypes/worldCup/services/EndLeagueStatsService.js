import BaseEndLeagueStats from '../../common/services/BaseEndLeagueStatsService';
import { KNOCKOUT_ROUNDS, fetchLeaderboardEntries } from './worldCupService';
import { statsAdapter } from '../stats/adapter';

export const WORLD_CUP_STATS_ROUND_KEYS = Object.freeze([
  'groupStage',
  ...KNOCKOUT_ROUNDS.map((round) => round.key)
]);

export const buildWorldCupRoundStats = (userScores = []) => (
  Object.fromEntries(WORLD_CUP_STATS_ROUND_KEYS.map((roundKey) => {
    const totals = userScores.reduce((current, user) => {
      const round = user.roundBreakdown?.[roundKey] || {};
      return {
        correctPicks: current.correctPicks + Number(round.correctPicks ?? round.correct ?? 0),
        possiblePicks: current.possiblePicks + Number(round.possiblePicks || 0),
        points: current.points + Number(round.points ?? round.totalPoints ?? 0),
        possiblePoints: current.possiblePoints + Number(round.possiblePoints ?? round.possible ?? 0),
        exactScoreHits: current.exactScoreHits + Number(round.exactScoreHits || 0)
      };
    }, {
      correctPicks: 0,
      possiblePicks: 0,
      points: 0,
      possiblePoints: 0,
      exactScoreHits: 0
    });

    return [roundKey, {
      ...totals,
      accuracy: totals.possiblePicks > 0 ? totals.correctPicks / totals.possiblePicks : 0
    }];
  }))
);

/**
 * Persists World Cup results in the canonical stats collections consumed by
 * the shared /stats pages.
 */
class WorldCupEndLeagueStats extends BaseEndLeagueStats {
  constructor(leagueId) {
    super(leagueId, 'worldCup');
    this.statsAdapter = statsAdapter;
  }

  async calculateScores() {
    const { entries, settings } = await fetchLeaderboardEntries(this.leagueId);

    this.settings = settings;
    this.userScores = entries.map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      score: Number(entry.totalPoints || 0),
      basePoints: Number(entry.groupPoints || 0) + Number(entry.knockoutPoints || 0),
      bonusPoints: Number(entry.bonusPoints || 0),
      correctPicks: Number(entry.correctPicks || 0),
      correctPickPercentage: Number(entry.percentRight || 0),
      totalPossible: Number(entry.possiblePicks || 0),
      possiblePoints: Number(entry.totalPossiblePoints || 0),
      groupPoints: Number(entry.groupPoints || 0),
      knockoutPoints: Number(entry.knockoutPoints || 0),
      groupBreakdown: entry.groupBreakdown || {},
      roundBreakdown: entry.roundBreakdown || {},
      championTeamId: entry.championTeamId || null,
      championCorrect: Boolean(entry.championCorrect),
      exactScoreHits: Number(entry.exactScoreHits || 0)
    }));

    this.previewData = {
      scoringSettings: settings || {},
      playerScores: this.userScores,
      roundStats: this.buildRoundStats()
    };
  }

  buildRoundStats() {
    return buildWorldCupRoundStats(this.userScores);
  }

  getSeasonId() {
    return String(this.gameData?.edition || new Date().getFullYear());
  }

  getTotalPossiblePicks() {
    return this.userScores?.[0]?.totalPossible || 0;
  }

  isLeagueCompleted() {
    return Boolean(this.gameData?.knockoutRounds?.final?.[0]?.winnerTeamId);
  }
}

export default WorldCupEndLeagueStats;

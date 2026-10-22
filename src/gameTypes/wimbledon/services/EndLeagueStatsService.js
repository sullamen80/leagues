import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import BaseEndLeagueStats from '../../common/services/BaseEndLeagueStatsService';
import { calculateWimbledonLeaderboard } from './wimbledonService';
import { statsAdapter } from '../stats/adapter';

class WimbledonEndLeagueStats extends BaseEndLeagueStats {
  constructor(leagueId) {
    super(leagueId, 'wimbledon');
    this.statsAdapter = statsAdapter;
  }

  async calculateScores() {
    const result = await calculateWimbledonLeaderboard(this.leagueId);
    this.userScores = result.rankings;
    const auditSnap = await getDocs(collection(db, 'leagues', this.leagueId, 'auditLog'));
    this.previewData = {
      playerScores: result.rankings,
      scoringSettings: result.scoring,
      auditCorrectionCount: auditSnap.size
    };
  }

  getSeasonId() {
    return String(this.gameData?.edition || new Date().getFullYear());
  }

  getTotalPossiblePicks() {
    return 127;
  }

  isLeagueCompleted() {
    return Boolean(this.gameData?.officialResultsByMatchId?.['final-1']?.winnerSlotId);
  }
}

export default WimbledonEndLeagueStats;

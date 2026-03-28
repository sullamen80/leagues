import React from 'react';
import { FaFootballBall } from 'react-icons/fa';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import BaseGameModule, { useUrlParams } from '../common/BaseGameModule';
import { calculateLeagueScores } from './services/scoringService';

import BracketDashboard from './components/BracketDashboard';
import BracketView from './components/BracketView';
import BracketEdit from './components/BracketEdit';
import AdminDashboard from './components/AdminDashboard';
import AdminSettings from './components/AdminSettings';
import AdminTeams from './components/AdminTeams';
import AdminMVPManagement from './components/AdminMVPManagement';
import AdminScoringSettings from './components/AdminScoringSettings';
import AdminStats from './components/AdminStats';
import LeagueSetup from './components/LeagueSetup';
import Leaderboard from './components/Leaderboard';
import TournamentIcon from './components/TournamentIcon';
import AdminUserBracketEditor from './components/AdminUserBracketEditor';

import {
  ROUND_KEYS
} from './constants/playoffConstants';
import { getDefaultGameData } from './utils/bracketUtils';
import { getDefaultScoringSettings, getRoundConfigs, normalizeScoringSettings } from './config/scoringConfig';

const NFLPlayoffsRouter = (props) => {
  const params = useUrlParams();
  const view = params.view || 'edit';
  const subview = params.subview || '';

  if (view === 'admin') {
    if (subview === 'settings') {
      return <AdminSettings {...props} urlParams={params} />;
    }
    if (subview === 'teams') {
      return <AdminTeams {...props} urlParams={params} />;
    }
    if (subview === 'scoring') {
      return <AdminScoringSettings {...props} urlParams={params} />;
    }
    if (subview === 'stats') {
      return <AdminStats {...props} urlParams={params} />;
    }
    if (subview === 'editUser') {
      return <AdminUserBracketEditor {...props} urlParams={params} />;
    }
    if (subview === 'mvp') {
      return (
        <AdminMVPManagement
          leagueId={props.leagueId}
          gameData={props.gameData}
          isArchived={props.isArchived || false}
          urlParams={params}
        />
      );
    }
    return <AdminDashboard {...props} urlParams={params} subview={subview} />;
  }

  return <BracketDashboard {...props} urlParams={params} activeTab={view} />;
};

class NFLPlayoffsModule extends BaseGameModule {
  constructor() {
    super();
    this.id = 'nflPlayoffs';
    this.name = 'NFL Playoffs';
    this.description = 'NFL Playoffs Bracket Challenge';
    this.icon = <FaFootballBall />;
    this.color = '#013369';
    this.bracketIcon = TournamentIcon;
  }

  getRoutes(baseUrl) {
    return [
      { path: `${baseUrl}`, element: BracketDashboard, exact: true },
      { path: `${baseUrl}/view`, element: BracketView },
      { path: `${baseUrl}/edit`, element: BracketEdit },
      { path: `${baseUrl}/admin`, element: AdminDashboard },
      { path: `${baseUrl}/admin/settings`, element: AdminSettings },
      { path: `${baseUrl}/admin/teams`, element: AdminTeams },
      { path: `${baseUrl}/admin/scoring`, element: AdminScoringSettings },
      { path: `${baseUrl}/leaderboard`, element: Leaderboard }
    ];
  }

  getParameterRoutes(baseUrl) {
    return [{ path: baseUrl, element: NFLPlayoffsRouter }];
  }

  getBracketViewUrl(baseUrl, bracketId) {
    return this.generateParameterUrl(baseUrl, { view: 'view', bracketId });
  }

  getBracketEditUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, { view: 'edit' });
  }

  getAdminUrl(baseUrl, subview = null) {
    const params = { view: 'admin' };
    if (subview) params.subview = subview;
    return this.generateParameterUrl(baseUrl, params);
  }

  getLeaderboardUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, { view: 'leaderboard' });
  }

  getSetupComponent() {
    return LeagueSetup;
  }

  async initializeLeague(leagueId, setupData = {}) {
    try {
      console.log(`Initializing NFL Playoffs league: ${leagueId}`, setupData);

      const tournamentData = {
        ...getDefaultGameData(),
        seasonYear: setupData.seasonYear || new Date().getFullYear(),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      const leagueRef = doc(db, 'leagues', leagueId);
      await updateDoc(leagueRef, {
        gameType: 'nflPlayoffs',
        lastUpdated: new Date().toISOString()
      });

      const gameDataRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
      await setDoc(gameDataRef, tournamentData);

      const defaultScoring = {
        ...getDefaultScoringSettings(),
        createdAt: new Date().toISOString()
      };

      const scoringRef = doc(db, 'leagues', leagueId, 'settings', 'scoring');
      await setDoc(scoringRef, defaultScoring);

      const locksRef = doc(db, 'leagues', leagueId, 'locks', 'lockStatus');
      await setDoc(locksRef, {
        [ROUND_KEYS.FIRST_ROUND]: { locked: false },
        [ROUND_KEYS.CONF_SEMIS]: { locked: false },
        [ROUND_KEYS.CONF_FINALS]: { locked: false },
        [ROUND_KEYS.SUPER_BOWL]: { locked: false }
      });

      return { success: true };
    } catch (error) {
      console.error('Error initializing NFL Playoffs league:', error);
      return {
        success: false,
        error: error.message || 'Failed to initialize tournament data'
      };
    }
  }

  async onUserJoin(leagueId, userId) {
    return super.onUserJoin(leagueId, userId);
  }

  getMetadata(gameData) {
    let status = 'Not Started';
    let teams = 0;
    let champion = 'TBD';
    let finalsMVP = 'TBD';

    if (gameData) {
      if (gameData.playoffTeams) {
        ['afcConference', 'nfcConference'].forEach((conf) => {
          const list = gameData.playoffTeams[conf];
          if (Array.isArray(list)) {
            teams += list.filter((team) => team && team.teamId).length;
          }
        });
      }

      if (gameData.status === 'completed') {
        status = 'Completed';
        champion = gameData[ROUND_KEYS.CHAMPION] || 'TBD';
        finalsMVP = gameData[ROUND_KEYS.FINALS_MVP] || 'TBD';
      } else if (gameData.status === 'active') {
        status = 'In Progress';
      }
    }

    return {
      status,
      teams,
      champion,
      customFields: [
        { label: 'Teams', value: teams ? `${teams}/14` : 'Not Set' },
        { label: 'Status', value: status },
        { label: 'Champion', value: champion },
        { label: 'Super Bowl MVP', value: finalsMVP }
      ]
    };
  }

  calculateScore(userBracket, playoffsResults, scoringSettings = null) {
    const settings = normalizeScoringSettings(scoringSettings);
    const roundPoints = getRoundConfigs().reduce(
      (acc, { key }) => ({
        ...acc,
        [key]: settings[key]
      }),
      {}
    );

    const bonusEnabled = settings.upsetBonusEnabled ?? true;
    const bonusPerSeedDifference = settings.bonusPerSeedDifference ?? 1;

    let points = 0;
    let correctPicks = 0;
    let bonusPoints = 0;
    let finalsMVPPoints = 0;
    const roundBreakdown = {};

    Object.entries(roundPoints).forEach(([round, pointValue]) => {
      roundBreakdown[round] = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
      if (!playoffsResults[round] || !userBracket[round]) return;

      if (round === ROUND_KEYS.SUPER_BOWL) {
        const official = playoffsResults[ROUND_KEYS.SUPER_BOWL];
        const user = userBracket[ROUND_KEYS.SUPER_BOWL];
        roundBreakdown[round].possible = pointValue;
        if (official?.winner && user?.winner && official.winner === user.winner) {
          roundBreakdown[round].base = pointValue;
          roundBreakdown[round].correct = 1;
          points += pointValue;
          correctPicks += 1;

          if (bonusEnabled && official.winnerSeed && user.winnerSeed) {
            const seedDiff = user.winnerSeed - official.winnerSeed;
            if (seedDiff > 0) {
              const bonus = seedDiff * bonusPerSeedDifference;
              bonusPoints += bonus;
              roundBreakdown[round].bonus = bonus;
            }
          }

          roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
        }
        return;
      }

      playoffsResults[round].forEach((officialMatchup, idx) => {
        roundBreakdown[round].possible += pointValue;
        const userMatchup = userBracket[round][idx];
        if (!officialMatchup?.winner || !userMatchup?.winner) return;
        if (officialMatchup.winner !== userMatchup.winner) return;

        roundBreakdown[round].base += pointValue;
        roundBreakdown[round].correct += 1;
        points += pointValue;
        correctPicks += 1;

        if (bonusEnabled && officialMatchup.winnerSeed) {
          const seedDiff = (userMatchup.winnerSeed ?? officialMatchup.winnerSeed) - officialMatchup.winnerSeed;
          if (seedDiff > 0) {
            const matchupBonus = seedDiff * bonusPerSeedDifference;
            bonusPoints += matchupBonus;
            roundBreakdown[round].bonus += matchupBonus;
          }
        }

      });

      roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
    });

    if (
      playoffsResults[ROUND_KEYS.FINALS_MVP] &&
      userBracket[ROUND_KEYS.FINALS_MVP] &&
      playoffsResults[ROUND_KEYS.FINALS_MVP] === userBracket[ROUND_KEYS.FINALS_MVP]
    ) {
      finalsMVPPoints = settings[ROUND_KEYS.FINALS_MVP];
      if (!roundBreakdown.Other) {
        roundBreakdown.Other = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
      }
      roundBreakdown.Other.base += finalsMVPPoints;
      roundBreakdown.Other.total += finalsMVPPoints;
      roundBreakdown.Other.correct += 1;
      roundBreakdown.Other.possible += settings[ROUND_KEYS.FINALS_MVP];
    } else if (playoffsResults[ROUND_KEYS.FINALS_MVP]) {
      if (!roundBreakdown.Other) {
        roundBreakdown.Other = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };
      }
      roundBreakdown.Other.possible += settings[ROUND_KEYS.FINALS_MVP];
    }

    return {
      points: points + bonusPoints + finalsMVPPoints,
      basePoints: points,
      bonusPoints,
      finalsMVPPoints,
      correctPicks,
      roundBreakdown
    };
  }

  async determineLeagueWinners(leagueId) {
    try {
      const { rankings } = await calculateLeagueScores(leagueId);
      if (!rankings || rankings.length === 0) {
        throw new Error('No user scores found to determine winners');
      }

      const winners = [];
      const topScore = rankings[0].score;
      for (const user of rankings) {
        if (user.score === topScore) {
          winners.push({ userId: user.userId, userName: user.userName, score: user.score });
        } else {
          break;
        }
      }

      return winners;
    } catch (error) {
      console.error('Error determining NFL Playoffs winners:', error);
      throw error;
    }
  }

  async onLeagueEnd(leagueId, winners) {
    console.log(`NFL Playoffs league ${leagueId} ended with winners:`, winners);
    return true;
  }
}

export default NFLPlayoffsModule;

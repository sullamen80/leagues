import React, { useMemo } from 'react';
import { FaFutbol } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { db } from '../../firebase';
import BaseGameModule from '../common/BaseGameModule';
import LeagueSetup from './components/LeagueSetup';
import BracketDashboard from './components/BracketDashboard';
import Leaderboard from './components/Leaderboard';
import AdminDashboard from './components/AdminDashboard';
import AdminSettings from './components/AdminSettings';
import AdminTeams from './components/AdminTeams';
import TournamentIcon from './components/TournamentIcon';
import WorldCupEndLeagueStats from './services/EndLeagueStatsService';
import { statsAdapter } from './stats/adapter';
import { parseWorldCupSearch } from './utils/routing';
import {
  WORLD_CUP_GAME_TYPE_ID,
  determineWorldCupLeagueWinners,
  initializeWorldCupLeague,
  upsertUserEntry
} from './services/worldCupService';

export const WorldCupRouter = (props) => {
  const location = useLocation();
  const params = useMemo(
    () => parseWorldCupSearch(location.search),
    [location.search]
  );
  const view = params.view || 'edit';
  const subview = params.subview || '';

  if (view === 'admin') {
    if (subview === 'settings') {
      return <AdminSettings {...props} urlParams={params} />;
    }
    if (subview === 'teams') {
      return <AdminTeams {...props} urlParams={params} />;
    }
    return <AdminDashboard {...props} urlParams={params} />;
  }

  return <BracketDashboard {...props} urlParams={params} activeTab={view} />;
};

class WorldCupModule extends BaseGameModule {
  constructor() {
    super();
    this.id = WORLD_CUP_GAME_TYPE_ID;
    this.name = 'World Cup';
    this.description = 'Predict group standings, then fill out the official knockout bracket.';
    this.icon = <FaFutbol />;
    this.color = '#047857';
    this.bracketIcon = TournamentIcon;
    this.statsAdapter = statsAdapter;
    this.defaultView = 'edit';
    this.category = 'Tournament';
  }

  getStatsAdapter() {
    return this.statsAdapter;
  }

  getRoutes(baseUrl) {
    return [
      { path: `${baseUrl}`, element: BracketDashboard, exact: true },
      { path: `${baseUrl}/edit`, element: BracketDashboard },
      { path: `${baseUrl}/view`, element: BracketDashboard },
      { path: `${baseUrl}/leaderboard`, element: Leaderboard },
      { path: `${baseUrl}/admin`, element: AdminDashboard },
      { path: `${baseUrl}/admin/settings`, element: AdminSettings },
      { path: `${baseUrl}/admin/teams`, element: AdminTeams }
    ];
  }

  getParameterRoutes(baseUrl) {
    return [{ path: baseUrl, element: WorldCupRouter }];
  }

  getSetupComponent() {
    return LeagueSetup;
  }

  getSettingsComponent() {
    return AdminSettings;
  }

  getEmbeddedDashboardComponent() {
    return BracketDashboard;
  }

  getLeaderboardUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, { view: 'leaderboard' });
  }

  getAdminUrl(baseUrl, subview = null) {
    const params = { view: 'admin' };
    if (subview) {
      params.subview = subview;
    }
    return this.generateParameterUrl(baseUrl, params);
  }

  async initializeLeague(leagueId, setupData = {}) {
    return initializeWorldCupLeague(leagueId, setupData);
  }

  async onUserJoinLeague(leagueId, userId, context = {}) {
    let gameData = context.gameData || {};
    const userInfo = context.userInfo || context.user || {};

    if (!gameData?.groups?.length) {
      const gameDataSnap = await getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'));
      if (gameDataSnap.exists()) {
        gameData = gameDataSnap.data();
      }
    }

    await upsertUserEntry(leagueId, userId, gameData, userInfo);
    return { success: true };
  }

  async determineLeagueWinners(leagueId) {
    return determineWorldCupLeagueWinners(leagueId);
  }

  async onLeagueEnd(leagueId, winners) {
    const stats = new WorldCupEndLeagueStats(leagueId);
    const result = await stats.captureStats(null, winners);

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to capture World Cup statistics');
    }

    return result;
  }

  getMetadata(gameData) {
    const groupsCompleted = (gameData?.groups || []).filter((group) => (group.officialOrder || []).length === 4).length;
    return {
      status: gameData?.knockoutEnabled ? 'Knockout Live' : 'Groups',
      customFields: [
        { label: 'Edition', value: gameData?.edition || 2026 },
        { label: 'Groups Finalized', value: `${groupsCompleted}/12` },
        { label: 'Knockout', value: gameData?.knockoutEnabled ? 'Enabled' : 'Locked' }
      ]
    };
  }
}

export default WorldCupModule;

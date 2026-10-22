import React, { useMemo } from 'react';
import { FaTableTennis } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import BaseGameModule from '../common/BaseGameModule';
import LeagueSetup from './components/LeagueSetup';
import BracketDashboard from './components/BracketDashboard';
import AdminDashboard from './components/AdminDashboard';
import AdminSettings from './components/AdminSettings';
import AdminParticipants from './components/AdminParticipants';
import WimbledonEndLeagueStats from './services/EndLeagueStatsService';
import { statsAdapter } from './stats/adapter';
import {
  determineWimbledonLeagueWinners,
  initializeWimbledonLeague,
  upsertWimbledonEntry
} from './services/wimbledonService';

const WimbledonRouter = (props) => {
  const location = useLocation();
  const params = useMemo(() => Object.fromEntries(new URLSearchParams(location.search)), [location.search]);
  const view = params.view || 'edit';
  const subview = params.subview || '';

  if (view === 'admin') {
    if (subview === 'settings') return <AdminSettings {...props} urlParams={params} />;
    if (subview === 'participants') return <AdminParticipants {...props} urlParams={params} />;
    return <AdminDashboard {...props} urlParams={params} />;
  }

  return <BracketDashboard {...props} activeTab={view} urlParams={params} />;
};

class WimbledonModule extends BaseGameModule {
  constructor() {
    super();
    this.id = 'wimbledon';
    this.name = 'Wimbledon';
    this.description = 'Predict a complete 128-slot tennis draw with optional set tie-break predictions.';
    this.category = 'Tournament';
    this.icon = <FaTableTennis />;
    this.color = '#4f46e5';
    this.defaultView = 'edit';
    this.statsAdapter = statsAdapter;
  }

  getStatsAdapter() {
    return this.statsAdapter;
  }

  getParameterRoutes(baseUrl) {
    return [{ path: baseUrl, element: WimbledonRouter }];
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
    return this.generateParameterUrl(baseUrl, { view: 'admin', ...(subview ? { subview } : {}) });
  }

  initializeLeague(leagueId, setupData = {}) {
    return initializeWimbledonLeague(leagueId, setupData);
  }

  async onUserJoinLeague(leagueId, userId, context = {}) {
    await upsertWimbledonEntry(leagueId, userId, context.gameData || null, context.userInfo || {});
    return { success: true };
  }

  determineLeagueWinners(leagueId) {
    return determineWimbledonLeagueWinners(leagueId);
  }

  async onLeagueEnd(leagueId, winners) {
    const stats = new WimbledonEndLeagueStats(leagueId);
    return stats.captureStats(null, winners);
  }

  getMetadata(gameData = {}) {
    return {
      status: gameData.status || 'Setup',
      customFields: [
        { label: 'Edition', value: gameData.edition || '' },
        { label: 'Event', value: gameData.eventLabel || 'Singles Championship' },
        { label: 'Draw', value: `${gameData.drawSize || 128} slots` }
      ]
    };
  }
}

export default WimbledonModule;

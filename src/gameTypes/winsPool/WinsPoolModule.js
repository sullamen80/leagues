import React from 'react';
import { FaFlagCheckered } from 'react-icons/fa';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import BaseGameModule, { useUrlParams } from '../common/BaseGameModule';

import WinsPoolDashboard from './components/WinsPoolDashboard';
import AdminDashboard from './components/AdminDashboard';
import LeagueSetup from './components/LeagueSetup';

import {
  DEFAULT_ROSTER_SETTINGS,
  DEFAULT_SCORING_SETTINGS,
  DRAFT_STATUS,
  ASSIGNMENT_MODES,
  DEFAULT_AUCTION_BUDGET,
  WINS_POOL_GAME_TYPE_ID,
  COLLECTION_KEYS,
  GAME_DATA_DOCUMENTS
} from './constants/winsPoolConstants';
import { getPresetTeamPoolById, hydrateTeamPool } from './constants/teamPools';
import { createEmptyRoster, syncGameDataTotals } from './services/rosterService';
import { calculateLeagueStandings, updateLeagueLeaderboard } from './services/scoringService';
import { generateAutoDoubleSnakeConfig } from './utils/draftConfig';

const WinsPoolRouter = (props) => {
  const params = useUrlParams();
  const view = params.view || 'overview';
  
  if (view === 'admin') {
    return <AdminDashboard {...props} urlParams={params} />;
  }
  
  return (
    <WinsPoolDashboard
      {...props}
      activeTab={view}
    />
  );
};

class WinsPoolModule extends BaseGameModule {
  constructor() {
    super();
    this.id = WINS_POOL_GAME_TYPE_ID;
    this.name = 'Wins Pool';
    this.description = 'Draft teams and earn points for every real-world win.';
    this.icon = <FaFlagCheckered />;
    this.color = '#1f6feb';
    this.category = 'Season-Long';
  }
  
  getRoutes(baseUrl) {
    return [
      {
        path: `${baseUrl}`,
        element: WinsPoolDashboard,
        exact: true
      },
      {
        path: `${baseUrl}/view`,
        element: WinsPoolDashboard
      },
      {
        path: `${baseUrl}/roster`,
        element: WinsPoolDashboard
      },
      {
        path: `${baseUrl}/teams`,
        element: WinsPoolDashboard
      },
      {
        path: `${baseUrl}/leaderboard`,
        element: WinsPoolDashboard
      },
      {
        path: `${baseUrl}/admin`,
        element: AdminDashboard
      }
    ];
  }
  
  getParameterRoutes(baseUrl) {
    return [
      {
        path: baseUrl,
        element: WinsPoolRouter
      }
    ];
  }
  
  getSetupComponent() {
    return LeagueSetup;
  }
  
  getSettingsComponent() {
    return AdminDashboard;
  }
  
  getLeaderboardUrl(baseUrl) {
    return this.generateParameterUrl(baseUrl, { view: 'leaderboard' });
  }
  
  getAdminUrl(baseUrl, subview = null) {
    const params = { view: 'admin' };
    if (subview) params.subview = subview;
    return this.generateParameterUrl(baseUrl, params);
  }
  
  async initializeLeague(leagueId, setupData = {}) {
    try {
      const winsPoolSetup = setupData?.winsPoolSetup || {};
      const poolSelection = winsPoolSetup.poolSelection || {};
      const rosterSettings = {
        ...DEFAULT_ROSTER_SETTINGS,
        ...(winsPoolSetup.rosterSettings || {})
      };
      const auctionBudget = winsPoolSetup.rosterSettings?.auctionBudget ?? DEFAULT_AUCTION_BUDGET;
      rosterSettings.auctionBudget = auctionBudget;
      const scoringSettings = {
        ...DEFAULT_SCORING_SETTINGS,
        ...(winsPoolSetup.scoringSettings || {})
      };
      
      let teamPool;
      if (poolSelection.type === 'custom' && poolSelection.customPool) {
        teamPool = hydrateTeamPool(poolSelection.customPool, 'custom');
      } else {
        const preset = getPresetTeamPoolById(poolSelection.presetId || 'nba');
        teamPool = hydrateTeamPool(preset || getPresetTeamPoolById('nba'), preset ? preset.scope : 'preset');
      }
      
      const doubleSnakeConfig = rosterSettings.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE
        ? generateAutoDoubleSnakeConfig(
            teamPool?.teams || [],
            'conference',
            rosterSettings.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
          )
        : null;

      const draftState = {
        status: DRAFT_STATUS.NOT_STARTED,
        assignmentMode: rosterSettings.assignmentMode,
        useSnakeDraft: rosterSettings.useSnakeDraft,
        picks: [],
        createdAt: new Date().toISOString(),
        auctionBudget,
        ...(doubleSnakeConfig ? { doubleSnakeConfig } : {})
      };
      
      const gameData = {
        gameType: WINS_POOL_GAME_TYPE_ID,
        teamPool,
        rosterSettings,
        scoring: scoringSettings,
        draft: draftState,
        totals: {
          totalWins: 0,
          totalTeamsAssigned: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const leagueRef = doc(db, 'leagues', leagueId);
      const leagueSnap = await getDoc(leagueRef);
      const leagueInfo = leagueSnap.exists() ? leagueSnap.data() || {} : {};
      let ownerId = winsPoolSetup?.ownerId || setupData?.ownerId || leagueInfo.ownerId || leagueInfo.createdBy || null;
      let ownerDisplayName = winsPoolSetup?.ownerName || setupData?.ownerName || leagueInfo.ownerName || null;
      let ownerEmail = setupData?.ownerEmail || leagueInfo.ownerEmail || null;
      let ownerPhotoURL = setupData?.ownerPhotoURL || leagueInfo.ownerPhotoURL || null;
      
      if (!ownerDisplayName && Array.isArray(leagueInfo.users) && ownerId) {
        const ownerUser = leagueInfo.users.find((user) => user.id === ownerId);
        if (ownerUser) {
          ownerDisplayName = ownerUser.displayName || ownerUser.username || ownerDisplayName || null;
          ownerPhotoURL = ownerPhotoURL || ownerUser.photoURL || null;
        }
      }
      
      if (!ownerDisplayName && ownerEmail) {
        ownerDisplayName = ownerEmail.split('@')[0];
      }
      
      await updateDoc(leagueRef, {
        gameType: WINS_POOL_GAME_TYPE_ID,
        updatedAt: new Date().toISOString()
      });
      
      const gameDataRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);
      await setDoc(gameDataRef, gameData);
      
      const scoringRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.SETTINGS, 'scoring');
      await setDoc(scoringRef, scoringSettings);
      
      const leaderboardRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.LEADERBOARD, GAME_DATA_DOCUMENTS.CURRENT);
      await setDoc(leaderboardRef, {
        entries: [],
        updatedAt: new Date().toISOString()
      });
      
      if (ownerId) {
        await createEmptyRoster(leagueId, ownerId, {
          displayName: ownerDisplayName,
          username: ownerDisplayName || ownerEmail?.split('@')[0] || ownerId,
          email: ownerEmail,
          photoURL: ownerPhotoURL,
          role: 'owner',
          joinedAt: Timestamp.now()
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('[WinsPool][Module] Failed to initialize league:', error);
      return {
        success: false,
        error: error.message || 'Failed to initialize Wins Pool league'
      };
    }
  }
  
  async onUserJoin(leagueId, userId, context = {}) {
    try {
      const userInfo =
        context.userInfo ||
        context.user ||
        context.profile ||
        context ||
        {};
      await createEmptyRoster(leagueId, userId, userInfo);
      return { success: true };
    } catch (error) {
      console.error('[WinsPool][Module] Failed to initialize user roster:', error);
      return {
        success: false,
        error: error.message || 'Failed to create user roster'
      };
    }
  }
  
  async onUserJoinLeague(leagueId, userId, context = {}) {
    return this.onUserJoin(leagueId, userId, context);
  }
  
  getMetadata(gameData) {
    const poolName = gameData?.teamPool?.name || 'Not configured';
    const rosterSize = gameData?.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize;
    const draftStatus = gameData?.draft?.status || DRAFT_STATUS.NOT_STARTED;
    return {
      status: draftStatus,
      customFields: [
        { label: 'Team Pool', value: poolName },
        { label: 'Roster Size', value: `${rosterSize} teams` },
        { label: 'Points / Win', value: gameData?.scoring?.pointsPerWin || DEFAULT_SCORING_SETTINGS.pointsPerWin }
      ]
    };
  }
  
  async determineLeagueWinners(leagueId) {
    const standings = await calculateLeagueStandings(leagueId);
    if (!standings.length) {
      throw new Error('No standings available to determine winners.');
    }
    
    const topPoints = standings[0].points;
    return standings
      .filter(entry => entry.points === topPoints)
      .map(entry => ({
        userId: entry.userId,
        userName: entry.displayName || entry.userId,
        score: entry.points
      }));
  }
  
  async onLeagueEnd(leagueId) {
    await updateLeagueLeaderboard(leagueId);
    await syncGameDataTotals(leagueId);
    return true;
  }
}

export default WinsPoolModule;

// src/gameTypes/winsPool/constants/winsPoolConstants.js

export const WINS_POOL_GAME_TYPE_ID = 'winsPool';

export const DEFAULT_WINS_POOL_COLOR = '#1f6feb';

export const PLAYER_STATS_CATEGORIES = ['ppg', 'rpg', 'apg', 'spg', 'bpg'];

const buildDefaultPlayerLeaderboardConfig = () =>
  PLAYER_STATS_CATEGORIES.reduce((accumulator, categoryId) => {
    accumulator[categoryId] = {
      maxRanks: 0,
      pointsByRank: {}
    };
    return accumulator;
  }, {});

export const DEFAULT_SCORING_SETTINGS = {
  pointsPerWin: 1,
  overtimeWinBonus: 0,
  playoffWinMultiplier: 1,
  allowDuplicateTeams: false,
  autoUpdateStandings: true,
  manualWinEntryAllowed: true,
  playerLeaderboardScoring: {
    enabled: false,
    categories: buildDefaultPlayerLeaderboardConfig()
  }
};

export const DRAFT_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed'
};

export const ASSIGNMENT_MODES = {
  DRAFT: 'draft',
  DOUBLE_SNAKE: 'double_snake',
  AUCTION: 'auction',
  AUTO_ASSIGN: 'auto_assign',
  MANUAL: 'manual'
};

export const DEFAULT_ROSTER_SETTINGS = {
  rosterSize: 3,
  maxTeamsPerPlayer: 6,
  allowRosterEditsDuringSeason: false,
  assignmentMode: ASSIGNMENT_MODES.DRAFT,
  useSnakeDraft: true,
  draftOrder: []
};

export const DOUBLE_SNAKE_POOLS = {
  POOL_A: 'poolA',
  POOL_B: 'poolB'
};

export const DEFAULT_DOUBLE_SNAKE_CONFIG = {
  groupingMode: 'conference',
  groups: [
    { id: DOUBLE_SNAKE_POOLS.POOL_A, label: 'Pool A', teamIds: [] },
    { id: DOUBLE_SNAKE_POOLS.POOL_B, label: 'Pool B', teamIds: [] }
  ],
  picksPerPool: {
    [DOUBLE_SNAKE_POOLS.POOL_A]: 0,
    [DOUBLE_SNAKE_POOLS.POOL_B]: 0
  },
  notes: 'Automatically splits teams by conference. Adjust as needed.'
};

export const DEFAULT_AUCTION_BUDGET = 200;

export const TEAM_POOL_SCOPES = {
  PRESET: 'preset',
  GLOBAL: 'global',
  LEAGUE: 'league',
  CUSTOM: 'custom'
};

export const COLLECTION_KEYS = {
  TEAM_POOLS: 'teamPools',
  GAME_DATA: 'gameData',
  USER_DATA: 'userData',
  LEADERBOARD: 'leaderboard',
  SETTINGS: 'settings'
};

export const GAME_DATA_DOCUMENTS = {
  CURRENT: 'current'
};

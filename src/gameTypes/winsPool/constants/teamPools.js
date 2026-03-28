// src/gameTypes/winsPool/constants/teamPools.js
/**
 * Preconfigured team pools for the Wins Pool game mode.
 * These pools can be reused across leagues and serve as templates
 * for admins who want to create custom variants.
 */

export const PRESET_TEAM_POOLS = {
  nba: {
    id: 'preset-nba-2024',
    name: 'NBA Teams',
    description: 'All 30 NBA franchises for the upcoming season.',
    league: 'NBA',
    season: '2024-25',
    scope: 'preset',
    teams: [
      { id: 'ATL', city: 'Atlanta', name: 'Hawks', shortName: 'Hawks', conference: 'East', division: 'Southeast', logo: 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg' },
      { id: 'BOS', city: 'Boston', name: 'Celtics', shortName: 'Celtics', conference: 'East', division: 'Atlantic', logo: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg' },
      { id: 'BKN', city: 'Brooklyn', name: 'Nets', shortName: 'Nets', conference: 'East', division: 'Atlantic', logo: 'https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg' },
      { id: 'CHA', city: 'Charlotte', name: 'Hornets', shortName: 'Hornets', conference: 'East', division: 'Southeast', logo: 'https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg' },
      { id: 'CHI', city: 'Chicago', name: 'Bulls', shortName: 'Bulls', conference: 'East', division: 'Central', logo: 'https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg' },
      { id: 'CLE', city: 'Cleveland', name: 'Cavaliers', shortName: 'Cavaliers', conference: 'East', division: 'Central', logo: 'https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg' },
      { id: 'DAL', city: 'Dallas', name: 'Mavericks', shortName: 'Mavericks', conference: 'West', division: 'Southwest', logo: 'https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg' },
      { id: 'DEN', city: 'Denver', name: 'Nuggets', shortName: 'Nuggets', conference: 'West', division: 'Northwest', logo: 'https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg' },
      { id: 'DET', city: 'Detroit', name: 'Pistons', shortName: 'Pistons', conference: 'East', division: 'Central', logo: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg' },
      { id: 'GSW', city: 'Golden State', name: 'Warriors', shortName: 'Warriors', conference: 'West', division: 'Pacific', logo: 'https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg' },
      { id: 'HOU', city: 'Houston', name: 'Rockets', shortName: 'Rockets', conference: 'West', division: 'Southwest', logo: 'https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg' },
      { id: 'IND', city: 'Indiana', name: 'Pacers', shortName: 'Pacers', conference: 'East', division: 'Central', logo: 'https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg' },
      { id: 'LAC', city: 'Los Angeles', name: 'Clippers', shortName: 'Clippers', conference: 'West', division: 'Pacific', logo: 'https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg' },
      { id: 'LAL', city: 'Los Angeles', name: 'Lakers', shortName: 'Lakers', conference: 'West', division: 'Pacific', logo: 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg' },
      { id: 'MEM', city: 'Memphis', name: 'Grizzlies', shortName: 'Grizzlies', conference: 'West', division: 'Southwest', logo: 'https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg' },
      { id: 'MIA', city: 'Miami', name: 'Heat', shortName: 'Heat', conference: 'East', division: 'Southeast', logo: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg' },
      { id: 'MIL', city: 'Milwaukee', name: 'Bucks', shortName: 'Bucks', conference: 'East', division: 'Central', logo: 'https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg' },
      { id: 'MIN', city: 'Minnesota', name: 'Timberwolves', shortName: 'Timberwolves', conference: 'West', division: 'Northwest', logo: 'https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg' },
      { id: 'NOP', city: 'New Orleans', name: 'Pelicans', shortName: 'Pelicans', conference: 'West', division: 'Southwest', logo: 'https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg' },
      { id: 'NYK', city: 'New York', name: 'Knicks', shortName: 'Knicks', conference: 'East', division: 'Atlantic', logo: 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg' },
      { id: 'OKC', city: 'Oklahoma City', name: 'Thunder', shortName: 'Thunder', conference: 'West', division: 'Northwest', logo: 'https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg' },
      { id: 'ORL', city: 'Orlando', name: 'Magic', shortName: 'Magic', conference: 'East', division: 'Southeast', logo: 'https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg' },
      { id: 'PHI', city: 'Philadelphia', name: '76ers', shortName: '76ers', conference: 'East', division: 'Atlantic', logo: 'https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg' },
      { id: 'PHX', city: 'Phoenix', name: 'Suns', shortName: 'Suns', conference: 'West', division: 'Pacific', logo: 'https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg' },
      { id: 'POR', city: 'Portland', name: 'Trail Blazers', shortName: 'Trail Blazers', conference: 'West', division: 'Northwest', logo: 'https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg' },
      { id: 'SAC', city: 'Sacramento', name: 'Kings', shortName: 'Kings', conference: 'West', division: 'Pacific', logo: 'https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg' },
      { id: 'SAS', city: 'San Antonio', name: 'Spurs', shortName: 'Spurs', conference: 'West', division: 'Southwest', logo: 'https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg' },
      { id: 'TOR', city: 'Toronto', name: 'Raptors', shortName: 'Raptors', conference: 'East', division: 'Atlantic', logo: 'https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg' },
      { id: 'UTA', city: 'Utah', name: 'Jazz', shortName: 'Jazz', conference: 'West', division: 'Northwest', logo: 'https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg' },
      { id: 'WAS', city: 'Washington', name: 'Wizards', shortName: 'Wizards', conference: 'East', division: 'Southeast', logo: 'https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg' }
    ]
  },
  nfl: {
    id: 'preset-nfl-2024',
    name: 'NFL Teams',
    description: 'All 32 NFL franchises for the upcoming season.',
    league: 'NFL',
    season: '2024',
    scope: 'preset',
    teams: [
      { id: 'ARI', city: 'Arizona', name: 'Cardinals', shortName: 'Cardinals', conference: 'NFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/ARI' },
      { id: 'ATL', city: 'Atlanta', name: 'Falcons', shortName: 'Falcons', conference: 'NFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/ATL' },
      { id: 'BAL', city: 'Baltimore', name: 'Ravens', shortName: 'Ravens', conference: 'AFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/BAL' },
      { id: 'BUF', city: 'Buffalo', name: 'Bills', shortName: 'Bills', conference: 'AFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/BUF' },
      { id: 'CAR', city: 'Carolina', name: 'Panthers', shortName: 'Panthers', conference: 'NFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/CAR' },
      { id: 'CHI', city: 'Chicago', name: 'Bears', shortName: 'Bears', conference: 'NFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/CHI' },
      { id: 'CIN', city: 'Cincinnati', name: 'Bengals', shortName: 'Bengals', conference: 'AFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/CIN' },
      { id: 'CLE', city: 'Cleveland', name: 'Browns', shortName: 'Browns', conference: 'AFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/CLE' },
      { id: 'DAL', city: 'Dallas', name: 'Cowboys', shortName: 'Cowboys', conference: 'NFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/DAL' },
      { id: 'DEN', city: 'Denver', name: 'Broncos', shortName: 'Broncos', conference: 'AFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/DEN' },
      { id: 'DET', city: 'Detroit', name: 'Lions', shortName: 'Lions', conference: 'NFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/DET' },
      { id: 'GB', city: 'Green Bay', name: 'Packers', shortName: 'Packers', conference: 'NFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/GB' },
      { id: 'HOU', city: 'Houston', name: 'Texans', shortName: 'Texans', conference: 'AFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/HOU' },
      { id: 'IND', city: 'Indianapolis', name: 'Colts', shortName: 'Colts', conference: 'AFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/IND' },
      { id: 'JAX', city: 'Jacksonville', name: 'Jaguars', shortName: 'Jaguars', conference: 'AFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/JAX' },
      { id: 'KC', city: 'Kansas City', name: 'Chiefs', shortName: 'Chiefs', conference: 'AFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/KC' },
      { id: 'LAC', city: 'Los Angeles', name: 'Chargers', shortName: 'Chargers', conference: 'AFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/LAC' },
      { id: 'LAR', city: 'Los Angeles', name: 'Rams', shortName: 'Rams', conference: 'NFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/LAR' },
      { id: 'LV', city: 'Las Vegas', name: 'Raiders', shortName: 'Raiders', conference: 'AFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/LV' },
      { id: 'MIA', city: 'Miami', name: 'Dolphins', shortName: 'Dolphins', conference: 'AFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/MIA' },
      { id: 'MIN', city: 'Minnesota', name: 'Vikings', shortName: 'Vikings', conference: 'NFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/MIN' },
      { id: 'NE', city: 'New England', name: 'Patriots', shortName: 'Patriots', conference: 'AFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/NE' },
      { id: 'NO', city: 'New Orleans', name: 'Saints', shortName: 'Saints', conference: 'NFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/NO' },
      { id: 'NYG', city: 'New York', name: 'Giants', shortName: 'Giants', conference: 'NFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/NYG' },
      { id: 'NYJ', city: 'New York', name: 'Jets', shortName: 'Jets', conference: 'AFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/NYJ' },
      { id: 'PHI', city: 'Philadelphia', name: 'Eagles', shortName: 'Eagles', conference: 'NFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/PHI' },
      { id: 'PIT', city: 'Pittsburgh', name: 'Steelers', shortName: 'Steelers', conference: 'AFC', division: 'North', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/PIT' },
      { id: 'SF', city: 'San Francisco', name: '49ers', shortName: '49ers', conference: 'NFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/SF' },
      { id: 'SEA', city: 'Seattle', name: 'Seahawks', shortName: 'Seahawks', conference: 'NFC', division: 'West', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/SEA' },
      { id: 'TB', city: 'Tampa Bay', name: 'Buccaneers', shortName: 'Buccaneers', conference: 'NFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/TB' },
      { id: 'TEN', city: 'Tennessee', name: 'Titans', shortName: 'Titans', conference: 'AFC', division: 'South', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/TEN' },
      { id: 'WAS', city: 'Washington', name: 'Commanders', shortName: 'Commanders', conference: 'NFC', division: 'East', logo: 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/WAS' }
    ]
  }
};

/**
 * Get a preset team pool by its id.
 * @param {string} poolId
 * @returns {Object|null}
 */
export const getPresetTeamPoolById = (poolId) => {
  if (!poolId) return null;
  return PRESET_TEAM_POOLS[poolId] || null;
};

/**
 * Get a list of preset pools formatted for select inputs.
 * @returns {Array<{value: string, label: string, description: string}>}
 */
export const getPresetTeamPoolOptions = () => {
  return Object.values(PRESET_TEAM_POOLS).map(pool => ({
    value: pool.id.startsWith('preset-') ? pool.id : `preset-${pool.id}`,
    key: pool.id,
    label: pool.name,
    description: pool.description || ''
  }));
};

/**
 * Normalize a list of teams into the canonical structure.
 * @param {Array} teams
 * @returns {Array}
 */
export const normalizeTeams = (teams = []) => {
  if (!Array.isArray(teams)) return [];
  
  return teams
    .filter(Boolean)
    .map(team => ({
      id: team.id || team.key || `${team.city || ''} ${team.name || team.shortName || ''}`.trim().replace(/\s+/g, '_'),
      city: team.city || '',
      name: team.name || team.shortName || '',
      shortName: team.shortName || team.name || '',
      conference: team.conference || team.conf || '',
      division: team.division || team.div || '',
      logo: team.logo || team.logoUrl || team.image || '',
      metadata: team.metadata || {}
    }));
};

/**
 * Hydrate a team pool into a ready-to-store object.
 * @param {Object} pool
 * @param {string} scope
 * @returns {Object}
 */
export const hydrateTeamPool = (pool = {}, scope = 'custom') => {
  return {
    id: pool.id || `custom-${Date.now()}`,
    name: pool.name || 'Untitled Team Pool',
    description: pool.description || '',
    league: pool.league || 'Custom',
    season: pool.season || '',
    scope,
    teams: normalizeTeams(pool.teams),
    createdAt: pool.createdAt || new Date().toISOString(),
    createdBy: pool.createdBy || null,
    updatedAt: new Date().toISOString()
  };
};

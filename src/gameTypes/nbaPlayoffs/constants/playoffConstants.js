/**
 * Standard keys for playoff rounds - single source of truth
 */
export const ROUND_KEYS = {
  PLAY_IN: 'Play In Tournament',
  FIRST_ROUND: 'First Round',
  CONF_SEMIS: 'Conference Semifinals',
  CONF_FINALS: 'Conference Finals',
  NBA_FINALS: 'NBA Finals',
  FINALS_MVP: 'Finals MVP',
  CHAMPION: 'Champion'
};

/**
 * Play-In Tournament specific constants
 */
export const PLAY_IN_KEYS = {
  ENABLED: 'playInTournamentEnabled',
  COMPLETE: 'playInComplete',
  EAST_RESULTS: 'playInResultsEast',
  WEST_RESULTS: 'playInResultsWest',
  SEVENTH_EIGHTH_GAME: 'seventhEighthGame',
  NINTH_TENTH_GAME: 'ninthTenthGame',
  FINAL_PLAY_IN_GAME: 'finalPlayInGame'
};

/**
 * Human-readable display names for each round
 */
export const ROUND_DISPLAY_NAMES = {
  [ROUND_KEYS.PLAY_IN]: 'Play-In Tournament',
  [ROUND_KEYS.FIRST_ROUND]: 'First Round',
  [ROUND_KEYS.CONF_SEMIS]: 'Conference Semifinals',
  [ROUND_KEYS.CONF_FINALS]: 'Conference Finals',
  [ROUND_KEYS.NBA_FINALS]: 'NBA Finals',
  [ROUND_KEYS.FINALS_MVP]: 'Finals MVP',
  [ROUND_KEYS.CHAMPION]: 'Champion'
};

/**
 * Default point values for each round
 */
export const DEFAULT_POINT_VALUES = {
  [ROUND_KEYS.PLAY_IN]: 1,
  [ROUND_KEYS.FIRST_ROUND]: 1,
  [ROUND_KEYS.CONF_SEMIS]: 2,
  [ROUND_KEYS.CONF_FINALS]: 3,
  [ROUND_KEYS.NBA_FINALS]: 4,
  [ROUND_KEYS.FINALS_MVP]: 2.5,
  [ROUND_KEYS.CHAMPION]: 8
};

/**
 * Default series length bonus values for each round
 */
export const DEFAULT_SERIES_BONUS = {
  [ROUND_KEYS.FIRST_ROUND]: 0.5,
  [ROUND_KEYS.CONF_SEMIS]: 1,
  [ROUND_KEYS.CONF_FINALS]: 1.5,
  [ROUND_KEYS.NBA_FINALS]: 2
};

/**
 * Standard keys for series length bonus settings
 */
export const SERIES_LENGTH_KEYS = {
  [ROUND_KEYS.FIRST_ROUND]: 'seriesLengthFirstRound',
  [ROUND_KEYS.CONF_SEMIS]: 'seriesLengthConfSemis',
  [ROUND_KEYS.CONF_FINALS]: 'seriesLengthConfFinals',
  [ROUND_KEYS.NBA_FINALS]: 'seriesLengthNBAFinals'
};

// Game options for series length
export const SERIES_GAMES_OPTIONS = [4, 5, 6, 7];

// Default conference order
export const CONFERENCE_ORDER = ['East', 'West'];
/**
 * Standard keys for NFL playoff rounds
 */
export const ROUND_KEYS = {
  FIRST_ROUND: 'Wild Card Round',
  CONF_SEMIS: 'Divisional Round',
  CONF_FINALS: 'Conference Championships',
  SUPER_BOWL: 'Super Bowl',
  FINALS_MVP: 'Super Bowl MVP',
  CHAMPION: 'Champion'
};

/**
 * Human-readable display names for each round
 */
export const ROUND_DISPLAY_NAMES = {
  [ROUND_KEYS.FIRST_ROUND]: 'Wild Card Round',
  [ROUND_KEYS.CONF_SEMIS]: 'Divisional Round',
  [ROUND_KEYS.CONF_FINALS]: 'Conference Championships',
  [ROUND_KEYS.SUPER_BOWL]: 'Super Bowl',
  [ROUND_KEYS.FINALS_MVP]: 'Super Bowl MVP',
  [ROUND_KEYS.CHAMPION]: 'Champion'
};

/**
 * Default point values for each round
 */
export const DEFAULT_POINT_VALUES = {
  [ROUND_KEYS.FIRST_ROUND]: 4,
  [ROUND_KEYS.CONF_SEMIS]: 6,
  [ROUND_KEYS.CONF_FINALS]: 8,
  [ROUND_KEYS.SUPER_BOWL]: 12,
  [ROUND_KEYS.FINALS_MVP]: 5,
  [ROUND_KEYS.CHAMPION]: 10
};

/**
 * Series bonus keys (kept for compatibility, but NFL uses single games)
 */
export const SERIES_GAMES_OPTIONS = [1];

export const CONFERENCE_ORDER = ['AFC', 'NFC'];

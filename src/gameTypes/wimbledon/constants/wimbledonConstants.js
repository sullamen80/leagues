export const WIMBLEDON_GAME_TYPE_ID = 'wimbledon';
export const WIMBLEDON_SCHEMA_VERSION = 1;
export const WIMBLEDON_DRAW_SIZE = 128;
export const WIMBLEDON_LOCK_KEY = 'entry';

export const WIMBLEDON_ROUNDS = Object.freeze([
  { key: 'roundOf128', label: 'Round of 128', matchCount: 64, points: 1 },
  { key: 'roundOf64', label: 'Round of 64', matchCount: 32, points: 2 },
  { key: 'roundOf32', label: 'Round of 32', matchCount: 16, points: 4 },
  { key: 'roundOf16', label: 'Round of 16', matchCount: 8, points: 8 },
  { key: 'quarterfinals', label: 'Quarterfinals', matchCount: 4, points: 16 },
  { key: 'semifinals', label: 'Semifinals', matchCount: 2, points: 32 },
  { key: 'final', label: 'Final', matchCount: 1, points: 64 }
]);

export const WIMBLEDON_ROUND_LOOKUP = Object.freeze(
  Object.fromEntries(WIMBLEDON_ROUNDS.map((round) => [round.key, round]))
);

export const createDefaultWimbledonScoring = () => ({
  roundPoints: Object.fromEntries(WIMBLEDON_ROUNDS.map((round) => [round.key, round.points])),
  setPredictionEnabled: false,
  setPredictionsAsTiebreaker: true
});

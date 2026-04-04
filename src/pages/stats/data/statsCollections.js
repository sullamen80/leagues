import {
  CANONICAL_STATS_COLLECTIONS,
  CANONICAL_STATS_GAME_TYPE_IDS,
  isCanonicalBracketStatsGameType
} from '../../../gameTypes/common/stats';

export const STATS_ROOT_COLLECTION = 'gameStats';
export const STATS_ROOT_DOCUMENT = 'root';

export { CANONICAL_STATS_COLLECTIONS, CANONICAL_STATS_GAME_TYPE_IDS };

export const isCanonicalStatsGameType = (gameTypeId) => {
  return isCanonicalBracketStatsGameType(gameTypeId);
};

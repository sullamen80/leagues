import { normalizeDoubleSnakeConfig } from './draftConfig';
import { reconcileDraftOrder } from './participants';
import { DRAFT_STATUS, DEFAULT_AUCTION_BUDGET, DEFAULT_ROSTER_SETTINGS } from '../constants/winsPoolConstants';

const draftKeys = ['assignmentMode', 'useSnakeDraft', 'order', 'doubleSnakeConfig', 'auctionBudget'];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const mergeDraftSettings = (current, requested, league = null) => {
  const active = (current.draft?.status || DRAFT_STATUS.NOT_STARTED) !== DRAFT_STATUS.NOT_STARTED;
  const sameDraftSetting = (key) => {
    if (key === 'auctionBudget') return (current.draft?.[key] ?? DEFAULT_AUCTION_BUDGET) === (requested.draft?.[key] ?? DEFAULT_AUCTION_BUDGET);
    if (key === 'useSnakeDraft') return (current.draft?.[key] ?? true) === (requested.draft?.[key] ?? true);
    if (key === 'assignmentMode') return (current.draft?.[key] ?? DEFAULT_ROSTER_SETTINGS.assignmentMode) === (requested.draft?.[key] ?? DEFAULT_ROSTER_SETTINGS.assignmentMode);
    if (key === 'order' && league) return equal(reconcileDraftOrder(league, current.draft, current.rosterSettings), reconcileDraftOrder(league, requested.draft, requested.rosterSettings));
    if (key !== 'doubleSnakeConfig') return equal(current.draft?.[key], requested.draft?.[key]);
    return equal(normalizeDoubleSnakeConfig(current.draft?.[key], current.teamPool?.teams, current.rosterSettings?.rosterSize),
      normalizeDoubleSnakeConfig(requested.draft?.[key], requested.teamPool?.teams, requested.rosterSettings?.rosterSize));
  };
  if (active && (
    current.rosterSettings?.rosterSize !== requested.rosterSettings?.rosterSize ||
    draftKeys.some((key) => !sameDraftSetting(key)) ||
    current.teamPool?.id !== requested.teamPool?.id ||
    !equal(current.teamPool?.teams?.map((team) => team.id), requested.teamPool?.teams?.map((team) => team.id))
  )) throw new Error('Draft allocation is locked after starting. Reload settings or reset the draft before changing pools, quotas, or order.');
  const settings = Object.fromEntries(draftKeys.filter((key) => requested.draft?.[key] !== undefined).map((key) => [key, requested.draft[key]]));
  return {
    rosterSettings: requested.rosterSettings,
    scoring: requested.scoring,
    teamPool: active ? current.teamPool : requested.teamPool,
    draft: active ? { ...current.draft } : { ...current.draft, ...settings, poolAllocations: null }
  };
};

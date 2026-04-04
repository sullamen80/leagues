import { getMarchMadnessExpandedRenderer, getMarchMadnessLeaguePagePresentation } from './marchMadness';
import { getNBAPlayoffsExpandedRenderer, getNBAPlayoffsLeaguePagePresentation } from './nbaPlayoffs';
import { getNFLPlayoffsExpandedRenderer, getNFLPlayoffsLeaguePagePresentation } from './nflPlayoffs';

const fallbackPresentation = (gameTypeId = 'unknown', leagueDetail = {}) => ({
  gameTypeId,
  theme: 'slate',
  kicker: 'League story',
  title: 'League overview',
  subtitle: 'A compact narrative built from the canonical league detail payload.',
  chips: [
    { label: 'Players', value: leagueDetail?.playerCount || 0, tone: 'slate' },
    { label: 'Champion', value: leagueDetail?.highlights?.champion || 'TBD', tone: 'blue' }
  ],
  cards: [],
  storySections: []
});

const registry = {
  marchMadness: {
    getLeaguePagePresentation: getMarchMadnessLeaguePagePresentation,
    getLeagueExpandedRenderer: getMarchMadnessExpandedRenderer
  },
  nbaPlayoffs: {
    getLeaguePagePresentation: getNBAPlayoffsLeaguePagePresentation,
    getLeagueExpandedRenderer: getNBAPlayoffsExpandedRenderer
  },
  nflPlayoffs: {
    getLeaguePagePresentation: getNFLPlayoffsLeaguePagePresentation,
    getLeagueExpandedRenderer: getNFLPlayoffsExpandedRenderer
  }
};

export const getLeaguePagePresentation = (gameTypeId, leagueDetail = {}) => {
  const entry = registry[gameTypeId];
  if (!entry) {
    return fallbackPresentation(gameTypeId, leagueDetail);
  }

  return entry.getLeaguePagePresentation(leagueDetail);
};

export const getLeagueExpandedRenderer = (gameTypeId) => {
  const entry = registry[gameTypeId];
  return entry ? entry.getLeagueExpandedRenderer() : null;
};

export const getGameTypePresentation = getLeaguePagePresentation;
export const getGameTypeExpandedRenderer = getLeagueExpandedRenderer;

export default registry;


import { createStatsAdapter } from '../../common/stats';

export const statsAdapter = createStatsAdapter({
  gameTypeId: 'worldCup',
  getListBadge: () => ({
    label: 'World Cup',
    tone: 'emerald'
  })
});

export default statsAdapter;

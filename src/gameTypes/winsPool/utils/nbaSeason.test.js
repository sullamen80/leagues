import { isOlderNbaPlayerSnapshot } from './nbaSeason';

test('keeps 2025–26 stats out of the 2026–27 current view', () => {
  const october2026 = new Date(2026, 9, 2);

  expect(isOlderNbaPlayerSnapshot({ meta: { seasonYear: 2026 } }, october2026)).toBe(true);
  expect(isOlderNbaPlayerSnapshot({ meta: { seasonYear: 2027 } }, october2026)).toBe(false);
});

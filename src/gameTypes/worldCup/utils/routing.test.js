import { parseWorldCupSearch } from './routing';

test('parses the current World Cup view from the query string', () => {
  expect(parseWorldCupSearch('?view=admin&subview=settings')).toEqual({
    view: 'admin',
    subview: 'settings'
  });
});

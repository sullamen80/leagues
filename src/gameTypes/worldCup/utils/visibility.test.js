import { filterWorldCupEntries } from './visibility';

const entries = [
  { id: 'tournament', isOfficial: true },
  { userId: 'current-user', isCurrentUser: true },
  { userId: 'other-user' }
];

test('fog of war only exposes the official and current user entries', () => {
  expect(filterWorldCupEntries(entries, {
    fogOfWarEnabled: true,
    tournamentCompleted: false,
    currentUserId: 'current-user'
  })).toEqual(entries.slice(0, 2));
});

test('completed tournaments expose every entry', () => {
  expect(filterWorldCupEntries(entries, {
    fogOfWarEnabled: true,
    tournamentCompleted: true,
    currentUserId: 'current-user'
  })).toEqual(entries);
});

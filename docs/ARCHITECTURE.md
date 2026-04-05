# Architecture

## Purpose

This is the single working reference for making updates to the `leagues` codebase.

Use this file when you need to understand:

- how the app boots and builds
- how routing works
- where league lifecycle logic lives
- how game modules are structured
- how styling is organized
- where stats and admin flows live
- which files to check before making a change

Keep historical change notes out of this file. Use [ARCHITECTURE_LOG.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE_LOG.md) for that.

Documentation maintenance rule:

- If a code change alters the current architecture, ownership, routing, data shape, or cross-file contract, update this file in the same change.
- If the change also introduces historical context worth preserving, a new architectural decision, or a meaningful contract shift that future work will need explained, add an entry to [docs/ARCHITECTURE_LOG.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE_LOG.md) in the same change.

Related docs:

- Product/operational overview: [README.md](/Users/jonahsulla-menashe/Desktop/leagues/README.md)
- Change history: [docs/ARCHITECTURE_LOG.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE_LOG.md)

## How To Use This File

When you are about to change behavior, read in this order:

1. The relevant section in this file.
2. The route-level page or shared service named in that section.
3. The game module or admin/stats screen involved in the change.
4. [docs/ARCHITECTURE_LOG.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE_LOG.md) only if you need historical context.

This file is meant to answer "where does this live, what is the contract, and what else do I need to touch?" It is not meant to be a changelog.

Treat documentation updates as part of implementation, not cleanup to do later.

## Build And Run

Toolchain:

- React 19
- `react-scripts` / Create React App build pipeline
- React Router
- Firebase Auth + Firestore + Hosting
- Tailwind CSS

Primary config files:

- Build scripts and dependencies: [package.json](/Users/jonahsulla-menashe/Desktop/leagues/package.json)
- Firebase Hosting and Firestore rules wiring: [firebase.json](/Users/jonahsulla-menashe/Desktop/leagues/firebase.json)
- Tailwind config: [tailwind.config.js](/Users/jonahsulla-menashe/Desktop/leagues/tailwind.config.js)
- Firebase client bootstrap: [src/firebase.js](/Users/jonahsulla-menashe/Desktop/leagues/src/firebase.js)
- Env template: [.env.example](/Users/jonahsulla-menashe/Desktop/leagues/.env.example)

Core commands:

```bash
npm install
npm start
npm run build
npm test
```

Required runtime env vars:

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- Optional: `REACT_APP_FIREBASE_MEASUREMENT_ID`

Hosting detail:

- Firebase Hosting serves the compiled `build/` directory.
- Hosting rewrites all routes to `index.html`, so client routing must stay SPA-safe.

## System Map

Application entry points:

- React bootstrap: [src/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/index.js)
- App shell and routes: [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- Auth state: [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js)
- Firebase client services: [src/firebase.js](/Users/jonahsulla-menashe/Desktop/leagues/src/firebase.js)

Shared app shell:

- Layout: [src/components/ui/layout/MainLayout.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/ui/layout/MainLayout.js)
- Navigation: [src/components/ui/layout/TopNav.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/ui/layout/TopNav.js)
- Main content wrapper: [src/components/ui/layout/MainContent.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/ui/layout/MainContent.js)

High-level runtime flow:

```text
Browser
  -> src/index.js mounts BrowserRouter
  -> src/App.js mounts AuthProvider and route tree
  -> AuthContext loads Firebase auth + users/{uid}
  -> Protected pages render inside MainLayout
  -> League pages resolve a game module
  -> Module-specific dashboard/setup/admin UI renders
  -> Firestore documents/subcollections back the league state
```

## Project Structure

Top-level directories that matter for application work:

- `src/components/`
  Shared auth, common, and UI components.
- `src/contexts/`
  Global React context, currently auth-centric.
- `src/gameTypes/`
  Module system for each game type plus shared game infrastructure.
- `src/pages/`
  Route-level pages for auth, dashboard, leagues, stats, and user/admin views.
- `src/styles/`
  Shared styling tokens/helpers.
- `docs/`
  Architecture and documentation files.

Most important feature roots:

- League dashboard: [src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js)
- League creation: [src/pages/CreateLeague.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/CreateLeague.js)
- League join: [src/pages/leagues/LeagueJoin.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueJoin.js)
- League view router: [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js)
- Stats router: [src/pages/stats/StatsRouter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/StatsRouter.js)
- Profile/admin entry: [src/pages/user/ProfilePage.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/ProfilePage.js)

## Routing Model

Top-level route ownership:

- [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)

Public routes:

- `/login`
- `/reset-password`
- `/reset-password-confirm`

Protected routes:

- `/`
- `/dashboard`
- `/create-league`
- `/join-league`
- `/league/:leagueId/*`
- `/leagues/:leagueId/setup`
- `/stats/*`
- `/profile`

Important routing decision:

- Top-level page routing uses React Router.
- Inside league modules, navigation is still query-param driven rather than nested route trees.
- Treat query-param module routing as the current contract until there is an intentional cross-module route refactor.

Examples:

- League dashboard subviews use patterns like `?view=view`, `?view=edit`, `?view=admin&subview=settings`.
- Stats uses route params like `/stats/league/:id` and `/stats/user/:id`.

Files to check before changing routing:

- [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js)
- [src/gameTypes/common/BaseGameModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/BaseGameModule.js)
- The relevant game module file
- [src/pages/stats/StatsRouter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/StatsRouter.js) if stats URLs are involved

## Styling System

Styling layers:

1. Global CSS entry:
   [src/index.css](/Users/jonahsulla-menashe/Desktop/leagues/src/index.css)
2. Tailwind theme/config:
   [tailwind.config.js](/Users/jonahsulla-menashe/Desktop/leagues/tailwind.config.js)
3. Shared color/token helpers:
   [src/styles/tokens/colors.js](/Users/jonahsulla-menashe/Desktop/leagues/src/styles/tokens/colors.js)
4. Reusable UI components:
   `src/components/ui/`

Practical styling rules for this repo:

- Most page/component styling is inline Tailwind utility usage.
- Shared semantic color access commonly goes through `getColorClass(...)` from [src/styles/tokens/colors.js](/Users/jonahsulla-menashe/Desktop/leagues/src/styles/tokens/colors.js).
- Layout composition is centralized in `MainLayout`, `TopNav`, and `MainContent`.
- If you are changing global visual behavior, check both Tailwind config and the token helper, not just one component.

Files to check before changing styling:

- [src/index.css](/Users/jonahsulla-menashe/Desktop/leagues/src/index.css)
- [tailwind.config.js](/Users/jonahsulla-menashe/Desktop/leagues/tailwind.config.js)
- [src/styles/tokens/colors.js](/Users/jonahsulla-menashe/Desktop/leagues/src/styles/tokens/colors.js)
- The relevant file under `src/components/ui/`

## Auth And Admin

Primary auth files:

- Context/provider: [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js)
- Auth page: [src/pages/auth/AuthPage.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/auth/AuthPage.js)
- Password reset pages:
  [src/pages/auth/ResetPassword.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/auth/ResetPassword.js)
  [src/pages/auth/CompletePasswordReset.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/auth/CompletePasswordReset.js)

Current auth/admin behavior:

- `AuthContext` subscribes to Firebase Auth.
- It loads `users/{uid}` from Firestore.
- `isAdmin` is the canonical client-side admin flag.
- Firestore rules still tolerate legacy `admin` reads during migration compatibility.

Admin UI entry points:

- Profile page: [src/pages/user/ProfilePage.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/ProfilePage.js)
- Admin tabs: [src/pages/user/admin/AdminTabs.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/AdminTabs.js)
- Manage users: [src/pages/user/admin/ManageUsers.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/ManageUsers.js)
- Manage leagues: [src/pages/user/admin/ManageLeagues.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/ManageLeagues.js)
- Site settings: [src/pages/user/admin/SiteSettings.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/SiteSettings.js)
- Stats history: [src/pages/user/admin/StatsHistory.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/StatsHistory.js)

If you change auth or admin behavior, update together:

- [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js)
- [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)
- the relevant admin screen

## Firebase And Firestore

Primary files:

- Firebase client setup: [src/firebase.js](/Users/jonahsulla-menashe/Desktop/leagues/src/firebase.js)
- Security rules: [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)
- Hosting config: [firebase.json](/Users/jonahsulla-menashe/Desktop/leagues/firebase.json)

Top-level collections used by the app:

- `users`
- `leagues`
- `settings`
- `gameStats`
- `statsHistory`
- `leagueSecrets`

Important documents/subcollections:

- `users/{userId}`
- `leagues/{leagueId}`
- `leagues/{leagueId}/userData/{userId}`
- `leagues/{leagueId}/gameData/current`
- `leagues/{leagueId}/settings/*`
- `leagues/{leagueId}/locks/*`
- `leagues/{leagueId}/leaderboard/*`
- `leagues/{leagueId}/scores/*`
- `leagues/{leagueId}/joinRequests/{userId}`
- `leagueSecrets/{leagueId}`
- `settings/gameTypes`
- `settings/leagues`
- `gameStats/root/...`
- `statsHistory/{leagueKey}/...`

Security model summary:

- Signed-in users can read most app data.
- League owners/admins control most league writes.
- Password-protected joins use hashed secrets plus validated join requests.
- Security-sensitive schema changes must update both rules and client write paths.

## League Lifecycle

Shared lifecycle service:

- [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js)

Current lifecycle split:

Creation shell:

- [src/pages/CreateLeague.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/CreateLeague.js)
- `createLeague(...)` in [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js)

Setup completion:

- `LeagueSetupWrapper` in [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- `completeLeagueSetup(...)` in [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js)

Join flow:

- [src/pages/leagues/LeagueJoin.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueJoin.js)
- `joinLeague(...)` and `addUserToLeague(...)` in [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js)

View flow:

- [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js)

Important rule:

- If you change league schema, membership behavior, password joins, or owner/admin permissions, start in `leagueService.js` and `firestore.rules`, then verify the route-level pages still match.

## Game Module System

Registry and shared contract:

- Module registry: [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js)
- Base class: [src/gameTypes/common/BaseGameModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/BaseGameModule.js)
- Interface notes: [src/gameTypes/gameTypeInterface.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/gameTypeInterface.js)

Current modules:

- [src/gameTypes/marchMadness/MarchMadnessModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/marchMadness/MarchMadnessModule.js)
- [src/gameTypes/nbaPlayoffs/NBAPlayoffsModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/NBAPlayoffsModule.js)
- [src/gameTypes/nflPlayoffs/NFLPlayoffsModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nflPlayoffs/NFLPlayoffsModule.js)
- [src/gameTypes/winsPool/WinsPoolModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/winsPool/WinsPoolModule.js)
- [src/gameTypes/worldCup/WorldCupModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/WorldCupModule.js)

What a module is expected to provide:

- identity metadata: `id`, `name`, `description`, `icon`, `color`
- setup component: `getSetupComponent()`
- league route contract: `getParameterRoutes(baseUrl)`
- league initialization: `initializeLeague(leagueId, setupData)`
- embedded dashboard component: `getEmbeddedDashboardComponent()`
- optional admin/settings/leaderboard URL helpers
- optional user join hooks

Important module rule:

- Adding a new module is not just a folder drop. Register it in [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js), implement the module contract, and wire any custom stats/admin behavior.

If you add or change a game type, check:

1. The module file itself.
2. The registry in [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js).
3. Shared lifecycle support in [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js) if join/create/setup behavior differs.
4. Embedded dashboard behavior in [src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js).
5. The game type stats adapter under `src/gameTypes/<gameTypeId>/stats/adapter.js` if the mode participates in shared `/stats`.

## World Cup Mode

Primary files:

- Module and query-param router: [src/gameTypes/worldCup/WorldCupModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/WorldCupModule.js)
- Core data/scoring service: [src/gameTypes/worldCup/services/worldCupService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/services/worldCupService.js)
- User dashboard/editor: [src/gameTypes/worldCup/components/BracketDashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/BracketDashboard.js)
- Read-only entry viewer: [src/gameTypes/worldCup/components/BracketView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/BracketView.js)
- Leaderboard: [src/gameTypes/worldCup/components/Leaderboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/Leaderboard.js)
- Admin control room: [src/gameTypes/worldCup/components/AdminDashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/AdminDashboard.js)
- Admin settings/editor: [src/gameTypes/worldCup/components/AdminSettings.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/AdminSettings.js)
- Admin participants manager: [src/gameTypes/worldCup/components/AdminTeams.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/AdminTeams.js)
- Shared `/stats` adapter: [src/gameTypes/worldCup/stats/adapter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/stats/adapter.js)

Current runtime shape:

- World Cup is a two-phase tournament mode, not a single bracket-only flow.
- Player entries are split between `groupPicks` and `knockoutPicks` in `leagues/{leagueId}/userData/{userId}`.
- Official tournament state lives in `leagues/{leagueId}/gameData/current`.
- Scoring rules live in `leagues/{leagueId}/settings/scoring`.
- Stage locks live in `leagues/{leagueId}/locks/lockStatus`.
- The `groups` and `knockout` lock entries are the source of truth for whether each stage is open or locked to users.

Important stored fields in `gameData/current`:

- `edition`
- `groups[]` with `teams[]` and admin-managed `officialOrder`
- `knockoutRounds`
- `status`

Current setup and lifecycle:

- [src/gameTypes/worldCup/components/LeagueSetup.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/LeagueSetup.js) only collects the tournament edition up front.
- `initializeWorldCupLeague(...)` in [src/gameTypes/worldCup/services/worldCupService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/services/worldCupService.js) preloads the default 2026 groups, default scoring, default locks, and an owner entry.
- `onUserJoinLeague(...)` in [src/gameTypes/worldCup/WorldCupModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/WorldCupModule.js) ensures every joining user gets a seeded World Cup entry document.

Current view contract:

- Default user view is `?view=edit`.
- `?view=edit` renders the two-tab pick flow inside [src/gameTypes/worldCup/components/BracketDashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/BracketDashboard.js).
- The edit screen defaults to the stage that is currently open according to `locks/lockStatus`: `Groups` while group picks are open, then `Knockout` once the knockout stage is unlocked.
- User knockout editing is gated by the `knockout` lock only, not by `gameData.knockoutEnabled`.
- `?view=view&userId=<uid>` renders the read-only entry viewer for a specific user.
- The read-only viewer uses the same stage-selection rule, so `Groups` / `Knockout` defaults stay aligned with the admin locks.
- In user view, both stages now support inline compare popups:
  - group cards open `Your Pick` vs `Official Result` plus one rotating visible `Other Pick`
  - knockout matchup cards open the same compare pattern for the specific match
- Compare popups only rotate across entries that are visible under the current Fog of War rules.
- `?view=leaderboard` renders a single combined leaderboard across group-stage and knockout scoring.
- `?view=admin` renders the admin control room.
- `?view=admin&subview=settings` renders the detailed tournament editor.
- `?view=admin&subview=teams` renders league participant management.

Current admin split:

- [src/gameTypes/worldCup/components/AdminDashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/AdminDashboard.js) is the control room for high-level stats, lock visibility, export/end-league flow, and quick links into the World Cup admin surfaces.
- [src/gameTypes/worldCup/components/AdminSettings.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/AdminSettings.js) owns the actual tournament configuration in three top-level tabs:
  - `Team Setup`: internal split between group-slot assignment from the FIFA catalog and knockout seeding
  - `Team Results`: internal split between official group results and official knockout results
  - `Scoring`: point weights and score-bonus toggles
- [src/gameTypes/worldCup/components/AdminTeams.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/components/AdminTeams.js) manages league participants and World Cup entry completion state.

Scoring and leaderboard contract:

- Group scoring and knockout scoring are calculated separately in [src/gameTypes/worldCup/services/worldCupService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/services/worldCupService.js), then merged into one leaderboard total.
- Knockout picks are derived from the official Round of 32 plus user winners, so later-round slots depend on earlier picks/results.
- Knockout winner credit requires a complete score entry. A matching winner with no user-entered score is treated as incomplete and does not award leaderboard points or count as a correct pick.
- `fetchLeaderboardEntries(...)` in [src/gameTypes/worldCup/services/worldCupService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/services/worldCupService.js) is the scoreboard source of truth for the in-league leaderboard.
- `determineWorldCupLeagueWinners(...)` in [src/gameTypes/worldCup/services/worldCupService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/services/worldCupService.js) resolves league winners from that combined total.

If you change World Cup behavior, verify together:

1. [src/gameTypes/worldCup/WorldCupModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/WorldCupModule.js)
2. [src/gameTypes/worldCup/services/worldCupService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/services/worldCupService.js)
3. the relevant World Cup component under `src/gameTypes/worldCup/components/`
4. [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js) if query-param behavior changes
5. [src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js) if embedded dashboard behavior changes
6. [src/gameTypes/worldCup/stats/adapter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/stats/adapter.js) if shared `/stats` presentation changes

## Dashboard, League View, And Stats

Dashboard:

- Main dashboard page: [src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js)
- It loads user leagues, loads `settings/gameTypes`, and renders the embedded dashboard supplied by the active module.

League view:

- Route shell: [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js)
- It loads the league, resolves the game module, and mounts the module’s parameter router.

Stats:

- Router: [src/pages/stats/StatsRouter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/StatsRouter.js)
- Main stats page: [src/pages/stats/stats.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/stats.js)
- Canonical stats repository: [src/pages/stats/data/statsRepository.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/data/statsRepository.js)
- Shared canonical stats helpers: [src/gameTypes/common/stats/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/stats/index.js)
- Game-specific stats adapters:
  [src/gameTypes/marchMadness/stats/adapter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/marchMadness/stats/adapter.js)
  [src/gameTypes/nbaPlayoffs/stats/adapter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/stats/adapter.js)
  [src/gameTypes/nflPlayoffs/stats/adapter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nflPlayoffs/stats/adapter.js)
  [src/gameTypes/worldCup/stats/adapter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/worldCup/stats/adapter.js)
- Formatting helpers: [src/pages/stats/utils/statsFormatter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/utils/statsFormatter.js)
- One-off migration tooling:
  [scripts/statsMigration/backfillBracketStats.mjs](/Users/jonahsulla-menashe/Desktop/leagues/scripts/statsMigration/backfillBracketStats.mjs)
  [scripts/statsMigration/validateBracketStats.mjs](/Users/jonahsulla-menashe/Desktop/leagues/scripts/statsMigration/validateBracketStats.mjs)

Stats architecture split:

- Canonical shared `/stats` reads only:
  - `gameStats/root/leagueSummaries/{leagueId}`
  - `gameStats/root/leagueDetails/{leagueId}`
  - `gameStats/root/userSummaries/{userId}`
  - `gameStats/root/userDetails/{userId}`
- Legacy bracket source data is preserved under:
  - `gameStats/root/leagues/{leagueId}`
  - `gameStats/root/userStats/{userId}`
- Historical season snapshots are stored under `statsHistory/...`
- End-of-league writers live in `EndLeagueStatsService` files under each bracket game type plus [src/gameTypes/common/services/BaseEndLeagueStatsService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/BaseEndLeagueStatsService.js)
- Shared `/stats` resolves per-mode behavior through `getStatsAdapter(gameTypeId)` from [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js)
- `winsPool` is intentionally outside the canonical shared `/stats` reader path and still uses its existing history flow

If you change stat payloads, update both:

- the writer service
- the canonical repository/adapter contract
- the shared stats page only if the common contract changes

## NBA Playoffs Bracket UI

Current bracket ownership:

- Main bracket editor/controller: [src/gameTypes/nbaPlayoffs/components/BracketEditor.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketEditor.js)
- Desktop mirrored canvas and connector geometry: [src/gameTypes/nbaPlayoffs/components/BracketCanvas.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketCanvas.js)
- Matchup card and pick modal: [src/gameTypes/nbaPlayoffs/components/BracketMatchupCard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketMatchupCard.js)
- Read-only bracket view and export trigger: [src/gameTypes/nbaPlayoffs/components/BracketView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketView.js)
- Export-only SVG/PNG renderer: [src/gameTypes/nbaPlayoffs/export/bracketExportRenderer.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/export/bracketExportRenderer.js)
- NBA team identity normalization for bracket display: [src/gameTypes/nbaPlayoffs/utils/teamIdentity.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/utils/teamIdentity.js)
- Shared NBA team logo catalog reused from wins pool: [src/gameTypes/winsPool/constants/teamPools.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/winsPool/constants/teamPools.js)

Current interaction contract:

- The desktop bracket is intentionally minimal. Matchup cards are display-first, showing team identity and winner state rather than inline pick controls.
- Editing a series prediction happens through the matchup modal opened from [src/gameTypes/nbaPlayoffs/components/BracketMatchupCard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketMatchupCard.js), not by separate in-card winner/game selectors.
- The matchup summary surface is logo-first and name-first. It is allowed to fall back to initials if a remote logo cannot load.
- `BracketEditor` remains the state owner. `BracketMatchupCard` emits a completed series prediction through `onSubmitPrediction`, and `BracketEditor` writes that through `handleSeriesPrediction(...)`.
- The bracket view still coexists with the legacy rounds view inside [src/gameTypes/nbaPlayoffs/components/BracketEditor.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketEditor.js). If you change bracket interaction, verify you are not breaking the rounds path.

Design constraint:

- The bracket now uses the wins-pool NBA team catalog as the canonical display identity source for short names and logos. If you change team naming or logo behavior for the bracket, check both [src/gameTypes/nbaPlayoffs/utils/teamIdentity.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/utils/teamIdentity.js) and [src/gameTypes/winsPool/constants/teamPools.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/winsPool/constants/teamPools.js).
- NBA team logos for bracket rendering/export are now served from same-origin static assets under `public/images/nba-logos/` via the wins-pool team catalog, rather than fetching third-party logo URLs at render time.

Export contract:

- The user-facing PNG button is owned by [src/gameTypes/nbaPlayoffs/components/BracketView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketView.js), but it no longer screenshots the live DOM.
- PNG export now runs through [src/gameTypes/nbaPlayoffs/export/bracketExportRenderer.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/export/bracketExportRenderer.js), which builds a dedicated landscape SVG from bracket data and then rasterizes that SVG to PNG.
- The export renderer intentionally reuses the bracket canvas geometry constants instead of cloning `BracketEditor` markup. If you change mirrored bracket spacing, finals presentation, games-label placement, or champion layout, update both the live bracket surface and the export renderer together.
- The export renderer is a separate presentation surface from `BracketCanvas`. It is allowed to diverge slightly from the live interactive UI when needed for deterministic image output, but it should preserve matchup ordering, winner state, logos, and round metadata.

## Visual Regression Harness

NBA playoffs bracket visual checks are browser-based, not jsdom-based.

- Visual harness route entry: [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- Harness page and scenarios: [src/testing/visual/NBAPlayoffsBracketHarness.js](/Users/jonahsulla-menashe/Desktop/leagues/src/testing/visual/NBAPlayoffsBracketHarness.js)
- Playwright config: [playwright.config.js](/Users/jonahsulla-menashe/Desktop/leagues/playwright.config.js)
- Screenshot spec: [tests/visual/nba-playoffs-bracket.spec.js](/Users/jonahsulla-menashe/Desktop/leagues/tests/visual/nba-playoffs-bracket.spec.js)
- Snapshot baselines: `tests/visual/nba-playoffs-bracket.spec.js-snapshots/`

Visual harness contract:

- The app exposes a special unauthenticated route family under `/__visual-tests/...` only for deterministic visual scenarios.
- The harness renders fixture-backed bracket states for at least `default`, `locked`, and `long-names`.
- Visual assertions should prefer the harness frame or full-page screenshots in Playwright. Do not treat Jest/jsdom tests as authoritative layout validation for the bracket.
- When you intentionally change bracket appearance, update the snapshots with `npm run test:visual:update` and review the resulting images before treating the new baseline as correct.

## Update Playbook

If you are changing:

Routing:

- [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js)
- [src/gameTypes/common/BaseGameModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/BaseGameModule.js)
- the specific module file
- the visual harness route in [src/testing/visual/NBAPlayoffsBracketHarness.js](/Users/jonahsulla-menashe/Desktop/leagues/src/testing/visual/NBAPlayoffsBracketHarness.js) if the change affects browser-based regression coverage

League lifecycle:

- [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js)
- [src/pages/CreateLeague.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/CreateLeague.js)
- [src/pages/leagues/LeagueJoin.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueJoin.js)
- [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)

Game modules:

- [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js)
- [src/gameTypes/common/BaseGameModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/BaseGameModule.js)
- the specific module folder
- [src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js)
- the mode adapter if shared `/stats` behavior is changing

Styling/layout:

- [src/index.css](/Users/jonahsulla-menashe/Desktop/leagues/src/index.css)
- [tailwind.config.js](/Users/jonahsulla-menashe/Desktop/leagues/tailwind.config.js)
- [src/styles/tokens/colors.js](/Users/jonahsulla-menashe/Desktop/leagues/src/styles/tokens/colors.js)
- the relevant UI/layout component

NBA playoffs bracket UI:

- [src/gameTypes/nbaPlayoffs/components/BracketEditor.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketEditor.js)
- [src/gameTypes/nbaPlayoffs/components/BracketCanvas.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketCanvas.js)
- [src/gameTypes/nbaPlayoffs/components/BracketMatchupCard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/components/BracketMatchupCard.js)
- [src/gameTypes/nbaPlayoffs/utils/teamIdentity.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/utils/teamIdentity.js)
- [src/gameTypes/winsPool/constants/teamPools.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/winsPool/constants/teamPools.js) if display names or logos are involved
- [tests/visual/nba-playoffs-bracket.spec.js](/Users/jonahsulla-menashe/Desktop/leagues/tests/visual/nba-playoffs-bracket.spec.js) and its snapshot directory if the visual surface changes

Auth/admin/security:

- [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js)
- [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)
- the relevant admin page

Stats:

- [src/gameTypes/common/stats/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/stats/index.js)
- [src/gameTypes/common/services/BaseEndLeagueStatsService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/BaseEndLeagueStatsService.js)
- the relevant game-type `EndLeagueStatsService`
- the relevant game-type `stats/adapter.js`
- [src/pages/stats/data/statsRepository.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/data/statsRepository.js)
- [src/pages/stats/stats.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/stats.js)
- [src/pages/user/admin/StatsHistory.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/StatsHistory.js) if history data changes

## Source Of Truth

When the docs disagree, trust the code first, then this file, then the README. If this file is missing a contract or a file path you needed during implementation, update it as part of the same change. If the change should be cataloged for future historical context, add the corresponding note to [docs/ARCHITECTURE_LOG.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE_LOG.md) as part of that same change. When you need historical context for why something changed, check [docs/ARCHITECTURE_LOG.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE_LOG.md).

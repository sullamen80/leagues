# Architecture

## Purpose

This document is the working architecture reference for the current `leagues` codebase. It is based on the implementation in `src/`, Firebase configuration, and Firestore rules rather than on the older README description.

Use this file before making changes that affect routing, league lifecycle, game modules, stats, or Firestore data shape.

## Audit Summary

The codebase has a real modular structure, but it has drifted from the README and has several maintenance risks:

1. The README is outdated. It describes a smaller system and misses active areas such as `winsPool`, NFL Playoffs, admin tooling, and the current stats/history flows.
2. Firebase configuration is hardcoded in [src/firebase.js](/Users/jonahsulla-menashe/Desktop/leagues/src/firebase.js) even though the README describes env-based configuration.
3. The repo snapshot includes generated or non-source directories like `build/`, `dist/`, `downloaded-site/`, plus a stray [src/pages/Dashboard copy.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard%20copy.js).
4. Admin identity is not fully normalized. Firestore rules accept both `admin` and `isAdmin`, but [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js) only reads `admin`.
5. Game type IDs are inconsistent. The registry key is `nbaBracket`, while the NBA module identifies itself as `nbaPlayoffs`, and several callers carry compatibility logic for both names.
6. Shared league behavior exists in [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js), but core pages like [src/pages/CreateLeague.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/CreateLeague.js) and [src/pages/leagues/LeagueJoin.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueJoin.js) bypass it and write directly to Firestore.
7. Route handling is partly framework-native and partly custom query-param routing. Updates need to preserve both layers.

## System Overview

This is a client-rendered React app deployed to Firebase Hosting with Firebase Auth and Firestore as the backend.

High-level flow:

```text
Browser
  -> React entry point
  -> AuthProvider establishes Firebase auth session
  -> App routes gate access to protected pages
  -> League and stats pages load Firestore documents directly
  -> Game-type modules decide which dashboard/setup/admin UI to render
  -> Firebase Hosting rewrites all routes to index.html
```

Primary implementation anchors:

- App bootstrap: [src/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/index.js)
- Route composition: [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- Auth state: [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js)
- Firebase client setup: [src/firebase.js](/Users/jonahsulla-menashe/Desktop/leagues/src/firebase.js)
- Firestore rules: [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)
- Hosting config: [firebase.json](/Users/jonahsulla-menashe/Desktop/leagues/firebase.json)

## Runtime Architecture

### 1. App Shell and Routing

[src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js) owns the top-level route tree.

Public routes:

- `/login`
- `/reset-password`
- `/reset-password-confirm`

Protected routes:

- `/` and `/dashboard`
- `/create-league`
- `/join-league`
- `/league/:leagueId/*`
- `/leagues/:leagueId/setup`
- `/stats/*`
- `/profile`

Important detail:

- Route protection is implemented inline inside `App.js`.
- There is also an unused [src/components/auth/ProtectedRoute.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/auth/ProtectedRoute.js) with a stale `isSuperuser` contract. Do not assume that file is the active auth gate.

### 2. Layout Layer

The shared shell is:

- [src/components/ui/layout/MainLayout.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/ui/layout/MainLayout.js)
- [src/components/ui/layout/TopNav.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/ui/layout/TopNav.js)
- [src/components/ui/layout/MainContent.js](/Users/jonahsulla-menashe/Desktop/leagues/src/components/ui/layout/MainContent.js)

Current navigation is intentionally small:

- Dashboard
- Stats
- Profile via user menu

Admin tooling is not a top-level nav item. It is embedded inside the profile page.

### 3. Auth and User Context

[src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js) is the shared auth state layer.

It does three things:

1. Subscribes to Firebase Auth with `onAuthStateChanged`.
2. Loads the signed-in user's Firestore document from `users/{uid}`.
3. Exposes `currentUser`, `userData`, `isAdmin`, `loading`, `logout`, and `resetPassword`.

Current caveat:

- `isAdmin` is derived from `userDocData.admin === true`.
- Firestore rules allow both `admin` and `isAdmin`.
- Any admin-role change should update both the rules and the React context together.

### 4. League Lifecycle

League creation and usage span several files.

Creation:

- [src/pages/CreateLeague.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/CreateLeague.js) creates a base `leagues/{leagueId}` document.
- It also updates `users/{uid}.leagueIds`.
- After creation it routes to `/leagues/:leagueId/setup`.

Setup:

- `LeagueSetupWrapper` inside [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js) loads the league document.
- It resolves the correct module setup component via `getGameTypeModule(gameTypeId)`.
- It updates shared league fields like `title`, `description`, privacy flags, and `setupCompleted`.
- It then calls `gameTypeModule.initializeLeague(leagueId, setupData)`.

Join:

- [src/pages/leagues/LeagueJoin.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueJoin.js) queries leagues directly, handles password-protected joins, updates league membership arrays, updates the user document, and optionally calls module join hooks.

View:

- [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js) loads the league document, resolves the game module, and mounts the module's parameter router.

Shared service:

- [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js) defines generic create/join/remove behavior, but the UI layer does not consistently use it.

Implication:

- When changing league schema or membership behavior, update both the shared service and the pages that still write directly to Firestore.

### 5. Game Type Module System

The game-type system is the main extension mechanism for the app.

Registry:

- [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js)

Base contract:

- [src/gameTypes/common/BaseGameModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/BaseGameModule.js)
- [src/gameTypes/gameTypeInterface.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/gameTypeInterface.js)

Current active modules in the registry:

- March Madness
- NBA Playoffs
- NFL Playoffs
- Wins Pool

Each module is a class that usually provides:

- Metadata: `id`, `name`, `description`, `icon`, `color`
- `getRoutes(baseUrl)`
- `getParameterRoutes(baseUrl)`
- `getSetupComponent()`
- Optional settings/admin URL helpers
- `initializeLeague(leagueId, setupData)`
- Optional join hooks such as `onUserJoin` or `onUserJoinLeague`

Current module files:

- [src/gameTypes/marchMadness/MarchMadnessModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/marchMadness/MarchMadnessModule.js)
- [src/gameTypes/nbaPlayoffs/NBAPlayoffsModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nbaPlayoffs/NBAPlayoffsModule.js)
- [src/gameTypes/nflPlayoffs/NFLPlayoffsModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/nflPlayoffs/NFLPlayoffsModule.js)
- [src/gameTypes/winsPool/WinsPoolModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/winsPool/WinsPoolModule.js)

Important implementation detail:

- League pages do not use nested React Router routes inside each game.
- Instead, each module usually exposes a custom router keyed off query params like `?view=edit` or `?view=admin&subview=settings`.

That means module updates usually belong in two places:

1. The module class and its URL helper methods.
2. The dashboard/admin components that interpret `urlParams`.

### 6. Dashboard Architecture

[src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js) is not a thin launcher. It has its own orchestration logic.

It:

- Loads user leagues via `getUserLeagues`
- Loads game-type settings from `settings/gameTypes`
- Fetches the selected league document directly
- Selects a module-specific dashboard component
- Clears session storage keys during league switches

Current coupling to note:

- The dashboard knows about individual game types directly through imports.
- It also includes compatibility handling for both `nbaBracket` and `nbaPlayoffs`.

If you add a new game type, the registry change alone is not enough. The dashboard also needs explicit support unless you refactor it to be module-driven.

### 7. Profile and Admin Architecture

[src/pages/user/ProfilePage.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/ProfilePage.js) serves two roles:

- User profile management
- Entry point for admin tools

Admin tabs live in:

- [src/pages/user/admin/AdminTabs.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/AdminTabs.js)

Current admin sections include:

- User management
- League management
- Site settings
- Stats history

Key admin files:

- [src/pages/user/admin/ManageUsers.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/ManageUsers.js)
- [src/pages/user/admin/ManageLeagues.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/ManageLeagues.js)
- [src/pages/user/admin/SiteSettings.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/SiteSettings.js)
- [src/pages/user/admin/StatsHistory.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/StatsHistory.js)

Operational note:

- Some admin screens do manual Firestore cleanup and batch deletion.
- Any change to subcollection names or league schema should be reflected in admin deletion/archive logic.

### 8. Stats Architecture

There are two separate stats concepts in the codebase.

League and user aggregate stats UI:

- [src/pages/stats/StatsRouter.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/StatsRouter.js)
- [src/pages/stats/stats.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/stats.js)
- [src/pages/stats/components/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/components/gameTypes/index.js)

End-of-league aggregation:

- [src/gameTypes/common/services/BaseEndLeagueStatsService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/BaseEndLeagueStatsService.js)
- Game-specific `EndLeagueStatsService.js` files inside each module

Historical standings for season-long data:

- [src/pages/user/admin/StatsHistory.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/StatsHistory.js)
- [src/gameTypes/winsPool/services/statsHistoryService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/winsPool/services/statsHistoryService.js)

Storage split:

- Aggregated league and user stats are under `gameStats/root/...`
- Historical snapshots are under `statsHistory/...`

When changing stat payloads, update both:

- The service that writes the documents
- The stats UI that reads and formats them

## Firestore Data Shape

This is the current practical model inferred from the code.

Top-level collections:

- `users`
- `leagues`
- `settings`
- `gameStats`
- `statsHistory`

### `users/{userId}`

Common fields used in the app:

- `username`
- `displayName`
- `email`
- `photoURL`
- `leagueIds`
- `admin` and sometimes `isAdmin`

### `leagues/{leagueId}`

Common fields used in the app:

- `leagueId`
- `title`
- `description`
- `gameTypeId`
- `gameType`
- `ownerId`
- `ownerName`
- `createdBy`
- `members`
- `users`
- `private`
- `passwordProtected`
- `password`
- `setupCompleted`
- `createdAt`
- `updatedAt`
- `archivedAt`

Observed league subcollections:

- `userData`
- `gameData`
- `settings`
- `locks`
- `scores`
- `leaderboard`
- `bracketTemplate`

Not every game type uses every subcollection, but admin cleanup assumes a fixed list.

### `settings/{docId}`

Known settings documents:

- `settings/gameTypes`
- `settings/leagues`

### `gameStats/root/...`

Used by the aggregate stats system:

- `gameStats/root/leagues/{statsDoc}`
- `gameStats/root/userStats/{userStatsDoc}`

### `statsHistory/{leagueKey}/...`

Used by the season snapshot archive flow, currently tied to wins-pool historical data tooling.

## Security Model

Security is enforced in [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules).

Important rules:

- Signed-in users can read most application documents.
- Admins can manage global settings and stats collections.
- League owners or admins can write most league-scoped subcollections.
- Members can read league subcollections.
- There is custom join logic that allows limited member-array updates on public, non-password-protected leagues.

Current risk areas:

- The UI stores league passwords directly in Firestore.
- App code performs many direct document writes from the client.
- Admin field naming is inconsistent between rules and React state.

Any security-sensitive schema change should update:

1. Firestore rules
2. The client writer code
3. The admin screens

## Update Playbook

### If you are changing routing

Check these files first:

- [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- [src/pages/leagues/LeagueView.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueView.js)
- [src/gameTypes/common/BaseGameModule.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/BaseGameModule.js)
- The specific game module file

Preserve query-param routing unless you are intentionally replacing the module navigation model.

### If you are changing auth or admin behavior

Check these files first:

- [src/contexts/AuthContext.js](/Users/jonahsulla-menashe/Desktop/leagues/src/contexts/AuthContext.js)
- [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)
- [src/pages/user/ProfilePage.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/ProfilePage.js)
- [src/pages/user/admin/AdminTabs.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/AdminTabs.js)

Normalize `admin` versus `isAdmin` before building more admin features on top.

### If you are changing league creation or membership

Check these files first:

- [src/pages/CreateLeague.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/CreateLeague.js)
- [src/pages/leagues/LeagueJoin.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/leagues/LeagueJoin.js)
- [src/gameTypes/common/services/leagueService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/leagueService.js)
- [src/App.js](/Users/jonahsulla-menashe/Desktop/leagues/src/App.js)
- [firestore.rules](/Users/jonahsulla-menashe/Desktop/leagues/firestore.rules)

Do not update only one path. The app currently has duplicated league lifecycle logic.

### If you are adding or updating a game type

Minimum checklist:

1. Add or update the module in `src/gameTypes/<gameType>/`.
2. Register it in [src/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/index.js).
3. Make sure `getSetupComponent()` and `initializeLeague()` are implemented.
4. Add dashboard support if [src/pages/Dashboard.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard.js) still needs explicit imports.
5. Add stats renderers in [src/pages/stats/components/gameTypes/index.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/components/gameTypes/index.js) if the game has custom stats.
6. Verify admin settings and cleanup flows if the module creates new subcollections.

Before adding another game type, decide whether to keep the current pattern or refactor toward a stricter module contract. The current system is flexible, but not fully centralized.

### If you are changing stat schemas

Check these files first:

- The relevant `EndLeagueStatsService`
- [src/gameTypes/common/services/BaseEndLeagueStatsService.js](/Users/jonahsulla-menashe/Desktop/leagues/src/gameTypes/common/services/BaseEndLeagueStatsService.js)
- [src/pages/stats/stats.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/stats/stats.js)
- The game-type stats renderer
- [src/pages/user/admin/StatsHistory.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/user/admin/StatsHistory.js) if the change affects historical snapshots

### If you are cleaning the repo

Candidate cleanup targets:

- `build/`
- `dist/`
- `downloaded-site/`
- [src/pages/Dashboard copy.js](/Users/jonahsulla-menashe/Desktop/leagues/src/pages/Dashboard%20copy.js)

Only remove them deliberately after confirming they are not being used as deployment or recovery artifacts outside this snapshot.

## Recommended Near-Term Cleanup

These are the highest-value structural improvements for safer future updates:

1. Move Firebase config to environment variables and keep production values out of source files.
2. Normalize admin flags to one field name across rules, UI, and stored user documents.
3. Normalize the NBA game type ID to one canonical value.
4. Pick one league lifecycle path and migrate callers to it.
5. Remove generated artifacts and duplicate source files from the repo snapshot.
6. Decide whether module navigation should stay query-param based or move to nested route definitions.

## Source of Truth

When this document and the README disagree, trust the code and this document, then update the README afterward.

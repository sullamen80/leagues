# Architecture Log

Historical change notes for the `leagues` codebase live here.

Use [ARCHITECTURE.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE.md) for the current system map and implementation guide. Use this file only when you need historical context for why a change was made.

## 2026-10-14

- Enabled Wins Pool members to draft only for themselves on their selected pool's active turn, while keeping commissioner “Draft for…” controls exclusive to owner/admin. Added commissioner-published schedules and narrowly scoped Firestore validation for atomic pick/roster writes, preserving independent pool queues, balanced quotas, and on-behalf drafting. Existing active drafts prepare member access on a commissioner visit without resetting picks. Added real-emulator permission and complete-draft coverage.

## 2026-10-13

- Aligned the Wins Pool draft team list with the selected season's records and sorting, using one display projection for both list and detail cards. Added loading/missing-data handling to avoid showing current-season records while browsing history.

- Replaced Wins Pool's shared alternating-pool turn order with two independent opposite-start snake queues. Both screens now expose separate clocks and pool selection; pick writes use per-pool stale-turn guards and complete only when both quotas are filled. Added per-pool rollback with atomic global/roster pick-number reconciliation, preserving existing picks and saved allocations.

- Fixed the Wins Pool user-lobby draft crash caused by intentionally null NBA player snapshots by sharing a null-safe stats normalizer. Added a two-pool console summary showing availability and the current manager's quotas without relaxing pick eligibility.

- Added balanced odd-roster allocation with persistent per-manager pool quotas/start pools, while retaining fixed quotas for legacy leagues and custom asymmetric pools. Verified complete six-manager, five-team drafts for both 15/15 balanced and 18/12 fixed catalogs. Fixed custom team restoration/grouping, active settings saves overwriting draft state, and missing global custom-pool permissions; global writes remain site-admin-only.

- Defined and corrected Wins Pool double snake as alternating pools per manager with reversed manager order each round. Shared turn eligibility and preview logic now enforce pool quotas/capacity and infer legacy pool metadata from team assignments. Added owner/admin drafting on behalf in the draft room, strict on-clock and stale-pick guards, committed console updates, and rollback/reset transaction fixes; ordinary member UI now reflects the existing commissioner-only write permissions.

- Unified Wins Pool participant reads around `ownerId` plus `members`, using one roster projection and shared live subscription. Missing roster documents now produce zero-point member rows, while orphan roster documents cannot inflate counts or reintroduce removed users.
- Reconciled saved draft sequences with current membership in both draft UIs and draft transactions, preserving sequence while appending missing members. Replaced the displayed leaderboard's saved-entry preference with live member-based scoring so joins, removals, and picks update rankings without a manual refresh.

## 2026-06-21

- Added the standalone `wimbledon` module with an event-agnostic 128-slot draw, permanent slot identity for entrant replacements, whole-bracket locking/reveal, optional set predictions used only as standings tie-breakers, manual draw import, audited post-lock admin corrections, sectioned bracket rendering, leaderboard scoring, and canonical league/user stats.
- Added a Wimbledon admin quick-fill action backed by a bundled 128-player active men's fixture, reusing the normal entrant import, draw revision, lock, and audit contracts.
- Aligned Wimbledon navigation and controls with the shared indigo card/button styling, added explicit return actions throughout admin, and replaced the section picker with one scrollable full-draw bracket canvas.
- Mirrored the Wimbledon draw into two 64-player sides that advance toward a centered championship match.
- Split Wimbledon bracket presentation into focused Round of 128, Round of 64, and Final 32 views; the Final 32 now follows the World Cup canvas treatment with fixed geometry, connectors, and a featured championship center.
- Added clickable Wimbledon leaderboard rows and View actions, while preserving the whole-bracket reveal rule for other participants' entries.
- Changed Wimbledon leaderboard row clicks to open round-by-round stat breakdown cards, hid set metrics when unused, and added User Picks / Official Results switching to read-only bracket view.
- Hardened league setup sequencing so `setupCompleted` is written only after game-module initialization succeeds.
- Added owner-scoped canonical stats writes through `_metadata.sourceLeagueId`, allowing league owners to archive leagues with usable stats without granting broad `gameStats` write access.
- Updated game-type creation to honor `settings/gameTypes` visibility, enabled state, and display order.

## 2026-03-28

- Completed the bracket stats architecture refactor. `marchMadness`, `nbaPlayoffs`, and `nflPlayoffs` now write canonical summary/detail docs under `gameStats/root/{leagueSummaries,leagueDetails,userSummaries,userDetails}`, shared `/stats` reads only those canonical docs through the stats repository plus game-type adapters, the old manual stats renderer registry was removed, legacy bracket source docs remain preserved for migration/rollback, and one-off backfill tooling now lives under `scripts/statsMigration/`.
- Completed admin-field normalization. `isAdmin` is now the canonical client-side admin field, while rules and admin tooling still tolerate legacy `admin` data during migration cleanup.
- Completed game type ID canonicalization. `nbaPlayoffs` is the canonical game type ID, with legacy `nbaBracket` values normalized in module resolution and stats views.
- Completed password-protection hardening for league joins. Raw passwords are no longer stored on league documents; hashed values now live in `leagueSecrets`, with validated join requests under each league.
- Completed league lifecycle consolidation. Create, setup, and join flows now run through the shared league service instead of multiple direct Firestore write paths.
- Completed README refresh and Firebase environment cleanup. Firebase web config now comes from `REACT_APP_FIREBASE_*` environment variables, with `.env.example` as the local template.
- Completed dead-code and generated-artifact cleanup. Removed duplicate dashboard/auth/game-type codepaths plus generated snapshot directories that were no longer part of the active app.
- Completed dashboard decoupling. Embedded league dashboard rendering now comes from the game module contract instead of hardcoded page-level branching.
- Recorded the routing decision to keep query-parameter module routing as the active league-view contract until a deliberate cross-module route refactor happens.

## 2026-04-03

- Added browser-based visual regression coverage for the NBA playoffs bracket. The app now exposes deterministic harness routes under `/__visual-tests/nba-playoffs-bracket/...`, the harness lives in `src/testing/visual/NBAPlayoffsBracketHarness.js`, and Playwright snapshot coverage now protects default, locked, mobile, and long-name bracket states.
- Refactored the NBA playoffs bracket toward a display-first interaction model. `BracketCanvas` owns the mirrored desktop bracket geometry and champion presentation, while `BracketMatchupCard` now uses a simplified matchup surface with a click-to-edit modal instead of inline pick controls.
- Standardized NBA bracket display identity on the wins-pool NBA team catalog. Bracket team name shortening and logo lookup now flow through `src/gameTypes/nbaPlayoffs/utils/teamIdentity.js`, which resolves canonical display names and logos from `src/gameTypes/winsPool/constants/teamPools.js`.
- Replaced the NBA playoffs PNG export pipeline with a dedicated export renderer. `src/gameTypes/nbaPlayoffs/components/BracketView.js` now routes the PNG button through `src/gameTypes/nbaPlayoffs/export/bracketExportRenderer.js`, which builds a fixed landscape SVG from bracket data and rasterizes that export surface instead of cloning live DOM through `foreignObject` or `html2canvas`. The export path also depends on same-origin NBA logo assets under `public/images/nba-logos/` so rendered logos stay stable in downloaded images.

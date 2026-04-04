# Architecture Log

Historical change notes for the `leagues` codebase live here.

Use [ARCHITECTURE.md](/Users/jonahsulla-menashe/Desktop/leagues/docs/ARCHITECTURE.md) for the current system map and implementation guide. Use this file only when you need historical context for why a change was made.

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

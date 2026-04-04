# Leagues

`leagues` is a React + Firebase app for running multi-game competition leagues. The current codebase supports bracket-style tournaments and a season-long wins pool, with league creation, join flows, owner/admin tooling, and aggregate stats/history views.

Use the docs this way:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the working codebase map. Open this when you are changing code.
- [docs/ARCHITECTURE_LOG.md](docs/ARCHITECTURE_LOG.md) is the change history. Open this when you need historical context.
- This README stays short and operational.

## Current Scope

Active game types in the repo:

- `marchMadness`
- `nbaPlayoffs`
- `nflPlayoffs`
- `winsPool`

Core product areas:

- Firebase Auth-backed login, signup, and password reset
- League creation, setup, join, and league-specific views
- Owner/admin controls inside the profile/admin area
- Aggregate stats pages plus wins-pool stats history tooling
- Firebase Hosting deployment with SPA rewrites

## Stack

- React 19
- React Router
- Firebase Auth
- Cloud Firestore
- Firebase Hosting
- Tailwind CSS
- Recharts

## Getting Started

Prerequisites:

- Node.js 18+ recommended
- npm
- A Firebase project with Auth, Firestore, and Hosting configured

Install:

```bash
npm install
```

Configure Firebase:

1. Copy `.env.example` to `.env.local`.
2. Fill in the Firebase web app values for your project.

Required variables:

```bash
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Run locally:

```bash
npm start
```

Build:

```bash
npm run build
```

## Firestore Notes

- Firestore security rules live in [firestore.rules](firestore.rules).
- Password-protected league joins now use hashed secrets and validated join requests rather than storing raw passwords on league documents.
- Global settings are stored under `settings/*`.

## Project Shape

```text
src/
  components/
    auth/
    common/
    ui/
  contexts/
    AuthContext.js
  gameTypes/
    common/
    marchMadness/
    nbaPlayoffs/
    nflPlayoffs/
    winsPool/
    gameTypeInterface.js
    index.js
  pages/
    auth/
    leagues/
    stats/
    user/
    CreateLeague.js
    Dashboard.js
    NotFound.js
  firebase.js
  App.js
docs/
  ARCHITECTURE.md
firebase.json
firestore.rules
```

## Architecture Notes

- Game types are registered in [src/gameTypes/index.js](src/gameTypes/index.js).
- League views use module-driven query-parameter routing such as `?view=edit` and `?view=admin&subview=settings`.
- The main dashboard is now module-driven for embedded league dashboards rather than manually hardcoding each game type in the page.
- Shared create/setup/join lifecycle logic lives in [src/gameTypes/common/services/leagueService.js](src/gameTypes/common/services/leagueService.js).
- Styling is mostly Tailwind utility driven, with shared color helpers in [src/styles/tokens/colors.js](src/styles/tokens/colors.js).

## Scripts

```bash
npm start
npm run build
npm test
```

## Deployment

The app is configured for Firebase Hosting in [firebase.json](firebase.json). Build first, then deploy with your normal Firebase workflow.

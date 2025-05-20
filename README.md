# Bracket Tournament Platform

A flexible, modern web application for creating and managing tournament brackets across multiple game types, including March Madness.

## 🏆 Features

- **Multi-Game Support**: Extensible architecture supporting various tournament formats
- **Real-Time Updates**: Live bracket updates and leaderboard changes
- **User Authentication**: Secure account management and protected routes
- **Responsive Design**: Optimized viewing experience across all devices
- **Customizable Tournaments**: Flexible settings for different tournament styles
- **Social Integration**: Share brackets and invite friends to leagues

## 🎮 Game Types

### 🏀 March Madness
- Complete NCAA tournament bracket creation and management
- Regional groupings with proper tournament flow
- Pick-based scoring system
- Visual bracket representation

### 🔮 Future Game Types (Coming Soon)
- NFL Playoff Brackets
- Soccer/Football Tournament Brackets
- Custom Tournament Builder

## 🚀 Getting Started

### Prerequisites
- Node.js 14.x or higher
- npm 6.x or higher
- Firebase account

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/bracket-tournament-platform.git
   cd bracket-tournament-platform
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure Firebase
   - Create a `.env.local` file in the root directory
   - Add your Firebase configuration
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

4. Start the development server
   ```bash
   npm start
   ```

## 📁 Project Structure

```
src/
├── assets/                                # Static assets
│   └── ...
│
├── components/                            # General application components
│   ├── auth/
│   │   └── ProtectedRoute.js
│   │
│   ├── common/
│   │   ├── Loading.js
│   │   └── ErrorDisplay.js
│   │
│   └── ui/                                # UI components
│       ├── layout/                        # Layout components
│       │   ├── MainContent.js
│       │   ├── MainLayout.js
│       │   └── TopNav.js
│       │
│       ├── navigation/                    # Navigation components
│       │   ├── MobileNavLink.js
│       │   ├── NavLink.js
│       │   └── UserMenu.js
│       │
│       ├── user/                          # User-related UI components
│       │   └── Avatar.js
│       │
│       └── feedback/                      # Feedback components
│           └── LoadingSpinner.js
│
├── contexts/
│   └── AuthContext.js
│
├── pages/
│   ├── auth/
│   │   ├── AuthPage.js
│   │   ├── ResetPassword.js
│   │   └── CompletePasswordReset.js
│   │
│   ├── leagues/
│   │   ├── LeagueView.js
│   │   └── LeagueJoin.js
│   │
│   ├── stats/                             # Statistics pages
│   │   ├── components/                    # Stats components
│   │   │   ├── common/
│   │   │   │   ├── StatCard.js
│   │   │   │   ├── StatsHeader.js
│   │   │   │   └── ViewToggle.js
│   │   │   │
│   │   │   ├── gameTypes/
│   │   │   │   ├── default/
│   │   │   │   │   └── ...
│   │   │   │   │
│   │   │   │   ├── marchMadness/
│   │   │   │   │   ├── MarchMadnessLeagueView.js
│   │   │   │   │   └── MarchMadnessUserView.js
│   │   │   │   │
│   │   │   │   ├── nbaPlayoffs/
│   │   │   │   │   ├── NBAPlayoffsLeagueView.js
│   │   │   │   │   └── NBAPlayoffsUserView.js
│   │   │   │   │
│   │   │   │   └── index.js               # Index file for game types
│   │   │   │
│   │   │   ├── visualizations/
│   │   │   │   ├── ComparisonChart.js
│   │   │   │   ├── DistributionChart.js
│   │   │   │   ├── LeaderboardTable.js
│   │   │   │   └── ProgressChart.js
│   │   │   │
│   │   │   ├── LeaguesTableView.js
│   │   │   ├── LeagueStatsViewShell.js
│   │   │   ├── UserTableView.js
│   │   │   └── UserStatsViewShell.js
│   │   │
│   │   ├── utils/
│   │   │   ├── schemaAnalyzer.js
│   │   │   └── statsFormatter.js
│   │   │
│   │   ├── stats.js
│   │   └── StatsRouter.js
│   │
│   ├── user/
│   │   ├── ProfilePage.js
│   │   └── admin/
│   │       ├── AdminTabs.js
│   │       ├── ManageUsers.js
│   │       ├── ManageLeagues.js
│   │       └── SiteSettings.js
│   │
│   ├── Dashboard.js
│   └── NotFound.js
│
├── styles/                                # Styling system
│   └── tokens/
│       └── colors.js
│
├── utils/                                 # Utility functions
│   └── formatters.js
│
├── gameTypes/                             # Game types system
│   ├── gameTypeRegistry.js
│   ├── gameTypeInterface.js
│   ├── index.js
│   │
│   ├── common/                            # Base components for all game types
│   │   ├── BaseGameModule.js
│   │   │
│   │   ├── components/
│   │   │   ├── BaseAdminDashboard.js
│   │   │   ├── BaseAdminParticipants.js
│   │   │   ├── BaseAdminSettings.js
│   │   │   ├── BaseDashboard.js
│   │   │   ├── BaseEditor.js
│   │   │   ├── BaseLeaderboard.js
│   │   │   ├── BaseLeagueSetup.js
│   │   │   ├── BaseMatchup.js
│   │   │   └── BaseView.js
│   │   │
│   │   └── services/
│   │       ├── BaseEndLeagueStatsService.js
│   │       ├── customScoringService.js
│   │       └── leagueService.js
│   │
│   ├── marchMadness/                      # March Madness specific implementation
│   │   ├── MarchMadnessModule.js          # Game type module - extends BaseGameModule
│   │   │
│   │   ├── components/
│   │   │   ├── BracketDashboard.js        # Uses BaseDashboard
│   │   │   ├── BracketView.js             # Views brackets
│   │   │   ├── BracketEdit.js             # Uses BaseEditor
│   │   │   ├── AdminDashboard.js          # Uses BaseAdminDashboard
│   │   │   ├── AdminSettings.js           # Settings page
│   │   │   ├── AdminStats.js              # Stats admin page
│   │   │   ├── AdminSettingsPanels/       # Sub-components for AdminSettings
│   │   │   │   ├── AdminTeamsPanel.js     # Team management panel
│   │   │   │   ├── AdminBracketPanel.js   # Bracket management panel
│   │   │   │   └── AdminAdvancedPanel.js  # Advanced settings panel
│   │   │   │
│   │   │   ├── LeagueSetup.js             # League setup component
│   │   │   ├── LeagueSettings.js          # League settings component
│   │   │   ├── Leaderboard.js             # Leaderboard component
│   │   │   ├── Matchup.js                 # Uses BaseMatchup
│   │   │   ├── Rules.js                   # Tournament rules component
│   │   │   └── TournamentIcon.js          # Icon component
│   │   │
│   │   ├── services/
│   │   │   ├── bracketService.js          # Bracket-specific services
│   │   │   ├── tournamentService.js       # Tournament-specific services
│   │   │   ├── scoringService.js          # Scoring-specific services
│   │   │   └── EndLeagueStatsService.js   # End of league stats service
│   │   │
│   │   ├── hooks/
│   │   │   ├── useBracket.js              # Custom hooks for bracket functionality
│   │   │   ├── useTournament.js           # Custom hooks for tournament data
│   │   │   └── useScoring.js              # Custom hooks for scoring system
│   │   │
│   │   └── utils/
│   │       └── bracketUtils.js            # Utility functions for brackets
│   │
│   ├── nbaPlayoffs/                       # NBA Playoffs specific implementation
│   │   ├── NBAPlayoffsModule.js           # Game type module - extends BaseGameModule
│   │   │
│   │   ├── components/                    # NBA Playoffs-specific components
│   │   │   ├── BracketEdit.js             # Main bracket editing component
│   │   │   ├── BracketEditor.js           # Bracket visualization component
│   │   │   ├── BracketView.js             # Bracket viewing component
│   │   │   ├── Leaderboard.js             # NBA Playoffs leaderboard
│   │   │   ├── LeagueSetup.js             # League setup for NBA Playoffs
│   │   │   ├── Matchup.js                 # Series matchup component
│   │   │   ├── MVPSelector.js             # Finals MVP selector component
│   │   │   ├── TournamentIcon.js          # Icon component for NBA Playoffs
│   │   │   ├── UserPlayInPanel.js         # User Play-In tournament interface
│   │   │   ├── AdminStats.js              # Stats admin page
│   │   │   │
│   │   │   ├── AdminSettings/             # Admin settings components
│   │   │   │   ├── AdminBracketPanel.js   # Bracket management panel
│   │   │   │   ├── AdminTeamsPanel.js     # Team management panel
│   │   │   │   ├── AdminPlayInPanel.js    # Play-In tournament panel
│   │   │   │   └── AdminAdvancedPanel.js  # Advanced settings panel
│   │   │   │
│   │   │   ├── AdminMVPManagement.js      # MVP candidate management
│   │   │   ├── AdminScoring.js            # Scoring settings administration
│   │   │   ├── AdminScoringSettings.js    # Extended scoring settings
│   │   │   ├── AdminTeams.js              # Team administration
│   │   │   └── AdminDashboard.js          # Admin dashboard component
│   │   │
│   │   ├── constants/
│   │   │   └── playoffConstants.js        # Constants for rounds, display names, etc.
│   │   │
│   │   ├── hooks/
│   │   │   ├── usePlayIn.js               # Hook for Play-In tournament
│   │   │   ├── usePlayoffs.js             # General playoffs hook
│   │   │   └── usePlayoffsBracket.js      # Bracket-specific hook
│   │   │
│   │   ├── services/
│   │   │   ├── bracketService.js          # Services for bracket operations
│   │   │   ├── playoffsService.js         # Playoffs-specific services
│   │   │   ├── scoringService.js          # Scoring calculations
│   │   │   └── EndLeagueStatsService.js   # End of league stats service
│   │   │
│   │   └── utils/
│   │       ├── bracketUtils.js            # Bracket utility functions
│   │       └── playoffsUtils.js           # General playoffs utilities
│   │
│   └── newGameTypes/                      # Directory for new game types
│
├── firebase.js
└── App.js
```

## 🔧 Technologies

- **Frontend**: React, React Router, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Cloud Functions)
- **State Management**: React Context API
- **Deployment**: Firebase Hosting

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 🙏 Acknowledgments

- Inspired by the excitement of tournament season
- Built with modern web technologies
- Created for sports fans everywhere

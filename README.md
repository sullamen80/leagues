# Bracket Tournament Platform

A flexible, modern web application for creating and managing tournament brackets across multiple game types, including March Madness.

![Bracket Tournament Platform Banner](https://via.placeholder.com/1200x300/4f46e5/ffffff?text=Bracket+Tournament+Platform)

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
├── components/                            # General application components
│   ├── auth/
│   │   └── ProtectedRoute.js
│   │
│   ├── common/
│   │   ├── Loading.js
│   │   └── ErrorDisplay.js
│   │
│   ├── Layout.js
│   └── CreateLeague.js                    # UPDATED: Added check for league creation block
│
├── contexts/
│   └── AuthContext.js                     # UPDATED: Added resetPassword function
│
├── pages/                                 # Application pages/routes
│   ├── auth/
│   │   ├── AuthPage.js                    
│   │   ├── ResetPassword.js               # Existing password reset request page
│   │   └── CompletePasswordReset.js       # NEW: Password reset confirmation page
│   │
│   ├── leagues/
│   │   ├── LeagueView.js
│   │   └── LeagueJoin.js
│   │
│   ├── user/
│   │   ├── ProfilePage.js                 # UPDATED: Added admin tabs functionality
│   │   └── admin/                         # NEW: Admin components folder
│   │       ├── AdminTabs.js               # NEW: Main tab manager component
│   │       ├── ManageUsers.js             # NEW: User management component
│   │       ├── ManageLeagues.js           # NEW: League management component
│   │       └── SiteSettings.js            # NEW: Site settings component
│   │
│   ├── Dashboard.js                       # UPDATED: Respects game type visibility settings
│   └── NotFound.js
│
├── gameTypes/                             # Game types system
│   ├── gameTypeRegistry.js                # Registry for all game types
│   ├── gameTypeInterface.js               # Interface definition for game types
│   ├── index.js
│   │
│   ├── common/                            # Base components for all game types
│   │   ├── BaseGameModule.js              # Base game module with core functionality
│   │   │
│   │   ├── components/
│   │   │   ├── BaseAdminDashboard.js      # Common admin dashboard functionality
│   │   │   ├── BaseAdminSettings.js       # Common admin settings functionality
│   │   │   ├── BaseDashboard.js           # Common tabbed interface
│   │   │   ├── BaseMatchup.js             # Generic matchup component
│   │   │   ├── BaseEditor.js              # Reusable entry editor
│   │   │   ├── BaseLeaderboard.js         # Common leaderboard functionality
│   │   │   ├── BaseAdminParticipants.js   # Common participant management
│   │   │   ├── BaseLeagueSetup.js         # Common league setup functionality
│   │   │   └── BaseView.js                # Common view component
│   │   │
│   │   └── services/
│   │       └── leagueService.js           # Shared services across game types
│   │
│   └── marchMadness/                      # March Madness specific implementation
│       ├── MarchMadnessModule.js          # Game type module - extends BaseGameModule
│       ├── index.js
│       │
│       ├── components/
│       │   ├── BracketDashboard.js        # Uses BaseDashboard
│       │   ├── BracketView.js             # Views brackets (needs refactoring)
│       │   ├── BracketEdit.js             # Uses BaseEditor
│       │   ├── AdminDashboard.js          # Uses BaseAdminDashboard
│       │   ├── AdminSettings.js           # Settings page (recently refactored)
│       │   ├── AdminSettingsPanels/       # Sub-components for AdminSettings
│       │   │   ├── AdminTeamsPanel.js     # Team management panel
│       │   │   ├── AdminBracketPanel.js   # Bracket management panel
│       │   │   └── AdminAdvancedPanel.js  # Advanced settings panel
│       │   │
│       │   ├── LeagueSetup.js
│       │   ├── LeagueSettings.js
│       │   ├── Leaderboard.js             # Leaderboard (needs refactoring)
│       │   ├── Matchup.js                 # Uses BaseMatchup
│       │   ├── Rules.js
│       │   └── TournamentIcon.js
│       │
│       ├── services/
│       │   ├── bracketService.js          # Bracket-specific services
│       │   ├── tournamentService.js       # Tournament-specific services
│       │   └── scoringService.js          # Scoring-specific services
│       │
│       ├── hooks/
│       │   ├── useBracket.js              # Custom hooks for bracket functionality
│       │   ├── useTournament.js           # Custom hooks for tournament data
│       │   └── useScoring.js              # Custom hooks for scoring system
│       │
│       └── utils/
│           └── bracketUtils.js            # Utility functions for brackets
│
├── firebase.js                            # Firebase configuration
└── App.js                                 # UPDATED: Added route for CompletePasswordReset
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

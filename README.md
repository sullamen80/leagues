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
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.js
│   │
│   ├── common/
│   │   ├── Loading.js
│   │   └── ErrorDisplay.js
│   │
│   ├── Layout.js
│   └── CreateLeague.js
│
├── contexts/
│   └── AuthCont

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

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the excitement of tournament season
- Built with modern web technologies
- Created for sports fans everywhere

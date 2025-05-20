import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getGameTypeModule } from './gameTypes';
import { LoadingSpinner } from './components/ui/feedback/LoadingSpinner';

// Import MainLayout from centralized UI component system
import { MainLayout } from './components/ui/layout/MainLayout';

// Auth pages
import AuthPage from './pages/auth/AuthPage';
import ResetPassword from './pages/auth/ResetPassword';
import CompletePasswordReset from './pages/auth/CompletePasswordReset';

// Main pages
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
// Import StatsRouter instead of Stats
import StatsRouter from './pages/stats/StatsRouter';

// League pages
import CreateLeague from './pages/CreateLeague';
import LeagueView from './pages/leagues/LeagueView';
import LeagueJoin from './pages/leagues/LeagueJoin';
import ProfilePage from './pages/user/ProfilePage';
import Loading from './components/common/Loading';
import ErrorDisplay from './components/common/ErrorDisplay';

// Define getSetupComponent locally
const getSetupComponent = (gameTypeId) => {
  const module = getGameTypeModule(gameTypeId);
  
  if (!module) {
    console.error(`Cannot get setup component: game type '${gameTypeId}' not found`);
    return null;
  }
  
  if (typeof module.getSetupComponent !== 'function') {
    console.error(`Game type '${gameTypeId}' does not have a getSetupComponent method`);
    return null;
  }
  
  return module.getSetupComponent();
};

/**
 * Component to dynamically load the appropriate setup component
 * based on the league's game type
 */
const LeagueSetupWrapper = () => {
  const { leagueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setupComponent, setSetupComponent] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadSetupComponent = async () => {
      if (!leagueId) {
        setError("League ID is required");
        setLoading(false);
        return;
      }

      try {
        // Fetch league data to get the game type
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found");
          setLoading(false);
          return;
        }

        const leagueData = leagueSnap.data();
        
        // Check if user is the league owner
        if (leagueData.ownerId !== currentUser?.uid) {
          setError("You don't have permission to set up this league");
          setLoading(false);
          return;
        }

        // Get the game type ID
        const gameTypeId = leagueData.gameTypeId;
        if (!gameTypeId) {
          setError("League doesn't have a game type specified");
          setLoading(false);
          return;
        }

        // Get the setup component from the registry
        const SetupComponent = getSetupComponent(gameTypeId);
        if (!SetupComponent) {
          setError(`Setup component not found for game type: ${gameTypeId}`);
          setLoading(false);
          return;
        }

        // Define the onCreateLeague function that will be passed to the setup component
        const onCreateLeague = async (setupData) => {
          try {
            // Update the league with the setup data
            const leagueRef = doc(db, "leagues", leagueId);
            
            // Prepare data for update
            const updateData = {
              title: setupData.title || leagueData.title,
              description: setupData.description || leagueData.description,
              private: setupData.private !== undefined ? setupData.private : leagueData.private,
              passwordProtected: setupData.passwordProtected || false,
              password: setupData.passwordProtected ? setupData.password : null,
              setupCompleted: true,
              updatedAt: new Date()
            };
            
            console.log("Updating league document with:", updateData);
            
            // Update the league document
            await updateDoc(leagueRef, updateData);
            
            // Call the game type's initialize method
            const gameTypeModule = getGameTypeModule(gameTypeId);
            if (gameTypeModule && typeof gameTypeModule.initializeLeague === 'function') {
              console.log("Initializing league game data");
              // Pass both the league ID and setup data to initializeLeague
              await gameTypeModule.initializeLeague(leagueId, setupData);
            } else {
              console.warn(`Game type ${gameTypeId} doesn't have an initializeLeague method`);
            }
            
            // Note the singular "league" path rather than "leagues"
            const leagueViewUrl = `/league/${leagueId}`;
            
            console.log("Setup complete. Attempting navigation to:", leagueViewUrl);
            
            // This ensures the success response gets back to the component
            const result = { 
              success: true, 
              leagueId: leagueId
            };
        
            // Use a very small delay to allow React to process the return
            setTimeout(() => {
              // Use window.location.href for most reliable navigation
              console.log("Navigating to:", leagueViewUrl);
              window.location.href = leagueViewUrl;
            }, 100);
            
            return result;
          } catch (error) {
            console.error("Error in onCreateLeague:", error);
            return { 
              success: false, 
              error: error.message || "Failed to create league"
            };
          }
        };

        // Pass both the currentUser and onCreateLeague function to the setup component
        setSetupComponent(() => (props) => (
          <SetupComponent 
            {...props} 
            leagueId={leagueId} 
            currentUser={currentUser} 
            onCreateLeague={onCreateLeague}
          />
        ));
        setLoading(false);
      } catch (err) {
        console.error("Error loading setup component:", err);
        setError(`Error loading setup component: ${err.message}`);
        setLoading(false);
      }
    };

    loadSetupComponent();
  }, [leagueId, currentUser, navigate]);

  if (loading) {
    return <Loading message="Loading league setup..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  if (!setupComponent) {
    return <ErrorDisplay message="Setup component not available" />;
  }

  const SetupComponent = setupComponent;
  return <SetupComponent />;
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner fullScreen />;
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner fullScreen />;
  }
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password-confirm" element={<CompletePasswordReset />} />

      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* Add new route for /dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/create-league" element={
        <ProtectedRoute>
          <MainLayout>
            <CreateLeague />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/join-league" element={
        <ProtectedRoute>
          <MainLayout>
            <LeagueJoin />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* League routes  */}
      <Route path="/league/:leagueId/*" element={
        <ProtectedRoute>
          <MainLayout>
            <LeagueView />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* Stats routes - now using StatsRouter */}
      <Route path="/stats/*" element={
        <ProtectedRoute>
          <MainLayout>
            <StatsRouter />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* Add explicit routes for type and id parameters */}
      <Route path="/stats/:type" element={
        <ProtectedRoute>
          <MainLayout>
            <StatsRouter />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/stats/:type/:id" element={
        <ProtectedRoute>
          <MainLayout>
            <StatsRouter />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* Setup route */}
      <Route path="/leagues/:leagueId/setup" element={
        <ProtectedRoute>
          <MainLayout>
            <LeagueSetupWrapper />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <MainLayout>
            <ProfilePage />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <MainLayout>
            <div>Settings Page (Coming Soon)</div>
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* Fallback route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
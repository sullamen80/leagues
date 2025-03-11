import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getGameTypeModule } from './gameTypes';


// Layout component
import Layout from './components/Layout';

// Auth pages
import AuthPage from './pages/auth/AuthPage';
import ResetPassword from './pages/auth/ResetPassword';

// Main pages
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

// League pages
import CreateLeague from './components/CreateLeague';
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
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
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
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Add new route for /dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/create-league" element={
        <ProtectedRoute>
          <Layout>
            <CreateLeague />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/join-league" element={
        <ProtectedRoute>
          <Layout>
            <LeagueJoin />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* League routes - make sure the path matches the navigation */}
      <Route path="/league/:leagueId/*" element={
        <ProtectedRoute>
          <Layout>
            <LeagueView />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Setup route */}
      <Route path="/leagues/:leagueId/setup" element={
        <ProtectedRoute>
          <Layout>
            <LeagueSetupWrapper />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout>
            <ProfilePage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout>
            <div>Settings Page (Coming Soon)</div>
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Fallback route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
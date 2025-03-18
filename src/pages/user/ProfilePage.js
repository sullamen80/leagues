import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import AdminTabs from './admin/AdminTabs';
import { 
  FaUser, 
  FaSave, 
  FaSpinner, 
  FaCheckCircle, 
  FaExclamationCircle,
  FaEdit,
  FaTrophy,
  FaMedal,
  FaHistory,
  FaArrowRight,
  FaBasketballBall,
  FaUserShield,
  FaUsers,
  FaLayerGroup,
  FaCog,
  FaChartLine,
  FaPlus
} from 'react-icons/fa';

// Helper function to generate initials from a name
const getInitials = (name) => {
  if (!name) return '?';
  
  // If it's an email, use the first character before the @ symbol
  if (name.includes('@')) {
    const firstPart = name.split('@')[0];
    return firstPart.charAt(0).toUpperCase();
  }
  
  // Otherwise, get initials from the name (up to 2 characters)
  const parts = name.split(' ').filter(part => part.length > 0);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  } else if (parts.length > 1) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  
  return '?';
};

// Generate a color based on a string
const generateColorFromString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 25%)`;
};

// Format date for display
const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown date';
  
  const date = timestamp.seconds 
    ? new Date(timestamp.seconds * 1000) 
    : new Date(timestamp);
    
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Status indicator component
const StatusIndicator = ({ status, activeLeagues }) => {
  if (status === 'admin') {
    return (
      <div className="px-3 py-1 bg-purple-700 rounded-full text-purple-100 text-xs font-medium flex items-center">
        <FaUserShield className="mr-1" /> Admin
      </div>
    );
  }
  
  if (activeLeagues > 0) {
    return (
      <div className="px-3 py-1 bg-green-700 rounded-full text-green-100 text-xs font-medium flex items-center">
        <FaBasketballBall className="mr-1" /> Active
      </div>
    );
  }
  
  return (
    <div className="px-3 py-1 bg-gray-600 rounded-full text-gray-200 text-xs font-medium">
      Member
    </div>
  );
};

const ProfilePage = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pastLeagues, setPastLeagues] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);
  const [trophies, setTrophies] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  
  // State for admin view
  const [isAdminView, setIsAdminView] = useState(false);
  
  // Toggle admin view
  const toggleAdminView = () => {
    setIsAdminView(!isAdminView);
  };
  
  // Admin stats
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalLeagues: 0,
    recentUsersCount: 0,
    activeUsersCount: 0
  });
  const [loadingAdminStats, setLoadingAdminStats] = useState(false);
  
  // Editable user data state
  const [editableData, setEditableData] = useState({
    username: '',
    displayName: '',
    bio: ''
  });
  
  // Load user data from Firestore
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserData(userData);
          setEditableData({
            username: userData.username || '',
            displayName: userData.displayName || '',
            bio: userData.bio || ''
          });
        } else {
          // User document doesn't exist yet
          const defaultData = {
            id: currentUser.uid,
            email: currentUser.email,
            username: currentUser.displayName || currentUser.email.split('@')[0],
            createdAt: new Date()
          };
          setUserData(defaultData);
          setEditableData({
            username: defaultData.username || '',
            displayName: defaultData.displayName || '',
            bio: ''
          });
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setError('Failed to load user profile');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, [currentUser]);
  
  // Load user's leagues and trophies
  useEffect(() => {
    const loadUserLeaguesAndTrophies = async () => {
      if (!currentUser) return;
      
      try {
        setLoadingLeagues(true);
        
        // Get user's leagues
        const userLeagueIds = userData?.leagueIds || [];
        if (userLeagueIds.length === 0) {
          setLoadingLeagues(false);
          return;
        }
        
        // Fetch all leagues the user is a member of
        const leaguesData = [];
        const trophiesData = [];
        
        for (const leagueId of userLeagueIds) {
          const leagueRef = doc(db, 'leagues', leagueId);
          const leagueSnap = await getDoc(leagueRef);
          
          if (leagueSnap.exists()) {
            const league = {
              id: leagueId,
              ...leagueSnap.data()
            };
            
            // Check if user has won any trophies in this league
            if (league.winners && Array.isArray(league.winners)) {
              const userWins = league.winners.filter(winner => 
                winner.userId === currentUser.uid || 
                winner.id === currentUser.uid
              );
              
              if (userWins.length > 0) {
                userWins.forEach(win => {
                  trophiesData.push({
                    ...win,
                    leagueId,
                    leagueTitle: league.title,
                    date: win.date || league.completedAt || null
                  });
                });
              }
            }
            
            // Separate active and archived leagues
            if (league.archivedAt) {
              leaguesData.push({...league, status: 'archived'});
            } else {
              leaguesData.push({...league, status: 'active'});
            }
          }
        }
        
        // Sort leagues by date (most recent first)
        const sortedLeagues = leaguesData.sort((a, b) => {
          const dateA = a.updatedAt || a.createdAt;
          const dateB = b.updatedAt || b.createdAt;
          
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          
          // Convert to milliseconds for comparison
          const timeA = dateA.seconds ? dateA.seconds * 1000 : dateA.getTime();
          const timeB = dateB.seconds ? dateB.seconds * 1000 : dateB.getTime();
          
          return timeB - timeA;
        });
        
        // Split into active and archived leagues
        setActiveLeagues(sortedLeagues.filter(league => league.status === 'active'));
        setPastLeagues(sortedLeagues.filter(league => league.status === 'archived'));
        
        // Sort trophies by date (most recent first)
        const sortedTrophies = trophiesData.sort((a, b) => {
          const dateA = a.date;
          const dateB = b.date;
          
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          
          // Convert to milliseconds for comparison
          const timeA = dateA.seconds ? dateA.seconds * 1000 : dateA.getTime();
          const timeB = dateB.seconds ? dateB.seconds * 1000 : dateB.getTime();
          
          return timeB - timeA;
        });
        
        setTrophies(sortedTrophies);
      } catch (err) {
        console.error('Error loading leagues and trophies:', err);
      } finally {
        setLoadingLeagues(false);
      }
    };
    
    if (userData) {
      loadUserLeaguesAndTrophies();
    }
  }, [currentUser, userData]);
  
  // Load admin stats if the user is an admin
  useEffect(() => {
    const loadAdminStats = async () => {
      if (!isAdmin) return;
      
      try {
        setLoadingAdminStats(true);
        
        // Get total number of users
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const totalUsers = usersSnapshot.size;
        
        // Get count of users created in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentUsersQuery = query(
          collection(db, 'users'),
          where('createdAt', '>=', thirtyDaysAgo)
        );
        const recentUsersSnapshot = await getDocs(recentUsersQuery);
        const recentUsersCount = recentUsersSnapshot.size;
        
        // Get total number of leagues
        const leaguesQuery = query(collection(db, 'leagues'));
        const leaguesSnapshot = await getDocs(leaguesQuery);
        const totalLeagues = leaguesSnapshot.size;
        
        // Active users is a simulated value for this demo
        const activeUsersCount = Math.floor(totalUsers * 0.75);
        
        setAdminStats({
          totalUsers,
          totalLeagues,
          recentUsersCount,
          activeUsersCount
        });
        
      } catch (err) {
        console.error('Error loading admin stats:', err);
      } finally {
        setLoadingAdminStats(false);
      }
    };
    
    if (isAdmin && userData) {
      loadAdminStats();
    }
  }, [isAdmin, userData]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableData({
      ...editableData,
      [name]: value
    });
  };
  
  // Save user profile changes
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Basic validation
      if (!editableData.username.trim()) {
        setError('Username is required');
        setIsSaving(false);
        return;
      }
      
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        username: editableData.username.trim(),
        displayName: editableData.displayName.trim() || null,
        bio: editableData.bio.trim() || null,
        updatedAt: new Date()
      });
      
      // Update local state
      setUserData({
        ...userData,
        ...editableData
      });
      
      setIsEditing(false);
      setSuccess('Profile updated successfully');
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to update profile: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Navigate to a league
  const handleViewLeague = (leagueId) => {
    navigate(`/league/${leagueId}`);
  };
  
  // Navigate to create a new league
  const handleCreateLeague = () => {
    navigate('/create-league');
  };
  
  // Get display name for avatar
  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.username) return userData.username;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email;
    return "User";
  };

  // For avatar color based on user id
  const avatarColor = currentUser ? generateColorFromString(currentUser.uid) : '#666';
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  // Render profile content
  const renderProfileContent = () => {
    return (
      <>
        {/* Trophy Case Section */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-800 mr-4">
                <FaTrophy className="text-yellow-400 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white">Trophy Case</h2>
            </div>
            
            {trophies.length > 0 && (
              <span className="text-gray-400 text-sm">
                {trophies.length} achievement{trophies.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {loadingLeagues ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
          ) : trophies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trophies.map((trophy, index) => (
                <div 
                  key={index} 
                  className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-yellow-500 transition cursor-pointer group"
                  onClick={() => handleViewLeague(trophy.leagueId)}
                >
                  <div className="flex items-center mb-2">
                    <FaMedal className="text-yellow-500 text-2xl mr-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold text-white">{trophy.title || "Champion"}</h3>
                  </div>
                  <p className="text-gray-300">{trophy.leagueTitle}</p>
                  {trophy.date && (
                    <p className="text-gray-400 text-sm mt-1">
                      {formatDate(trophy.date)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-700 p-6 rounded-lg text-center">
              <p className="text-gray-300">You haven't won any trophies yet.</p>
              <p className="text-gray-400 mt-2">Join leagues and compete to win!</p>
            </div>
          )}
        </div>
        
        {/* Active Leagues Section */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-900 mr-4">
                <FaBasketballBall className="text-blue-400 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white">Active Leagues</h2>
            </div>
            
            {activeLeagues.length > 0 && (
              <span className="text-gray-400 text-sm">
                {activeLeagues.length} league{activeLeagues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {loadingLeagues ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : activeLeagues.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeLeagues.map(league => (
                <div 
                  key={league.id} 
                  className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-blue-500 transition cursor-pointer group"
                  onClick={() => handleViewLeague(league.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-white">{league.title}</h3>
                      {league.description && (
                        <p className="text-gray-300 text-sm mt-1 line-clamp-2">{league.description}</p>
                      )}
                      {league.gameTypeId && (
                        <p className="text-gray-400 text-sm mt-1 flex items-center">
                          <FaBasketballBall className="mr-1 text-xs" />
                          {league.gameTypeId === "marchMadness" ? "March Madness" : league.gameTypeId}
                        </p>
                      )}
                    </div>
                    <button 
                      className="text-blue-400 hover:text-blue-300 group-hover:translate-x-1 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewLeague(league.id);
                      }}
                    >
                      <FaArrowRight />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-700 p-6 rounded-lg text-center">
              <p className="text-gray-300">You don't have any active leagues.</p>
              <p className="text-gray-400 mt-2">Use the "Create New League" button above to get started!</p>
            </div>
          )}
        </div>
        
        {/* Past Leagues Section */}
        {pastLeagues.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-gray-700 mr-4">
                  <FaHistory className="text-gray-400 text-xl" />
                </div>
                <h2 className="text-xl font-bold text-white">Past Leagues</h2>
              </div>
              
              <span className="text-gray-400 text-sm">
                {pastLeagues.length} league{pastLeagues.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pastLeagues.map(league => (
                <div 
                  key={league.id} 
                  className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-gray-500 transition cursor-pointer group"
                  onClick={() => handleViewLeague(league.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-white">{league.title}</h3>
                      {league.description && (
                        <p className="text-gray-300 text-sm mt-1 line-clamp-2">{league.description}</p>
                      )}
                      {league.archivedAt && (
                        <p className="text-gray-400 text-sm mt-1">
                          Archived on {formatDate(league.archivedAt)}
                        </p>
                      )}
                    </div>
                    <button 
                      className="text-gray-400 hover:text-gray-300 group-hover:translate-x-1 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewLeague(league.id);
                      }}
                    >
                      <FaArrowRight />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };
  
  return (
    <div className="text-white max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Main header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold">Profile Dashboard</h1>
        
        {/* Create League - Primary button */}
        <button 
          onClick={handleCreateLeague}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white transition"
        >
          <FaPlus className="mr-2" />
          Create New League
        </button>
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg flex items-center animate-appear">
          <FaExclamationCircle className="mr-2 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg flex items-center animate-appear">
          <FaCheckCircle className="mr-2 text-green-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
      
      {/* Main grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Profile */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile card */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 transition-transform hover:scale-105"
                  style={{ backgroundColor: avatarColor }}
                >
                  {getInitials(getDisplayName())}
                </div>
                
                {/* User info */}
                <h2 className="text-xl font-bold text-white">{getDisplayName()}</h2>
                <p className="text-gray-400 mb-2">{userData?.email || currentUser?.email}</p>
                
                {/* Status indicator */}
                <StatusIndicator 
                  status={isAdmin ? 'admin' : 'user'} 
                  activeLeagues={activeLeagues.length} 
                />
                
                {/* Action button */}
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition flex items-center justify-center"
                  >
                    <FaEdit className="mr-2" /> Edit Profile
                  </button>
                )}
              </div>
            </div>
            
            {/* User stats */}
            <div className="border-t border-gray-700 grid grid-cols-3">
              <div className="text-center p-3">
                <p className="text-2xl font-bold">{activeLeagues.length + pastLeagues.length}</p>
                <p className="text-gray-400 text-sm">Leagues</p>
              </div>
              <div className="text-center p-3 border-l border-r border-gray-700">
                <p className="text-2xl font-bold">{trophies.length}</p>
                <p className="text-gray-400 text-sm">Trophies</p>
              </div>
              <div className="text-center p-3">
                <p className="text-2xl font-bold">{activeLeagues.length}</p>
                <p className="text-gray-400 text-sm">Active</p>
              </div>
            </div>
          </div>
          
          {/* Account Information */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">Account Information</h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1" htmlFor="username">
                    Username*
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={editableData.username}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                    placeholder="Username"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1" htmlFor="displayName">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={editableData.displayName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                    placeholder="Display Name (optional)"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1" htmlFor="bio">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={editableData.bio}
                    onChange={handleChange}
                    rows="4"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                    placeholder="Tell us a bit about yourself (optional)"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 transition"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50 flex items-center"
                  >
                    {isSaving ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave className="mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {userData?.username && (
                    <div>
                      <p className="text-gray-400 text-sm">Username</p>
                      <p className="text-white">{userData.username}</p>
                    </div>
                  )}
                  
                  {userData?.displayName && (
                    <div>
                      <p className="text-gray-400 text-sm">Display Name</p>
                      <p className="text-white">{userData.displayName}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-gray-400 text-sm">Email</p>
                    <p className="text-white">{userData?.email || currentUser?.email}</p>
                  </div>
                  
                  {userData?.createdAt && (
                    <div>
                      <p className="text-gray-400 text-sm">Member Since</p>
                      <p className="text-white">
                        {userData.createdAt instanceof Date
                          ? userData.createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : new Date(userData.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
                
                {userData?.bio && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-400 text-sm mb-1">Bio</p>
                    <p className="text-white">{userData.bio}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Admin Dashboard - Only visible to admins */}
          {isAdmin && (
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl border border-purple-700 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div className="flex items-center mb-4 sm:mb-0">
                  <div className="p-3 rounded-full bg-purple-800 mr-4">
                    <FaUserShield className="text-purple-200 text-xl" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Admin Dashboard</h2>
                </div>
                <div className="px-4 py-2 bg-purple-800 rounded-lg text-purple-200 flex items-center">
                  <FaUser className="mr-2" />
                  Admin Access
                </div>
              </div>
              
              {/* Admin Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {loadingAdminStats ? (
                  <div className="col-span-4 flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-300"></div>
                  </div>
                ) : (
                  <>
                    <div className="bg-purple-800/50 p-4 rounded-lg border border-purple-700">
                      <p className="text-purple-300 text-sm mb-1">Total Users</p>
                      <p className="text-2xl font-bold text-white">{adminStats.totalUsers}</p>
                      <p className="text-purple-300 text-sm mt-1">
                        <span className="text-green-400">+{adminStats.recentUsersCount}</span> in last 30 days
                      </p>
                    </div>
                    
                    <div className="bg-purple-800/50 p-4 rounded-lg border border-purple-700">
                      <p className="text-purple-300 text-sm mb-1">Active Users</p>
                      <p className="text-2xl font-bold text-white">{adminStats.activeUsersCount}</p>
                      <p className="text-purple-300 text-sm mt-1">
                        <span className="text-green-400">{Math.round((adminStats.activeUsersCount / adminStats.totalUsers) * 100)}%</span> engagement
                      </p>
                    </div>
                    
                    <div className="bg-purple-800/50 p-4 rounded-lg border border-purple-700">
                      <p className="text-purple-300 text-sm mb-1">Total Leagues</p>
                      <p className="text-2xl font-bold text-white">{adminStats.totalLeagues}</p>
                      <p className="text-purple-300 text-sm mt-1">
                        <span className="text-green-400">
                          {(adminStats.totalLeagues / Math.max(1, adminStats.totalUsers)).toFixed(1)}
                        </span> per user
                      </p>
                    </div>
                    
                    <div className="bg-purple-800/50 p-4 rounded-lg border border-purple-700 flex items-center justify-center">
                      <button 
                        onClick={toggleAdminView}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition rounded-md text-white flex items-center"
                      >
                        {isAdminView ? (
                          <>
                            <FaUser className="mr-2" />
                            Back to Profile
                          </>
                        ) : (
                          <>
                            <FaUserShield className="mr-2" />
                            Admin Tools
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Admin Tools or Regular Content */}
          {isAdmin && isAdminView ? (
            <AdminTabs />
          ) : (
            renderProfileContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
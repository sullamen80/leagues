import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
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
  FaBasketballBall
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

// Generate a random pastel color based on a string
const generateColorFromString = (str) => {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to pastel-ish color
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 45%, 25%)`; // Lower lightness for dark mode
};

const ProfilePage = () => {
  const { currentUser } = useAuth();
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
  
  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.seconds 
      ? new Date(timestamp.seconds * 1000) 
      : new Date(timestamp);
      
    return date.toLocaleDateString();
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="text-white space-y-6">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      {/* Error and success messages */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg flex items-center">
          <FaExclamationCircle className="mr-2 text-red-500" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg flex items-center">
          <FaCheckCircle className="mr-2 text-green-500" />
          {success}
        </div>
      )}
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        {/* Profile header with avatar */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start mb-6">
          {/* Avatar with initials */}
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 sm:mb-0 sm:mr-6"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(getDisplayName())}
          </div>
          
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-white">{getDisplayName()}</h2>
            <p className="text-gray-400">{userData?.email || currentUser?.email}</p>
            
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center mx-auto sm:mx-0"
              >
                <FaEdit className="mr-2" /> Edit Profile
              </button>
            )}
          </div>
        </div>
        
        {/* Profile form */}
        {isEditing ? (
          <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Edit Profile</h3>
            
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
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
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
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
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
                  rows="3"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
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
          </div>
        ) : (
          <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Account Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      ? userData.createdAt.toLocaleDateString()
                      : new Date(userData.createdAt.seconds * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
            
            {userData?.bio && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm">Bio</p>
                <p className="text-white mt-1">{userData.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Trophy Case Section */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <div className="p-3 rounded-full bg-yellow-800 mr-4">
            <FaTrophy className="text-yellow-400 text-xl" />
          </div>
          <h2 className="text-xl font-bold text-white">Trophy Case</h2>
        </div>
        
        {loadingLeagues ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          </div>
        ) : trophies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trophies.map((trophy, index) => (
              <div 
                key={index} 
                className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-yellow-500 transition cursor-pointer"
                onClick={() => handleViewLeague(trophy.leagueId)}
              >
                <div className="flex items-center mb-2">
                  <FaMedal className="text-yellow-500 text-2xl mr-2" />
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
      {activeLeagues.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center mb-6">
            <div className="p-3 rounded-full bg-blue-900 mr-4">
              <FaBasketballBall className="text-blue-400 text-xl" />
            </div>
            <h2 className="text-xl font-bold text-white">Active Leagues</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLeagues.map(league => (
              <div 
                key={league.id} 
                className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-blue-500 transition cursor-pointer"
                onClick={() => handleViewLeague(league.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white">{league.title}</h3>
                    {league.description && (
                      <p className="text-gray-300 text-sm mt-1 line-clamp-2">{league.description}</p>
                    )}
                    {league.gameTypeId && (
                      <p className="text-gray-400 text-sm mt-1">
                        {league.gameTypeId === "marchMadness" ? "March Madness" : league.gameTypeId}
                      </p>
                    )}
                  </div>
                  <button 
                    className="text-blue-400 hover:text-blue-300"
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
      
      {/* Past Leagues Section */}
      {pastLeagues.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center mb-6">
            <div className="p-3 rounded-full bg-gray-700 mr-4">
              <FaHistory className="text-gray-400 text-xl" />
            </div>
            <h2 className="text-xl font-bold text-white">Past Leagues</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastLeagues.map(league => (
              <div 
                key={league.id} 
                className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-gray-500 transition cursor-pointer"
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
                    className="text-gray-400 hover:text-gray-300"
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
    </div>
  );
};

export default ProfilePage;
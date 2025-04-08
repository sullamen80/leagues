import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion,
  getDoc,
  setDoc,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import { 
  FaTrophy, 
  FaLock, 
  FaUsers, 
  FaUserPlus, 
  FaSpinner, 
  FaCheckCircle, 
  FaExclamationCircle,
  FaArrowRight,
  FaSearch,
  FaBasketballBall,
  FaArchive,
  FaGamepad
} from 'react-icons/fa';
import { getAvailableGameTypes } from '../../gameTypes';

const LeagueJoin = () => {
  const [leagues, setLeagues] = useState([]);
  const [userLeagues, setUserLeagues] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [joinInProgress, setJoinInProgress] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [gameTypes, setGameTypes] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Load all available game types
    const loadGameTypes = async () => {
      try {
        const allGameTypes = getAvailableGameTypes();
        setGameTypes(allGameTypes);
      } catch (err) {
        console.error('Error loading game types:', err);
      }
    };
    
    loadGameTypes();
  }, []);

  useEffect(() => {
    const fetchLeaguesData = async () => {
      if (!currentUser) return;

      try {
        setIsLoading(true);
        setError('');
        
        // 1. Fetch the user's current leagues
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        let userLeagueIds = [];
        
        if (userSnap.exists() && userSnap.data().leagueIds) {
          userLeagueIds = userSnap.data().leagueIds;
          setUserLeagues(userLeagueIds);
        }
        
        // 2. Fetch all available leagues
        const leaguesCollection = collection(db, 'leagues');
        const leaguesSnapshot = await getDocs(leaguesCollection);
        
        const leaguesList = leaguesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isJoined: userLeagueIds.includes(doc.id)
        }));
        
        // Sort leagues: joined first, then alphabetically
        leaguesList.sort((a, b) => {
          if (a.isJoined !== b.isJoined) return a.isJoined ? -1 : 1;
          return a.title.localeCompare(b.title);
        });
        
        setLeagues(leaguesList);
      } catch (err) {
        console.error('Error fetching leagues:', err);
        setError('Failed to fetch available leagues');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaguesData();
  }, [currentUser]);

  const getGameTypeName = (gameTypeId) => {
    // Handle both potential naming conventions
    const normalizedGameTypeId = gameTypeId === 'nbaBracket' ? 'nbaPlayoffs' : gameTypeId;
    
    const gameType = gameTypes.find(gt => gt.id === normalizedGameTypeId);
    return gameType ? gameType.name : normalizedGameTypeId === 'marchMadness' ? 'March Madness' : 
           normalizedGameTypeId === 'nbaPlayoffs' ? 'NBA Playoffs' : 'Unknown Game Type';
  };

  const handleJoinLeague = async (league) => {
    if (!currentUser) {
      setError('You must be logged in to join a league');
      return;
    }

    // If league is archived, don't allow joining
    if (league.status === "archived") {
      setError(`Cannot join "${league.title}" as it has been archived.`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    // If league is password protected, show password modal
    if (league.passwordProtected) {
      setSelectedLeague(league);
      setPassword('');
      setPasswordError('');
      setShowPasswordModal(true);
      return;
    }

    // Otherwise join directly
    await joinLeague(league.id);
  };

  const joinLeague = async (leagueId, providedPassword = null) => {
    try {
      setJoinInProgress(leagueId);
      setError('');
      
      // Check if the league requires a password
      const leagueRef = doc(db, 'leagues', leagueId);
      const leagueSnap = await getDoc(leagueRef);
      
      if (!leagueSnap.exists()) {
        throw new Error('League not found');
      }
      
      const leagueData = leagueSnap.data();
      
      // Check if league is archived
      if (leagueData.status === "archived") {
        setPasswordError('This league has been archived and cannot be joined');
        setJoinInProgress(null);
        return false;
      }
      
      // Verify password if league is password protected
      if (leagueData.passwordProtected && leagueData.password !== providedPassword) {
        setPasswordError('Incorrect password');
        setJoinInProgress(null);
        return false;
      }
      
      // Add user to the league
      await updateDoc(leagueRef, {
        members: arrayUnion(currentUser.uid),
        users: arrayUnion({
          id: currentUser.uid,
          username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          photoURL: currentUser.photoURL || null,
          role: 'member',
          joinedAt: Timestamp.now()
        }),
        updatedAt: Timestamp.now()
      });

      // Add league to user's leagueIds array
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Update existing user document
        await updateDoc(userRef, {
          leagueIds: arrayUnion(leagueId),
          updatedAt: Timestamp.now()
        });
      } else {
        // Create new user document if it doesn't exist
        await setDoc(userRef, {
          id: currentUser.uid,
          username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          email: currentUser.email,
          photoURL: currentUser.photoURL || null,
          leagueIds: [leagueId],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      // Update local state
      setUserLeagues([...userLeagues, leagueId]);
      setLeagues(leagues.map(league => 
        league.id === leagueId ? { ...league, isJoined: true } : league
      ));
      
      setSuccessMessage(`Successfully joined ${leagueData.title}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Close modal if open
      setShowPasswordModal(false);
      
      // Navigate to the joined league
      navigate(`/league/${leagueId}`);
      return true;
    } catch (err) {
      console.error('Error joining league:', err);
      setError(`Failed to join league: ${err.message}`);
      return false;
    } finally {
      setJoinInProgress(null);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setPasswordError('Password is required');
      return;
    }
    
    const success = await joinLeague(selectedLeague.id, password);
    if (success) {
      // Navigation happens in joinLeague function
    }
  };

  const handleViewLeague = (leagueId) => {
    navigate(`/league/${leagueId}`);
  };

  // First, filter leagues based on search term
  const searchFilteredLeagues = leagues.filter(league => 
    league.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (league.description && league.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Create separate lists - for joined leagues show all, for available leagues exclude archived
  const joinedLeagues = searchFilteredLeagues.filter(league => league.isJoined);
  const availableLeagues = searchFilteredLeagues.filter(league => 
    !league.isJoined && league.status !== "archived"
  );

  return (
    <div className="text-white space-y-6">
      {/* Header with title and search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="mr-4 bg-orange-800 p-3 rounded-full">
            <FaBasketballBall className="text-orange-400 text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Join a League</h1>
            <p className="text-gray-300">Browse and join available tournament brackets</p>
          </div>
        </div>
        
        {/* Search box */}
        <div className="w-full sm:w-64 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search leagues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 px-4 pr-10 border rounded-lg bg-gray-800 text-gray-200 border-gray-700 focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-sm placeholder-gray-500"
            />
            <div className="absolute right-3 top-2.5 text-gray-500">
              <FaSearch className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-900/30 border-2 border-green-700 text-green-300 rounded-lg flex items-center shadow-md">
          <FaCheckCircle className="mr-2 text-green-500" />
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border-2 border-red-700 text-red-300 rounded-lg flex items-center shadow-md">
          <FaExclamationCircle className="mr-2 text-red-500" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Your leagues section */}
          {joinedLeagues.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-700 text-white">Your Leagues</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {joinedLeagues.map((league) => (
                  <div 
                    key={league.id} 
                    className="rounded-lg shadow-md p-4 border border-gray-700 cursor-pointer transition bg-gray-800 hover:bg-gray-700"
                    onClick={() => handleViewLeague(league.id)}
                  >
                    <div className="flex items-center">
                      <div className="p-3 rounded-full bg-blue-900">
                        <FaTrophy className="text-blue-400" />
                      </div>
                      <div className="ml-3 flex-grow">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-white">{league.title}</h3>
                          <div className="flex items-center space-x-2">
                            <span className="bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full text-xs flex items-center">
                              <FaGamepad className="mr-1" /> {getGameTypeName(league.gameTypeId)}
                            </span>
                            {league.status === "archived" && (
                              <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full flex items-center text-xs">
                                <FaArchive className="mr-1 text-xs" /> Archived
                              </span>
                            )}
                          </div>
                        </div>
                        {league.description && (
                          <p className="text-sm text-gray-300 line-clamp-1">{league.description}</p>
                        )}
                        <div className="flex items-center mt-1 text-xs text-gray-400">
                          <FaUsers className="mr-1" />
                          <span>{league.members?.length || 1} {league.members?.length === 1 ? 'member' : 'members'}</span>
                          {league.private && (
                            <span className="ml-2 bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full flex items-center">
                              <FaLock className="mr-1 text-xs" /> Private
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available leagues section */}
          <div>
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-700 text-white">Available Leagues</h2>
            {availableLeagues.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-300">
                  {searchTerm ? 'No leagues match your search' : 'No available leagues at the moment'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableLeagues.map((league) => (
                  <div 
                    key={league.id} 
                    className="rounded-lg shadow-md p-4 border border-gray-700 bg-gray-800"
                  >
                    <div className="flex flex-col space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          <div className="p-3 rounded-full bg-indigo-900">
                            <FaTrophy className="text-indigo-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="font-semibold text-white flex items-center">
                              {league.title}
                              {league.passwordProtected && (
                                <FaLock className="ml-2 text-yellow-500 text-sm" title="Password Protected" />
                              )}
                            </h3>
                            <span className="mt-1 bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full text-xs inline-flex items-center">
                              <FaGamepad className="mr-1" /> {getGameTypeName(league.gameTypeId)}
                            </span>
                            {league.description && (
                              <p className="text-sm text-gray-300 line-clamp-2 mt-1">{league.description}</p>
                            )}
                            <div className="flex items-center mt-1 text-xs text-gray-400">
                              <FaUsers className="mr-1" />
                              <span>{league.members?.length || 1} {league.members?.length === 1 ? 'member' : 'members'}</span>
                              {league.private && (
                                <span className="ml-2 bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full flex items-center">
                                  <FaLock className="mr-1 text-xs" /> Private
                                </span>
                              )}
                              {league.passwordProtected && (
                                <span className="ml-2 bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full flex items-center">
                                  <FaLock className="mr-1 text-xs" /> Password
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinLeague(league)}
                          disabled={joinInProgress === league.id}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {joinInProgress === league.id ? (
                            <FaSpinner className="animate-spin mr-1" />
                          ) : (
                            <FaUserPlus className="mr-1" />
                          )}
                          Join
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && selectedLeague && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center text-white">
              <FaLock className="text-yellow-500 mr-2" />
              Password Required
            </h2>
            <p className="text-gray-300 mb-4">
              The league "{selectedLeague.title}" is password protected. Please enter the password to join.
            </p>
            
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label htmlFor="password" className="block text-gray-300 text-sm font-bold mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="text-gray-500" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-10 px-3 py-2 border rounded-md ${
                      passwordError ? 'border-red-600' : 'border-gray-600'
                    } bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="Enter league password"
                  />
                </div>
                {passwordError && (
                  <p className="text-red-400 text-xs mt-1">{passwordError}</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinInProgress === selectedLeague.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
                >
                  {joinInProgress === selectedLeague.id ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <FaUserPlus className="mr-2" />
                      Join League
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueJoin;
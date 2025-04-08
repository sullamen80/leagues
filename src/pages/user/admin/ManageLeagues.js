import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, setDoc, 
    deleteDoc, where, orderBy, arrayRemove, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  FaSpinner,
  FaArchive,
  FaTrash,
  FaExclamationCircle,
  FaCheck,
  FaSearch,
  FaSave,
  FaBan,
  FaLock,
  FaLockOpen,
  FaFilter,
  FaEye,
  FaEyeSlash,
  FaPlus
} from 'react-icons/fa';

const ManageLeagues = () => {
  const { currentUser } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all', // all, active, archived
    gameType: 'all'
  });
  const [gameTypes, setGameTypes] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [leagueCreationBlocked, setLeagueCreationBlocked] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  // Load leagues data and system settings
  useEffect(() => {
    const loadLeaguesAndSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load system settings
        const settingsRef = doc(db, 'settings', 'leagues');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          setLeagueCreationBlocked(settings.blockCreation || false);
        } else {
          // Create default settings if they don't exist
          await setDoc(settingsRef, {
            blockCreation: false
          });
        }
        
        // Load leagues
        const leaguesQuery = query(
          collection(db, 'leagues'),
          orderBy('createdAt', 'desc')
        );
        const leaguesSnapshot = await getDocs(leaguesQuery);
        
        const leaguesData = leaguesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert timestamps to JS dates for easier handling
          createdAt: doc.data().createdAt?.toDate() || null,
          updatedAt: doc.data().updatedAt?.toDate() || null,
          archivedAt: doc.data().archivedAt?.toDate() || null
        }));
        
        setLeagues(leaguesData);
        
        // Load game types for filtering
        const gameTypesSet = new Set();
        leaguesData.forEach(league => {
          if (league.gameTypeId) {
            gameTypesSet.add(league.gameTypeId);
          }
        });
        
        setGameTypes(Array.from(gameTypesSet));
      } catch (err) {
        console.error('Error loading leagues and settings:', err);
        setError('Failed to load leagues and system settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadLeaguesAndSettings();
  }, []);
  
  // Toggle league creation block
  const toggleLeagueCreationBlock = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(null);
      
      // Update in Firestore
      const settingsRef = doc(db, 'settings', 'leagues');
      await updateDoc(settingsRef, {
        blockCreation: !leagueCreationBlocked
      });
      
      // Update state
      setLeagueCreationBlocked(!leagueCreationBlocked);
      
      setSuccess(`League creation ${!leagueCreationBlocked ? 'blocked' : 'enabled'} successfully`);
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating league creation setting:', err);
      setError('Failed to update system settings. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Archive/Unarchive a league
  const toggleArchiveLeague = async (leagueId, isCurrentlyArchived) => {
    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(null);
      
      const leagueRef = doc(db, 'leagues', leagueId);
      
      if (isCurrentlyArchived) {
        // Unarchive
        await updateDoc(leagueRef, {
          archivedAt: null,
          updatedAt: new Date()
        });
        
        // Update leagues state
        setLeagues(leagues.map(league => {
          if (league.id === leagueId) {
            const { archivedAt, ...rest } = league;
            return { 
              ...rest, 
              updatedAt: new Date() 
            };
          }
          return league;
        }));
        
        setSuccess('League unarchived successfully');
      } else {
        // Archive
        await updateDoc(leagueRef, {
          archivedAt: new Date(),
          updatedAt: new Date()
        });
        
        // Update leagues state
        setLeagues(leagues.map(league => {
          if (league.id === leagueId) {
            return { 
              ...league, 
              archivedAt: new Date(),
              updatedAt: new Date() 
            };
          }
          return league;
        }));
        
        setSuccess('League archived successfully');
      }
      
      // Clear confirmation state
      setConfirmAction(null);
      setSelectedLeague(null);
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating league:', err);
      setError('Failed to update league. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Delete a league
  const deleteLeague = async (leagueId) => {
    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(null);
      
      // Step 1: Find all users who have this league in their leagueIds
      const usersQuery = query(
        collection(db, 'users'),
        where('leagueIds', 'array-contains', leagueId)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      // Step 2: Remove the league ID from each user's leagueIds array
      const updatePromises = usersSnapshot.docs.map(userDoc => {
        const userRef = doc(db, 'users', userDoc.id);
        return updateDoc(userRef, {
          leagueIds: arrayRemove(leagueId)
        });
      });
      
      // Wait for all user updates to complete
      await Promise.all(updatePromises);
      
      // Step 3: Delete all subcollections
      // Define subcollections to delete
      const subcollections = ['gameData', 'locks', 'settings'];
      
      // Delete each subcollection
      for (const subcollName of subcollections) {
        const subcollRef = collection(db, 'leagues', leagueId, subcollName);
        const subcollSnapshot = await getDocs(subcollRef);
        
        // Use batched writes for better performance if many documents
        const batchSize = 500; // Firestore batch limit is 500
        let batch = writeBatch(db);
        let docsProcessed = 0;
        
        for (const docSnapshot of subcollSnapshot.docs) {
          batch.delete(doc(db, 'leagues', leagueId, subcollName, docSnapshot.id));
          docsProcessed++;
          
          // Commit batch when reaching limit and start a new one
          if (docsProcessed >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            docsProcessed = 0;
          }
        }
        
        // Commit any remaining operations
        if (docsProcessed > 0) {
          await batch.commit();
        }
        
        console.log(`Deleted ${subcollSnapshot.size} documents from ${subcollName} subcollection`);
      }
      
      // Step 4: Delete the league document
      await deleteDoc(doc(db, 'leagues', leagueId));
      
      // Update leagues state in component
      setLeagues(leagues.filter(league => league.id !== leagueId));
      
      setSuccess(`League and all its data deleted successfully`);
      
      // Clear confirmation state
      setConfirmAction(null);
      setSelectedLeague(null);
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting league:', err);
      setError(`Failed to delete league: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Prepare confirmation for archive/unarchive/delete
  const prepareAction = (leagueId, action) => {
    setSelectedLeague(leagueId);
    setConfirmAction(action);
  };
  
  // Cancel confirmation
  const cancelAction = () => {
    setSelectedLeague(null);
    setConfirmAction(null);
  };
  
  // Filter leagues based on filters and search term
  const filteredLeagues = leagues.filter(league => {
    // Apply search term filter
    const searchMatch = !searchTerm || (
      (league.title && league.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (league.description && league.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    // Apply status filter
    const statusMatch = 
      filters.status === 'all' || 
      (filters.status === 'active' && !league.archivedAt) || 
      (filters.status === 'archived' && league.archivedAt);
    
    // Apply game type filter
    const gameTypeMatch = 
      filters.gameType === 'all' || 
      league.gameTypeId === filters.gameType;
    
    return searchMatch && statusMatch && gameTypeMatch;
  });
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Get user count for a league
  const getUserCount = (league) => {
    if (!league.userIds) return 0;
    return Array.isArray(league.userIds) ? league.userIds.length : Object.keys(league.userIds).length;
  };
  
  // Get game type display name
  const getGameTypeName = (gameTypeId) => {
    switch(gameTypeId) {
      case 'marchMadness':
        return 'March Madness';
      default:
        return gameTypeId || 'Unknown';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Manage Leagues</h2>
        
        <button
          onClick={toggleLeagueCreationBlock}
          disabled={isUpdating}
          className={`px-4 py-2 ${
            leagueCreationBlocked 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-red-600 hover:bg-red-700'
          } text-white rounded-md transition disabled:opacity-50 flex items-center`}
        >
          {isUpdating ? (
            <FaSpinner className="animate-spin mr-2" />
          ) : leagueCreationBlocked ? (
            <FaLockOpen className="mr-2" />
          ) : (
            <FaLock className="mr-2" />
          )}
          {leagueCreationBlocked ? 'Enable League Creation' : 'Block League Creation'}
        </button>
      </div>
      
      {/* System status */}
      <div className={`p-4 rounded-lg flex items-center ${
        leagueCreationBlocked ? 'bg-red-900/30 border border-red-700 text-red-300' : 'bg-green-900/30 border border-green-700 text-green-300'
      }`}>
        {leagueCreationBlocked ? (
          <>
            <FaBan className="mr-2 text-red-500 flex-shrink-0" />
            <span>League creation is currently <strong>blocked</strong>. Users cannot create new leagues.</span>
          </>
        ) : (
          <>
            <FaCheck className="mr-2 text-green-500 flex-shrink-0" />
            <span>League creation is currently <strong>enabled</strong>. Users can create new leagues.</span>
          </>
        )}
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg flex items-center">
          <FaExclamationCircle className="mr-2 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg flex items-center">
          <FaCheck className="mr-2 text-green-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
      
      {/* Leagues Management */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">All Leagues</h3>
        
        {/* Search and filters */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition flex items-center whitespace-nowrap"
            >
              <FaFilter className="mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-fadeIn">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">
                  Game Type
                </label>
                <select
                  value={filters.gameType}
                  onChange={(e) => setFilters({...filters, gameType: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                >
                  <option value="all">All Game Types</option>
                  {gameTypes.map(type => (
                    <option key={type} value={type}>
                      {getGameTypeName(type)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        
        {/* Leagues table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <FaSpinner className="animate-spin text-2xl text-indigo-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredLeagues.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {searchTerm || filters.status !== 'all' || filters.gameType !== 'all' ? (
                  <>No leagues match your filters. Try adjusting your search criteria.</>
                ) : (
                  <>No leagues found in the system.</>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      League
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Game Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredLeagues.map((league) => (
                    <tr key={league.id} className="hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-white truncate max-w-xs">{league.title}</div>
                        {league.description && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">{league.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{league.ownerName || "Unknown"}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{getGameTypeName(league.gameTypeId)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-300">{getUserCount(league)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{formatDate(league.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {league.archivedAt ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-300">
                            Archived
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-300">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                        {selectedLeague === league.id && confirmAction ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                if (confirmAction === 'archive') {
                                  toggleArchiveLeague(league.id, !!league.archivedAt);
                                } else if (confirmAction === 'delete') {
                                  deleteLeague(league.id);
                                }
                              }}
                              disabled={isUpdating}
                              className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={cancelAction}
                              disabled={isUpdating}
                              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <a
                              href={`/league/${league.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white transition flex items-center"
                            >
                              <FaEye className="mr-1" /> View
                            </a>
                            <button
                              onClick={() => prepareAction(league.id, 'archive')}
                              className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white transition flex items-center"
                            >
                              {league.archivedAt ? (
                                <>
                                  <FaArchive className="mr-1" /> Unarchive
                                </>
                              ) : (
                                <>
                                  <FaArchive className="mr-1" /> Archive
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => prepareAction(league.id, 'delete')}
                              className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition flex items-center"
                            >
                              <FaTrash className="mr-1" /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageLeagues;
// src/gameTypes/common/components/BaseAdminParticipants.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaUser, FaUserMinus, FaUserCheck, FaUserTimes, FaSort, FaSortUp, FaSortDown, FaCalendarAlt, FaClipboardCheck, FaTimesCircle, FaExclamationTriangle, FaArchive, FaSearch } from 'react-icons/fa';

/**
 * BaseAdminParticipants - A reusable component for managing participants across different game types
 * 
 * @param {Object} props - Component props
 * @param {string} props.entryType - The type of entry (e.g., 'Bracket', 'Lineup', etc.)
 * @param {Function} props.getParticipantStatus - Function to determine if a participant has completed their entry
 * @param {Function} props.renderParticipantDetails - Function to render additional participant details 
 * @param {Function} props.renderStatsCards - Function to render game-specific stats cards
 * @param {Function} props.getEntryVerificationMessage - Function to get verification message when removing a participant
 * @param {string} props.backPath - Path to navigate back to (default: 'admin')
 * @param {string} props.pageTitle - Title of the page (default: 'Manage Participants')
 */
const BaseAdminParticipants = ({
  entryType = 'Entry',
  getParticipantStatus = (participant) => ({ 
    hasEntry: false, 
    statusText: 'No Entry', 
    statusClass: 'bg-yellow-100 text-yellow-800', 
    statusIcon: <FaExclamationTriangle className="mr-1" />
  }),
  renderParticipantDetails = null,
  renderStatsCards = null,
  getEntryVerificationMessage = (participant) => 
    `This participant has already created their entry. All their progress will be lost.`,
  backPath = 'admin',
  pageTitle = 'Manage Participants'
}) => {
  const [leagueData, setLeagueData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [kickingUserId, setKickingUserId] = useState(null);
  const [isArchived, setIsArchived] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [filterValue, setFilterValue] = useState('');
  
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // Add location hook for navigation
  const currentUserId = auth.currentUser?.uid;
  
  // Load league and participant data
  useEffect(() => {
    if (!leagueId || !currentUserId) {
      setError("Missing required information");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get league data
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const league = { id: leagueId, ...leagueSnap.data() };
        setLeagueData(league);
        
        // Check if user is admin and if league is archived
        if (league.ownerId !== currentUserId) {
          setError("You don't have permission to manage this league");
          setIsLoading(false);
          return;
        }
        
        setIsArchived(league.status === 'archived');
        
        // Get all league members from league data
        const allMembers = [];
        
        // First check members array
        if (Array.isArray(league.members)) {
          league.members.forEach(member => {
            if (typeof member === 'string') {
              allMembers.push(member);
            }
          });
        }
        
        // Then check users array
        if (Array.isArray(league.users)) {
          league.users.forEach(user => {
            if (typeof user === 'string') {
              if (!allMembers.includes(user)) {
                allMembers.push(user);
              }
            } else if (user && user.id) {
              if (!allMembers.includes(user.id)) {
                allMembers.push(user.id);
              }
            }
          });
        }
        
        // Fetch all user data from userData collection
        const userDataRef = collection(db, "leagues", leagueId, "userData");
        const userDataSnap = await getDocs(userDataRef);
        
        // Map of userId -> user data
        const userDataMap = {};
        userDataSnap.forEach(doc => {
          userDataMap[doc.id] = doc.data();
        });
        
        // Include users without data but in members array
        allMembers.forEach(userId => {
          if (!userDataMap[userId]) {
            userDataMap[userId] = { hasEmptyEntry: true };
          }
        });
        
        // Get user data for each member
        const participantPromises = Object.keys(userDataMap).map(async (userId) => {
          const userData = userDataMap[userId];
          
          // Skip current user (admin) but include in the list marked as admin
          if (userId === currentUserId) {
            const adminData = { 
              id: userId, 
              entryData: userData.hasEmptyEntry ? {} : userData,
              isAdmin: true,
              name: 'You (Admin)',
              email: auth.currentUser?.email || 'Unknown',
              joinedAt: userData.joinedAt || league.createdAt
            };
            
            // Add the entry status
            const entryStatus = getParticipantStatus(adminData);
            return { ...adminData, ...entryStatus };
          }
          
          // Get user info
          let participantData = {
            id: userId,
            entryData: userData.hasEmptyEntry ? {} : userData,
            name: 'Unknown User',
            email: 'Unknown',
            isAdmin: false,
            joinedAt: userData.joinedAt || null
          };
          
          try {
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userDoc = userSnap.data();
              participantData.name = userDoc.displayName || userDoc.username || userDoc.email || 'Unknown User';
              participantData.email = userDoc.email || 'Unknown';
            }
          } catch (userError) {
            console.error(`Error getting user data for ${userId}:`, userError);
            // Continue with default values
          }
          
          // Add the entry status
          const entryStatus = getParticipantStatus(participantData);
          return { ...participantData, ...entryStatus };
        });
        
        const participantData = await Promise.all(participantPromises);
        
        // Sort participants
        const sortedParticipants = sortData(participantData, sortConfig.key, sortConfig.direction);
        setParticipants(sortedParticipants);
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading participant data:", err);
        setError(`Failed to load participant data: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId, currentUserId, getParticipantStatus]);
  
  // Helper to format dates
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return 'Unknown';
    }
    
    return date.toLocaleDateString();
  };
  
  // Helper for sorting
  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      // Special handling for joinedAt
      if (key === 'joinedAt') {
        const aDate = a.joinedAt ? new Date(a.joinedAt) : new Date(0);
        const bDate = b.joinedAt ? new Date(b.joinedAt) : new Date(0);
        
        return direction === 'asc' 
          ? aDate - bDate 
          : bDate - aDate;
      }
      
      // Handle boolean values (hasEntry)
      if (typeof a[key] === 'boolean') {
        if (direction === 'asc') {
          return a[key] === b[key] ? 0 : a[key] ? -1 : 1;
        } else {
          return a[key] === b[key] ? 0 : a[key] ? 1 : -1;
        }
      }
      
      // Default string comparison
      if (!a[key]) return direction === 'asc' ? 1 : -1;
      if (!b[key]) return direction === 'asc' ? -1 : 1;
      
      const aVal = a[key].toString().toLowerCase();
      const bVal = b[key].toString().toLowerCase();
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };
  
  // Handle sorting
  const handleSort = (key) => {
    // For backwards compatibility - map hasEntry to hasBracket if it exists
    const sortKey = key === 'hasEntry' && participants.some(p => 'hasBracket' in p) ? 'hasBracket' : key;
    
    let direction = 'asc';
    
    if (sortConfig.key === sortKey) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    const newSortConfig = { key: sortKey, direction };
    setSortConfig(newSortConfig);
    
    const sortedData = sortData(participants, sortKey, direction);
    setParticipants(sortedData);
  };
  
  // Handle removing a participant
  const handleRemoveParticipant = (participant) => {
    if (isArchived) {
      setFeedback("Cannot remove participants from an archived league");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    // Don't allow removing the admin
    if (participant.id === currentUserId) {
      setFeedback("You cannot remove yourself as the league owner");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    // Set the user being kicked (this will trigger the confirmation modal)
    setKickingUserId(participant);
  };
  
  // Confirm removing a participant
  const confirmRemoveParticipant = async () => {
    if (!kickingUserId || isArchived) return;
    
    try {
      const userId = kickingUserId.id;
      
      // 1. Delete the user's entry from the league (if it exists)
      try {
        const entryRef = doc(db, "leagues", leagueId, "userData", userId);
        const entrySnap = await getDoc(entryRef);
        
        if (entrySnap.exists()) {
          await deleteDoc(entryRef);
          console.log("Deleted user entry data");
        }
      } catch (err) {
        console.error("Error deleting entry data:", err);
        // Continue with other removals even if this fails
      }
      
      // 2. Remove the league from the user's profile
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            leagueIds: arrayRemove(leagueId)
          });
          console.log("Removed league from user's profile");
        }
      } catch (err) {
        console.error("Error updating user profile:", err);
        // Continue with other removals even if this fails
      }
      
      // 3. Update the league document - remove from both members and users arrays
      const leagueRef = doc(db, "leagues", leagueId);
      
      // 3a. First update members array
      if (leagueData.members && Array.isArray(leagueData.members)) {
        await updateDoc(leagueRef, {
          members: arrayRemove(userId)
        });
        console.log("Removed user from members array");
      }
      
      // 3b. Then update users array if it contains objects
      if (leagueData.users && Array.isArray(leagueData.users)) {
        // Check if users array contains strings or objects
        const hasObjectUsers = leagueData.users.some(user => typeof user !== 'string');
        
        if (hasObjectUsers) {
          // Filter out the user from users array
          const filteredUsers = leagueData.users.filter(user => {
            if (typeof user === 'string') {
              return user !== userId;
            } else {
              return user.id !== userId;
            }
          });
          
          // Update users array with filtered array
          await updateDoc(leagueRef, {
            users: filteredUsers
          });
          console.log("Removed user from users array (object format)");
        } else {
          // If users array contains just strings, use arrayRemove
          await updateDoc(leagueRef, {
            users: arrayRemove(userId)
          });
          console.log("Removed user from users array (string format)");
        }
      }
      
      // 4. Update local state
      setParticipants(participants.filter(p => p.id !== userId));
      setLeagueData({
        ...leagueData,
        members: leagueData.members ? leagueData.members.filter(id => id !== userId) : [],
        users: leagueData.users ? leagueData.users.filter(user => {
          if (typeof user === 'string') return user !== userId;
          return user.id !== userId;
        }) : []
      });
      
      setFeedback(`${kickingUserId.name} has been removed from the league`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error removing participant:", err);
      setFeedback(`Error removing participant: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      // Close the confirmation modal
      setKickingUserId(null);
    }
  };
  
  // Cancel the kick operation
  const cancelRemoveParticipant = () => {
    setKickingUserId(null);
  };
  
  // Handle filtering
  const handleFilterChange = (e) => {
    setFilterValue(e.target.value);
  };
  
  // Filter participants based on search term
  const getFilteredParticipants = () => {
    if (!filterValue.trim()) return participants;
    
    const searchTerm = filterValue.toLowerCase();
    return participants.filter(participant => 
      participant.name.toLowerCase().includes(searchTerm) ||
      participant.email.toLowerCase().includes(searchTerm)
    );
  };
  
  // Navigate back to admin dashboard - UPDATED to use URL parameters
  const handleBack = () => {
    // Use URL parameter approach instead of direct path navigation
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', backPath);
    searchParams.delete('subview');
    navigate(`${location.pathname.split('/').slice(0, 3).join('/')}?${searchParams.toString()}`, { replace: true });
  };
  
  // Calculate statistics
  const calculateStats = () => {
    const total = participants.length;
    const withEntries = participants.filter(p => p.hasEntry).length;
    const withoutEntries = total - withEntries;
    const fillRate = total > 0 ? Math.round((withEntries / total) * 100) : 0;
    
    return {
      total,
      withEntries,
      withoutEntries,
      fillRate
    };
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
        <div className="flex flex-col items-center justify-center p-4 sm:p-8">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-500 mb-3 sm:mb-4"></div>
          <p className="text-gray-600">Loading participant data...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
        <div className="flex items-center px-2 sm:px-0 mb-4 sm:mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition"
          >
            <FaArrowLeft className="mr-1 sm:mr-2" /> Back to Admin
          </button>
        </div>
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded mx-2 sm:mx-0 mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  // Get filtered participants
  const filteredParticipants = getFilteredParticipants();
  const stats = calculateStats();
  
  return (
    <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b px-2 sm:px-0">
        <div className="flex items-center mb-3 sm:mb-0">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition mr-2 sm:mr-4"
          >
            <FaArrowLeft className="mr-1 sm:mr-2" /> Back
          </button>
          
          <h1 className="text-lg sm:text-2xl font-bold">{pageTitle}</h1>
        </div>
        
        {isArchived && (
          <div className="flex items-center text-gray-600 bg-gray-100 px-2 py-1 rounded">
            <FaArchive className="mr-1" />
            <span className="text-sm">League is archived - participants cannot be removed</span>
          </div>
        )}
      </div>
      
      {/* Feedback message */}
      {feedback && (
        <div className={`mb-4 p-2 sm:p-3 rounded border mx-2 sm:mx-0 ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}
      
      {/* Stats overview */}
      {renderStatsCards ? (
        renderStatsCards(stats, participants, isArchived)
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 px-2 sm:px-0">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-4">
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm text-blue-700">Total Participants</span>
              <span className="text-lg sm:text-xl font-bold text-blue-800">{stats.total}</span>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm text-green-700">With {entryType}s</span>
              <span className="text-lg sm:text-xl font-bold text-green-800">
                {stats.withEntries}
              </span>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-4">
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm text-yellow-700">Without {entryType}s</span>
              <span className="text-lg sm:text-xl font-bold text-yellow-800">
                {stats.withoutEntries}
              </span>
            </div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 sm:p-4">
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm text-purple-700">{entryType} Fill Rate</span>
              <span className="text-lg sm:text-xl font-bold text-purple-800">
                {stats.fillRate}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Search and filter */}
      <div className="mb-4 sm:mb-6 px-2 sm:px-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaUser className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search participants by name or email..."
            value={filterValue}
            onChange={handleFilterChange}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>
      
      {/* Participants table */}
      <div className="overflow-x-auto shadow border rounded-lg mb-4 sm:mb-6 mx-2 sm:mx-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  <span>Participant</span>
                  {sortConfig.key === 'name' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                    </span>
                  )}
                  {sortConfig.key !== 'name' && <FaSort className="ml-1 text-gray-300" />}
                </div>
              </th>
              <th 
                className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('joinedAt')}
              >
                <div className="flex items-center">
                  <span>Joined</span>
                  {sortConfig.key === 'joinedAt' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                    </span>
                  )}
                  {sortConfig.key !== 'joinedAt' && <FaSort className="ml-1 text-gray-300" />}
                </div>
              </th>
              <th 
                className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('hasEntry')}
              >
                <div className="flex items-center">
                  <span>{entryType} Status</span>
                  {(sortConfig.key === 'hasEntry' || sortConfig.key === 'hasBracket') && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                    </span>
                  )}
                  {(sortConfig.key !== 'hasEntry' && sortConfig.key !== 'hasBracket') && <FaSort className="ml-1 text-gray-300" />}
                </div>
              </th>
              <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-3 py-4 sm:px-6 sm:py-4 text-center text-sm text-gray-500">
                  {filterValue 
                    ? 'No participants match your search' 
                    : 'No participants found in this league'}
                </td>
              </tr>
            ) : (
              filteredParticipants.map(participant => (
                <tr key={participant.id} className={participant.isAdmin ? 'bg-blue-50' : ''}>
                  <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <FaUser className="text-gray-600" />
                      </div>
                      <div className="ml-2 sm:ml-4">
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-32 sm:max-w-none">{participant.email}</div>
                        {renderParticipantDetails && renderParticipantDetails(participant)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center text-xs sm:text-sm text-gray-500">
                      <FaCalendarAlt className="text-gray-400 mr-1" />
                      <span>{formatDate(participant.joinedAt)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${participant.statusClass}`}>
                        {participant.statusIcon} {participant.statusText}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium">
                    {participant.isAdmin ? (
                      <span className="text-xs text-gray-500">League Owner</span>
                    ) : (
                      <button
                        onClick={() => handleRemoveParticipant(participant)}
                        disabled={isArchived}
                        className={`text-red-600 hover:text-red-800 ${isArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center">
                          <FaUserMinus className="mr-1" /> 
                          <span className="hidden sm:inline">Remove</span>
                        </div>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Confirmation Modal for Removing Participant */}
      {kickingUserId && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FaUserTimes className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Remove Participant
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to remove <strong>{kickingUserId.name}</strong> from this league? 
                        This will delete their {entryType.toLowerCase()} and remove the league from their profile.
                      </p>
                      
                      {kickingUserId.hasEntry && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                          <FaExclamationTriangle className="inline mr-1" />
                          {getEntryVerificationMessage(kickingUserId)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmRemoveParticipant}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={cancelRemoveParticipant}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* League info at bottom */}
      <div className="mt-6 text-xs text-gray-500 px-2 sm:px-0">
        <p>League ID: {leagueId}</p>
        <p>Total participants: {participants.length}</p>
        {isArchived && <p className="mt-1 font-medium">This league is archived. Participant management is limited.</p>}
      </div>
    </div>
  );
};

export default BaseAdminParticipants;
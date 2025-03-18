import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  FaUser, 
  FaSpinner, 
  FaUserShield, 
  FaBan, 
  FaCheck,
  FaExclamationCircle,
  FaSearch
} from 'react-icons/fa';

const ManageUsers = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Load users data
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by creation date (newest first)
        usersData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt.seconds * 1000) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt.seconds * 1000) : new Date(0);
          return dateB - dateA;
        });
        
        setUsers(usersData);
      } catch (err) {
        console.error('Error loading users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUsers();
  }, []);
  
  // Toggle user admin status
  const toggleAdminStatus = async (userId, isCurrentlyAdmin) => {
    if (userId === currentUser.uid) {
      alert("You cannot remove your own admin privileges.");
      return;
    }
    
    try {
      setIsUpdating(true);
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: !isCurrentlyAdmin,
        updatedAt: new Date()
      });
      
      // Update the local state
      setUsers(users.map(user => {
        if (user.id === userId) {
          return { ...user, isAdmin: !isCurrentlyAdmin };
        }
        return user;
      }));
      
    } catch (err) {
      console.error('Error updating admin status:', err);
      setError('Failed to update user. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Toggle user banned status
  const toggleBanStatus = async (userId, isCurrentlyBanned) => {
    if (userId === currentUser.uid) {
      alert("You cannot ban yourself.");
      return;
    }
    
    try {
      setIsUpdating(true);
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isBanned: !isCurrentlyBanned,
        updatedAt: new Date()
      });
      
      // Update the local state
      setUsers(users.map(user => {
        if (user.id === userId) {
          return { ...user, isBanned: !isCurrentlyBanned };
        }
        return user;
      }));
      
    } catch (err) {
      console.error('Error updating ban status:', err);
      setError('Failed to update user. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.seconds 
      ? new Date(timestamp.seconds * 1000) 
      : new Date(timestamp);
      
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.username && user.username.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchLower))
    );
  });
  
  return (
    <div className="space-y-6">
      {/* Search and stats */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
        
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-gray-700 rounded-md">
            <span className="text-gray-300 text-sm">Total Users:</span>
            <span className="ml-2 font-bold">{users.length}</span>
          </div>
          
          <div className="px-4 py-2 bg-gray-700 rounded-md">
            <span className="text-gray-300 text-sm">Admins:</span>
            <span className="ml-2 font-bold">{users.filter(user => user.isAdmin).length}</span>
          </div>
          
          <div className="px-4 py-2 bg-gray-700 rounded-md">
            <span className="text-gray-300 text-sm">Banned:</span>
            <span className="ml-2 font-bold">{users.filter(user => user.isBanned).length}</span>
          </div>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg flex items-center">
          <FaExclamationCircle className="mr-2 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Users table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <FaSpinner className="animate-spin text-2xl text-indigo-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Joined
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
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                            {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">
                              {user.displayName || user.username || 'Unnamed User'}
                            </div>
                            <div className="text-sm text-gray-400">
                              @{user.username || 'no-username'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{formatDate(user.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {user.isAdmin && (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-800 text-purple-200">
                              Admin
                            </span>
                          )}
                          {user.isBanned && (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-800 text-red-200">
                              Banned
                            </span>
                          )}
                          {!user.isAdmin && !user.isBanned && (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-800 text-green-200">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleAdminStatus(user.id, user.isAdmin)}
                            disabled={isUpdating}
                            className={`px-2 py-1 rounded ${
                              user.isAdmin
                                ? 'bg-purple-900 hover:bg-purple-800'
                                : 'bg-gray-700 hover:bg-gray-600'
                            } transition-colors`}
                            title={user.isAdmin ? "Remove admin" : "Make admin"}
                          >
                            <FaUserShield className={`${user.isAdmin ? 'text-purple-300' : 'text-gray-400'}`} />
                          </button>
                          
                          <button
                            onClick={() => toggleBanStatus(user.id, user.isBanned)}
                            disabled={isUpdating}
                            className={`px-2 py-1 rounded ${
                              user.isBanned
                                ? 'bg-red-900 hover:bg-red-800'
                                : 'bg-gray-700 hover:bg-gray-600'
                            } transition-colors`}
                            title={user.isBanned ? "Unban user" : "Ban user"}
                          >
                            {user.isBanned ? (
                              <FaCheck className="text-green-400" />
                            ) : (
                              <FaBan className="text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-gray-400">
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUsers;
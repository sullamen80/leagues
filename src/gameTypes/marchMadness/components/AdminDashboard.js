// src/gameTypes/marchMadness/components/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaCog, FaUsers, FaLock, FaLockOpen, FaClipboardCheck, FaDownload, FaTrophy, FaArchive, FaCalculator, FaEyeSlash, FaEye } from 'react-icons/fa';
import { endLeague } from '../../../gameTypes/common/services/leagueService';

/**
 * Admin dashboard for league owners to manage the tournament
 */
const AdminDashboard = () => {
  const [leagueData, setLeagueData] = useState(null);
  const [tournamentData, setTournamentData] = useState(null);
  const [userCount, setUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lockStatus, setLockStatus] = useState({});
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isEndingLeague, setIsEndingLeague] = useState(false);
  
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  
  // Fetch league and tournament data
  useEffect(() => {
    if (!leagueId || !userId) {
      setError("League ID and user ID are required");
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
        
        const leagueData = leagueSnap.data();
        setLeagueData(leagueData);
        
        // Check if user is owner
        setIsOwner(leagueData.ownerId === userId);
        
        if (leagueData.ownerId !== userId) {
          setError("You don't have permission to access this page");
          setIsLoading(false);
          return;
        }
        
        // Get tournament data
        const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (tournamentSnap.exists()) {
          setTournamentData(tournamentSnap.data());
        }
        
        // Get lock status
        const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
        const locksSnap = await getDoc(locksRef);
        
        if (locksSnap.exists()) {
          setLockStatus(locksSnap.data());
        }
        
        // Get fog of war status
        const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
        const visibilitySnap = await getDoc(visibilityRef);
        
        if (visibilitySnap.exists()) {
          setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
        }
        
        // Count users
        const userBracketsRef = collection(db, "leagues", leagueId, "userData");
        const userBracketsSnap = await getDocs(userBracketsRef);
        setUserCount(userBracketsSnap.size);
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading admin data:", err);
        setError("Failed to load league data. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId, userId]);
  
  // Toggle the lock status for a round
  const handleToggleLock = async (round) => {
    if (!isOwner || !leagueId) return;
    
    try {
      const currentStatus = lockStatus[round]?.locked || false;
      const newStatus = !currentStatus;
      
      // Update in Firestore
      const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
      await updateDoc(locksRef, {
        [round]: {
          locked: newStatus,
          lockedAt: newStatus ? new Date().toISOString() : null
        }
      });
      
      // Update local state
      setLockStatus({
        ...lockStatus,
        [round]: {
          locked: newStatus,
          lockedAt: newStatus ? new Date().toISOString() : null
        }
      });
      
      setFeedback(`${round} is now ${newStatus ? 'locked' : 'unlocked'}`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error updating lock status:", err);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Toggle fog of war setting
  const handleToggleFogOfWar = async () => {
    if (!isOwner || !leagueId || leagueData?.status === 'archived') return;
    
    try {
      const newStatus = !fogOfWarEnabled;
      
      // Update in Firestore
      const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
      await setDoc(visibilityRef, {
        fogOfWarEnabled: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      }, { merge: true });
      
      // Update local state
      setFogOfWarEnabled(newStatus);
      
      setFeedback(`Fog of War is now ${newStatus ? 'enabled' : 'disabled'}`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error updating fog of war status:", err);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Handle ending the league and determining winners
  const handleEndLeague = async () => {
    if (!isOwner || !leagueId || leagueData?.status === 'archived') {
      return;
    }

    const confirmEnd = window.confirm(
      "Are you sure you want to end this league? This will:\n" +
      "- Determine the winner(s)\n" +
      "- Record the win in players' profiles\n" +
      "- Archive the league\n\n" +
      "This action cannot be undone."
    );

    if (!confirmEnd) return;

    try {
      setIsEndingLeague(true);
      setFeedback("Ending league and determining winners...");

      // Use the centralized league service to end the league
      const result = await endLeague(leagueId, userId);
      
      if (!result.success) {
        throw new Error("Failed to end league");
      }

      // Update the local state with new league data
      setLeagueData({
        ...leagueData,
        status: 'archived',
        archivedAt: result.archivedAt,
        winners: result.winners
      });
      
      // Show success message
      const winnerNames = result.winners.map(w => w.userName).join(', ');
      setFeedback(`League ended successfully! Winner${result.winners.length > 1 ? 's' : ''}: ${winnerNames}`);
      
    } catch (err) {
      console.error("Error ending league:", err);
      setFeedback(`Error ending league: ${err.message}`);
    } finally {
      setIsEndingLeague(false);
      setTimeout(() => setFeedback(''), 5000);
    }
  };
  
  // Export tournament data as JSON
  const handleExportData = () => {
    if (!tournamentData) return;
    
    try {
      // Create a JSON string with the tournament data
      const dataStr = JSON.stringify(tournamentData, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.download = `tournament-data-${leagueId}.json`;
      link.href = url;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting data:", err);
      setFeedback(`Error exporting data: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    }
  };
  
  // Navigate to settings page
  const handleGoToSettings = () => {
    navigate(`/league/${leagueId}/admin/settings`);
  };
  
  // Navigate to scoring settings page
  const handleGoToScoringSettings = () => {
    navigate(`/league/${leagueId}/admin/scoring`);
  };
  
  // Navigate back to dashboard
  const handleBack = () => {
    navigate(`/league/${leagueId}`);
  };
  
  // Count filled teams in the tournament
  const getTeamCount = () => {
    if (!tournamentData?.SetTeams) return 0;
    
    const regions = ['eastRegion', 'westRegion', 'midwestRegion', 'southRegion'];
    let count = 0;
    
    regions.forEach(region => {
      if (Array.isArray(tournamentData.SetTeams[region])) {
        count += tournamentData.SetTeams[region].filter(team => team && team.name).length;
      }
    });
    
    return count;
  };
  
  // Get tournament status text
  const getTournamentStatus = () => {
    if (!tournamentData) return 'Not Set Up';
    
    if (tournamentData.Champion) {
      return 'Completed';
    }
    
    if (tournamentData.RoundOf64 && tournamentData.RoundOf64.some(match => match && match.winner)) {
      return 'In Progress';
    }
    
    if (getTeamCount() > 0) {
      return 'Teams Set';
    }
    
    return 'Not Started';
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading admin dashboard...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition"
          >
            <FaArrowLeft className="mr-2" /> Back to Dashboard
          </button>
        </div>
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Get league status display
  const getLeagueStatusDisplay = () => {
    if (leagueData?.status === 'archived') {
      return (
        <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 mb-6">
          <div className="flex items-center">
            <FaArchive className="text-gray-500 mr-2" />
            <span className="font-semibold text-gray-700">This league has been archived</span>
          </div>
          {leagueData.winners && leagueData.winners.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold">Winner{leagueData.winners.length > 1 ? 's' : ''}:</p>
              <ul className="list-disc list-inside ml-2">
                {leagueData.winners.map((winner, index) => (
                  <li key={index} className="text-green-700">
                    {winner.userName} ({winner.score} points)
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-1">
                Archived on {leagueData.archivedAt?.toDate().toLocaleString() || 'unknown date'}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition"
          >
            <FaArrowLeft className="mr-2" /> Back to Dashboard
          </button>
          
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleGoToSettings}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            <FaCog className="mr-2" /> Tournament Settings
          </button>
          
          <button
            onClick={handleGoToScoringSettings}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
          >
            <FaCalculator className="mr-2" /> Scoring Settings
          </button>
        </div>
      </div>
      
      {/* Feedback messages */}
      {feedback && (
        <div className={`mb-4 p-3 rounded border ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}

      {/* League archive status banner (if archived) */}
      {getLeagueStatusDisplay()}
      
      {/* League overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FaUsers className="text-blue-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Players</p>
              <p className="text-2xl font-bold">{userCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <FaClipboardCheck className="text-green-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Teams Set</p>
              <p className="text-2xl font-bold">{getTeamCount()}/64</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-full mr-4">
              <FaLock className="text-yellow-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bracket Status</p>
              <p className="text-2xl font-bold">{lockStatus.RoundOf64?.locked ? 'Locked' : 'Open'}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <FaClipboardCheck className="text-purple-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tournament Status</p>
              <p className="text-2xl font-bold">{getTournamentStatus()}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Fog of War Control */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Bracket Visibility Settings</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Fog of War</h3>
              <p className="text-sm text-gray-600 max-w-3xl">
                When enabled, players cannot see other participants' brackets until the tournament is completed. 
                This creates more suspense and prevents players from copying each other's strategies or tracking 
                their relative standings too closely.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Current status: <span className="font-medium">{fogOfWarEnabled ? 'Enabled' : 'Disabled'}</span>
              </p>
            </div>
            <button
              onClick={handleToggleFogOfWar}
              disabled={leagueData?.status === 'archived'}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                fogOfWarEnabled 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              } ${leagueData?.status === 'archived' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {fogOfWarEnabled ? (
                <>
                  <FaEye /> Show All Brackets
                </>
              ) : (
                <>
                  <FaEyeSlash /> Hide Other Brackets
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Lock Controls */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Round Lock Controls</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="mb-4 text-gray-600">
            Locking a round prevents users from making changes to their brackets. Typically, you should lock the bracket before the first game of each round.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'].map(round => (
              <div key={round} className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{round.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-sm text-gray-500">
                      {lockStatus[round]?.locked 
                        ? `Locked on ${new Date(lockStatus[round].lockedAt).toLocaleString()}` 
                        : 'Not locked'}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleToggleLock(round)}
                    disabled={leagueData?.status === 'archived'}
                    className={`p-2 rounded-full ${
                      lockStatus[round]?.locked
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    } ${leagueData?.status === 'archived' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {lockStatus[round]?.locked ? <FaLock /> : <FaLockOpen />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Admin Actions */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Admin Actions</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Tournament Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure teams, brackets, and other tournament settings.
              </p>
              <button
                onClick={handleGoToSettings}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition w-full justify-center"
              >
                <FaCog className="mr-2" /> Settings
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Scoring Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure point values and bonus scoring rules for the tournament.
              </p>
              <button
                onClick={handleGoToScoringSettings}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition w-full justify-center"
              >
                <FaCalculator className="mr-2" /> Scoring
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Export Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download the current tournament data as a JSON file for backup.
              </p>
              <button
                onClick={handleExportData}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full justify-center"
              >
                <FaDownload className="mr-2" /> Export
              </button>
            </div>

            {/* End League button */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">End League</h3>
              <p className="text-sm text-gray-600 mb-4">
                Determine winners, record results, and archive the league.
              </p>
              <button
                onClick={handleEndLeague}
                disabled={isEndingLeague || leagueData?.status === 'archived'}
                className={`flex items-center px-4 py-2 ${
                  isEndingLeague || leagueData?.status === 'archived'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white rounded transition w-full justify-center`}
              >
                {isEndingLeague ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaTrophy className="mr-2" /> 
                    {leagueData?.status === 'archived' ? 'Archived' : 'End League'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
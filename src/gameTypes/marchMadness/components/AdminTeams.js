// src/gameTypes/marchMadness/components/AdminTeams.js
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { FaClipboardCheck, FaExclamationTriangle, FaUserEdit } from 'react-icons/fa';
import BaseAdminParticipants from '../../common/components/BaseAdminParticipants';
import { db } from '../../../firebase';

/**
 * Admin component for managing March Madness league participants
 * Extends BaseAdminParticipants with March Madness specific functionality
 */
const AdminTeams = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickParticipants, setQuickParticipants] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const fetchQuickParticipants = useCallback(async () => {
    if (!leagueId) return;

    try {
      const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
      if (!leagueSnap.exists()) return;

      const league = leagueSnap.data();
      const participantMap = new Map();

      if (Array.isArray(league.users)) {
        league.users.forEach((entry) => {
          if (typeof entry === 'string') {
            participantMap.set(entry, { id: entry, name: entry });
            return;
          }

          if (entry?.id) {
            participantMap.set(entry.id, {
              id: entry.id,
              name: entry.username || entry.name || entry.email || entry.id
            });
          }
        });
      }

      if (Array.isArray(league.members)) {
        league.members.forEach((userId) => {
          if (!participantMap.has(userId)) {
            participantMap.set(userId, { id: userId, name: userId });
          }
        });
      }

      setQuickParticipants(
        Array.from(participantMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error('Error loading participant list:', error);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchQuickParticipants();
  }, [fetchQuickParticipants]);

  const handleEditUserBracket = () => {
    if (!selectedUserId) return;

    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'editUser');
    searchParams.set('targetUser', selectedUserId);
    navigate(`${location.pathname}?${searchParams.toString()}`);
  };

  // Function to determine if a participant has completed their bracket
  const getBracketStatus = (participant) => {
    // Check if the participant has filled out any part of their bracket
    const hasBracket = participant.entryData && 
      participant.entryData.RoundOf64 && 
      participant.entryData.RoundOf64.some(m => m && m.winner);
    
    // Return status object with all the necessary display properties
    return {
      hasEntry: hasBracket,
      hasBracket: hasBracket, // For compatibility with the original implementation
      statusText: hasBracket ? 'Bracket Saved' : 'No Bracket',
      statusClass: hasBracket ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
      statusIcon: hasBracket ? <FaClipboardCheck className="mr-1" /> : <FaExclamationTriangle className="mr-1" />
    };
  };
  
  // Verification message when removing a participant
  const getBracketVerificationMessage = (participant) => {
    return "This participant has already filled out their bracket. All their progress will be lost.";
  };
  
  // Render custom stats cards if needed
  const renderMarchMadnessStats = (stats, participants, isArchived) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 px-2 sm:px-0">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-blue-700">Total Participants</span>
            <span className="text-lg sm:text-xl font-bold text-blue-800">{participants.length}</span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-green-700">With Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-green-800">
              {participants.filter(p => p.hasBracket).length}
            </span>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-yellow-700">Without Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-yellow-800">
              {participants.filter(p => !p.hasBracket).length}
            </span>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-purple-700">Bracket Fill Rate</span>
            <span className="text-lg sm:text-xl font-bold text-purple-800">
              {participants.length > 0 
                ? Math.round((participants.filter(p => p.hasBracket).length / participants.length) * 100)
                : 0}%
            </span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render additional participant details if needed
  const renderParticipantDetails = (participant) => {
    // For now, we won't add any additional details
    // This is a placeholder for any custom details we might want to add later
    return null;
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <FaUserEdit className="mr-2 text-blue-500" />
          Edit Participant Bracket
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Select a participant and open their bracket in an admin editor. This editor ignores round locks.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
          >
            <option value="">Select participant</option>
            {quickParticipants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name} ({participant.id})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleEditUserBracket}
            disabled={!selectedUserId}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Edit Bracket
          </button>
        </div>
      </div>

      <BaseAdminParticipants 
        entryType="Bracket"
        getParticipantStatus={getBracketStatus}
        renderParticipantDetails={renderParticipantDetails}
        renderStatsCards={renderMarchMadnessStats}
        getEntryVerificationMessage={getBracketVerificationMessage}
        pageTitle="Manage Participants"
        backPath="admin"
      />
    </div>
  );
};

export default AdminTeams;

// src/gameTypes/nbaPlayoffs/components/PlayoffsAdminTeams.js
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  FaClipboardCheck,
  FaExclamationTriangle,
  FaPlus,
  FaSpinner,
  FaTrophy,
  FaUserEdit,
  FaUserPlus
} from 'react-icons/fa';
import BaseAdminParticipants from '../../common/components/BaseAdminParticipants';
import { db } from '../../../firebase';
import { addUserToLeague } from '../../common/services/leagueService';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

/**
 * Admin component for managing NBA Playoffs league participants
 * Extends BaseAdminParticipants with NBA Playoffs specific functionality
 */
const AdminTeams = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickParticipants, setQuickParticipants] = useState([]);
  const [availableSiteUsers, setAvailableSiteUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSiteUserId, setSelectedSiteUserId] = useState('');
  const [siteUserSearch, setSiteUserSearch] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [participantFeedback, setParticipantFeedback] = useState(null);
  const [participantsVersion, setParticipantsVersion] = useState(0);

  const clearFeedback = useCallback(() => {
    setTimeout(() => setParticipantFeedback(null), 4000);
  }, []);

  const fetchParticipantOptions = useCallback(async () => {
    if (!leagueId) return;

    try {
      const [leagueSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', leagueId)),
        getDocs(collection(db, 'users'))
      ]);

      if (!leagueSnap.exists()) return;

      const league = leagueSnap.data();
      const participantMap = new Map();
      const participantIds = new Set();

      if (Array.isArray(league.users)) {
        league.users.forEach((entry) => {
          if (typeof entry === 'string') {
            participantMap.set(entry, { id: entry, name: entry });
            participantIds.add(entry);
            return;
          }

          if (entry?.id) {
            participantMap.set(entry.id, {
              id: entry.id,
              name: entry.username || entry.displayName || entry.email || entry.id
            });
            participantIds.add(entry.id);
          }
        });
      }

      if (Array.isArray(league.members)) {
        league.members.forEach((userId) => {
          participantIds.add(userId);
          if (!participantMap.has(userId)) {
            participantMap.set(userId, { id: userId, name: userId });
          }
        });
      }

      const siteUsers = usersSnap.docs.map((userDoc) => {
        const userData = userDoc.data() || {};
        const displayName =
          userData.displayName ||
          userData.username ||
          userData.email ||
          userDoc.id;

        return {
          id: userDoc.id,
          displayName,
          username: userData.username || '',
          email: userData.email || '',
          photoURL: userData.photoURL || null,
          isBanned: userData.isBanned === true
        };
      });

      siteUsers.forEach((siteUser) => {
        if (participantMap.has(siteUser.id)) {
          participantMap.set(siteUser.id, {
            id: siteUser.id,
            name: siteUser.displayName
          });
        }
      });

      setQuickParticipants(
        Array.from(participantMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      );

      setAvailableSiteUsers(
        siteUsers
          .filter((siteUser) => !participantIds.has(siteUser.id))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
      );
    } catch (error) {
      console.error('Error loading participant list:', error);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchParticipantOptions();
  }, [fetchParticipantOptions]);

  const handleEditUserBracket = () => {
    if (!selectedUserId) return;

    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'editUser');
    searchParams.set('targetUser', selectedUserId);
    navigate(`${location.pathname}?${searchParams.toString()}`);
  };

  const navigateToEditUser = useCallback((userId) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'editUser');
    searchParams.set('targetUser', userId);
    navigate(`${location.pathname}?${searchParams.toString()}`);
  }, [location.search, location.pathname, navigate]);

  const handleAddSiteUser = useCallback(async (openEditorAfterAdd = false) => {
    if (!leagueId || !selectedSiteUserId) return;

    const selectedUser = availableSiteUsers.find((user) => user.id === selectedSiteUserId);
    if (!selectedUser) return;

    try {
      setIsAddingUser(true);
      setParticipantFeedback(null);

      await addUserToLeague(leagueId, selectedSiteUserId, {
        username: selectedUser.username || selectedUser.displayName,
        displayName: selectedUser.displayName,
        email: selectedUser.email || null,
        photoURL: selectedUser.photoURL || null
      });

      await fetchParticipantOptions();
      setParticipantsVersion((current) => current + 1);
      setSelectedUserId(selectedSiteUserId);
      setSelectedSiteUserId('');
      setSiteUserSearch('');

      if (openEditorAfterAdd) {
        navigateToEditUser(selectedSiteUserId);
        return;
      }

      setParticipantFeedback({
        type: 'success',
        message: `${selectedUser.displayName} was added to the league.`
      });
      clearFeedback();
    } catch (error) {
      console.error('Error adding user to league:', error);
      setParticipantFeedback({
        type: 'error',
        message: error.message || 'Failed to add user to the league.'
      });
      clearFeedback();
    } finally {
      setIsAddingUser(false);
    }
  }, [
    leagueId,
    selectedSiteUserId,
    availableSiteUsers,
    fetchParticipantOptions,
    navigateToEditUser,
    clearFeedback
  ]);

  const filteredSiteUsers = availableSiteUsers.filter((user) => {
    const searchValue = siteUserSearch.trim().toLowerCase();
    if (!searchValue) return true;

    return (
      user.displayName.toLowerCase().includes(searchValue) ||
      user.username.toLowerCase().includes(searchValue) ||
      user.email.toLowerCase().includes(searchValue) ||
      user.id.toLowerCase().includes(searchValue)
    );
  });

  // Function to get round data using standardized keys
  const getRoundData = (participant, roundKey) => {
    if (!participant.entryData) return null;
    return participant.entryData[roundKey] ?? null;
  };

  const hasPlayInPicks = (participant) => {
    const playInData = getRoundData(participant, ROUND_KEYS.PLAY_IN);
    if (!playInData) return false;

    const conferences = ['east', 'west'];
    const pickKeys = ['seventhEighthWinner', 'ninthTenthWinner', 'finalWinner'];

    return conferences.some((conference) =>
      pickKeys.some((pickKey) => Boolean(playInData?.[conference]?.[pickKey]?.team))
    );
  };

  // Function to determine if a participant has completed their bracket
  const getBracketStatus = (participant) => {
    const firstRoundData = getRoundData(participant, ROUND_KEYS.FIRST_ROUND);
    const finalsData = getRoundData(participant, ROUND_KEYS.NBA_FINALS);
    const hasBracket =
      (Array.isArray(firstRoundData) && firstRoundData.some((matchup) => matchup && matchup.winner)) ||
      Boolean(finalsData?.winner) ||
      Boolean(participant.entryData?.[ROUND_KEYS.FINALS_MVP]) ||
      hasPlayInPicks(participant);
    const hasChampion = Boolean(finalsData?.winner || participant.entryData?.[ROUND_KEYS.CHAMPION]);

    return {
      hasEntry: hasBracket,
      hasBracket,
      hasChampion: hasChampion,
      statusText: hasBracket 
        ? (hasChampion ? 'Complete Bracket' : 'Partial Bracket') 
        : 'No Bracket',
      statusClass: hasChampion 
        ? 'bg-green-100 text-green-800' 
        : (hasBracket ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'),
      statusIcon: hasChampion 
        ? <FaTrophy className="mr-1" /> 
        : (hasBracket ? <FaClipboardCheck className="mr-1" /> : <FaExclamationTriangle className="mr-1" />)
    };
  };
  
  // Verification message when removing a participant
  const getBracketVerificationMessage = (participant) => {
    return "This participant has already filled out their playoff bracket. All their predictions will be lost.";
  };
  
  // Render custom stats cards
  const renderPlayoffsStats = (stats, participants, isArchived) => {
    // Calculate advanced stats
    const totalParticipants = participants.length;
    const withBrackets = participants.filter(p => p.hasBracket).length;
    const withComplete = participants.filter(p => p.hasChampion).length;
    const withPartial = withBrackets - withComplete;
    const withoutBrackets = totalParticipants - withBrackets;
    const completeRate = totalParticipants > 0 
      ? Math.round((withComplete / totalParticipants) * 100)
      : 0;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 px-2 sm:px-0">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-blue-700">Total Participants</span>
            <span className="text-lg sm:text-xl font-bold text-blue-800">{totalParticipants}</span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-green-700">Complete Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-green-800">{withComplete}</span>
            <span className="text-xs text-green-600">{completeRate}% of participants</span>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-yellow-700">Partial Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-yellow-800">{withPartial}</span>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-red-700">No Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-red-800">{withoutBrackets}</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render additional participant details
  const renderParticipantDetails = (participant) => {
    const finalsData = getRoundData(participant, ROUND_KEYS.NBA_FINALS);
    const championPick = finalsData?.winner || participant.entryData?.[ROUND_KEYS.CHAMPION];
    const finalsMvpPick = finalsData?.predictedMVP || participant.entryData?.[ROUND_KEYS.FINALS_MVP];
    
    if (championPick) {
      return (
        <div className="mt-2 text-sm">
          <span className="font-semibold">Champion Pick:</span>{' '}
          <span className="text-indigo-700">
            {championPick}
          </span>
          
          {finalsMvpPick && (
            <span className="ml-2">
              <span className="font-semibold">{ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]}:</span>{' '}
              <span className="text-indigo-700">
                {finalsMvpPick}
              </span>
            </span>
          )}
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <FaUserPlus className="mr-2 text-green-600" />
          Add Site User
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Add an existing site user to this league, then optionally jump straight into their bracket editor.
        </p>

        {participantFeedback && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-sm ${
              participantFeedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {participantFeedback.message}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={siteUserSearch}
            onChange={(e) => setSiteUserSearch(e.target.value)}
            placeholder="Search site users by name, username, email, or id"
            className="w-full rounded border px-3 py-2"
          />
          <div className="flex flex-col md:flex-row gap-3">
            <select
              value={selectedSiteUserId}
              onChange={(e) => setSelectedSiteUserId(e.target.value)}
              className="flex-1 px-3 py-2 border rounded"
            >
              <option value="">
                {filteredSiteUsers.length > 0 ? 'Select site user' : 'No available site users'}
              </option>
              {filteredSiteUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                  {user.email ? ` (${user.email})` : ` (${user.id})`}
                  {user.isBanned ? ' [banned]' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddSiteUser(false)}
              disabled={!selectedSiteUserId || isAddingUser}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {isAddingUser ? (
                <span className="flex items-center gap-2">
                  <FaSpinner className="animate-spin" />
                  Adding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FaPlus />
                  Add To League
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleAddSiteUser(true)}
              disabled={!selectedSiteUserId || isAddingUser}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
            >
              Add And Edit
            </button>
          </div>
        </div>
      </div>

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
        key={`nba-admin-participants-${participantsVersion}`}
        entryType="Bracket"
        getParticipantStatus={getBracketStatus}
        renderParticipantDetails={renderParticipantDetails}
        renderStatsCards={renderPlayoffsStats}
        getEntryVerificationMessage={getBracketVerificationMessage}
        pageTitle="Manage Participants"
        backPath="admin"
      />
    </div>
  );
};

export default AdminTeams;

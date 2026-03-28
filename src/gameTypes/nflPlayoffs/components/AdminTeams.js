// src/gameTypes/nflPlayoffs/components/AdminTeams.js
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { FaArrowLeft, FaClipboardCheck, FaExclamationTriangle, FaTrophy, FaPlus, FaUserEdit } from 'react-icons/fa';
import BaseAdminParticipants from '../../common/components/BaseAdminParticipants';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';
import { db } from '../../../firebase';
import { createUserBracketFromTemplate } from '../services/bracketService';

/**
 * Admin component for managing NFL Playoffs league participants
 * Extends BaseAdminParticipants with NFL Playoffs specific functionality
 */
const AdminTeams = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualStatus, setManualStatus] = useState({ type: '', message: '' });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [quickParticipants, setQuickParticipants] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const showMessage = (type, message) => {
    setManualStatus({ type, message });
    setTimeout(() => setManualStatus({ type: '', message: '' }), 5000);
  };

  const resolveUserRecord = useCallback(async (identifier) => {
    const trimmed = identifier.trim();
    if (!trimmed) throw new Error('Please enter a user ID, username, or email.');

    const directSnap = await getDoc(doc(db, 'users', trimmed));
    if (directSnap.exists()) {
      return { userId: trimmed, data: directSnap.data() };
    }

    const usersRef = collection(db, 'users');

    const tryQuery = async (field) => {
      const q = query(usersRef, where(field, '==', trimmed));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { userId: docSnap.id, data: docSnap.data() };
      }
      return null;
    };

    const emailResult = await tryQuery('email');
    if (emailResult) return emailResult;

    const usernameResult = await tryQuery('username');
    if (usernameResult) return usernameResult;

    throw new Error('User not found.');
  }, []);

  const fetchQuickParticipants = useCallback(async () => {
    if (!leagueId) return;
    try {
      const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
      if (!leagueSnap.exists()) return;
      const league = leagueSnap.data();
      const list = [];
      if (Array.isArray(league.users)) {
        league.users.forEach((entry) => {
          if (typeof entry === 'string') {
            list.push({ id: entry, name: entry });
          } else if (entry?.id) {
            list.push({
              id: entry.id,
              name: entry.username || entry.name || entry.email || entry.id
            });
          }
        });
      } else if (Array.isArray(league.members)) {
        league.members.forEach((userId) => list.push({ id: userId, name: userId }));
      }
      setQuickParticipants(list);
    } catch (error) {
      console.error('Error loading quick participants:', error);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchQuickParticipants();
  }, [fetchQuickParticipants, refreshKey]);

  const handleManualAdd = async (event) => {
    event.preventDefault();
    if (!leagueId) return;

    try {
      setIsAddingUser(true);
      const { userId, data } = await resolveUserRecord(manualIdentifier);
      const userDisplayName = data.displayName || data.username || data.email || 'Unknown User';

      const leagueRef = doc(db, 'leagues', leagueId);

      await setDoc(
        leagueRef,
        {
          members: arrayUnion(userId),
          users: arrayUnion({
            id: userId,
            username: userDisplayName,
            email: data.email || ''
          })
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', userId),
        {
          leagueIds: arrayUnion(leagueId)
        },
        { merge: true }
      );

      await createUserBracketFromTemplate(leagueId, userId);

      showMessage('success', `${userDisplayName} was added to the league.`);
      setManualIdentifier('');
      setRefreshKey((key) => key + 1);
      fetchQuickParticipants();
    } catch (error) {
      console.error('Error adding user:', error);
      showMessage('error', error.message || 'Failed to add user.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleImpersonate = () => {
    if (!selectedUserId) {
      showMessage('error', 'Select a participant to impersonate.');
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'editUser');
    searchParams.set('targetUser', selectedUserId);
    navigate(`${location.pathname}?${searchParams.toString()}`);
  };
  
  const handleBackToAdmin = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.delete('subview');
    navigate(`${location.pathname.split('/').slice(0, 3).join('/')}?${searchParams.toString()}`, { replace: true });
  };

  // Function to get round data using standardized keys
  const getRoundData = (participant, roundKey) => {
    if (!participant.entryData) return null;
    return participant.entryData[roundKey] || [];
  };

  const countWinnerPicks = (roundData) => {
    if (Array.isArray(roundData)) {
      return roundData.filter((matchup) => matchup && matchup.winner).length;
    }
    if (roundData && typeof roundData === 'object') {
      return roundData.winner ? 1 : 0;
    }
    return 0;
  };

  const getRoundSubmissionSummary = (participant) => {
    const entryData = participant.entryData || {};
    const rounds = [
      { key: ROUND_KEYS.FIRST_ROUND, label: 'WC' },
      { key: ROUND_KEYS.CONF_SEMIS, label: 'DIV' },
      { key: ROUND_KEYS.CONF_FINALS, label: 'CONF' },
      { key: ROUND_KEYS.SUPER_BOWL, label: 'SB' }
    ];

    const roundDetails = rounds.map(({ key, label }) => {
      const roundData = entryData[key];
      const total = Array.isArray(roundData)
        ? roundData.length
        : roundData && typeof roundData === 'object'
          ? 1
          : 0;
      const picked = countWinnerPicks(roundData);
      return { key, label, picked, total };
    });

    const hasSuperWinnerPick = Boolean(entryData.superWinnerPick);
    const hasMvpPick = Boolean(entryData[ROUND_KEYS.FINALS_MVP]);

    return {
      roundDetails,
      hasSuperWinnerPick,
      hasMvpPick
    };
  };

  // Function to determine if a participant has completed their bracket
  const getBracketStatus = (participant) => {
    const { roundDetails, hasSuperWinnerPick, hasMvpPick } = getRoundSubmissionSummary(participant);
    const totalPicked = roundDetails.reduce((sum, round) => sum + round.picked, 0);
    const totalSlots = roundDetails.reduce((sum, round) => sum + round.total, 0);

    const hasBracket = totalPicked > 0 || hasSuperWinnerPick || hasMvpPick;

    // Check if they've made a championship prediction
    const superBowlData = getRoundData(participant, ROUND_KEYS.SUPER_BOWL);
    const hasChampion = Boolean(
      participant.entryData?.[ROUND_KEYS.CHAMPION] ||
      superBowlData?.winner
    );

    const roundSummary = roundDetails
      .filter((round) => round.total > 0)
      .map((round) => `${round.label} ${round.picked}/${round.total}`)
      .join(' • ');

    const statusSuffix = roundSummary ? ` (${roundSummary})` : '';

    return {
      hasEntry: hasBracket,
      hasBracket: hasBracket, // For compatibility with the base implementation
      hasChampion: hasChampion,
      statusText: hasBracket
        ? (hasChampion ? `Complete${statusSuffix}` : `Partial${statusSuffix}`)
        : 'No Bracket',
      statusClass: hasChampion
        ? 'bg-green-100 text-green-800'
        : (hasBracket ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'),
      statusIcon: hasChampion
        ? <FaTrophy className="mr-1" />
        : (hasBracket ? <FaClipboardCheck className="mr-1" /> : <FaExclamationTriangle className="mr-1" />),
      roundDetails,
      hasSuperWinnerPick,
      hasMvpPick
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
    const champion = participant.entryData?.[ROUND_KEYS.CHAMPION] || participant.entryData?.[ROUND_KEYS.SUPER_BOWL]?.winner;
    const mvpSelection = participant.entryData?.[ROUND_KEYS.FINALS_MVP];
    const { roundDetails, hasSuperWinnerPick, hasMvpPick } = participant.roundDetails
      ? participant
      : getRoundSubmissionSummary(participant);

    return (
      <div className="mt-2 text-xs text-gray-600">
        <div className="flex flex-wrap gap-2">
          {roundDetails.map((round) => (
            <span
              key={round.key}
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                round.total === 0
                  ? 'bg-gray-100 text-gray-500'
                  : round.picked === round.total
                    ? 'bg-green-100 text-green-700'
                    : round.picked > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
              }`}
            >
              {round.label}: {round.picked}/{round.total || 0}
            </span>
          ))}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              hasSuperWinnerPick ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Super Winner: {hasSuperWinnerPick ? 'Yes' : 'No'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              hasMvpPick ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            MVP: {hasMvpPick ? 'Yes' : 'No'}
          </span>
        </div>

        {champion && (
          <div className="mt-2 text-sm">
            <span className="font-semibold">Champion Pick:</span>{' '}
            <span className="text-indigo-700">
              {champion}
            </span>

            {mvpSelection && (
              <span className="ml-2">
                <span className="font-semibold">{ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]}:</span>{' '}
                <span className="text-indigo-700">
                  {mvpSelection}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 sm:pb-4">
        <div className="flex items-center mb-3 sm:mb-0">
          <button
            onClick={handleBackToAdmin}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition mr-2 sm:mr-4"
          >
            <FaArrowLeft className="mr-1 sm:mr-2" /> Back
          </button>
          <h1 className="text-lg sm:text-2xl font-bold">Manage Participants</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <FaPlus className="mr-2 text-indigo-500" />
          Add Existing User
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Enter a user ID, username, or email for someone already registered in the app.
        </p>
        <form onSubmit={handleManualAdd} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={manualIdentifier}
            onChange={(e) => setManualIdentifier(e.target.value)}
            placeholder="User ID, email, or username"
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            type="submit"
            disabled={!manualIdentifier.trim() || isAddingUser}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            {isAddingUser ? 'Adding...' : 'Add User'}
          </button>
        </form>
        {manualStatus.message && (
          <div
            className={`mt-3 text-sm ${
              manualStatus.type === 'error' ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {manualStatus.message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <FaUserEdit className="mr-2 text-blue-500" />
          Impersonate Participant
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Select a participant and edit their bracket directly. This temporarily bypasses locks.
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
            onClick={handleImpersonate}
            disabled={!selectedUserId}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Edit as User
          </button>
        </div>
      </div>

      <BaseAdminParticipants 
        key={refreshKey}
        entryType="Bracket"
        getParticipantStatus={getBracketStatus}
        renderParticipantDetails={renderParticipantDetails}
        renderStatsCards={renderPlayoffsStats}
        getEntryVerificationMessage={getBracketVerificationMessage}
        pageTitle="Manage Participants"
        showHeader={false}
      />
    </div>
  );
};

export default AdminTeams;

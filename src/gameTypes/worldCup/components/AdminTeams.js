import React from 'react';
import {
  FaClipboardCheck,
  FaExclamationTriangle,
  FaGlobeAmericas,
  FaTrophy
} from 'react-icons/fa';
import BaseAdminParticipants from '../../common/components/BaseAdminParticipants';
import { createEmptyKnockoutRounds } from '../services/worldCupService';

const countCompletedGroupPicks = (groupPicks = {}) =>
  Object.values(groupPicks || {}).filter((picks) => Array.isArray(picks) && picks.length > 0 && picks.every(Boolean)).length;

const countKnockoutWinners = (knockoutPicks = {}) => {
  const defaultRounds = createEmptyKnockoutRounds();
  return Object.keys(defaultRounds).reduce((total, roundKey) => {
    const matches = knockoutPicks?.[roundKey] || [];
    return total + matches.filter((match) => Boolean(match?.winnerTeamId)).length;
  }, 0);
};

const AdminTeams = () => {
  const getEntryStatus = (participant) => {
    const entryData = participant.entryData || {};
    const groupsCompleted = countCompletedGroupPicks(entryData.groupPicks || {});
    const knockoutWinners = countKnockoutWinners(entryData.knockoutPicks || {});
    const hasGroupWork = groupsCompleted > 0;
    const hasKnockoutWork = knockoutWinners > 0;
    const hasEntry = hasGroupWork || hasKnockoutWork;
    const groupsTotal = Object.keys(entryData.groupPicks || {}).length;
    const hasCompleteGroups = groupsTotal > 0 && groupsCompleted === groupsTotal;

    return {
      hasEntry,
      statusText: hasEntry
        ? hasCompleteGroups
          ? `Active Entry (${groupsCompleted}/${groupsTotal} groups, ${knockoutWinners} knockout picks)`
          : `Partial Entry (${groupsCompleted}/${groupsTotal} groups, ${knockoutWinners} knockout picks)`
        : 'No Entry',
      statusClass: hasCompleteGroups
        ? 'bg-green-100 text-green-800'
        : hasEntry
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800',
      statusIcon: hasCompleteGroups
        ? <FaTrophy className="mr-1" />
        : hasEntry
          ? <FaClipboardCheck className="mr-1" />
          : <FaExclamationTriangle className="mr-1" />,
      groupsCompleted,
      groupsTotal,
      knockoutWinners
    };
  };

  const renderParticipantDetails = (participant) => (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
        <FaGlobeAmericas className="mr-1 inline" />
        Groups {participant.groupsCompleted || 0}/{participant.groupsTotal || 0}
      </span>
      <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700">
        <FaTrophy className="mr-1 inline" />
        Knockout {participant.knockoutWinners || 0}
      </span>
    </div>
  );

  const renderStatsCards = (_stats, participants) => {
    const totalParticipants = participants.length;
    const withGroups = participants.filter((participant) => (participant.groupsCompleted || 0) > 0).length;
    const withCompleteGroups = participants.filter(
      (participant) => participant.groupsTotal > 0 && participant.groupsCompleted === participant.groupsTotal
    ).length;
    const withKnockout = participants.filter((participant) => (participant.knockoutWinners || 0) > 0).length;

    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6 px-2 sm:px-0 md:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-blue-700">Total Participants</span>
            <span className="text-lg sm:text-xl font-bold text-blue-800">{totalParticipants}</span>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-emerald-700">With Group Picks</span>
            <span className="text-lg sm:text-xl font-bold text-emerald-800">{withGroups}</span>
          </div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-green-700">Complete Groups</span>
            <span className="text-lg sm:text-xl font-bold text-green-800">{withCompleteGroups}</span>
          </div>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-indigo-700">With Knockout Picks</span>
            <span className="text-lg sm:text-xl font-bold text-indigo-800">{withKnockout}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <BaseAdminParticipants
      entryType="World Cup Entry"
      getParticipantStatus={getEntryStatus}
      renderParticipantDetails={renderParticipantDetails}
      renderStatsCards={renderStatsCards}
      getEntryVerificationMessage={() => 'This participant already has saved World Cup picks. Removing them will delete those picks.'}
      pageTitle="Manage Participants"
      backPath="admin"
    />
  );
};

export default AdminTeams;

// src/pages/stats/components/common/StatsHeader.js
import React, { useState } from 'react';
import { formatDate } from '../../../../utils/formatters';
import { Link } from 'react-router-dom';
import {
  formatWinnerLabel,
  getAdapterNode,
  normalizeDateValue,
  resolveLeagueDetail,
  resolveUserDetail
} from '../statsViewModel';

/**
 * Header for stats page displaying metadata about the selected stats
 * Uses an accordion style that's collapsed by default
 */
const renderMetaRows = (meta) => {
  if (!meta) {
    return null;
  }

  if (React.isValidElement(meta)) {
    return meta;
  }

  const rows = Array.isArray(meta) ? meta : [meta];

  return rows
    .filter(Boolean)
    .map((row, index) => {
      if (React.isValidElement(row)) {
        return row;
      }

      if (typeof row === 'string') {
        return (
          <div key={`meta-${index}`} className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Detail</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{row}</dd>
          </div>
        );
      }

      const label = row.label || row.title || 'Detail';
      const value = row.value ?? row.content ?? '—';

      return (
        <div
          key={`meta-${index}`}
          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}
        >
          <dt className="text-sm font-medium text-gray-500">{label}</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
        </div>
      );
    });
};

const StatsHeader = ({ data, type, adapter = null, headerMeta = null }) => {
  // State to track if accordion is expanded
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!data) return null;
  
  // Toggle accordion state
  const toggleAccordion = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Render league header
  if (type === 'league') {
    const league = resolveLeagueDetail(data);
    const leagueId = league.leagueId;
    const gameTypeId = league.gameTypeId;
    const seasonId = league.seasonId;
    const completedAt = normalizeDateValue(league.completedAt);
    const timestamp = normalizeDateValue(data.timestamp);
    const playerCount = league.playerCount;
    const winners = league.winners;
    const winner = formatWinnerLabel(league.winner || winners[0]);
    const adapterMeta = headerMeta || league.headerMeta || getAdapterNode(adapter, 'renderLeagueHeaderMeta', { leagueDetail: data, league });
    
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-indigo-700 to-indigo-500 flex justify-between items-center">
          <button 
            onClick={toggleAccordion}
            className="flex items-center flex-grow text-left focus:outline-none"
          >
            <div>
              <h3 className="text-lg leading-6 font-medium text-white">League Statistics</h3>
              <p className="mt-1 max-w-2xl text-sm text-indigo-100">
                {gameTypeId} - {seasonId}
              </p>
            </div>
            <div className="ml-4 text-white">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 transition-transform duration-200 transform ${isExpanded ? 'rotate-180' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
          <Link
            to={`/league/${leagueId}?view=leaderboard&tab=leaderboard`}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ml-4"
          >
            Go to League
          </Link>
        </div>
        
        {/* Accordion Content */}
        <div 
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-screen' : 'max-h-0'}`}
        >
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">League</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {seasonId} ({leagueId})
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Game Type</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{gameTypeId}</dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Player Count</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{playerCount}</dd>
              </div>
              {league.winner || winners.length > 0 ? (
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Winner</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{winner}</dd>
                </div>
              ) : null}
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  {completedAt ? 'Completed' : 'Generated'}
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {completedAt ? formatDate(completedAt, 'long') : timestamp ? formatDate(timestamp, 'long') : 'Unknown'}
                </dd>
              </div>
              {renderMetaRows(adapterMeta)}
            </dl>
          </div>
        </div>
      </div>
    );
  }
  
  // Render user header
  else {
    const user = resolveUserDetail(data);
    const {
      userId,
      userName = 'Unknown User',
      lastUpdated,
      summary = {},
      byGameType = {}
    } = user;
    const normalizedLastUpdated = normalizeDateValue(lastUpdated);
    const adapterMeta = headerMeta || data.headerMeta || getAdapterNode(adapter, 'renderUserHeaderMeta', { userDetail: data, user });
    
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div 
          className="px-4 py-5 sm:px-6 bg-gradient-to-r from-blue-700 to-blue-500 flex justify-between items-center cursor-pointer"
          onClick={toggleAccordion}
        >
          <div>
            <h3 className="text-lg leading-6 font-medium text-white">User Statistics</h3>
            <p className="mt-1 max-w-2xl text-sm text-blue-100">
              {userName}
            </p>
          </div>
          <div className="text-white">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 transition-transform duration-200 transform ${isExpanded ? 'rotate-180' : ''}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        {/* Accordion Content */}
        <div 
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-screen' : 'max-h-0'}`}
        >
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{userId}</dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Total Leagues</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {summary.totalLeagues || 0}
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Total Wins</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {summary.totalWins || 0}
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Win Rate</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {summary.totalLeagues > 0 
                    ? `${((summary.totalWins / summary.totalLeagues) * 100).toFixed(1)}%` 
                    : '0%'}
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {normalizedLastUpdated ? formatDate(normalizedLastUpdated, 'long') : 'Unknown'}
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Game Types</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {Object.keys(byGameType).length > 0 ? Object.keys(byGameType).join(', ') : 'None'}
                </dd>
              </div>
              {renderMetaRows(adapterMeta)}
            </dl>
          </div>
        </div>
      </div>
    );
  }
};

export default StatsHeader;

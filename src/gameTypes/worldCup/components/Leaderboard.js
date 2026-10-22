import React from 'react';
import { auth } from '../../../firebase';
import { FaChartBar, FaEye, FaEyeSlash, FaMedal, FaTrophy } from 'react-icons/fa';
import BaseLeaderboard from '../../common/components/BaseLeaderboard';
import { fetchLeaderboardEntries } from '../services/worldCupService';
import { filterWorldCupEntries } from '../utils/visibility';

const formatPercentRight = (value) => {
  if (value === null || typeof value === 'undefined') {
    return '--';
  }

  return `${Math.round(value * 100)}%`;
};

const KNOCKOUT_ROUND_LABELS = {
  roundOf32: 'Round of 32',
  roundOf16: 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  thirdPlace: 'Third Place',
  final: 'Final'
};

const Leaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  onViewBracket = null,
  fogOfWarEnabled = null,
  tournamentCompleted = null
}) => {
  const fetchLeaderboardData = async (leagueId) => {
    const result = await fetchLeaderboardEntries(leagueId);
    const isCompleted = Boolean(result.gameData?.knockoutRounds?.final?.[0]?.winnerTeamId);

    return {
      entries: result.entries || [],
      referenceData: result.gameData || null,
      isCompleted,
      settings: result.settings || null
    };
  };

  const getVisibleEntries = (entries, fogEnabled, isCompleted, ...context) =>
    filterWorldCupEntries(entries, {
      fogOfWarEnabled: fogEnabled,
      tournamentCompleted: isCompleted,
      currentUserId: context[1]
    })
      .map((entry) => ({
        ...entry,
        rank: entries.findIndex((candidate) => candidate.userId === entry.userId) + 1
      }));

  const handleViewEntry = (entryId, isEmbed, nav, league) => {
    if (isEmbed && onViewBracket) {
      return onViewBracket(entryId);
    }

    nav(`/league/${league}?view=view&tab=view&userId=${entryId}`);
    return false;
  };

  const handleViewPrimary = (isEmbed, nav, league) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      return false;
    }

    if (isEmbed && onViewBracket) {
      return onViewBracket(currentUserId);
    }

    nav(`/league/${league}?view=view&tab=view&userId=${currentUserId}`);
    return false;
  };

  const renderWorldCupHeaders = () => (
    <>
      <th className="py-3 px-4 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
      <th className="py-3 px-4 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
      <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Groups</th>
      <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Knockout</th>
      <th className="hidden md:table-cell py-3 px-4 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Right</th>
      <th className="hidden md:table-cell py-3 px-4 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bonus</th>
      <th className="py-3 px-4 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
      <th className="py-3 px-4 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
    </>
  );

  const renderWorldCupRow = (entry, index, handleShowDetails, onViewEntry) => {
    const displayRank = entry.rank || index + 1;
    const isTopThree = displayRank <= 3;
    const isCurrentUser = entry.userId === auth.currentUser?.uid;

    return (
      <tr
        key={entry.userId}
        className={`
          ${isTopThree ? 'bg-yellow-50' : ''}
          ${isCurrentUser ? 'bg-blue-50' : ''}
          hover:bg-gray-50
        `}
      >
        <td className="py-3 px-4 whitespace-nowrap">
          <div className="flex items-center">
            {displayRank === 1 ? <FaMedal className="text-yellow-500 mr-1" title="1st Place" /> : null}
            {displayRank === 2 ? <FaMedal className="text-gray-400 mr-1" title="2nd Place" /> : null}
            {displayRank === 3 ? <FaMedal className="text-amber-700 mr-1" title="3rd Place" /> : null}
            <span className={`${isTopThree ? 'font-bold' : ''} text-gray-900`}>{displayRank}</span>
          </div>
        </td>
        <td className="py-3 px-4 whitespace-nowrap">
          <span className={`${isTopThree ? 'font-bold' : ''} ${isCurrentUser ? 'font-semibold' : ''} text-gray-900`}>
            {entry.userName}
            {isCurrentUser ? <span className="ml-1 text-blue-700">(You)</span> : null}
          </span>
          <div className="mt-1 flex flex-wrap gap-2 sm:hidden">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              G {entry.groupPoints}
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              K {entry.knockoutPoints}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {formatPercentRight(entry.percentRight)}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              B {entry.bonusPoints}
            </span>
          </div>
        </td>
        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-700">{entry.groupPoints}</td>
        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-700">{entry.knockoutPoints}</td>
        <td className="hidden md:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-700">
          {formatPercentRight(entry.percentRight)}
        </td>
        <td className="hidden md:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-700">{entry.bonusPoints}</td>
        <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-gray-900">{entry.totalPoints}</td>
        <td className="py-3 px-4 whitespace-nowrap text-center">
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => handleShowDetails(entry)}
              className="sm:inline-flex sm:items-center px-2 sm:px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none"
            >
              <FaChartBar className="sm:mr-1" />
              <span className="hidden sm:inline">Details</span>
            </button>
            <button
              onClick={(event) => {
                event.preventDefault();
                onViewEntry(entry.userId);
              }}
              className="sm:inline-flex sm:items-center px-2 sm:px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
            >
              <FaEye className="sm:mr-1" />
              <span className="hidden sm:inline">View</span>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderDetailsModal = (entry, settings, visibleEntries, gameData) => {
    const leader = visibleEntries[0] || null;
    const groupsCompleted = (gameData?.groups || []).filter((group) => (group.officialOrder || []).every(Boolean)).length;
    const scoreThirdPlaceMatch = settings?.scoreThirdPlaceMatch ? 'Enabled' : 'Disabled';
    const exactScoreBonus = settings?.enableExactScoreBonus ? 'Enabled' : 'Disabled';
    const groupBreakdown = Object.values(entry.groupBreakdown || {});
    const firstPlaceHits = groupBreakdown.filter((group) => group.firstCorrect).length;
    const secondPlaceHits = groupBreakdown.filter((group) => group.secondCorrect).length;
    const perfectGroups = groupBreakdown.filter((group) => group.perfect).length;
    const groupRows = [
      {
        label: '1st place picks',
        hits: firstPlaceHits,
        total: groupsCompleted,
        points: firstPlaceHits * Number(settings?.groupFirstPlacePoints || 0)
      },
      {
        label: '2nd place picks',
        hits: secondPlaceHits,
        total: groupsCompleted,
        points: secondPlaceHits * Number(settings?.groupSecondPlacePoints || 0)
      },
      {
        label: 'Perfect groups',
        hits: perfectGroups,
        total: groupsCompleted,
        points: perfectGroups * Number(settings?.groupPerfectOrderBonus || 0)
      }
    ];
    const knockoutRows = Object.entries(entry.knockoutBreakdown || {})
      .filter(([roundKey, round]) => {
        if (roundKey === 'thirdPlace' && !settings?.scoreThirdPlaceMatch) {
          return false;
        }

        return round.possible > 0 || round.totalPoints > 0;
      });

    return (
      <div className="space-y-4 text-sm text-gray-700">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Rank</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{entry.rank}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Total Points</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{entry.totalPoints}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Percent Right</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{formatPercentRight(entry.percentRight)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Scored Picks</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{entry.correctPicks} / {entry.possiblePicks}</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Group Stage Points</h3>
            <span className="font-semibold text-gray-900">{entry.groupPoints}</span>
          </div>
          <div className="mt-3 space-y-2">
            {groupRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span>{row.label}</span>
                <span className="font-medium text-gray-900">
                  {row.points} ({row.hits}/{row.total})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Knockout Points</h3>
            <span className="font-semibold text-gray-900">{entry.knockoutPoints + entry.bonusPoints}</span>
          </div>
          <div className="mt-3 space-y-3">
            {knockoutRows.map(([roundKey, round]) => (
              <div key={roundKey} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{KNOCKOUT_ROUND_LABELS[roundKey] || roundKey}</span>
                  <span className="font-semibold text-gray-900">{round.totalPoints}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Correct picks: {round.correct}</span>
                  <span>Winner points: {round.basePoints}</span>
                </div>
                {round.exactScorePoints > 0 ? (
                  <div className="mt-1 flex items-center justify-between text-xs text-amber-700">
                    <span>Exact score bonus</span>
                    <span>{round.exactScorePoints}</span>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span>Winner points total</span>
              <span className="font-medium text-gray-900">{entry.knockoutPoints}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bonus points total</span>
              <span className="font-medium text-gray-900">{entry.bonusPoints}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="font-semibold text-gray-900">League Context</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span>Leader</span>
              <span className="font-medium text-gray-900">{leader ? leader.userName : 'No picks yet'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Groups Finalized</span>
              <span className="font-medium text-gray-900">{groupsCompleted} / 12</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Exact Score Bonus</span>
              <span className="font-medium text-gray-900">{exactScoreBonus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Third Place Match</span>
              <span className="font-medium text-gray-900">{scoreThirdPlaceMatch}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatusInfo = (leagueData) => (
    <div className="space-y-6">
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">World Cup Leaderboard</h2>
            <p className="text-sm text-gray-500">
              {leagueData?.title || 'This league'} uses one table for group-stage picks and the later knockout bracket.
            </p>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">
            <FaChartBar className="mr-2 inline" />
            Live scoring
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
          <FaTrophy className="mr-2 inline" />
          One leaderboard across both phases
        </span>
        <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">
          <FaEye className="mr-2 inline" />
          View any saved entry
        </span>
      </div>
    </div>
  );

  const renderFogOfWarBanner = () => (
    <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-center">
        <FaEyeSlash className="mr-3 text-xl text-yellow-600" />
        <div>
          <h3 className="font-semibold text-yellow-800">Fog of War Mode Active</h3>
          <p className="text-yellow-700">
            Other entries are hidden until the tournament is complete.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <BaseLeaderboard
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      hideBackButton={hideBackButton}
      entryType="Bracket"
      primaryEntryName="My"
      fetchData={fetchLeaderboardData}
      getVisibleEntries={getVisibleEntries}
      handleViewEntry={handleViewEntry}
      handleViewPrimary={handleViewPrimary}
      renderTableHeaders={renderWorldCupHeaders}
      renderTableRow={renderWorldCupRow}
      renderDetailsModal={renderDetailsModal}
      renderStatusInfo={renderStatusInfo}
      renderFogOfWarBanner={renderFogOfWarBanner}
      fogOfWarEnabled={fogOfWarEnabled}
      tournamentCompleted={tournamentCompleted}
    />
  );
};

export default Leaderboard;

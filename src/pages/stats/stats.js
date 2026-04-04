// src/pages/stats/Stats.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatNumber } from '../../utils/formatters';
import StatsHeader from './components/common/StatsHeader';
import ViewToggle from './components/common/ViewToggle';
import LeagueStatsViewShell from './components/LeagueStatsViewShell';
import UserStatsViewShell from './components/UserStatsViewShell';
import LeaguesTableView from './components/LeaguesTableView';
import UsersTableView from './components/UsersTableView';
import {
  renderLeagueInsights,
  renderUserInsights
} from './components/CanonicalStatsInsights';
import LoadingSpinner from '../../components/common/Loading';
import { getColorClass } from '../../styles/tokens/colors';
import { statsRepository } from './data';
import {
  formatPercentage,
  renderAdapterColumnValue,
  renderAdapterExpandedContent
} from './components/adapterRenderers';

const LIST_BADGE_CLASS_NAMES = Object.freeze({
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800'
});

const safeArray = (value) => (Array.isArray(value) ? value : []);
const hasKeys = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);

const deriveByGameTypeFromHistory = (history = []) => (
  safeArray(history).reduce((acc, entry) => {
    const gameTypeId = entry?.gameTypeId;
    if (!gameTypeId) {
      return acc;
    }

    const next = acc[gameTypeId] || {
      leagues: 0,
      wins: 0,
      bestScore: 0,
      averageScore: 0,
      bestAccuracy: 0,
      averageAccuracy: 0,
      _scores: [],
      _accuracies: []
    };

    const score = Number(entry?.score || 0);
    const accuracy = Number(entry?.accuracy || 0);

    next.leagues += 1;
    next.wins += Number(entry?.rank || 0) === 1 ? 1 : 0;
    next.bestScore = Math.max(next.bestScore, score);
    next.bestAccuracy = Math.max(next.bestAccuracy, accuracy);
    next._scores.push(score);
    next._accuracies.push(accuracy);
    next.averageScore = next._scores.reduce((sum, value) => sum + value, 0) / next._scores.length;
    next.averageAccuracy = next._accuracies.reduce((sum, value) => sum + value, 0) / next._accuracies.length;

    acc[gameTypeId] = next;
    return acc;
  }, {})
);

const mergeByGameTypeStats = (summaryStats = {}, historyStats = {}) => {
  const merged = {};
  const gameTypeIds = new Set([
    ...Object.keys(summaryStats || {}),
    ...Object.keys(historyStats || {})
  ]);

  gameTypeIds.forEach((gameTypeId) => {
    const summaryEntry = summaryStats?.[gameTypeId] || {};
    const historyEntry = historyStats?.[gameTypeId] || {};
    const hasHistoryEntry = Number(historyEntry.leagues || 0) > 0;

    merged[gameTypeId] = {
      leagues: Number(hasHistoryEntry ? historyEntry.leagues : summaryEntry.leagues ?? 0),
      wins: Number(hasHistoryEntry ? historyEntry.wins : summaryEntry.wins ?? 0),
      bestScore: Number(hasHistoryEntry ? historyEntry.bestScore : summaryEntry.bestScore ?? 0),
      averageScore: Number(hasHistoryEntry ? historyEntry.averageScore : summaryEntry.averageScore ?? 0),
      bestAccuracy: Number(hasHistoryEntry ? historyEntry.bestAccuracy : summaryEntry.bestAccuracy ?? 0),
      averageAccuracy: Number(hasHistoryEntry ? historyEntry.averageAccuracy : summaryEntry.averageAccuracy ?? 0)
    };
  });

  return merged;
};

const toBadge = (adapter, fallbackGameTypeId) => {
  const badge = adapter?.getListBadge?.();

  if (!badge) {
    return {
      label: fallbackGameTypeId || 'Unknown',
      className: LIST_BADGE_CLASS_NAMES.gray
    };
  }

  if (React.isValidElement(badge)) {
    return badge;
  }

  if (typeof badge === 'string') {
    return {
      label: badge,
      className: LIST_BADGE_CLASS_NAMES.gray
    };
  }

  return {
    ...badge,
    label: badge.label || fallbackGameTypeId || 'Unknown',
    className: badge.className || LIST_BADGE_CLASS_NAMES[badge.tone] || LIST_BADGE_CLASS_NAMES.gray
  };
};

const createLeagueStatCards = (leagueDetail) => {
  const summary = leagueDetail?.summary || {};
  const playerCount = leagueDetail?.playerCount || safeArray(leagueDetail?.leaders).length;

  return [
    {
      title: 'Players',
      value: playerCount,
      description: 'Total participants',
      variant: 'primary'
    },
    {
      title: 'Average Score',
      value: formatNumber(Number(summary.averageScore || 0)),
      description: 'Points per player',
      variant: 'info'
    },
    {
      title: 'Highest Score',
      value: formatNumber(Number(summary.highestScore || 0)),
      description: 'Best performance',
      variant: 'success'
    },
    {
      title: 'Pick Accuracy',
      value: formatPercentage(summary.accuracy || 0),
      description: 'Overall correct picks',
      variant: 'primary'
    }
  ];
};

const buildLeagueRow = (leader, expandedRows) => ({
  ...leader,
  accuracy: Number(leader.accuracy || 0),
  correctPicks: Number(leader.correctPicks || 0),
  totalPossible: Number(leader.totalPossible || 0),
  specialPicks: leader.specialPicks || {},
  formattedAccuracy: formatPercentage(leader.accuracy || 0),
  formattedScore: formatNumber(Number(leader.score || 0)),
  isExpanded: !!expandedRows[leader.userId],
  fullData: leader
});

const buildLeagueColumns = (adapter, leagueDetail) => (
  safeArray(adapter?.renderLeagueColumns?.({ leagueDetail })).map((column) => ({
    ...column,
    render: (player) => renderAdapterColumnValue(column, player)
  }))
);

const buildUserColumns = (historyEntries) => {
  const hasRowHighlights = historyEntries.some((entry) => {
    const adapter = statsRepository.resolveStatsAdapter(entry.gameTypeId);
    const payload = adapter?.renderUserRow?.({ historyEntry: entry });
    return payload && (typeof payload !== 'object' || Object.keys(payload).length > 0);
  });

  if (!hasRowHighlights) {
    return [];
  }

  return [
    {
      key: 'specialPicks',
      label: 'Highlights',
      render: (league) => {
        const entry = league.fullData || league;
        const adapter = statsRepository.resolveStatsAdapter(entry.gameTypeId);
        const rowPayload = adapter?.renderUserRow?.({ historyEntry: entry }) || entry.specialPicks || {};
        return renderAdapterColumnValue({ key: 'specialPicks' }, { specialPicks: rowPayload });
      }
    }
  ];
};

const mergeLeagueDetail = (leagueSummary, leagueDetail) => ({
  ...(leagueDetail || {}),
  ...(leagueSummary || {}),
  summary: hasKeys(leagueDetail?.summary) ? leagueDetail.summary : leagueSummary?.summary || {},
  winner: leagueDetail?.winner || leagueSummary?.winner || null,
  playerCount: leagueDetail?.playerCount ?? leagueSummary?.playerCount ?? safeArray(leagueDetail?.leaders).length,
  completedAt: leagueDetail?.completedAt || leagueSummary?.completedAt || null,
  highlights: hasKeys(leagueDetail?.highlights) ? leagueDetail.highlights : leagueSummary?.highlights || {}
});

const mergeUserDetail = (userSummary, userDetail) => {
  const history = safeArray(userDetail?.history);
  const derivedByGameType = deriveByGameTypeFromHistory(history);

  return {
    ...(userDetail || {}),
    ...(userSummary || {}),
    summary: userSummary?.summary || {},
    byGameType: mergeByGameTypeStats(userSummary?.byGameType || {}, derivedByGameType),
    history
  };
};

/**
 * Statistics Page Component
 * Reads only canonical stats summary/detail docs.
 */
const Stats = ({
  type,
  id,
  navigateToLeague,
  navigateToLeaguesList,
  navigateToUsersList
}) => {
  const [activeView, setActiveView] = useState(type || 'league');
  const [selectedId, setSelectedId] = useState(id || null);
  const [leagues, setLeagues] = useState([]);
  const [users, setUsers] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    if (type !== activeView) {
      setActiveView(type);
      setStatsData(null);
    }

    if (id !== selectedId) {
      setSelectedId(id);
      setStatsData(null);
    }
  }, [type, id, activeView, selectedId]);

  useEffect(() => {
    setExpandedRows({});
  }, [activeView, selectedId]);

  useEffect(() => {
    let isCancelled = false;

    const loadLists = async () => {
      setLoading(true);
      setError(null);

      try {
        const [leagueSummaries, userSummaries] = await Promise.all([
          statsRepository.listLeagueSummaries(),
          statsRepository.listUserSummaries()
        ]);

        if (isCancelled) {
          return;
        }

        setLeagues(
          leagueSummaries.map((league) => {
            const adapter = statsRepository.resolveStatsAdapter(league.gameTypeId);
            return {
              ...league,
              adapter,
              statsAdapter: adapter,
              badge: toBadge(adapter, league.gameTypeId)
            };
          })
        );

        setUsers(
          [...userSummaries]
            .sort((left, right) => (right.summary?.totalLeagues || 0) - (left.summary?.totalLeagues || 0))
            .map((user) => ({
              ...user
            }))
        );
      } catch (loadError) {
        if (!isCancelled) {
          setError(`Failed to load statistics: ${loadError.message}`);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadLists();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedId) {
      setStatsData(null);
      return undefined;
    }

    const loadDetail = async () => {
      setDetailLoading(true);
      setError(null);

      try {
        if (activeView === 'league') {
          const [leagueSummary, leagueDetail] = await Promise.all([
            statsRepository.fetchLeagueSummary(selectedId),
            statsRepository.fetchLeagueDetail(selectedId)
          ]);

          const mergedLeague = mergeLeagueDetail(leagueSummary, leagueDetail);
          if (!mergedLeague.leagueId) {
            throw new Error(`No statistics found for league ${selectedId}`);
          }

          const adapter = statsRepository.resolveStatsAdapter(mergedLeague.gameTypeId);

          if (!isCancelled) {
            setStatsData({
              ...mergedLeague,
              adapter,
              statsAdapter: adapter,
              badge: toBadge(adapter, mergedLeague.gameTypeId)
            });
          }
        } else {
          const [userSummary, userDetail] = await Promise.all([
            statsRepository.fetchUserSummary(selectedId),
            statsRepository.fetchUserDetail(selectedId)
          ]);

          const mergedUser = mergeUserDetail(userSummary, userDetail);
          if (!mergedUser.userId) {
            throw new Error(`No statistics found for user ${selectedId}`);
          }

          if (!isCancelled) {
            setStatsData(mergedUser);
          }
        }
      } catch (loadError) {
        if (!isCancelled) {
          setStatsData(null);
          setError(loadError.message);
        }
      } finally {
        if (!isCancelled) {
          setDetailLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      isCancelled = true;
    };
  }, [activeView, selectedId]);

  const handleViewChange = (view) => {
    if (view === activeView) {
      return;
    }

    setActiveView(view);
    setSelectedId(null);
    setStatsData(null);

    if (view === 'league') {
      navigateToLeaguesList();
    } else {
      navigateToUsersList();
    }
  };

  const handleBackToList = () => {
    if (activeView === 'league') {
      navigateToLeaguesList();
    } else {
      navigateToUsersList();
    }

    setSelectedId(null);
    setStatsData(null);
  };

  const toggleExpand = (itemId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const leagueViewModel = useMemo(() => {
    if (!statsData || activeView !== 'league') {
      return null;
    }

    const adapter = statsData.adapter || statsRepository.resolveStatsAdapter(statsData.gameTypeId);
    const leaders = safeArray(statsData.leaders).map((leader) => buildLeagueRow(leader, expandedRows));

    const leaderboardData = leaders.map((leader) => ({
      ...leader,
      profileLink: (
        <Link
          to={`/stats/user/${leader.userId}`}
          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Profile
        </Link>
      ),
      actions: (
        <div className="flex space-x-2">
          <Link
            to={`/stats/user/${leader.userId}`}
            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Profile
          </Link>
          <button
            onClick={() => toggleExpand(leader.userId)}
            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {expandedRows[leader.userId] ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )
    }));

    return {
      adapter,
      headerMeta: adapter?.renderLeagueHeaderMeta?.({ leagueDetail: statsData }) || [],
      statCards: createLeagueStatCards(statsData),
      extraColumns: buildLeagueColumns(adapter, statsData),
      renderSections: renderLeagueInsights({
        leagueDetail: statsData,
        adapterSections: safeArray(adapter?.renderLeagueSections?.({ leagueDetail: statsData }))
      }),
      renderExpandedContent: (leader) => (
        renderAdapterExpandedContent(
          adapter?.renderLeagueExpanded?.({ leader: leader.fullData || leader, leagueDetail: statsData }),
          leader
        )
      ),
      leaderboardData
    };
  }, [activeView, expandedRows, statsData]);

  const userViewModel = useMemo(() => {
    if (!statsData || activeView !== 'user') {
      return null;
    }

    const history = safeArray(statsData.history);

    return {
      headerMeta: [],
      extraColumns: buildUserColumns(history),
      renderSections: renderUserInsights({ userDetail: statsData }),
      formatLeagueData: (standardLeagueData, historyEntry) => ({
        ...standardLeagueData,
        specialPicks: historyEntry.specialPicks || {},
        adapter: statsRepository.resolveStatsAdapter(historyEntry.gameTypeId),
        fullData: historyEntry
      }),
      renderExpandedContent: (league) => {
        const historyEntry = league.fullData || league;
        const adapter = statsRepository.resolveStatsAdapter(historyEntry.gameTypeId);
        return renderAdapterExpandedContent(
          adapter?.renderUserExpanded?.({ historyEntry, userDetail: statsData }),
          {
            ...league,
            roundBreakdown: historyEntry.roundBreakdown || {}
          }
        );
      }
    };
  }, [activeView, statsData]);

  if (loading && !leagues.length && !users.length) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const showDetailLoading = detailLoading && !statsData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className={`${getColorClass('text', 'white', 'text')} text-xl sm:text-2xl font-bold`}>Statistics</h1>
        <p className="mt-2 text-sm text-gray-500">
          View detailed statistics for leagues and players
        </p>
      </div>

      <div className="mb-6">
        <ViewToggle activeView={activeView} onChange={handleViewChange} />
      </div>

      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      ) : null}

      {activeView === 'league' ? (
        selectedId ? (
          <div>
            {statsData ? (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleBackToList}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  ← Back to Leagues
                </button>
              </div>
            ) : null}

            {statsData && leagueViewModel ? (
              <div className="stats-content">
                <StatsHeader
                  data={statsData}
                  type="league"
                  adapter={leagueViewModel.adapter}
                  headerMeta={leagueViewModel.headerMeta}
                />
                <LeagueStatsViewShell
                  data={statsData}
                  adapter={leagueViewModel.adapter}
                  statCards={leagueViewModel.statCards}
                  leaderboardData={leagueViewModel.leaderboardData}
                  extraColumns={leagueViewModel.extraColumns}
                  renderExpandedContent={leagueViewModel.renderExpandedContent}
                  renderSections={leagueViewModel.renderSections}
                  expandedRows={expandedRows}
                  onToggleExpand={toggleExpand}
                />
              </div>
            ) : showDetailLoading ? (
              <div className="flex justify-center items-center h-48">
                <LoadingSpinner size="md" />
              </div>
            ) : null}
          </div>
        ) : (
          <LeaguesTableView leagues={leagues} navigateToStats={navigateToLeague} />
        )
      ) : (
        <>
          {selectedId ? (
            <div>
              {statsData ? (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleBackToList}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    ← Back to Users
                  </button>
                </div>
              ) : null}

              {statsData && userViewModel ? (
                <div className="stats-content">
                  <StatsHeader data={statsData} type="user" headerMeta={userViewModel.headerMeta} />
                  <UserStatsViewShell
                    data={statsData}
                    extraColumns={userViewModel.extraColumns}
                    formatLeagueData={userViewModel.formatLeagueData}
                    renderExpandedContent={userViewModel.renderExpandedContent}
                    renderSections={userViewModel.renderSections}
                  />
                </div>
              ) : showDetailLoading ? (
                <div className="flex justify-center items-center h-48">
                  <LoadingSpinner size="md" />
                </div>
              ) : null}
            </div>
          ) : (
            <UsersTableView users={users} />
          )}
        </>
      )}
    </div>
  );
};

export default Stats;

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { FaChevronLeft, FaChevronRight, FaEyeSlash, FaFutbol, FaLock, FaTimes, FaTrophy } from 'react-icons/fa';
import { db } from '../../../firebase';
import BaseView from '../../common/components/BaseView';
import WorldCupKnockoutBracket from './WorldCupKnockoutBracket';
import {
  buildUserKnockoutBracket,
  calculateGroupScore,
  createDefaultScoringSettings,
  createEmptyUserEntry,
  deriveKnockoutBracket,
  getPreferredStageTab,
  getOfficialGroupOrder,
  normalizeGroups,
  normalizeOrderForGroup
} from '../services/worldCupService';

const GroupCompareModal = ({
  isOpen,
  onClose,
  group,
  fallbackCurrentOrder = [],
  officialOrder = [],
  comparisonEntries = []
}) => {
  const [otherIndex, setOtherIndex] = useState(0);

  const visibleOtherEntries = useMemo(
    () => comparisonEntries
      .filter((entry) => !entry.isCurrentUser)
      .sort((left, right) => {
        if (left.isActiveEntry) return -1;
        if (right.isActiveEntry) return 1;
        return left.name.localeCompare(right.name);
      }),
    [comparisonEntries]
  );

  const activeOtherEntry = visibleOtherEntries[otherIndex] || null;
  const currentUserOrder = comparisonEntries.find((entry) => entry.isCurrentUser)?.groupOrders?.[group?.id] || fallbackCurrentOrder;

  useEffect(() => {
    if (isOpen) {
      setOtherIndex(0);
    }
  }, [group?.id, isOpen]);

  useEffect(() => {
    if (!visibleOtherEntries.length) {
      setOtherIndex(0);
      return;
    }

    if (otherIndex >= visibleOtherEntries.length) {
      setOtherIndex(0);
    }
  }, [otherIndex, visibleOtherEntries]);

  if (!isOpen || !group) {
    return null;
  }

  const renderOrderPanel = (label, order, tone = 'default') => (
    <div
      className={`rounded-3xl border p-4 ${
        tone === 'official'
          ? 'border-emerald-200 bg-emerald-50/60'
          : tone === 'current'
            ? 'border-blue-200 bg-blue-50/60'
            : 'border-slate-200 bg-slate-50/70'
      }`}
    >
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <ol className="space-y-2 text-sm text-slate-800">
        {Array.from({ length: 4 }).map((_, index) => {
          const teamId = order[index] || '';
          const teamName = group.teams.find((team) => team.id === teamId)?.name || 'TBD';

          return (
            <li key={`${label}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
              <span className="font-semibold text-slate-500">{index + 1}</span>
              <span className="ml-3 flex-1 truncate text-right font-medium text-slate-900">{teamName}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const handlePreviousOther = () => {
    if (!visibleOtherEntries.length) {
      return;
    }

    setOtherIndex((current) => (current - 1 + visibleOtherEntries.length) % visibleOtherEntries.length);
  };

  const handleNextOther = () => {
    if (!visibleOtherEntries.length) {
      return;
    }

    setOtherIndex((current) => (current + 1) % visibleOtherEntries.length);
  };

  return (
    <div
      className="fixed inset-0 z-[220] isolate flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative z-[221] w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Group Compare
            </div>
            <h3 className="mt-1 text-xl font-bold text-slate-950">
              {group.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            <FaTimes />
          </button>
        </div>

        <div className="px-5 py-5">
            <div className="grid gap-4 lg:grid-cols-3">
            {renderOrderPanel('Your Pick', currentUserOrder, 'current')}
            {renderOrderPanel('Official Result', officialOrder, 'official')}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Other Picks
                </div>
                {visibleOtherEntries.length ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePreviousOther}
                      className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      aria-label="Show previous group pick"
                    >
                      <FaChevronLeft className="text-xs" />
                    </button>
                    <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {otherIndex + 1} / {visibleOtherEntries.length}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextOther}
                      className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      aria-label="Show next group pick"
                    >
                      <FaChevronRight className="text-xs" />
                    </button>
                  </div>
                ) : null}
              </div>
              {activeOtherEntry ? (
                renderOrderPanel(activeOtherEntry.name, activeOtherEntry.groupOrders?.[group.id] || [], 'other')
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No other picks visible.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const resolveUserName = async (leagueId, userId, fallbackName = null) => {
  if (!userId) {
    return 'Unknown User';
  }

  if (fallbackName) {
    return fallbackName;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.displayName || userData.username || userData.email || 'Unknown User';
    }
  } catch (error) {
    console.error('[WorldCup][BracketView] Failed to resolve user name:', error);
  }

  return 'Unknown User';
};

const GroupOrderCard = ({
  title,
  groups,
  picks,
  mode = 'predicted',
  settings = {},
  scoringBreakdown = null,
  comparisonEntries = []
}) => {
  const [compareGroupId, setCompareGroupId] = useState(null);

  const selectedGroup = groups.find((group) => group.id === compareGroupId) || null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">
          {mode === 'official' ? 'Official final order for every group.' : 'Top-two scoring plus perfect-group bonus.'}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const predictedOrder = normalizeOrderForGroup(picks[group.id] || [], group);
          const officialOrder = getOfficialGroupOrder(group);
          const visibleOrder = mode === 'official' ? officialOrder : predictedOrder;
          const groupScore = scoringBreakdown?.[group.id] || null;
          const firstPlacePoints = Number(settings.groupFirstPlacePoints || 0);
          const secondPlacePoints = Number(settings.groupSecondPlacePoints || 0);
          const perfectGroupBonus = Number(settings.groupPerfectOrderBonus || 0);
          const canInspect = mode !== 'official' && officialOrder.every(Boolean);

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                if (canInspect) {
                  setCompareGroupId(group.id);
                }
              }}
              disabled={!canInspect}
              className={`rounded-lg border border-gray-200 bg-white p-4 text-left transition ${
                canInspect ? 'hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'
              }`}
            >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">{group.name}</h4>
              {mode !== 'official' && officialOrder.every(Boolean) ? (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  Official
                </span>
              ) : null}
            </div>
            <div className={mode === 'official' ? '' : 'grid gap-3 md:grid-cols-2'}>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {mode === 'official' ? 'Official Order' : 'Predicted Order'}
                </div>
                <ol className="space-y-1 text-sm text-gray-800">
                  {visibleOrder.map((teamId, index) => (
                    <li key={`${group.id}-${mode}-${index}`}>
                      {index + 1}. {group.teams.find((team) => team.id === teamId)?.name || 'TBD'}
                    </li>
                  ))}
                </ol>
              </div>
              {mode !== 'official' ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Official Order</div>
                  <ol className="space-y-1 text-sm text-gray-800">
                    {officialOrder.map((teamId, index) => (
                      <li key={`${group.id}-official-${index}`}>
                        {index + 1}. {group.teams.find((team) => team.id === teamId)?.name || 'TBD'}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
            {mode !== 'official' && groupScore ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scoring Breakdown</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {groupScore.points} / {groupScore.possible}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">1st place pick</span>
                    <span className={groupScore.firstCorrect ? 'font-semibold text-emerald-700' : 'font-medium text-slate-400'}>
                      {groupScore.firstCorrect ? `+${firstPlacePoints}` : '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">2nd place pick</span>
                    <span className={groupScore.secondCorrect ? 'font-semibold text-emerald-700' : 'font-medium text-slate-400'}>
                      {groupScore.secondCorrect ? `+${secondPlacePoints}` : '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Perfect group bonus</span>
                    <span className={groupScore.perfect ? 'font-semibold text-emerald-700' : 'font-medium text-slate-400'}>
                      {groupScore.perfect ? `+${perfectGroupBonus}` : '0'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            </button>
          );
        })}
      </div>

      <GroupCompareModal
        isOpen={Boolean(selectedGroup)}
        onClose={() => setCompareGroupId(null)}
        group={selectedGroup}
        fallbackCurrentOrder={selectedGroup ? normalizeOrderForGroup(picks[selectedGroup.id] || [], selectedGroup) : []}
        officialOrder={selectedGroup ? getOfficialGroupOrder(selectedGroup) : []}
        comparisonEntries={comparisonEntries}
      />
    </section>
  );
};

const ViewSectionTabs = ({ current, onChange }) => (
  <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
    {[
      { key: 'groups', label: 'Groups' },
      { key: 'knockout', label: 'Knockout' }
    ].map((item) => (
      <button
        key={item.key}
        type="button"
        onClick={() => onChange(item.key)}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          current === item.key
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

const EntryViewer = ({
  bracketData,
  officialEntryData,
  activeEntryId,
  officialEntryId,
  activeEntry,
  visibleEntries = [],
  currentUserId = null,
  leagueId
}) => {
  const [activeSection, setActiveSection] = useState('groups');
  const [comparisonEntries, setComparisonEntries] = useState([]);
  const gameData = activeEntryId === officialEntryId ? bracketData : officialEntryData;
  const settings = gameData?.settings || createDefaultScoringSettings();
  const groups = normalizeGroups(gameData?.groups || []);

  useEffect(() => {
    let isCancelled = false;

    const loadComparisonEntries = async () => {
      if (!leagueId || !officialEntryData || activeEntryId === officialEntryId) {
        setComparisonEntries([]);
        return;
      }

      const candidateEntries = visibleEntries.filter((entry) => !entry.isOfficial);
      if (!candidateEntries.length) {
        setComparisonEntries([]);
        return;
      }

      const loadedEntries = await Promise.all(
        candidateEntries.map(async (entry) => {
          try {
            const entryData = entry.id === activeEntryId
              ? bracketData
              : (await getDoc(doc(db, 'leagues', leagueId, 'userData', entry.id))).data();

            return {
              id: entry.id,
              name: entry.isCurrentUser ? 'You' : entry.name,
              isCurrentUser: entry.id === currentUserId,
              isActiveEntry: entry.id === activeEntryId,
              bracket: buildUserKnockoutBracket(officialEntryData, entryData?.knockoutPicks || {}),
              groupOrders: Object.fromEntries(
                groups.map((group) => [
                  group.id,
                  normalizeOrderForGroup(entryData?.groupPicks?.[group.id] || [], group)
                ])
              )
            };
          } catch (error) {
            console.error('[WorldCup][BracketView] Failed to load comparison entry:', error);
            return null;
          }
        })
      );

      if (!isCancelled) {
        setComparisonEntries(loadedEntries.filter(Boolean));
      }
    };

    loadComparisonEntries();

    return () => {
      isCancelled = true;
    };
  }, [activeEntryId, bracketData, currentUserId, groups, leagueId, officialEntryData, officialEntryId, visibleEntries]);

  useEffect(() => {
    setActiveSection(getPreferredStageTab(gameData, gameData?.locks || {}));
  }, [activeEntryId, gameData]);

  if (activeEntryId === officialEntryId) {
    const officialBracket = deriveKnockoutBracket(bracketData?.knockoutRounds || {}, bracketData?.groups || []);
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-gray-50 p-4">
          <h2 className="text-xl font-semibold text-gray-900">Official Tournament View</h2>
          <p className="text-sm text-gray-500">
            Finalized group standings and official knockout results for the tournament.
          </p>
        </div>
        <div className="flex justify-start">
          <ViewSectionTabs current={activeSection} onChange={setActiveSection} />
        </div>
        {activeSection === 'groups' ? (
          <GroupOrderCard
            title="Official Group Standings"
            groups={groups}
            picks={Object.fromEntries(groups.map((group) => [group.id, group.officialOrder || []]))}
            mode="official"
          />
        ) : (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Official Knockout Bracket</h3>
              <p className="text-sm text-gray-500">Official knockout path from the Round of 32 through the Final.</p>
            </div>
            <WorldCupKnockoutBracket
              groups={groups}
              rounds={officialBracket}
              officialRounds={officialBracket}
              showThirdPlace={Boolean(settings.scoreThirdPlaceMatch)}
              readOnly={true}
              isOfficialBracket={true}
            />
          </div>
        )}
      </div>
    );
  }

  const userBracket = buildUserKnockoutBracket(gameData || {}, bracketData?.knockoutPicks || {});
  const officialBracket = deriveKnockoutBracket(gameData?.knockoutRounds || {}, gameData?.groups || []);
  const groupScore = calculateGroupScore(bracketData?.groupPicks || {}, gameData || {}, settings);
  const compareEntryLabel = activeEntry?.isCurrentUser
    ? 'Your Pick'
    : activeEntry?.name ? `${activeEntry.name}'s Pick` : 'Viewed Pick';

  return (
    <div className="space-y-6">
      <div className="flex justify-start">
        <ViewSectionTabs current={activeSection} onChange={setActiveSection} />
      </div>
      {activeSection === 'groups' ? (
        <GroupOrderCard
          title="Group Picks"
          groups={groups}
          picks={bracketData?.groupPicks || {}}
          settings={settings}
          scoringBreakdown={groupScore.breakdown}
          comparisonEntries={comparisonEntries}
        />
      ) : (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Knockout Bracket</h3>
            <p className="text-sm text-gray-500">
              Exact score bonus is {Boolean(settings.enableExactScoreBonus) ? 'enabled' : 'disabled'}.
            </p>
          </div>
          <WorldCupKnockoutBracket
            groups={groups}
            rounds={userBracket}
            officialRounds={officialBracket}
            showThirdPlace={Boolean(settings.scoreThirdPlaceMatch)}
            readOnly={true}
            isOfficialBracket={false}
            comparisonEntries={comparisonEntries}
            compareEntryLabel={compareEntryLabel}
          />
        </div>
      )}
    </div>
  );
};

const LoadingRenderer = () => (
  <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
    <div className="flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-500 mb-3 sm:mb-4"></div>
      <p className="text-gray-600">Loading bracket data...</p>
    </div>
  </div>
);

const ErrorRenderer = ({ error }) => (
  <div className="bg-red-100 border-0 sm:border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-none sm:rounded mb-4">
    <p className="font-bold">Error</p>
    <p>{error || 'An unexpected error occurred.'}</p>
  </div>
);

const HiddenBracketRenderer = ({ isAdmin, userId, handleEntryChange, officialEntryId }) => (
  <div className="text-center py-6 sm:py-12">
    <FaEyeSlash className="text-4xl sm:text-6xl text-gray-300 mx-auto mb-3 sm:mb-4" />
    <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Bracket Hidden</h3>
    <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base px-2 sm:px-0">
      This bracket is hidden while Fog of War mode is active. You can view the official tournament
      bracket and your own bracket, but other players&apos; brackets will remain hidden until the tournament
      is completed.
      {isAdmin && ' As admin, you are also subject to Fog of War to ensure fair play.'}
    </p>
    <div className="flex flex-col sm:flex-row justify-center mt-4 sm:mt-6 space-y-2 sm:space-y-0 sm:space-x-4">
      <button
        onClick={() => handleEntryChange(officialEntryId)}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
      >
        View Official Tournament
      </button>
      {userId && (
        <button
          onClick={() => handleEntryChange(userId)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          View Your Bracket
        </button>
      )}
    </div>
  </div>
);

const EmptyBracketRenderer = ({ activeEntryId, officialEntryId }) => (
  <div className="text-center py-6 sm:py-8 text-gray-500">
    {!activeEntryId ? (
      <p>No bracket selected. Please select a bracket to view.</p>
    ) : (
      <div className="flex flex-col items-center">
        <FaLock className="text-3xl sm:text-4xl mb-2 sm:mb-3 text-gray-400" />
        <p className="mb-1">Bracket data not available</p>
        <p className="text-xs sm:text-sm text-gray-400">
          {activeEntryId === officialEntryId
            ? "The official tournament bracket hasn't been created yet."
            : "This user hasn't filled out their bracket yet."}
        </p>
      </div>
    )}
  </div>
);

const BracketSelector = ({ entries, activeEntryId, onEntrySelect }) => (
  <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
    <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2">
      {entries.length > 0 ? (
        entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onEntrySelect(entry.id)}
            className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded transition text-sm ${
              activeEntryId === entry.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {entry.isOfficial ? (
              <FaTrophy className="mr-1 sm:mr-2" />
            ) : (
              <FaFutbol className="mr-1 sm:mr-2" />
            )}
            <span className="truncate max-w-32 sm:max-w-none">
              {entry.name}
              {entry.isCurrentUser ? ' (You)' : ''}
            </span>
          </button>
        ))
      ) : (
        <div className="text-gray-500 italic text-sm">No brackets available</div>
      )}
    </div>
  </div>
);

const BracketView = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  initialBracketId = null,
  onBracketSelect = null,
  hideBackButton = false,
  fogOfWarEnabled = false,
  tournamentCompleted = false
}) => {
  const fetchOfficialEntry = async (leagueId) => {
    const [tournamentSnap, scoringSnap, lockSnap] = await Promise.all([
      getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
      getDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring')),
      getDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'))
    ]);

    if (!tournamentSnap.exists()) {
      return null;
    }

    return {
      ...tournamentSnap.data(),
      settings: scoringSnap.exists() ? scoringSnap.data() : createDefaultScoringSettings(),
      locks: lockSnap.exists() ? lockSnap.data() : {}
    };
  };

  const fetchEntryData = async (leagueId, entryId) => {
    if (entryId === 'tournament') {
      return fetchOfficialEntry(leagueId);
    }

    const [gameDataSnap, userSnap, scoringSnap, lockSnap] = await Promise.all([
      getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
      getDoc(doc(db, 'leagues', leagueId, 'userData', entryId)),
      getDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring')),
      getDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'))
    ]);

    const gameData = gameDataSnap.exists() ? gameDataSnap.data() : {};
    const fallbackSettings = scoringSnap.exists() ? scoringSnap.data() : createDefaultScoringSettings();
    const locks = lockSnap.exists() ? lockSnap.data() : {};

    if (userSnap.exists()) {
      return {
        ...userSnap.data(),
        locks
      };
    }

    return createEmptyUserEntry(
      {
        ...gameData,
        settings: fallbackSettings,
        locks
      },
      { uid: entryId, displayName: 'League Member', email: '' }
    );
  };

  const fetchEntries = async (leagueId, leagueData, currentUserId) => {
    const entries = [{ id: 'tournament', name: 'Official Tournament', isOfficial: true }];
    const userEntriesSnap = await getDocs(collection(db, 'leagues', leagueId, 'userData'));

    const userEntries = await Promise.all(
      userEntriesSnap.docs.map(async (entryDoc) => {
        const entryData = entryDoc.data();
        const name = await resolveUserName(leagueId, entryDoc.id, entryData.userName);
        return {
          id: entryDoc.id,
          name,
          isOfficial: false,
          isCurrentUser: entryDoc.id === currentUserId
        };
      })
    );

    userEntries.sort((left, right) => {
      if (left.isCurrentUser) return -1;
      if (right.isCurrentUser) return 1;
      return left.name.localeCompare(right.name);
    });

    return [...entries, ...userEntries];
  };

  const isEntryVisible = (entry) => {
    if (entry.isOfficial) {
      return true;
    }
    return entry.isCurrentUser;
  };

  const isGameCompleted = (data) => Boolean(data?.knockoutRounds?.final?.[0]?.winnerTeamId);

  return (
    <BaseView
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      initialEntryId={initialBracketId || 'tournament'}
      onEntrySelect={onBracketSelect}
      hideBackButton={hideBackButton}
      fogOfWarEnabled={fogOfWarEnabled}
      gameCompleted={tournamentCompleted || isGameCompleted}
      entryType="Bracket"
      officialEntryId="tournament"
      officialEntryName="Official Tournament"
      fetchOfficialEntry={fetchOfficialEntry}
      fetchEntryData={fetchEntryData}
      fetchEntries={fetchEntries}
      isEntryVisible={isEntryVisible}
      EntryViewer={EntryViewer}
      EntrySelector={BracketSelector}
      EmptyEntryRenderer={EmptyBracketRenderer}
      LoadingRenderer={LoadingRenderer}
      ErrorRenderer={ErrorRenderer}
      HiddenEntryRenderer={HiddenBracketRenderer}
      showLeagueUpdatedAt={false}
      showEntryUpdatedAt={false}
    />
  );
};

export default BracketView;

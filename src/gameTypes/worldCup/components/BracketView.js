import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaExchangeAlt,
  FaEyeSlash,
  FaFutbol,
  FaLock,
  FaTimes,
  FaTimesCircle,
  FaTrophy
} from 'react-icons/fa';
import { db } from '../../../firebase';
import BaseView from '../../common/components/BaseView';
import WorldCupKnockoutBracket from './WorldCupKnockoutBracket';
import { isWorldCupEntryVisible } from '../utils/visibility';
import {
  buildUserKnockoutBracket,
  calculateGroupScore,
  calculateUserTotals,
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
  comparisonEntries = [],
  groupPosition = 0,
  groupCount = 0,
  onPreviousGroup = null,
  onNextGroup = null
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
      className={`rounded-2xl border p-3 sm:rounded-3xl sm:p-4 ${
        tone === 'official'
          ? 'border-emerald-200 bg-emerald-50/60'
          : tone === 'current'
            ? 'border-blue-200 bg-blue-50/60'
            : 'border-slate-200 bg-slate-50/70'
      }`}
    >
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:mb-3 sm:text-[10px] sm:tracking-[0.18em]">
        {label}
      </div>
      <ol className="space-y-1.5 text-xs text-slate-800 sm:space-y-2 sm:text-sm">
        {Array.from({ length: 4 }).map((_, index) => {
          const teamId = order[index] || '';
          const teamName = group.teams.find((team) => team.id === teamId)?.name || 'TBD';

          return (
            <li key={`${label}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-2.5 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
              <span className="font-semibold text-slate-500">{index + 1}</span>
              <span className="ml-2 flex-1 truncate text-right font-medium text-slate-900 sm:ml-3">{teamName}</span>
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

  const modalContent = (
    <div
      className="fixed inset-0 z-[220] isolate flex items-start justify-center overflow-y-auto bg-slate-950/55 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative z-[221] flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[10px] sm:tracking-[0.18em]">
              Group Compare
            </div>
            <h3 className="mt-0.5 text-base font-bold text-slate-950 sm:mt-1 sm:text-xl">
              {group.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {groupCount > 1 ? (
              <>
                <button
                  type="button"
                  onClick={onPreviousGroup}
                  className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:p-2"
                  aria-label="Compare previous group"
                >
                  <FaChevronLeft className="text-xs" />
                </button>
                <div className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:px-2.5 sm:text-[10px] sm:tracking-[0.14em]">
                  {groupPosition + 1} / {groupCount}
                </div>
                <button
                  type="button"
                  onClick={onNextGroup}
                  className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:p-2"
                  aria-label="Compare next group"
                >
                  <FaChevronRight className="text-xs" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:p-2"
              aria-label="Close group comparison"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5">
          <div className="grid gap-2.5 sm:gap-4 lg:grid-cols-3">
            {renderOrderPanel('Your Pick', currentUserOrder, 'current')}
            {renderOrderPanel('Official Result', officialOrder, 'official')}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:rounded-3xl sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:gap-3">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[10px] sm:tracking-[0.18em]">
                  Other Picks
                </div>
                {visibleOtherEntries.length ? (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={handlePreviousOther}
                      className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:p-2"
                      aria-label="Show previous group pick"
                    >
                      <FaChevronLeft className="text-xs" />
                    </button>
                    <div className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:px-2.5 sm:text-[10px] sm:tracking-[0.14em]">
                      {otherIndex + 1} / {visibleOtherEntries.length}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextOther}
                      className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:p-2"
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
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500 sm:rounded-2xl sm:px-4 sm:py-6 sm:text-sm">
                  No other picks visible.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
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
  comparisonEntries = [],
  viewedEntryLabel = 'Viewed Pick'
}) => {
  const [compareGroupId, setCompareGroupId] = useState(null);

  const selectedGroup = groups.find((group) => group.id === compareGroupId) || null;
  const selectedGroupIndex = selectedGroup
    ? groups.findIndex((group) => group.id === selectedGroup.id)
    : -1;

  const showAdjacentGroup = (offset) => {
    if (selectedGroupIndex < 0 || !groups.length) {
      return;
    }

    const nextIndex = (selectedGroupIndex + offset + groups.length) % groups.length;
    setCompareGroupId(groups[nextIndex].id);
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">
          {mode === 'official'
            ? 'Official final order for every group.'
            : 'The viewed pick and official result are aligned by finishing position. Select a group to compare league picks.'}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const predictedOrder = normalizeOrderForGroup(picks[group.id] || [], group);
          const officialOrder = getOfficialGroupOrder(group);
          const visibleOrder = mode === 'official' ? officialOrder : predictedOrder;
          const groupScore = scoringBreakdown?.[group.id] || null;
          const firstPlacePoints = Number(settings.groupFirstPlacePoints || 0);
          const secondPlacePoints = Number(settings.groupSecondPlacePoints || 0);
          const perfectGroupBonus = Number(settings.groupPerfectOrderBonus || 0);
          const hasOfficialResult = officialOrder.every(Boolean);
          const canInspect = mode !== 'official';
          const hasScoredResult = mode !== 'official' && Boolean(groupScore) && hasOfficialResult;
          const hasCorrectPick = Boolean(groupScore?.firstCorrect || groupScore?.secondCorrect);
          const resultTone = groupScore?.perfect
            ? 'border-emerald-300 bg-emerald-50/40'
            : hasCorrectPick
              ? 'border-amber-300 bg-amber-50/30'
              : hasScoredResult
                ? 'border-rose-300 bg-rose-50/30'
                : 'border-gray-200 bg-white';

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
              className={`rounded-lg border p-4 text-left transition ${resultTone} ${
                canInspect ? 'hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-gray-900">{group.name}</h4>
                {canInspect ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                    <FaExchangeAlt />
                    Compare
                  </span>
                ) : null}
              </div>
              <div className={mode === 'official' ? '' : 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2'}>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {mode === 'official' ? 'Official Order' : viewedEntryLabel}
                  </div>
                  <ol className="space-y-1.5 text-sm text-gray-800">
                    {visibleOrder.map((teamId, index) => {
                      const hasResult = mode !== 'official' && hasOfficialResult && Boolean(teamId);
                      const isCorrect = hasResult && teamId === officialOrder[index];

                      return (
                        <li
                          key={`${group.id}-${mode}-${index}`}
                          className={`flex items-center justify-between rounded-md px-2 py-1 ${
                            !hasResult
                              ? ''
                              : isCorrect
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="mr-1 font-semibold text-slate-400">{index + 1}.</span>
                            {group.teams.find((team) => team.id === teamId)?.name || 'TBD'}
                          </span>
                          {hasResult ? (
                            <span
                              className="ml-2 flex-shrink-0"
                              title={isCorrect ? 'Correct position' : 'Incorrect position'}
                              aria-label={isCorrect ? 'Correct position' : 'Incorrect position'}
                            >
                              {isCorrect ? <FaCheck /> : <FaTimesCircle />}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
                {mode !== 'official' ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Official Order</div>
                    <ol className="space-y-1.5 text-sm text-gray-800">
                      {officialOrder.map((teamId, index) => (
                        <li
                          key={`${group.id}-official-${index}`}
                          className="truncate rounded-md bg-white/70 px-2 py-1"
                        >
                          <span className="mr-1 font-semibold text-slate-400">{index + 1}.</span>
                          {group.teams.find((team) => team.id === teamId)?.name || 'TBD'}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
              {mode !== 'official' && groupScore ? (
                <div className={`mt-4 rounded-lg border p-3 ${
                  !hasScoredResult
                    ? 'border-slate-200 bg-slate-50'
                    : groupScore.perfect
                    ? 'border-emerald-200 bg-emerald-50'
                    : hasCorrectPick
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-rose-200 bg-rose-50'
                }`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {!hasScoredResult
                        ? 'Scoring Breakdown'
                        : groupScore.perfect
                          ? 'Perfect Group'
                          : hasCorrectPick
                            ? 'Partial Result'
                            : 'No Correct Picks'}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {groupScore.points} / {groupScore.possible}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">1st place pick</span>
                      <span className={
                        groupScore.firstCorrect
                          ? 'font-semibold text-emerald-700'
                          : hasScoredResult
                            ? 'font-semibold text-rose-700'
                            : 'font-medium text-slate-400'
                      }>
                        {groupScore.firstCorrect ? `+${firstPlacePoints}` : '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">2nd place pick</span>
                      <span className={
                        groupScore.secondCorrect
                          ? 'font-semibold text-emerald-700'
                          : hasScoredResult
                            ? 'font-semibold text-rose-700'
                            : 'font-medium text-slate-400'
                      }>
                        {groupScore.secondCorrect ? `+${secondPlacePoints}` : '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Perfect group bonus</span>
                      <span className={
                        groupScore.perfect
                          ? 'font-semibold text-emerald-700'
                          : hasScoredResult
                            ? 'font-semibold text-rose-700'
                            : 'font-medium text-slate-400'
                      }>
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
        groupPosition={selectedGroupIndex}
        groupCount={groups.length}
        onPreviousGroup={() => showAdjacentGroup(-1)}
        onNextGroup={() => showAdjacentGroup(1)}
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
  const groups = useMemo(
    () => normalizeGroups(gameData?.groups || []),
    [gameData?.groups]
  );

  useEffect(() => {
    let isCancelled = false;

    const loadComparisonEntries = async () => {
      if (!leagueId || !officialEntryData || activeEntryId === officialEntryId) {
        setComparisonEntries((current) => current.length ? [] : current);
        return;
      }

      const candidateEntries = visibleEntries.filter((entry) => !entry.isOfficial);
      if (!candidateEntries.length) {
        setComparisonEntries((current) => current.length ? [] : current);
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
              scoringSettings={settings}
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
          viewedEntryLabel={compareEntryLabel}
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
            scoringSettings={settings}
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

const renderEntryPoints = ({ activeEntryId, officialEntryId, entryData, officialEntryData }) => {
  if (activeEntryId === officialEntryId || !entryData || !officialEntryData) {
    return null;
  }

  const settings = officialEntryData.settings || createDefaultScoringSettings();
  const totals = calculateUserTotals(entryData, officialEntryData, settings);

  return (
    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
      {totals.totalPoints} pts
    </span>
  );
};

const BracketView = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  initialBracketId = null,
  onBracketSelect = null,
  hideBackButton = false,
  fogOfWarEnabled = null,
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

  const isEntryVisible = (entry, currentUserId) =>
    isWorldCupEntryVisible(entry, currentUserId);

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
      renderEntryTitleExtra={renderEntryPoints}
      showLeagueUpdatedAt={false}
      showEntryUpdatedAt={false}
    />
  );
};

export default BracketView;

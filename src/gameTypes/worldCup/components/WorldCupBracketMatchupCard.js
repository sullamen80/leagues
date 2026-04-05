import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import { classNames } from '../../../utils/formatters';
import { getFifaTeamIcon } from '../constants/fifaTeams';

const getScoreSummary = (matchup = {}) =>
  String(matchup.homeScore) !== '' || String(matchup.awayScore) !== ''
    ? `${String(matchup.homeScore) !== '' ? matchup.homeScore : '-'}-${String(matchup.awayScore) !== '' ? matchup.awayScore : '-'}`
    : 'No score';

const parseNumericScore = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getWinnerFromScores = (matchup, homeScore, awayScore) => {
  const parsedHomeScore = parseNumericScore(homeScore);
  const parsedAwayScore = parseNumericScore(awayScore);

  if (parsedHomeScore === null || parsedAwayScore === null) {
    return null;
  }

  if (parsedHomeScore > parsedAwayScore) {
    return matchup?.homeTeamId || null;
  }

  if (parsedAwayScore > parsedHomeScore) {
    return matchup?.awayTeamId || null;
  }

  return null;
};

const buildOutcomeNote = ({ matchup, officialResult, isOfficialBracket }) => {
  if (isOfficialBracket || !officialResult?.winnerTeamId) {
    return null;
  }

  const hasUserScore =
    String(matchup?.homeScore ?? '') !== '' &&
    String(matchup?.awayScore ?? '') !== '';
  const exactScoreMatch =
    hasUserScore &&
    String(matchup?.homeScore ?? '') === String(officialResult?.homeScore ?? '') &&
    String(matchup?.awayScore ?? '') === String(officialResult?.awayScore ?? '');

  if (matchup?.winnerTeamId && matchup.winnerTeamId === officialResult.winnerTeamId) {
    if (!hasUserScore) {
      return {
        label: 'No Score',
        tone: 'neutral'
      };
    }

    return {
      label: exactScoreMatch ? 'Perfect' : 'Correct',
      tone: exactScoreMatch ? 'perfect' : 'correct'
    };
  }

  if (matchup?.winnerTeamId) {
    return {
      label: 'Incorrect',
      tone: 'incorrect'
    };
  }

  return {
    label: 'Official',
    tone: 'neutral'
  };
};

const getInlineTeamLabel = (teamName) => teamName || 'TBD';

const TeamLogo = ({ teamName, iconCode, size = 'default', highlighted = false, exportMode = false }) => {
  const fallback = (teamName || 'TBD').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const sizeClasses = size === 'tight'
    ? {
        wrapper: 'h-7 w-7',
        icon: 'text-base',
        fallback: 'text-[7px]'
      }
    : size === 'hero'
      ? {
          wrapper: 'h-14 w-14',
          icon: 'text-2xl',
          fallback: 'text-[9px]'
        }
      : size === 'compact'
        ? {
            wrapper: 'h-8 w-8',
            icon: 'text-lg',
            fallback: 'text-[8px]'
          }
        : {
            wrapper: 'h-12 w-12',
            icon: 'text-xl',
            fallback: 'text-[10px]'
          };

  return (
    <div className={classNames(
      'flex items-center justify-center rounded-full bg-white ring-1 ring-slate-200/80',
      !exportMode && 'shadow-sm',
      highlighted && (exportMode ? 'border-2 border-sky-400 bg-sky-50' : 'bg-sky-50 ring-2 ring-sky-400 ring-offset-2 ring-offset-white'),
      sizeClasses.wrapper
    )}>
      {iconCode ? (
        <span className={sizeClasses.icon} aria-hidden="true">
          {getFifaTeamIcon(iconCode)}
        </span>
      ) : (
        <span className={classNames('font-semibold uppercase tracking-[0.08em] text-slate-500', sizeClasses.fallback)}>
          {fallback}
        </span>
      )}
    </div>
  );
};

const TeamSummaryRow = ({
  teamName,
  iconCode,
  selected = false,
  compact = false,
  align = 'left',
  tight = false,
  exportMode = false
}) => {
  const compactNameLength = (teamName || '').length;
  const compactTextClass = compactNameLength > 18 || tight
    ? 'text-[9px]'
    : compactNameLength > 14
      ? 'text-[10px]'
      : 'text-[11px]';
  const displayLabel = getInlineTeamLabel(teamName);

  return (
    <div
      className={classNames(
        'flex items-center transition',
        compact ? (tight ? 'gap-1 rounded-2xl px-1.5 py-1.5' : 'gap-1.5 rounded-2xl px-2 py-1.5') : 'gap-3 rounded-full px-3 py-2.5',
        compact
          ? exportMode ? 'bg-white text-slate-700 ring-1 ring-slate-200' : 'bg-white/78 text-slate-700'
          : 'bg-white text-slate-700 ring-1 ring-slate-200',
        align === 'right' && 'flex-row-reverse text-right'
      )}
    >
      <TeamLogo
        teamName={teamName}
        iconCode={iconCode}
        size={tight ? 'tight' : compact ? 'compact' : 'default'}
        highlighted={selected}
        exportMode={exportMode}
      />
      <div className="min-w-0 flex-1">
        <div
          className={classNames(
            compact ? classNames('truncate leading-tight', compactTextClass) : 'truncate text-sm',
            selected ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'
          )}
          title={displayLabel}
        >
          {displayLabel}
        </div>
      </div>
    </div>
  );
};

const MatchupEditorModal = ({
  matchup,
  title,
  isOpen,
  onClose,
  onSave,
  teamLookup = {}
}) => {
  const [draftWinnerTeamId, setDraftWinnerTeamId] = useState(matchup?.winnerTeamId || '');
  const [draftHomeScore, setDraftHomeScore] = useState(matchup?.homeScore ?? '');
  const [draftAwayScore, setDraftAwayScore] = useState(matchup?.awayScore ?? '');

  useEffect(() => {
    if (!isOpen) return;
    setDraftWinnerTeamId(matchup?.winnerTeamId || '');
    setDraftHomeScore(matchup?.homeScore ?? '');
    setDraftAwayScore(matchup?.awayScore ?? '');
  }, [isOpen, matchup]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const inferredWinnerTeamId = getWinnerFromScores(matchup, draftHomeScore, draftAwayScore);
    if (inferredWinnerTeamId) {
      setDraftWinnerTeamId(inferredWinnerTeamId);
    }
  }, [draftAwayScore, draftHomeScore, isOpen, matchup]);

  if (!isOpen) return null;

  const options = [
    matchup?.homeTeamId ? { id: matchup.homeTeamId, name: matchup.homeTeamName, iconCode: teamLookup[matchup.homeTeamId]?.iconCode || null } : null,
    matchup?.awayTeamId ? { id: matchup.awayTeamId, name: matchup.awayTeamName, iconCode: teamLookup[matchup.awayTeamId]?.iconCode || null } : null
  ].filter(Boolean);
  const canSave = !!draftWinnerTeamId && draftHomeScore !== '' && draftAwayScore !== '';

  const modalContent = (
    <div
      className="fixed inset-0 z-[220] isolate flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative z-[221] w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Choose Winner
            </div>
            <h3 className="mt-1 text-xl font-bold text-slate-950">
              {title || 'Match'}
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

        <div className="space-y-5 px-5 py-5">
          <div className="space-y-3">
            {options.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => setDraftWinnerTeamId(team.id)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                  draftWinnerTeamId === team.id
                    ? 'border-blue-400 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <TeamLogo
                  teamName={team.name}
                  iconCode={team.iconCode}
                  size="default"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {getInlineTeamLabel(team.name)}
                  </div>
                </div>
                {draftWinnerTeamId === team.id ? (
                  <div className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    Selected
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Score
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-500">
                  {matchup?.homeTeamName || 'Home'}
                </span>
                <input
                  type="number"
                  min="0"
                  value={draftHomeScore}
                  onChange={(event) => setDraftHomeScore(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-500">
                  {matchup?.awayTeamName || 'Away'}
                </span>
                <input
                  type="number"
                  min="0"
                  value={draftAwayScore}
                  onChange={(event) => setDraftAwayScore(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <div className="text-sm text-slate-500">
            {draftWinnerTeamId && draftHomeScore !== '' && draftAwayScore !== ''
              ? `${teamLookup[draftWinnerTeamId]?.name || 'Winner'} ${getScoreSummary({ homeScore: draftHomeScore, awayScore: draftAwayScore })}`
              : 'Choose a winner and final score'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
                onClick={() => {
                  if (!canSave) return;
                  const inferredWinnerTeamId = getWinnerFromScores(matchup, draftHomeScore, draftAwayScore);
                  onSave?.(inferredWinnerTeamId || draftWinnerTeamId, draftHomeScore, draftAwayScore);
                  onClose();
                }}
              disabled={!canSave}
              className={classNames(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                canSave
                  ? 'bg-blue-500 text-white shadow-sm shadow-blue-200 hover:bg-blue-600'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              )}
            >
              Save Pick
            </button>
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

const MatchupCompareModal = ({
  matchup,
  officialResult,
  title,
  isOpen,
  onClose,
  teamLookup = {},
  comparisonEntries = [],
  compareEntryLabel = 'Viewed Pick'
}) => {
  const [otherIndex, setOtherIndex] = useState(0);
  const renderCompareSection = (label, compareMatchup, tone, key = label) => {
    const homeTeam = {
      name: compareMatchup?.homeTeamName || teamLookup[compareMatchup?.homeTeamId]?.name || '',
      iconCode: teamLookup[compareMatchup?.homeTeamId]?.iconCode || null
    };
    const awayTeam = {
      name: compareMatchup?.awayTeamName || teamLookup[compareMatchup?.awayTeamId]?.name || '',
      iconCode: teamLookup[compareMatchup?.awayTeamId]?.iconCode || null
    };
    const winnerTeamId = compareMatchup?.winnerTeamId || '';

    return (
      <div className={classNames(
        'rounded-3xl border p-4',
        tone === 'official'
          ? 'border-emerald-200 bg-emerald-50/60'
          : tone === 'current'
            ? 'border-blue-200 bg-blue-50/60'
            : 'border-slate-200 bg-slate-50/70'
      )} key={key}>
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="space-y-2.5">
          <TeamSummaryRow
            teamName={homeTeam.name}
            iconCode={homeTeam.iconCode}
            selected={winnerTeamId === compareMatchup?.homeTeamId}
          />
          <TeamSummaryRow
            teamName={awayTeam.name}
            iconCode={awayTeam.iconCode}
            selected={winnerTeamId === compareMatchup?.awayTeamId}
          />
        </div>
        <div className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {getScoreSummary(compareMatchup)}
        </div>
      </div>
    );
  };

  const currentUserComparison = comparisonEntries.find((entry) => entry.isCurrentUser) || null;
  const otherComparisons = comparisonEntries
    .filter((entry) => !entry.isCurrentUser)
    .sort((left, right) => {
      if (left.isActiveEntry) return -1;
      if (right.isActiveEntry) return 1;
      return left.name.localeCompare(right.name);
    });
  const activeOtherComparison = otherComparisons[otherIndex] || null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setOtherIndex(0);
  }, [isOpen, title]);

  useEffect(() => {
    if (!otherComparisons.length) {
      setOtherIndex(0);
      return;
    }

    if (otherIndex >= otherComparisons.length) {
      setOtherIndex(0);
    }
  }, [otherComparisons, otherIndex]);

  const handlePreviousOther = () => {
    if (!otherComparisons.length) {
      return;
    }

    setOtherIndex((current) => (current - 1 + otherComparisons.length) % otherComparisons.length);
  };

  const handleNextOther = () => {
    if (!otherComparisons.length) {
      return;
    }

    setOtherIndex((current) => (current + 1) % otherComparisons.length);
  };

  if (!isOpen) {
    return null;
  }

  const modalContent = (
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
              Match Compare
            </div>
            <h3 className="mt-1 text-xl font-bold text-slate-950">
              {title || 'Match'}
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
            {renderCompareSection(
              'Your Pick',
              currentUserComparison?.matchup || null,
              'current'
            )}
            {renderCompareSection('Official Result', officialResult, 'official')}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Other Picks
                </div>
                {otherComparisons.length ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePreviousOther}
                      className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      aria-label="Show previous pick"
                    >
                      <FaChevronLeft className="text-xs" />
                    </button>
                    <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {otherIndex + 1} / {otherComparisons.length}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextOther}
                      className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      aria-label="Show next pick"
                    >
                      <FaChevronRight className="text-xs" />
                    </button>
                  </div>
                ) : null}
              </div>
              {activeOtherComparison ? (
                renderCompareSection(
                  activeOtherComparison.isActiveEntry ? compareEntryLabel : activeOtherComparison.name,
                  activeOtherComparison.matchup,
                  'other',
                  activeOtherComparison.id
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No other picks visible.
                </div>
              )}
              {otherComparisons.length > 1 ? (
                <div className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Use arrows to compare the rest
                </div>
              ) : null}
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

const WorldCupBracketMatchupCard = ({
  matchup,
  onSubmitPrediction,
  isLocked = false,
  title = '',
  officialResult = null,
  isOfficialBracket = false,
  emphasis = 'standard',
  titlePlacement = 'inside',
  titleAlign = 'left',
  showFooter = true,
  exportMode = false,
  teamLookup = {},
  comparisonEntries = [],
  compareEntryLabel = 'Viewed Pick'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const homeTeam = useMemo(
    () => ({
      name: matchup?.homeTeamName || teamLookup[matchup?.homeTeamId]?.name || '',
      iconCode: teamLookup[matchup?.homeTeamId]?.iconCode || null
    }),
    [matchup?.homeTeamId, matchup?.homeTeamName, teamLookup]
  );
  const awayTeam = useMemo(
    () => ({
      name: matchup?.awayTeamName || teamLookup[matchup?.awayTeamId]?.name || '',
      iconCode: teamLookup[matchup?.awayTeamId]?.iconCode || null
    }),
    [matchup?.awayTeamId, matchup?.awayTeamName, teamLookup]
  );
  const winnerTeamId = matchup?.winnerTeamId || '';
  const gamesLabel = getScoreSummary(matchup);
  const outcomeNote = buildOutcomeNote({
    matchup,
    officialResult,
    isOfficialBracket
  });

  const hasInteractiveTeams = !!matchup?.homeTeamId || !!matchup?.awayTeamId;
  const canEdit = !isLocked && !!onSubmitPrediction && hasInteractiveTeams;
  const canInspect = !canEdit && !isOfficialBracket && !!officialResult && !exportMode;
  const showTitle = emphasis !== 'standard' && titlePlacement === 'inside';
  const showSplitLayout = emphasis === 'championship';
  const titleAlignmentClass = titleAlign === 'center' ? 'justify-center text-center' : 'items-center justify-between';
  const WrapperTag = exportMode ? 'div' : 'button';
  const wrapperProps = exportMode
    ? {}
    : {
        type: 'button',
        onClick: () => {
          if (canEdit) {
            setIsModalOpen(true);
            return;
          }

          if (canInspect) {
            setIsCompareModalOpen(true);
          }
        },
        disabled: !canEdit && !canInspect
      };

  return (
    <>
      <WrapperTag
        {...wrapperProps}
        className={classNames(
          'h-full w-full rounded-[22px] p-2.5 text-left transition',
          exportMode
            ? emphasis === 'championship'
              ? 'bg-[#fff7e6] border-2 border-amber-300'
              : emphasis === 'featured'
                ? 'bg-slate-50 border border-slate-300'
                : 'bg-white border border-slate-300'
            : emphasis === 'championship'
              ? 'bg-gradient-to-br from-white via-amber-50/60 to-white shadow-lg shadow-amber-100/70 ring-1 ring-amber-100/80'
              : emphasis === 'featured'
                ? 'bg-gradient-to-br from-white via-slate-50 to-white shadow-md shadow-slate-200/60 ring-1 ring-slate-200/90'
                : 'bg-white/94 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/80',
          !exportMode && (canEdit || canInspect) && 'hover:-translate-y-0.5 hover:shadow-md',
          !exportMode && !canEdit && !canInspect && 'cursor-default'
        )}
      >
        {showTitle ? (
          <div className={classNames('mb-2.5 flex gap-2', titleAlignmentClass)}>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {title}
            </span>
            {gamesLabel && showFooter ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {gamesLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {showSplitLayout ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col items-center rounded-2xl bg-white/78 px-2 py-2.5 text-center">
              <TeamLogo
                teamName={homeTeam.name}
                iconCode={homeTeam.iconCode}
                size="hero"
                highlighted={winnerTeamId === matchup?.homeTeamId}
                exportMode={exportMode}
              />
              <div
                className={classNames(
                  'mt-2 w-full truncate text-[11px] leading-tight',
                  winnerTeamId === matchup?.homeTeamId ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'
                )}
                title={getInlineTeamLabel(homeTeam.name)}
              >
                {getInlineTeamLabel(homeTeam.name)}
              </div>
            </div>
            <div className="flex min-w-0 flex-col items-center rounded-2xl bg-white/78 px-2 py-2.5 text-center">
              <TeamLogo
                teamName={awayTeam.name}
                iconCode={awayTeam.iconCode}
                size="hero"
                highlighted={winnerTeamId === matchup?.awayTeamId}
                exportMode={exportMode}
              />
              <div
                className={classNames(
                  'mt-2 w-full truncate text-[11px] leading-tight',
                  winnerTeamId === matchup?.awayTeamId ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'
                )}
                title={getInlineTeamLabel(awayTeam.name)}
              >
                {getInlineTeamLabel(awayTeam.name)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <TeamSummaryRow
              teamName={homeTeam.name}
              iconCode={homeTeam.iconCode}
              selected={winnerTeamId === matchup?.homeTeamId}
              compact
              exportMode={exportMode}
            />
            <TeamSummaryRow
              teamName={awayTeam.name}
              iconCode={awayTeam.iconCode}
              selected={winnerTeamId === matchup?.awayTeamId}
              compact
              exportMode={exportMode}
            />
          </div>
        )}

      </WrapperTag>

      <div className={classNames(
        'mt-2',
        outcomeNote ? 'space-y-1 text-center' : 'flex items-center justify-center',
        !showFooter && 'hidden'
      )}>
        <div className={classNames(
          'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500',
          showTitle && emphasis === 'championship' && 'sr-only'
        )}>
          {gamesLabel || '\u00A0'}
        </div>
        {outcomeNote ? (
          <div className="space-y-1 text-center">
            <div
              className={classNames(
                'inline-block rounded-full border px-1.5 py-0.5 origin-top scale-[0.72] text-[8px] font-medium uppercase leading-none tracking-[0.03em]',
                outcomeNote.tone === 'perfect' && 'border-green-200 bg-green-50 text-green-700',
                outcomeNote.tone === 'correct' && 'border-blue-200 bg-blue-50 text-blue-700',
                outcomeNote.tone === 'incorrect' && 'border-rose-200 bg-rose-50 text-rose-700',
                outcomeNote.tone === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-600'
              )}
            >
              {outcomeNote.label}
            </div>
          </div>
        ) : null}
      </div>

      {!exportMode ? (
        <MatchupEditorModal
          matchup={matchup}
          title={title}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={onSubmitPrediction}
          teamLookup={teamLookup}
        />
      ) : null}

      {!exportMode ? (
        <MatchupCompareModal
          matchup={matchup}
          officialResult={officialResult}
          title={title}
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          teamLookup={teamLookup}
          comparisonEntries={comparisonEntries}
          compareEntryLabel={compareEntryLabel}
        />
      ) : null}
    </>
  );
};

export default WorldCupBracketMatchupCard;

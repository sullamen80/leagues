import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { classNames } from '../../../utils/formatters';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { getPointValue, getSeriesBonus, teamsMatch } from '../services/scoringService';
import { getNBATeamProfile } from '../utils/teamIdentity';

const SERIES_OPTIONS = [4, 5, 6, 7];

const formatPointValue = (value) => {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue) ? `${numericValue}` : numericValue.toFixed(1).replace(/\.0$/, '');
};

const normalizeValue = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const buildEarnedScoreNote = ({
  matchup,
  officialResult,
  roundKey,
  scoringSettings,
  officialFinalsMVP,
  selectedMVP,
  showScoreNotes,
  isOfficialBracket
}) => {
  if (!showScoreNotes || isOfficialBracket || !officialResult || !roundKey) {
    return null;
  }

  const officialWinner = officialResult?.winner;
  const hasCorrectWinner = !!matchup?.winner && !!officialWinner && matchup.winner === officialWinner;
  let totalPoints = 0;
  let earnedBonus = false;
  let earnedMVP = false;
  
  if (hasCorrectWinner) {
    totalPoints += Number(getPointValue(roundKey, scoringSettings) || 0);
    const officialGames = officialResult?.numGames ?? officialResult?.gamesPlayed ?? null;
    const predictedGames = matchup?.numGames ?? matchup?.gamesPlayed ?? null;

    if (officialGames && predictedGames && Number(officialGames) === Number(predictedGames) && teamsMatch(matchup, officialResult)) {
      totalPoints += Number(getSeriesBonus(roundKey, scoringSettings) || 0);
      earnedBonus = true;
    }

    const upsetBonusEnabled = scoringSettings?.upsetBonusEnabled !== false;
    if (upsetBonusEnabled && officialResult?.winnerSeed !== undefined && officialResult?.winnerSeed !== null) {
      const losingSeed = officialResult.winner === officialResult.team1
        ? officialResult.team2Seed
        : officialResult.team1Seed;

      if (losingSeed !== undefined && losingSeed !== null && Number(officialResult.winnerSeed) > Number(losingSeed)) {
        totalPoints += Number(scoringSettings?.upsetBonus || 2);
        earnedBonus = true;
      }
    }
  }

  if (roundKey === ROUND_KEYS.NBA_FINALS && officialFinalsMVP) {
    const userFinalsMVP = matchup?.mvp || matchup?.mvpPick || matchup?.predictedMVP || selectedMVP || '';
    if (normalizeValue(userFinalsMVP) && normalizeValue(userFinalsMVP) === normalizeValue(officialFinalsMVP)) {
      totalPoints += Number(getPointValue(ROUND_KEYS.FINALS_MVP, scoringSettings) || 0);
      earnedBonus = true;
      earnedMVP = true;
    }
  }

  return totalPoints > 0 ? {
    label: `+${formatPointValue(totalPoints)} pts${earnedMVP ? ' • MVP' : ''}`,
    tone: earnedMVP && !hasCorrectWinner ? 'mvp' : earnedBonus ? 'perfect' : 'correct'
  } : null;
};

const TeamLogo = ({ name, logo, size = 'default', highlighted = false, exportMode = false }) => {
  const [hasError, setHasError] = useState(false);
  const fallback = (name || 'TBD').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const sizeClasses = size === 'tight'
    ? {
        wrapper: 'h-7 w-7',
        image: 'h-4 w-4',
        fallback: 'text-[7px]'
      }
    : size === 'hero'
    ? {
        wrapper: 'h-14 w-14',
        image: 'h-9 w-9',
        fallback: 'text-[9px]'
      }
    : size === 'finals'
    ? {
        wrapper: 'h-12 w-12',
        image: 'h-8 w-8',
        fallback: 'text-[9px]'
      }
    : size === 'compact'
    ? {
        wrapper: 'h-8 w-8',
        image: 'h-5 w-5',
        fallback: 'text-[8px]'
      }
    : {
        wrapper: 'h-12 w-12',
        image: 'h-8 w-8',
        fallback: 'text-[10px]'
      };

  return (
    <div className={classNames(
      'flex items-center justify-center rounded-full bg-white ring-1 ring-slate-200/80',
      !exportMode && 'shadow-sm',
      highlighted && (exportMode ? 'border-2 border-sky-400 bg-sky-50' : 'bg-sky-50 ring-2 ring-sky-400 ring-offset-2 ring-offset-white'),
      sizeClasses.wrapper
    )}>
      {logo && !hasError ? (
        <img
          src={logo}
          alt={`${name} logo`}
          className={sizeClasses.image}
          onError={() => setHasError(true)}
        />
      ) : (
        <span className={classNames('font-semibold uppercase tracking-[0.08em] text-slate-500', sizeClasses.fallback)}>
          {fallback}
        </span>
      )}
    </div>
  );
};

const TeamSummaryRow = ({
  name,
  logo,
  selected = false,
  compact = false,
  align = 'left',
  tight = false,
  exportMode = false
}) => {
  const compactNameLength = (name || '').length;
  const compactTextClass = compactNameLength > 18 || tight
    ? 'text-[9px]'
    : compactNameLength > 14
      ? 'text-[10px]'
      : 'text-[11px]';

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
      name={name}
      logo={logo}
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
        title={name || 'TBD'}
      >
        {name || 'TBD'}
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
  roundKey,
  teamPlayers = {},
  selectedMVP = ''
}) => {
  const [draftWinner, setDraftWinner] = useState(matchup?.winner || '');
  const [draftWinnerSeed, setDraftWinnerSeed] = useState(matchup?.winnerSeed || null);
  const [draftGames, setDraftGames] = useState(matchup?.numGames || null);
  const [draftMVP, setDraftMVP] = useState(selectedMVP || matchup?.mvp || matchup?.mvpPick || '');
  const isFinalsSeries = roundKey === ROUND_KEYS.NBA_FINALS;

  useEffect(() => {
    if (!isOpen) return;
    setDraftWinner(matchup?.winner || '');
    setDraftWinnerSeed(matchup?.winnerSeed || null);
    setDraftGames(matchup?.numGames || null);
    setDraftMVP(selectedMVP || matchup?.mvp || matchup?.mvpPick || '');
  }, [isOpen, matchup, selectedMVP]);

  if (!isOpen) return null;

  const options = [
    matchup?.team1 ? { name: matchup.team1, seed: matchup?.team1Seed, profile: getNBATeamProfile(matchup.team1) } : null,
    matchup?.team2 ? { name: matchup.team2, seed: matchup?.team2Seed, profile: getNBATeamProfile(matchup.team2) } : null
  ].filter(Boolean);
  const finalsMVPOptions = Array.from(new Set(
    [matchup?.team1, matchup?.team2]
      .filter(Boolean)
      .flatMap((teamName) => teamPlayers[teamName] || [])
      .filter(Boolean)
  ));

  const canSave = !!draftWinner && !!draftGames;

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
              {title || 'Series'}
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
                key={team.name}
                type="button"
                onClick={() => {
                  setDraftWinner(team.name);
                  setDraftWinnerSeed(team.seed || null);
                }}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                  draftWinner === team.name
                    ? 'border-blue-400 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <TeamLogo
                  name={team.profile?.displayName || team.name}
                  logo={team.profile?.logo || null}
                  size="default"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {team.profile?.displayName || team.name}
                  </div>
                  {team.profile?.fullName && team.profile.fullName !== team.profile.displayName ? (
                    <div className={classNames('mt-1 text-xs', draftWinner === team.name ? 'text-blue-700' : 'text-slate-500')}>
                      {team.profile.fullName}
                    </div>
                  ) : null}
                </div>
                {draftWinner === team.name ? (
                  <div className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    Selected
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Games
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SERIES_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraftGames(option)}
                  className={classNames(
                    'rounded-full border px-3 py-2 text-sm font-semibold transition',
                    draftGames === option
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm shadow-blue-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {isFinalsSeries ? (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Finals MVP
              </div>
              {finalsMVPOptions.length > 0 ? (
                <select
                  value={draftMVP}
                  onChange={(event) => setDraftMVP(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Pick later</option>
                  {finalsMVPOptions.map((player) => (
                    <option key={player} value={player}>
                      {player}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Add Finals roster players to enable MVP picks here.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <div className="text-sm text-slate-500">
            {draftWinner && draftGames
              ? `${draftWinner} in ${draftGames}${draftMVP ? `, ${draftMVP} MVP` : ''}`
              : 'Choose a winner and series length'}
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
                onSave?.(draftWinner, draftWinnerSeed, draftGames, draftMVP);
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

const BracketMatchupCard = ({
  matchup,
  onSubmitPrediction,
  isLocked = false,
  title = '',
  roundKey = '',
  scoringSettings = null,
  teamPlayers = {},
  selectedMVP = '',
  officialFinalsMVP = null,
  officialResult = null,
  showScoreNotes = false,
  isOfficialBracket = false,
  emphasis = 'standard',
  titlePlacement = 'inside',
  titleAlign = 'left',
  showFooter = true,
  exportMode = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const team1Profile = useMemo(() => getNBATeamProfile(matchup?.team1), [matchup?.team1]);
  const team2Profile = useMemo(() => getNBATeamProfile(matchup?.team2), [matchup?.team2]);
  const winnerName = matchup?.winner || '';
  const gamesLabel = matchup?.numGames ? `${matchup.numGames} games` : '';
  const scoringNote = buildEarnedScoreNote({
    matchup,
    officialResult,
    roundKey,
    scoringSettings,
    officialFinalsMVP,
    selectedMVP,
    showScoreNotes,
    isOfficialBracket
  });

  const hasInteractiveTeams = !!matchup?.team1 || !!matchup?.team2;
  const canEdit = !isLocked && !!onSubmitPrediction && hasInteractiveTeams;
  const showTitle = emphasis !== 'standard' && titlePlacement === 'inside';
  const showSplitLayout = emphasis === 'championship';
  const titleAlignmentClass = titleAlign === 'center' ? 'justify-center text-center' : 'items-center justify-between';
  const WrapperTag = exportMode ? 'div' : 'button';
  const wrapperProps = exportMode
    ? {}
    : {
        type: 'button',
        onClick: () => {
          if (canEdit) setIsModalOpen(true);
        },
        disabled: !canEdit
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
          !exportMode && canEdit && 'hover:-translate-y-0.5 hover:shadow-md',
          !exportMode && !canEdit && 'cursor-default'
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
                name={team1Profile?.displayName || matchup?.team1}
                logo={team1Profile?.logo || null}
                size="hero"
                highlighted={winnerName === matchup?.team1}
                exportMode={exportMode}
              />
              <div
                className={classNames(
                  'mt-2 w-full truncate text-[11px] leading-tight',
                  winnerName === matchup?.team1 ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'
                )}
                title={team1Profile?.displayName || matchup?.team1 || 'TBD'}
              >
                {team1Profile?.displayName || matchup?.team1 || 'TBD'}
              </div>
            </div>
            <div className="flex min-w-0 flex-col items-center rounded-2xl bg-white/78 px-2 py-2.5 text-center">
              <TeamLogo
                name={team2Profile?.displayName || matchup?.team2}
                logo={team2Profile?.logo || null}
                size="hero"
                highlighted={winnerName === matchup?.team2}
                exportMode={exportMode}
              />
              <div
                className={classNames(
                  'mt-2 w-full truncate text-[11px] leading-tight',
                  winnerName === matchup?.team2 ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'
                )}
                title={team2Profile?.displayName || matchup?.team2 || 'TBD'}
              >
                {team2Profile?.displayName || matchup?.team2 || 'TBD'}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <TeamSummaryRow
              name={team1Profile?.displayName || matchup?.team1}
              logo={team1Profile?.logo || null}
              selected={winnerName === matchup?.team1}
              compact
              exportMode={exportMode}
            />
            <TeamSummaryRow
              name={team2Profile?.displayName || matchup?.team2}
              logo={team2Profile?.logo || null}
              selected={winnerName === matchup?.team2}
              compact
              exportMode={exportMode}
            />
          </div>
        )}

        <div className={classNames(
          'mt-3',
          scoringNote ? 'space-y-1 text-center' : 'flex items-center justify-center',
          !showFooter && 'hidden'
        )}>
          <div className={classNames(
            'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500',
            showTitle && emphasis === 'championship' && 'sr-only'
          )}>
            {gamesLabel || '\u00A0'}
          </div>
          {scoringNote ? (
                <div
                  className={classNames(
                    'inline-block rounded-full border px-1.5 py-0.5 origin-top scale-[0.72] text-[8px] font-medium uppercase leading-none tracking-[0.03em]',
                    scoringNote.tone === 'perfect'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : scoringNote.tone === 'mvp'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                  )}
                >
                  {scoringNote.label}
                </div>
          ) : null}
        </div>
      </WrapperTag>

      {!exportMode ? (
        <MatchupEditorModal
          matchup={matchup}
          title={title}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={onSubmitPrediction}
          roundKey={roundKey}
          teamPlayers={teamPlayers}
          selectedMVP={selectedMVP}
        />
      ) : null}
    </>
  );
};

export default BracketMatchupCard;

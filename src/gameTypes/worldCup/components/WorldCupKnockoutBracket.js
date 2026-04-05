import React, { useMemo, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import BracketLayoutToggle from '../../common/bracket/BracketLayoutToggle';
import { buildTeamLookup } from '../services/worldCupService';
import WorldCupBracketCanvas from './WorldCupBracketCanvas';
import WorldCupBracketMatchupCard from './WorldCupBracketMatchupCard';

const KNOCKOUT_ROUND_LABELS = {
  roundOf32: 'Round of 32',
  roundOf16: 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  thirdPlace: 'Third Place Match',
  final: 'Final'
};

const ROUND_ORDER = ['roundOf32', 'roundOf16', 'quarterfinals', 'semifinals', 'thirdPlace', 'final'];

const WorldCupKnockoutBracket = ({
  groups = [],
  rounds = {},
  officialRounds = null,
  showThirdPlace = false,
  readOnly = false,
  isLocked = false,
  onMatchChange = null,
  isOfficialBracket = false,
  showLockedMessage = false,
  forceDesktopCanvas = false,
  exportMode = false,
  forcedLayoutMode = null,
  showLayoutToggle = true,
  renderMatchupOverride = null,
  comparisonEntries = [],
  compareEntryLabel = 'Viewed Pick'
}) => {
  const [layoutMode, setLayoutMode] = useState('bracket');
  const teamLookup = useMemo(() => buildTeamLookup(groups), [groups]);
  const canEdit = !readOnly && !isLocked && typeof onMatchChange === 'function';
  const activeLayoutMode = forcedLayoutMode || layoutMode;
  const visibleRoundKeys = useMemo(
    () => ROUND_ORDER.filter((roundKey) => showThirdPlace || roundKey !== 'thirdPlace'),
    [showThirdPlace]
  );

  const commitMatchChange = (roundKey, index, winnerTeamId, homeScore, awayScore) => {
    if (!onMatchChange) {
      return;
    }

    onMatchChange(roundKey, index, {
      winnerTeamId: winnerTeamId || null,
      homeScore,
      awayScore
    });
  };

  const getMatchTitle = (roundKey, index) => {
    const label = rounds?.[roundKey]?.[index]?.label;
    return label || `${KNOCKOUT_ROUND_LABELS[roundKey] || roundKey} ${index + 1}`;
  };

  const renderMatchup = (roundKey, index, matchup, options = {}) => {
    if (!matchup) {
      return null;
    }

    const {
      emphasis = 'standard',
      titlePlacement = 'inside',
      titleAlign = 'left',
      showFooter = true
    } = options;

    const defaultMatchup = (
      <WorldCupBracketMatchupCard
        matchup={matchup}
        onSubmitPrediction={canEdit ? (winnerTeamId, homeScore, awayScore) => (
          commitMatchChange(roundKey, index, winnerTeamId, homeScore, awayScore)
        ) : null}
        isLocked={!canEdit}
        title={getMatchTitle(roundKey, index)}
        officialResult={officialRounds?.[roundKey]?.[index] || null}
        isOfficialBracket={isOfficialBracket}
        emphasis={emphasis}
        titlePlacement={titlePlacement}
        titleAlign={titleAlign}
        showFooter={showFooter}
        exportMode={exportMode}
        teamLookup={teamLookup}
        comparisonEntries={comparisonEntries.map((entry) => ({
          ...entry,
          matchup: entry?.bracket?.[roundKey]?.[index] || null
        }))}
        compareEntryLabel={compareEntryLabel}
      />
    );

    if (typeof renderMatchupOverride === 'function') {
      const overrideResult = renderMatchupOverride({
        roundKey,
        index,
        matchup,
        options,
        title: getMatchTitle(roundKey, index),
        canEdit,
        teamLookup,
        defaultMatchup
      });

      if (overrideResult !== null && typeof overrideResult !== 'undefined') {
        return overrideResult;
      }
    }

    return defaultMatchup;
  };

  const renderLayoutToggle = () => (
    <div className="mb-5 flex justify-end">
      <BracketLayoutToggle value={layoutMode} onChange={setLayoutMode} />
    </div>
  );

  const renderBracketCanvas = () => {
    const leftRoundOf32 = (rounds?.roundOf32 || []).slice(0, 8);
    const rightRoundOf32 = (rounds?.roundOf32 || []).slice(8, 16);
    const leftRoundOf16 = (rounds?.roundOf16 || []).slice(0, 4);
    const rightRoundOf16 = (rounds?.roundOf16 || []).slice(4, 8);
    const leftQuarterfinals = (rounds?.quarterfinals || []).slice(0, 2);
    const rightQuarterfinals = (rounds?.quarterfinals || []).slice(2, 4);
    const leftSemifinal = rounds?.semifinals?.[0] || null;
    const rightSemifinal = rounds?.semifinals?.[1] || null;
    const finalMatch = rounds?.final?.[0] || null;
    const thirdPlaceMatch = rounds?.thirdPlace?.[0] || null;

    return (
      <div className="space-y-4">
        <div
          data-testid="world-cup-bracket-canvas-shell"
          className={forceDesktopCanvas ? 'block' : 'overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]'}
        >
          <WorldCupBracketCanvas
            leftRoundOf32={leftRoundOf32}
            leftRoundOf16={leftRoundOf16}
            leftQuarterfinals={leftQuarterfinals}
            leftSemifinal={leftSemifinal}
            finalMatch={finalMatch}
            rightSemifinal={rightSemifinal}
            rightQuarterfinals={rightQuarterfinals}
            rightRoundOf16={rightRoundOf16}
            rightRoundOf32={rightRoundOf32}
            renderMatchup={renderMatchup}
            championTeamId={finalMatch?.winnerTeamId || ''}
            teamLookup={teamLookup}
            exportMode={exportMode}
          />
        </div>

        {showThirdPlace && thirdPlaceMatch ? (
          <div className="max-w-sm">
            {renderMatchup('thirdPlace', 0, thirdPlaceMatch, {
              emphasis: 'featured'
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderRoundsView = () => (
    <div className="space-y-6">
      {visibleRoundKeys.map((roundKey) => (
        <section key={roundKey} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{KNOCKOUT_ROUND_LABELS[roundKey] || roundKey}</h3>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              {(rounds?.[roundKey] || []).length} match{(rounds?.[roundKey] || []).length === 1 ? '' : 'es'}
            </span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {(rounds?.[roundKey] || []).map((match, index) => (
              <div key={match.id || `${roundKey}-${index}`}>
                {renderMatchup(roundKey, index, match)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {showLayoutToggle ? renderLayoutToggle() : null}
      {activeLayoutMode === 'bracket' ? renderBracketCanvas() : renderRoundsView()}

      {showLockedMessage && isLocked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <div className="flex items-center gap-2 text-sm">
            <FaInfoCircle />
            <span>This bracket is locked and cannot be edited.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default WorldCupKnockoutBracket;

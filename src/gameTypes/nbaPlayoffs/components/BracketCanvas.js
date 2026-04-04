import React, { useState } from 'react';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { getPointValue, getSeriesBonus, teamsMatch } from '../services/scoringService';
import { getNBATeamProfile } from '../utils/teamIdentity';

const ROW_POSITIONS = Object.freeze({
  firstRound: [1, 5, 9, 13],
  semifinals: [3, 11],
  conferenceFinals: 7,
  finals: 7,
  champion: 4
});

const COLUMN_WIDTHS = [196, 176, 186, 264, 186, 176, 196];
const COLUMN_GAP = 16;
const ROW_HEIGHT = 66;
const HEADER_HEIGHT = 96;
const CARD_INSET_Y = 8;
const STANDARD_ROW_SPAN = 2;
const FINALS_ROW_SPAN = 3;
const CANVAS_HEIGHT = HEADER_HEIGHT + (16 * ROW_HEIGHT);

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

  const hasCorrectWinner = !!matchup?.winner && !!officialResult?.winner && matchup.winner === officialResult.winner;
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
const getColumnX = (columnIndex) => (
  COLUMN_WIDTHS.slice(0, columnIndex).reduce((sum, width) => sum + width, 0) +
  (columnIndex * COLUMN_GAP)
);

const getColumnCenterX = (columnIndex) => getColumnX(columnIndex) + (COLUMN_WIDTHS[columnIndex] / 2);

const getCardY = (rowStart) => (
  HEADER_HEIGHT + ((rowStart - 1) * ROW_HEIGHT) + CARD_INSET_Y
);

const getCardHeight = (rowSpan = STANDARD_ROW_SPAN) => (rowSpan * ROW_HEIGHT) - (CARD_INSET_Y * 2);

const getCardCenterY = (rowStart, rowSpan = STANDARD_ROW_SPAN) => (
  getCardY(rowStart, rowSpan) + (getCardHeight(rowSpan) / 2)
);

const TOTAL_WIDTH = COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0) + (COLUMN_GAP * (COLUMN_WIDTHS.length - 1));

const StageLabel = ({ left, width, top, label, tone = 'slate' }) => {
  const toneClass = tone === 'east' ? 'text-sky-700' : tone === 'west' ? 'text-rose-700' : 'text-slate-500';

  return (
    <div
      className={`absolute text-center text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}
      style={{ left, width, top }}
    >
      {label}
    </div>
  );
};

const MatchupMeta = ({ left, width, top, gamesLabel, scoringLabel = '', mvpPick = '' }) => (
  <div
    className="absolute text-center"
    style={{ left, width, top }}
  >
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {gamesLabel}
    </div>
    {scoringLabel ? (
      <div
        className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 origin-top scale-[0.72] text-[8px] font-medium uppercase leading-none tracking-[0.03em] ${
          scoringLabel.tone === 'perfect'
            ? 'border-green-200 bg-green-50 text-green-700'
            : scoringLabel.tone === 'mvp'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}
      >
        {scoringLabel.label}
      </div>
    ) : null}
    {mvpPick ? (
      <div className="mt-1">
        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          MVP Pick
        </div>
        <div className="mt-0.5 text-[11px] font-semibold text-slate-700">
          {mvpPick}
        </div>
      </div>
    ) : null}
  </div>
);

const MatchupPosition = ({ left, top, width, height, children }) => (
  <div
    className="absolute"
    style={{ left, top, width, height }}
  >
    {children}
  </div>
);

const ConnectorPath = ({ points, tone = 'neutral', emphasized = false }) => {
  const toneStyles = {
    neutral: { stroke: '#dbe4f0', width: 1.8 },
    east: { stroke: '#93c5fd', width: 2.2 },
    west: { stroke: '#f9a8d4', width: 2.2 },
    center: { stroke: '#c084fc', width: 2.5 },
    champion: { stroke: '#f0ab2d', width: 2.3 }
  };
  const style = toneStyles[tone] || toneStyles.neutral;

  return (
  <polyline
    points={points.map(([x, y]) => `${x},${y}`).join(' ')}
    fill="none"
    stroke={style.stroke}
    strokeWidth={emphasized ? style.width + 0.2 : style.width}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);
};

const ChampionLogo = ({ name, logo, exportMode = false }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={exportMode
      ? 'flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-white'
      : 'flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-white shadow-sm'
    }>
      {logo && !hasError ? (
        <img
          src={logo}
          alt={`${name} logo`}
          className="h-9 w-9"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {(name || 'TBD').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
};

const ChampionCard = ({ championName, exportMode = false }) => {
  const championProfile = getNBATeamProfile(championName);
  const displayName = championProfile?.displayName || championName || 'TBD';
  const championNameClass = displayName.length > 12 ? 'text-sm' : 'text-base';

  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="flex h-full w-full flex-col items-center justify-center rounded-full px-4 text-center"
          style={{
            border: '5px solid #d4a017',
            background: '#d4a017',
            boxShadow: exportMode ? 'none' : '0 24px 44px -24px rgba(180, 83, 9, 0.65), 0 0 0 4px rgba(253, 230, 138, 0.7)'
          }}
        >
          <div className="mb-2 flex items-center justify-center text-white">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em]">Champion</span>
          </div>
          <div className="mb-2.5 flex justify-center">
            <div
              className="rounded-full bg-white/95 p-1.5 shadow-sm"
              style={{ border: '2px solid #e5c15a' }}
            >
              <ChampionLogo name={displayName} logo={championProfile?.logo || null} exportMode={exportMode} />
            </div>
          </div>
          <div className={`font-bold text-white ${championNameClass}`}>
            {displayName}
          </div>
        </div>
      </div>
    </div>
  );
};

const buildEastConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn) + COLUMN_WIDTHS[fromColumn];
  const endX = getColumnX(toColumn);
  const midX = (startX + endX) / 2;
  const startY = getCardCenterY(fromRow);
  const endY = getCardCenterY(toRow);

  return [[startX, startY], [midX, startY], [midX, endY], [endX, endY]];
};

const buildWestConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn);
  const endX = getColumnX(toColumn) + COLUMN_WIDTHS[toColumn];
  const midX = (startX + endX) / 2;
  const startY = getCardCenterY(fromRow);
  const endY = getCardCenterY(toRow);

  return [[startX, startY], [midX, startY], [midX, endY], [endX, endY]];
};

const BracketCanvas = ({
  eastFirstRound = [],
  eastSemis = [],
  eastFinal = null,
  finals = null,
  westFinal = null,
  westSemis = [],
  westFirstRound = [],
  renderMatchup,
  championName,
  scoringSettings = null,
  officialBracket = null,
  showScoreNotes = false,
  isOfficialBracket = false,
  exportMode = false
}) => {
  const championWidth = 176;
  const championLeft = getColumnCenterX(3) - (championWidth / 2);
  const championTop = HEADER_HEIGHT + ((ROW_POSITIONS.champion - 1) * ROW_HEIGHT) - 34;
  const championHeight = 176;
  const externalStageLabelTop = getCardY(ROW_POSITIONS.conferenceFinals) - 24;
  const stageMetaTop = getCardY(ROW_POSITIONS.conferenceFinals) + getCardHeight() + 6;
  const finalsMetaTop = getCardY(ROW_POSITIONS.finals, FINALS_ROW_SPAN) + getCardHeight(FINALS_ROW_SPAN) + 6;

  return (
    <div className="pb-4">
      <div className="w-max rounded-[34px] bg-white/75 p-3 shadow-[0_28px_64px_-42px_rgba(15,23,42,0.45)]">
          <div
            data-testid="nba-bracket-canvas"
            className="relative overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,250,252,0.96)_28%,_rgba(241,245,249,0.98)_100%)]"
            style={{ width: TOTAL_WIDTH, height: CANVAS_HEIGHT }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[38%] bg-gradient-to-r from-sky-50/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%] bg-gradient-to-l from-rose-50/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[86px] border-b border-slate-200/70 bg-white/76 backdrop-blur-[2px]" />
            <div className="pointer-events-none absolute inset-x-8 top-[50px] h-px bg-gradient-to-r from-sky-200 via-slate-200 to-rose-200" />

            <svg
              className="pointer-events-none absolute inset-0"
              width={TOTAL_WIDTH}
              height={CANVAS_HEIGHT}
              viewBox={`0 0 ${TOTAL_WIDTH} ${CANVAS_HEIGHT}`}
              aria-hidden="true"
            >
              <ConnectorPath points={buildEastConnector(0, ROW_POSITIONS.firstRound[0], 1, ROW_POSITIONS.semifinals[0])} />
              <ConnectorPath points={buildEastConnector(0, ROW_POSITIONS.firstRound[1], 1, ROW_POSITIONS.semifinals[0])} />
              <ConnectorPath points={buildEastConnector(0, ROW_POSITIONS.firstRound[2], 1, ROW_POSITIONS.semifinals[1])} />
              <ConnectorPath points={buildEastConnector(0, ROW_POSITIONS.firstRound[3], 1, ROW_POSITIONS.semifinals[1])} />
              <ConnectorPath points={buildEastConnector(1, ROW_POSITIONS.semifinals[0], 2, ROW_POSITIONS.conferenceFinals)} tone="east" />
              <ConnectorPath points={buildEastConnector(1, ROW_POSITIONS.semifinals[1], 2, ROW_POSITIONS.conferenceFinals)} tone="east" />

              <ConnectorPath points={buildWestConnector(6, ROW_POSITIONS.firstRound[0], 5, ROW_POSITIONS.semifinals[0])} />
              <ConnectorPath points={buildWestConnector(6, ROW_POSITIONS.firstRound[1], 5, ROW_POSITIONS.semifinals[0])} />
              <ConnectorPath points={buildWestConnector(6, ROW_POSITIONS.firstRound[2], 5, ROW_POSITIONS.semifinals[1])} />
              <ConnectorPath points={buildWestConnector(6, ROW_POSITIONS.firstRound[3], 5, ROW_POSITIONS.semifinals[1])} />
              <ConnectorPath points={buildWestConnector(5, ROW_POSITIONS.semifinals[0], 4, ROW_POSITIONS.conferenceFinals)} tone="west" />
              <ConnectorPath points={buildWestConnector(5, ROW_POSITIONS.semifinals[1], 4, ROW_POSITIONS.conferenceFinals)} tone="west" />

              <ConnectorPath points={buildEastConnector(2, ROW_POSITIONS.conferenceFinals, 3, ROW_POSITIONS.finals)} tone="east" emphasized />
              <ConnectorPath points={buildWestConnector(4, ROW_POSITIONS.conferenceFinals, 3, ROW_POSITIONS.finals)} tone="west" emphasized />
            </svg>

            {eastFirstRound.map((matchup, index) => (
              <MatchupPosition
                key={`east-first-${index}`}
                left={getColumnX(0)}
                top={getCardY(ROW_POSITIONS.firstRound[index])}
                width={COLUMN_WIDTHS[0]}
                height={getCardHeight()}
              >
                {renderMatchup(ROUND_KEYS.FIRST_ROUND, index, matchup, { variant: 'bracket' })}
              </MatchupPosition>
            ))}

            {eastSemis.map((matchup, index) => (
              <MatchupPosition
                key={`east-semis-${index}`}
                left={getColumnX(1)}
                top={getCardY(ROW_POSITIONS.semifinals[index])}
                width={COLUMN_WIDTHS[1]}
                height={getCardHeight()}
              >
                {renderMatchup(ROUND_KEYS.CONF_SEMIS, index, matchup, { variant: 'bracket' })}
              </MatchupPosition>
            ))}

            {eastFinal ? (
              <>
                <StageLabel
                  left={getColumnX(2)}
                  width={COLUMN_WIDTHS[2]}
                  top={externalStageLabelTop}
                  label="East Final"
                  tone="east"
                />
                <MatchupPosition
                  left={getColumnX(2)}
                  top={getCardY(ROW_POSITIONS.conferenceFinals)}
                  width={COLUMN_WIDTHS[2]}
                  height={getCardHeight()}
                >
                  {renderMatchup(ROUND_KEYS.CONF_FINALS, 0, eastFinal, {
                    variant: 'bracket',
                    emphasis: 'featured',
                    titlePlacement: 'outside',
                    showFooter: false
                  })}
                </MatchupPosition>
                <MatchupMeta
                  left={getColumnX(2)}
                  width={COLUMN_WIDTHS[2]}
                  top={stageMetaTop}
                  gamesLabel={eastFinal?.numGames ? `${eastFinal.numGames} games` : ''}
                  scoringLabel={buildEarnedScoreNote({
                    matchup: eastFinal,
                    officialResult: officialBracket?.[ROUND_KEYS.CONF_FINALS]?.[0] || null,
                    roundKey: ROUND_KEYS.CONF_FINALS,
                    scoringSettings,
                    showScoreNotes,
                    isOfficialBracket
                  })}
                />
              </>
            ) : null}

            <MatchupPosition
              left={championLeft}
              top={championTop}
              width={championWidth}
              height={championHeight}
            >
              <ChampionCard championName={championName} exportMode={exportMode} />
            </MatchupPosition>

            {finals ? (
              <>
                <MatchupPosition
                  left={getColumnX(3)}
                  top={getCardY(ROW_POSITIONS.finals, FINALS_ROW_SPAN)}
                  width={COLUMN_WIDTHS[3]}
                  height={getCardHeight(FINALS_ROW_SPAN)}
                >
                  {renderMatchup(ROUND_KEYS.NBA_FINALS, 0, finals, {
                    variant: 'bracket',
                    emphasis: 'championship',
                    titleAlign: 'center',
                    showFooter: false
                  })}
                </MatchupPosition>
                <MatchupMeta
                  left={getColumnX(3)}
                  width={COLUMN_WIDTHS[3]}
                  top={finalsMetaTop}
                  gamesLabel={finals?.numGames ? `${finals.numGames} games` : ''}
                  scoringLabel={buildEarnedScoreNote({
                    matchup: finals,
                    officialResult: officialBracket?.[ROUND_KEYS.NBA_FINALS] || null,
                    roundKey: ROUND_KEYS.NBA_FINALS,
                    scoringSettings,
                    officialFinalsMVP: officialBracket?.[ROUND_KEYS.FINALS_MVP] || null,
                    selectedMVP: finals?.mvpPick || finals?.predictedMVP || finals?.mvp || '',
                    showScoreNotes,
                    isOfficialBracket
                  })}
                  mvpPick={finals?.mvpPick || finals?.predictedMVP || finals?.mvp || ''}
                />
              </>
            ) : null}

            {westFinal ? (
              <>
                <StageLabel
                  left={getColumnX(4)}
                  width={COLUMN_WIDTHS[4]}
                  top={externalStageLabelTop}
                  label="West Final"
                  tone="west"
                />
                <MatchupPosition
                  left={getColumnX(4)}
                  top={getCardY(ROW_POSITIONS.conferenceFinals)}
                  width={COLUMN_WIDTHS[4]}
                  height={getCardHeight()}
                >
                  {renderMatchup(ROUND_KEYS.CONF_FINALS, 1, westFinal, {
                    variant: 'bracket',
                    emphasis: 'featured',
                    titlePlacement: 'outside',
                    showFooter: false
                  })}
                </MatchupPosition>
                <MatchupMeta
                  left={getColumnX(4)}
                  width={COLUMN_WIDTHS[4]}
                  top={stageMetaTop}
                  gamesLabel={westFinal?.numGames ? `${westFinal.numGames} games` : ''}
                  scoringLabel={buildEarnedScoreNote({
                    matchup: westFinal,
                    officialResult: officialBracket?.[ROUND_KEYS.CONF_FINALS]?.[1] || null,
                    roundKey: ROUND_KEYS.CONF_FINALS,
                    scoringSettings,
                    showScoreNotes,
                    isOfficialBracket
                  })}
                />
              </>
            ) : null}

            {westSemis.map((matchup, index) => (
              <MatchupPosition
                key={`west-semis-${index}`}
                left={getColumnX(5)}
                top={getCardY(ROW_POSITIONS.semifinals[index])}
                width={COLUMN_WIDTHS[5]}
                height={getCardHeight()}
              >
                {renderMatchup(ROUND_KEYS.CONF_SEMIS, index + 2, matchup, { variant: 'bracket' })}
              </MatchupPosition>
            ))}

            {westFirstRound.map((matchup, index) => (
              <MatchupPosition
                key={`west-first-${index}`}
                left={getColumnX(6)}
                top={getCardY(ROW_POSITIONS.firstRound[index])}
                width={COLUMN_WIDTHS[6]}
                height={getCardHeight()}
              >
                {renderMatchup(ROUND_KEYS.FIRST_ROUND, index + 4, matchup, { variant: 'bracket' })}
              </MatchupPosition>
            ))}
          </div>
      </div>
    </div>
  );
};

export default BracketCanvas;

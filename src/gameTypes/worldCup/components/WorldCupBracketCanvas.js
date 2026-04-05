import React from 'react';
import { FaTrophy } from 'react-icons/fa';
import {
  CanvasFrame,
  ConnectorPath,
  MatchupPosition,
  StageLabel
} from '../../common/bracket/BracketCanvasPrimitives';
import { getFifaTeamIcon } from '../constants/fifaTeams';

const ROW_POSITIONS = Object.freeze({
  roundOf32: [1, 5, 9, 13, 19, 23, 27, 31],
  roundOf16: [3, 11, 21, 29],
  quarterfinals: [7, 25],
  semifinals: 16,
  final: 16
});

const COLUMN_WIDTHS = [188, 176, 176, 186, 252, 186, 176, 176, 188];
const COLUMN_GAPS = [14, 14, 18, 28, 28, 18, 14, 14];
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 96;
const CARD_INSET_Y = 8;
const STANDARD_ROW_SPAN = 2;
const FINAL_ROW_SPAN = 3;
const STANDARD_CARD_HEIGHT = 132;
const CHAMPION_TOP_PADDING = 18;
const CHAMPION_FINAL_GAP = 28;
const CANVAS_BOTTOM_PADDING = 36;
const FOOTER_STACK_HEIGHT = 42;

const getColumnX = (columnIndex) => (
  COLUMN_WIDTHS.slice(0, columnIndex).reduce((sum, width) => sum + width, 0) +
  COLUMN_GAPS.slice(0, columnIndex).reduce((sum, gap) => sum + gap, 0)
);

const getColumnCenterX = (columnIndex) => getColumnX(columnIndex) + (COLUMN_WIDTHS[columnIndex] / 2);

const getCardY = (rowStart) => (
  HEADER_HEIGHT + ((rowStart - 1) * ROW_HEIGHT) + CARD_INSET_Y
);

const getCardHeight = (rowSpan = STANDARD_ROW_SPAN) => (
  rowSpan === STANDARD_ROW_SPAN
    ? STANDARD_CARD_HEIGHT
    : (rowSpan * ROW_HEIGHT) - (CARD_INSET_Y * 2)
);

const getCardCenterY = (rowStart, rowSpan = STANDARD_ROW_SPAN) => (
  getCardY(rowStart, rowSpan) + (getCardHeight(rowSpan) / 2)
);

const getCardBottomY = (rowStart, rowSpan = STANDARD_ROW_SPAN) => (
  getCardY(rowStart, rowSpan) + getCardHeight(rowSpan)
);

const CONTENT_BOTTOM = Math.max(
  ...ROW_POSITIONS.roundOf32.map((rowStart) => getCardBottomY(rowStart)),
  ...ROW_POSITIONS.roundOf16.map((rowStart) => getCardBottomY(rowStart)),
  ...ROW_POSITIONS.quarterfinals.map((rowStart) => getCardBottomY(rowStart)),
  getCardBottomY(ROW_POSITIONS.semifinals),
  getCardBottomY(ROW_POSITIONS.final, FINAL_ROW_SPAN)
);

const CANVAS_HEIGHT = CONTENT_BOTTOM + FOOTER_STACK_HEIGHT + CANVAS_BOTTOM_PADDING;

const TOTAL_WIDTH =
  COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0) +
  COLUMN_GAPS.reduce((sum, gap) => sum + gap, 0);

const ChampionCard = ({ championTeamId, teamLookup = {}, exportMode = false }) => {
  const champion = championTeamId ? teamLookup[championTeamId] || null : null;
  const displayName = champion?.name || 'TBD';
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
              <div className={exportMode
                ? 'flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-white'
                : 'flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-white shadow-sm'
              }>
                {champion?.iconCode ? (
                  <span className="text-2xl" aria-hidden="true">
                    {getFifaTeamIcon(champion.iconCode)}
                  </span>
                ) : (
                  <FaTrophy className="text-amber-600" />
                )}
              </div>
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

const buildLeftConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn) + COLUMN_WIDTHS[fromColumn];
  const endX = getColumnX(toColumn);
  const midX = (startX + endX) / 2;
  const startY = getCardCenterY(fromRow);
  const endY = getCardCenterY(toRow);

  return [[startX, startY], [midX, startY], [midX, endY], [endX, endY]];
};

const buildRightConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn);
  const endX = getColumnX(toColumn) + COLUMN_WIDTHS[toColumn];
  const midX = (startX + endX) / 2;
  const startY = getCardCenterY(fromRow);
  const endY = getCardCenterY(toRow);

  return [[startX, startY], [midX, startY], [midX, endY], [endX, endY]];
};

const WorldCupBracketCanvas = ({
  leftRoundOf32 = [],
  leftRoundOf16 = [],
  leftQuarterfinals = [],
  leftSemifinal = null,
  finalMatch = null,
  rightSemifinal = null,
  rightQuarterfinals = [],
  rightRoundOf16 = [],
  rightRoundOf32 = [],
  renderMatchup,
  championTeamId = '',
  teamLookup = {},
  exportMode = false
}) => {
  const championWidth = 176;
  const championLeft = getColumnCenterX(4) - (championWidth / 2);
  const championHeight = 176;
  const finalTop = getCardY(ROW_POSITIONS.final, FINAL_ROW_SPAN);
  const championTop = Math.max(CHAMPION_TOP_PADDING, finalTop - championHeight - CHAMPION_FINAL_GAP);
  const externalStageLabelTop = getCardY(ROW_POSITIONS.semifinals) - 24;
  return (
    <div className="pb-4">
      <CanvasFrame
        width={TOTAL_WIDTH}
        height={CANVAS_HEIGHT}
        leftAccentClass="from-sky-50/80"
        rightAccentClass="from-rose-50/80"
        topRuleClass="from-sky-200 via-slate-200 to-rose-200"
      >
        <div
          data-testid="world-cup-bracket-canvas"
          className="absolute inset-0"
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={TOTAL_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${TOTAL_WIDTH} ${CANVAS_HEIGHT}`}
            aria-hidden="true"
          >
            {ROW_POSITIONS.roundOf32.map((rowStart, index) => (
              <ConnectorPath
                key={`left-r32-r16-${index}`}
                points={buildLeftConnector(0, rowStart, 1, ROW_POSITIONS.roundOf16[Math.floor(index / 2)])}
              />
            ))}
            {ROW_POSITIONS.roundOf16.map((rowStart, index) => (
              <ConnectorPath
                key={`left-r16-qf-${index}`}
                points={buildLeftConnector(1, rowStart, 2, ROW_POSITIONS.quarterfinals[Math.floor(index / 2)])}
              />
            ))}
            {ROW_POSITIONS.quarterfinals.map((rowStart) => (
              <ConnectorPath
                key={`left-qf-sf-${rowStart}`}
                points={buildLeftConnector(2, rowStart, 3, ROW_POSITIONS.semifinals)}
                tone="east"
              />
            ))}

            {ROW_POSITIONS.roundOf32.map((rowStart, index) => (
              <ConnectorPath
                key={`right-r32-r16-${index}`}
                points={buildRightConnector(8, rowStart, 7, ROW_POSITIONS.roundOf16[Math.floor(index / 2)])}
              />
            ))}
            {ROW_POSITIONS.roundOf16.map((rowStart, index) => (
              <ConnectorPath
                key={`right-r16-qf-${index}`}
                points={buildRightConnector(7, rowStart, 6, ROW_POSITIONS.quarterfinals[Math.floor(index / 2)])}
              />
            ))}
            {ROW_POSITIONS.quarterfinals.map((rowStart) => (
              <ConnectorPath
                key={`right-qf-sf-${rowStart}`}
                points={buildRightConnector(6, rowStart, 5, ROW_POSITIONS.semifinals)}
                tone="west"
              />
            ))}

            <ConnectorPath points={buildLeftConnector(3, ROW_POSITIONS.semifinals, 4, ROW_POSITIONS.final)} tone="east" emphasized />
            <ConnectorPath points={buildRightConnector(5, ROW_POSITIONS.semifinals, 4, ROW_POSITIONS.final)} tone="west" emphasized />
          </svg>

          {leftRoundOf32.map((matchup, index) => (
            <MatchupPosition
              key={`left-r32-${index}`}
              left={getColumnX(0)}
              top={getCardY(ROW_POSITIONS.roundOf32[index])}
              width={COLUMN_WIDTHS[0]}
              height={getCardHeight()}
            >
              {renderMatchup('roundOf32', index, matchup, { variant: 'bracket' })}
            </MatchupPosition>
          ))}

          {leftRoundOf16.map((matchup, index) => (
            <MatchupPosition
              key={`left-r16-${index}`}
              left={getColumnX(1)}
              top={getCardY(ROW_POSITIONS.roundOf16[index])}
              width={COLUMN_WIDTHS[1]}
              height={getCardHeight()}
            >
              {renderMatchup('roundOf16', index, matchup, { variant: 'bracket' })}
            </MatchupPosition>
          ))}

          {leftQuarterfinals.map((matchup, index) => (
            <MatchupPosition
              key={`left-qf-${index}`}
              left={getColumnX(2)}
              top={getCardY(ROW_POSITIONS.quarterfinals[index])}
              width={COLUMN_WIDTHS[2]}
              height={getCardHeight()}
            >
              {renderMatchup('quarterfinals', index, matchup, { variant: 'bracket' })}
            </MatchupPosition>
          ))}

          {leftSemifinal ? (
            <>
              <StageLabel
                left={getColumnX(3)}
                width={COLUMN_WIDTHS[3]}
                top={externalStageLabelTop}
                label="Semifinal 1"
                tone="east"
              />
              <MatchupPosition
                left={getColumnX(3)}
                top={getCardY(ROW_POSITIONS.semifinals)}
                width={COLUMN_WIDTHS[3]}
                height={getCardHeight()}
              >
                {renderMatchup('semifinals', 0, leftSemifinal, {
                  variant: 'bracket',
                  emphasis: 'featured',
                  titlePlacement: 'outside'
                })}
              </MatchupPosition>
            </>
          ) : null}

          <MatchupPosition
            left={championLeft}
            top={championTop}
            width={championWidth}
            height={championHeight}
          >
            <ChampionCard
              championTeamId={championTeamId}
              teamLookup={teamLookup}
              exportMode={exportMode}
            />
          </MatchupPosition>

          {finalMatch ? (
            <>
              <MatchupPosition
                left={getColumnX(4)}
                top={finalTop}
                width={COLUMN_WIDTHS[4]}
                height={getCardHeight(FINAL_ROW_SPAN)}
              >
                {renderMatchup('final', 0, finalMatch, {
                  variant: 'bracket',
                  emphasis: 'championship',
                  titleAlign: 'center'
                })}
              </MatchupPosition>
            </>
          ) : null}

          {rightSemifinal ? (
            <>
              <StageLabel
                left={getColumnX(5)}
                width={COLUMN_WIDTHS[5]}
                top={externalStageLabelTop}
                label="Semifinal 2"
                tone="west"
              />
              <MatchupPosition
                left={getColumnX(5)}
                top={getCardY(ROW_POSITIONS.semifinals)}
                width={COLUMN_WIDTHS[5]}
                height={getCardHeight()}
              >
                {renderMatchup('semifinals', 1, rightSemifinal, {
                  variant: 'bracket',
                  emphasis: 'featured',
                  titlePlacement: 'outside'
                })}
              </MatchupPosition>
            </>
          ) : null}

          {rightQuarterfinals.map((matchup, index) => (
            <MatchupPosition
              key={`right-qf-${index}`}
              left={getColumnX(6)}
              top={getCardY(ROW_POSITIONS.quarterfinals[index])}
              width={COLUMN_WIDTHS[6]}
              height={getCardHeight()}
            >
              {renderMatchup('quarterfinals', index + 2, matchup, { variant: 'bracket' })}
            </MatchupPosition>
          ))}

          {rightRoundOf16.map((matchup, index) => (
            <MatchupPosition
              key={`right-r16-${index}`}
              left={getColumnX(7)}
              top={getCardY(ROW_POSITIONS.roundOf16[index])}
              width={COLUMN_WIDTHS[7]}
              height={getCardHeight()}
            >
              {renderMatchup('roundOf16', index + 4, matchup, { variant: 'bracket' })}
            </MatchupPosition>
          ))}

          {rightRoundOf32.map((matchup, index) => (
            <MatchupPosition
              key={`right-r32-${index}`}
              left={getColumnX(8)}
              top={getCardY(ROW_POSITIONS.roundOf32[index])}
              width={COLUMN_WIDTHS[8]}
              height={getCardHeight()}
            >
              {renderMatchup('roundOf32', index + 8, matchup, { variant: 'bracket' })}
            </MatchupPosition>
          ))}
        </div>
      </CanvasFrame>
    </div>
  );
};

export default WorldCupBracketCanvas;

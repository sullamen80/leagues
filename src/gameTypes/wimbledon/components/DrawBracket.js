import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCheck,
  FaExpand,
  FaSearchMinus,
  FaSearchPlus,
  FaTimes,
  FaTrophy
} from 'react-icons/fa';
import {
  CanvasFrame,
  ConnectorPath,
  MatchupPosition,
  StageLabel
} from '../../common/bracket/BracketCanvasPrimitives';
import { WIMBLEDON_ROUNDS } from '../constants/wimbledonConstants';
import {
  getActiveStartRoundIndex,
  resolveDrawMatches,
  updateDrawPrediction
} from '../utils/drawUtils';
import './Wimbledon.css';

const FOCUS_OPTIONS = Object.freeze([
  { key: 'roundOf128', label: 'Round of 128' },
  { key: 'roundOf64', label: 'Round of 64' },
  { key: 'final32', label: 'Final 32' }
]);

const FINAL_32_ROW_POSITIONS = Object.freeze({
  roundOf32: [1, 5, 9, 13, 19, 23, 27, 31],
  roundOf16: [3, 11, 21, 29],
  quarterfinals: [7, 25],
  semifinals: 16,
  final: 16
});

const FINAL_32_COLUMN_WIDTHS = [220, 204, 204, 214, 270, 214, 204, 204, 220];
const FINAL_32_COLUMN_GAPS = [14, 14, 18, 28, 28, 18, 14, 14];
const FINAL_32_ROW_HEIGHT = 64;
const FINAL_32_HEADER_HEIGHT = 96;
const FINAL_32_CARD_INSET_Y = 8;
const FINAL_32_CARD_HEIGHT = 176;
const FINAL_32_CHAMPION_SIZE = 176;
const FINAL_32_CANVAS_BOTTOM_PADDING = 40;

const getColumnX = (columnIndex) => (
  FINAL_32_COLUMN_WIDTHS.slice(0, columnIndex).reduce((sum, width) => sum + width, 0) +
  FINAL_32_COLUMN_GAPS.slice(0, columnIndex).reduce((sum, gap) => sum + gap, 0)
);

const getColumnCenterX = (columnIndex) =>
  getColumnX(columnIndex) + (FINAL_32_COLUMN_WIDTHS[columnIndex] / 2);

const getCardY = (rowStart) =>
  FINAL_32_HEADER_HEIGHT + ((rowStart - 1) * FINAL_32_ROW_HEIGHT) + FINAL_32_CARD_INSET_Y;

const getCardCenterY = (rowStart) => getCardY(rowStart) + (FINAL_32_CARD_HEIGHT / 2);

const FINAL_32_TOTAL_WIDTH =
  FINAL_32_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0) +
  FINAL_32_COLUMN_GAPS.reduce((sum, gap) => sum + gap, 0);

const FINAL_32_CANVAS_HEIGHT =
  getCardY(FINAL_32_ROW_POSITIONS.roundOf32.at(-1)) +
  FINAL_32_CARD_HEIGHT +
  FINAL_32_CANVAS_BOTTOM_PADDING;

const getEntrantLabel = (entrant = {}) => {
  if (!entrant?.name) {
    return 'TBD';
  }
  const seed = entrant.seed ? `(${entrant.seed}) ` : '';
  const country = entrant.countryCode ? ` · ${entrant.countryCode}` : '';
  const status = entrant.entryStatus ? ` [${entrant.entryStatus}]` : '';
  return `${seed}${entrant.name}${country}${status}`;
};

const MatchCard = ({
  match,
  entrantsBySlot,
  prediction,
  officialPrediction,
  editable,
  showResults,
  setPredictionEnabled,
  allowCompletionReason,
  maximumSets,
  scoringSettings,
  onChange,
  canvas = false,
  emphasis = 'standard'
}) => {
  const participants = match.participantSlotIds || [];
  const winnerSets = Number(maximumSets) === 5 ? 3 : 2;
  const selectedWinner = prediction?.winnerSlotId || null;
  const championship = emphasis === 'championship';
  const hasOfficialResult = Boolean(showResults && officialPrediction?.winnerSlotId);
  const correctPick = Boolean(
    hasOfficialResult &&
    selectedWinner &&
    selectedWinner === officialPrediction.winnerSlotId
  );
  const incorrectPick = Boolean(hasOfficialResult && selectedWinner && !correctPick);
  const round = WIMBLEDON_ROUNDS.find((candidate) => candidate.key === match.roundKey);
  const roundPoints = Number(scoringSettings?.roundPoints?.[match.roundKey] ?? round?.points ?? 0);

  return (
    <div
      className={`relative flex flex-col border ${
      canvas
        ? `h-full w-full rounded-[22px] p-3 ${
            championship
              ? 'border-slate-200 bg-white shadow-[0_22px_50px_-30px_rgba(15,23,42,0.65)]'
              : 'border-slate-200 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)]'
          }`
        : 'min-w-[15rem] rounded bg-white p-2 shadow-sm'
      }`}
    >
      <div
        className={`flex items-center justify-between font-semibold uppercase tracking-wide ${
        canvas ? 'mb-2 text-[9px]' : 'mb-2 text-[0.65rem]'
        }`}
        style={{ color: '#9ca3af' }}
      >
        <span>{match.id.replace(/-/g, ' ')}</span>
        {correctPick ? <FaCheck className="wimbledon-match-result__icon is-correct" /> : null}
        {incorrectPick ? <FaTimes className="wimbledon-match-result__icon is-incorrect" /> : null}
      </div>
      <div className="space-y-1.5">
        {[0, 1].map((participantIndex) => {
          const slotId = participants[participantIndex];
          const entrant = entrantsBySlot?.[slotId] || null;
          const selected = slotId && selectedWinner === slotId;
          const correct = correctPick && selected;
          const incorrect = incorrectPick && selected;

          return (
            <button
              key={`${match.id}-${participantIndex}`}
              type="button"
              disabled={!editable || !slotId}
              onClick={() => onChange({
                winnerSlotId: slotId,
                winnerSets: setPredictionEnabled ? winnerSets : null,
                loserSets: null,
                completionReason: 'completed'
              })}
              className={`flex w-full items-center justify-between border text-left transition ${
                canvas ? 'rounded-full px-3 py-2 text-[11px]' : 'rounded px-2 py-2 text-xs'
              } ${
                correct
                  ? 'border-green-500 bg-green-50 text-green-900'
                  : incorrect
                    ? 'border-red-400 bg-red-50 text-red-900'
                    : selected
                      ? 'border-blue-400 bg-blue-50 font-semibold text-blue-950 ring-1 ring-blue-200'
                      : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
              } disabled:cursor-default`}
            >
              <span className="truncate">{getEntrantLabel(entrant)}</span>
              {selected && correct ? <FaCheck className="wimbledon-match-result__choice-icon" /> : null}
              {selected && incorrect ? <FaTimes className="wimbledon-match-result__choice-icon" /> : null}
              {selected && !hasOfficialResult ? <FaCheck className="wimbledon-match-result__choice-icon" /> : null}
            </button>
          );
        })}
      </div>
      {correctPick || incorrectPick ? (
        <div className={`wimbledon-match-result ${correctPick ? 'is-correct' : 'is-incorrect'}`}>
          <span>{correctPick ? 'Correct pick' : 'Incorrect pick'}</span>
          <strong>{correctPick ? `+${roundPoints}` : '0'} pts</strong>
        </div>
      ) : null}
      {selectedWinner && (setPredictionEnabled || allowCompletionReason) ? (
        <div className={`mt-auto grid gap-1.5 border-t border-slate-100 pt-2 ${
          setPredictionEnabled && allowCompletionReason ? 'grid-cols-2' : 'grid-cols-1'
        }`}>
          {setPredictionEnabled ? (
            <select
              disabled={!editable}
              value={prediction?.loserSets ?? ''}
              onChange={(event) => onChange({
                winnerSets,
                loserSets: event.target.value === '' ? null : Number(event.target.value)
              })}
              className="min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-[10px]"
            >
              <option value="">Sets</option>
              {Array.from({ length: winnerSets }, (_, index) => (
                <option key={index} value={index}>{winnerSets}–{index}</option>
              ))}
            </select>
          ) : null}
          {allowCompletionReason ? (
            <select
              disabled={!editable}
              value={prediction?.completionReason || 'completed'}
              onChange={(event) => onChange({
                completionReason: event.target.value,
                ...(event.target.value === 'completed' ? {} : { winnerSets: null, loserSets: null })
              })}
              className="min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-[10px]"
            >
              <option value="completed">Completed</option>
              <option value="retirement">Retirement</option>
              <option value="walkover">Walkover</option>
              <option value="default">Default</option>
              <option value="suspended">Suspended</option>
            </select>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const buildLeftConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn) + FINAL_32_COLUMN_WIDTHS[fromColumn];
  const endX = getColumnX(toColumn);
  const midX = (startX + endX) / 2;
  return [
    [startX, getCardCenterY(fromRow)],
    [midX, getCardCenterY(fromRow)],
    [midX, getCardCenterY(toRow)],
    [endX, getCardCenterY(toRow)]
  ];
};

const buildRightConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn);
  const endX = getColumnX(toColumn) + FINAL_32_COLUMN_WIDTHS[toColumn];
  const midX = (startX + endX) / 2;
  return [
    [startX, getCardCenterY(fromRow)],
    [midX, getCardCenterY(fromRow)],
    [midX, getCardCenterY(toRow)],
    [endX, getCardCenterY(toRow)]
  ];
};

const ChampionCard = ({ champion }) => (
  <div
    className="flex h-full w-full flex-col items-center justify-center rounded-full border-[5px] px-4 text-center text-white"
    style={{
      background: 'linear-gradient(180deg, #f7d774 0%, #d9a514 100%)',
      borderColor: '#9a6a00',
      boxShadow: '0 24px 44px -24px rgba(120, 72, 0, 0.9), 0 0 0 4px rgba(218, 165, 32, 0.38)'
    }}
  >
    <FaTrophy className="mb-2 text-2xl" />
    <div className="text-[10px] font-bold uppercase tracking-[0.22em]">Champion</div>
    <div className="mt-2 text-sm font-bold">{champion?.name || 'TBD'}</div>
  </div>
);

const Final32Canvas = ({
  resolved,
  official,
  gameData,
  editable,
  showResults,
  setPredictionEnabled,
  allowCompletionReason,
  scoringSettings,
  onMatchChange
}) => {
  const sharedProps = {
    entrantsBySlot: gameData?.entrantsBySlot || {},
    editable,
    showResults,
    setPredictionEnabled,
    allowCompletionReason,
    maximumSets: gameData?.maximumSets || 3,
    scoringSettings,
    canvas: true
  };
  const championSlotId = resolved.predictionsByMatchId?.['final-1']?.winnerSlotId || null;
  const champion = gameData?.entrantsBySlot?.[championSlotId] || null;
  const championLeft = getColumnCenterX(4) - (FINAL_32_CHAMPION_SIZE / 2);
  const finalTop = getCardY(FINAL_32_ROW_POSITIONS.final);
  const championTop = Math.max(18, finalTop - FINAL_32_CHAMPION_SIZE - 28);

  const renderPositionedMatch = (roundKey, index, column, row, options = {}) => {
    const matchId = `${roundKey}-${index + 1}`;
    return (
      <MatchupPosition
        key={matchId}
        left={getColumnX(column)}
        top={getCardY(row)}
        width={FINAL_32_COLUMN_WIDTHS[column]}
        height={FINAL_32_CARD_HEIGHT}
      >
        <MatchCard
          {...sharedProps}
          match={resolved.matchesById[matchId]}
          prediction={resolved.predictionsByMatchId[matchId]}
          officialPrediction={official.predictionsByMatchId[matchId]}
          emphasis={options.emphasis}
          onChange={(patch) => onMatchChange(matchId, patch)}
        />
      </MatchupPosition>
    );
  };

  return (
    <CanvasFrame
      width={FINAL_32_TOTAL_WIDTH}
      height={FINAL_32_CANVAS_HEIGHT}
      leftAccentClass="from-sky-50/80"
      rightAccentClass="from-rose-50/80"
      topRuleClass="from-sky-200 via-slate-200 to-rose-200"
    >
      <div className="absolute inset-0">
        <svg
          className="pointer-events-none absolute inset-0"
          width={FINAL_32_TOTAL_WIDTH}
          height={FINAL_32_CANVAS_HEIGHT}
          viewBox={`0 0 ${FINAL_32_TOTAL_WIDTH} ${FINAL_32_CANVAS_HEIGHT}`}
          aria-hidden="true"
        >
          {FINAL_32_ROW_POSITIONS.roundOf32.map((row, index) => (
            <ConnectorPath key={`left-r32-${index}`} points={buildLeftConnector(0, row, 1, FINAL_32_ROW_POSITIONS.roundOf16[Math.floor(index / 2)])} />
          ))}
          {FINAL_32_ROW_POSITIONS.roundOf16.map((row, index) => (
            <ConnectorPath key={`left-r16-${index}`} points={buildLeftConnector(1, row, 2, FINAL_32_ROW_POSITIONS.quarterfinals[Math.floor(index / 2)])} />
          ))}
          {FINAL_32_ROW_POSITIONS.quarterfinals.map((row) => (
            <ConnectorPath key={`left-qf-${row}`} points={buildLeftConnector(2, row, 3, FINAL_32_ROW_POSITIONS.semifinals)} tone="east" />
          ))}
          {FINAL_32_ROW_POSITIONS.roundOf32.map((row, index) => (
            <ConnectorPath key={`right-r32-${index}`} points={buildRightConnector(8, row, 7, FINAL_32_ROW_POSITIONS.roundOf16[Math.floor(index / 2)])} />
          ))}
          {FINAL_32_ROW_POSITIONS.roundOf16.map((row, index) => (
            <ConnectorPath key={`right-r16-${index}`} points={buildRightConnector(7, row, 6, FINAL_32_ROW_POSITIONS.quarterfinals[Math.floor(index / 2)])} />
          ))}
          {FINAL_32_ROW_POSITIONS.quarterfinals.map((row) => (
            <ConnectorPath key={`right-qf-${row}`} points={buildRightConnector(6, row, 5, FINAL_32_ROW_POSITIONS.semifinals)} tone="west" />
          ))}
          <ConnectorPath points={buildLeftConnector(3, FINAL_32_ROW_POSITIONS.semifinals, 4, FINAL_32_ROW_POSITIONS.final)} tone="east" emphasized />
          <ConnectorPath points={buildRightConnector(5, FINAL_32_ROW_POSITIONS.semifinals, 4, FINAL_32_ROW_POSITIONS.final)} tone="west" emphasized />
        </svg>

        {FINAL_32_ROW_POSITIONS.roundOf32.map((row, index) => renderPositionedMatch('roundOf32', index, 0, row))}
        {FINAL_32_ROW_POSITIONS.roundOf16.map((row, index) => renderPositionedMatch('roundOf16', index, 1, row))}
        {FINAL_32_ROW_POSITIONS.quarterfinals.map((row, index) => renderPositionedMatch('quarterfinals', index, 2, row))}
        <StageLabel left={getColumnX(3)} width={FINAL_32_COLUMN_WIDTHS[3]} top={getCardY(FINAL_32_ROW_POSITIONS.semifinals) - 24} label="Semifinal 1" tone="east" />
        {renderPositionedMatch('semifinals', 0, 3, FINAL_32_ROW_POSITIONS.semifinals, { emphasis: 'featured' })}

        <MatchupPosition left={championLeft} top={championTop} width={FINAL_32_CHAMPION_SIZE} height={FINAL_32_CHAMPION_SIZE}>
          <ChampionCard champion={champion} />
        </MatchupPosition>
        {renderPositionedMatch('final', 0, 4, FINAL_32_ROW_POSITIONS.final, { emphasis: 'championship' })}

        <StageLabel left={getColumnX(5)} width={FINAL_32_COLUMN_WIDTHS[5]} top={getCardY(FINAL_32_ROW_POSITIONS.semifinals) - 24} label="Semifinal 2" tone="west" />
        {renderPositionedMatch('semifinals', 1, 5, FINAL_32_ROW_POSITIONS.semifinals, { emphasis: 'featured' })}
        {FINAL_32_ROW_POSITIONS.quarterfinals.map((row, index) => renderPositionedMatch('quarterfinals', index + 2, 6, row))}
        {FINAL_32_ROW_POSITIONS.roundOf16.map((row, index) => renderPositionedMatch('roundOf16', index + 4, 7, row))}
        {FINAL_32_ROW_POSITIONS.roundOf32.map((row, index) => renderPositionedMatch('roundOf32', index + 8, 8, row))}
      </div>
    </CanvasFrame>
  );
};

const EarlyRoundFocus = ({
  roundKey,
  resolved,
  official,
  gameData,
  editable,
  showResults,
  setPredictionEnabled,
  allowCompletionReason,
  scoringSettings,
  onMatchChange
}) => {
  const round = WIMBLEDON_ROUNDS.find((candidate) => candidate.key === roundKey);
  const matchIds = Array.from({ length: round.matchCount }, (_, index) => `${roundKey}-${index + 1}`);
  const midpoint = matchIds.length / 2;
  const halves = [matchIds.slice(0, midpoint), matchIds.slice(midpoint)];

  return (
    <div className="grid min-w-[1120px] grid-cols-2 gap-8 p-4">
      {halves.map((ids, halfIndex) => (
        <section key={halfIndex} className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className={`mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            halfIndex === 0 ? 'text-sky-700' : 'text-rose-700'
          }`}>
            {halfIndex === 0 ? 'Top Half' : 'Bottom Half'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ids.map((matchId) => (
              <MatchCard
                key={matchId}
                match={resolved.matchesById[matchId]}
                entrantsBySlot={gameData?.entrantsBySlot || {}}
                prediction={resolved.predictionsByMatchId[matchId]}
                officialPrediction={official.predictionsByMatchId[matchId]}
                editable={editable}
                showResults={showResults}
                setPredictionEnabled={setPredictionEnabled}
                allowCompletionReason={allowCompletionReason}
                maximumSets={gameData?.maximumSets || 3}
                scoringSettings={scoringSettings}
                onChange={(patch) => onMatchChange(matchId, patch)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const DrawBracket = ({
  gameData,
  picksByMatchId = {},
  officialResultsByMatchId = null,
  editable = false,
  showResults = false,
  setPredictionEnabled = false,
  allowCompletionReason = false,
  scoringSettings = null,
  onChange = () => {}
}) => {
  const [focus, setFocus] = useState('final32');
  const [zoom, setZoom] = useState(1);
  const activeStartRoundIndex = getActiveStartRoundIndex(gameData);
  const focusOptions = useMemo(
    () => FOCUS_OPTIONS.filter((option) => {
      if (option.key === 'roundOf128') {
        return activeStartRoundIndex <= 0;
      }

      if (option.key === 'roundOf64') {
        return activeStartRoundIndex <= 1;
      }

      return true;
    }),
    [activeStartRoundIndex]
  );
  const resolved = useMemo(
    () => resolveDrawMatches(gameData, picksByMatchId),
    [gameData, picksByMatchId]
  );
  const official = useMemo(
    () => resolveDrawMatches(gameData, officialResultsByMatchId || gameData?.officialResultsByMatchId || {}),
    [gameData, officialResultsByMatchId]
  );
  const activeFocus = focusOptions.some((option) => option.key === focus) ? focus : 'final32';

  useEffect(() => {
    if (!focusOptions.some((option) => option.key === focus)) {
      setFocus('final32');
    }
  }, [focus, focusOptions]);

  const handleMatchChange = (matchId, patch) => {
    onChange(updateDrawPrediction(gameData, resolved.predictionsByMatchId, matchId, patch));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-300 bg-slate-100/95 p-1.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1">
          <span className="pl-3 pr-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">View</span>
          {focusOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFocus(option.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeFocus === option.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:text-slate-950'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mr-1 flex items-center gap-2">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))} className="rounded-full bg-white p-2 text-gray-600 hover:bg-gray-200"><FaSearchMinus /></button>
          <span className="text-xs font-semibold text-gray-500">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))} className="rounded-full bg-white p-2 text-gray-600 hover:bg-gray-200"><FaSearchPlus /></button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-full bg-white p-2 text-gray-600 hover:bg-gray-200"><FaExpand /></button>
        </div>
      </div>

      <div className="max-h-[78vh] overflow-auto rounded-[30px] bg-slate-100 p-3">
        <div
          className="w-max origin-top-left transition-transform"
          style={{ transform: `scale(${zoom})`, marginBottom: `${Math.max(0, (zoom - 1) * 180)}px` }}
        >
          {activeFocus === 'final32' ? (
            <Final32Canvas
              resolved={resolved}
              official={official}
              gameData={gameData}
              editable={editable}
              showResults={showResults}
              setPredictionEnabled={setPredictionEnabled}
              allowCompletionReason={allowCompletionReason}
              scoringSettings={scoringSettings}
              onMatchChange={handleMatchChange}
            />
          ) : (
            <EarlyRoundFocus
              roundKey={activeFocus}
              resolved={resolved}
              official={official}
              gameData={gameData}
              editable={editable}
              showResults={showResults}
              setPredictionEnabled={setPredictionEnabled}
              allowCompletionReason={allowCompletionReason}
              scoringSettings={scoringSettings}
              onMatchChange={handleMatchChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DrawBracket;

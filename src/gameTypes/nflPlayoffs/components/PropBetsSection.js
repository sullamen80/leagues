import React from 'react';
import { FaDice, FaLock } from 'react-icons/fa';
import { ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

const formatOptions = (options = []) =>
  Array.isArray(options) ? options.filter(Boolean) : [];

const getPropOfficialAnswer = (prop) => {
  if (!prop) return '';
  if (Object.prototype.hasOwnProperty.call(prop, 'officialAnswer')) {
    return prop.officialAnswer || '';
  }
  return prop.correctAnswer || '';
};

const PropBetsSection = ({
  propBets = [],
  selections = {},
  isLocked = false,
  scoringSettings = {},
  onSelectionChange = () => {},
  showOnlySelectedProps = false
}) => {
  if (!Array.isArray(propBets) || propBets.length === 0) {
    return null;
  }

  const defaults = scoringSettings?.propBetDefaults || {};
  const overrides = scoringSettings?.propBetOverrides || {};
  const selectionLimit = scoringSettings?.propBetSelectionLimit ?? 0;
  const activeWagers = Object.values(selections).filter(
    (selection) => Number(selection?.wager) > 0
  ).length;

  const getMaxWager = (propId) =>
    (overrides?.[propId]?.maxWager ?? defaults.maxWager ?? 3);

  const handleAnswerChange = (propId, value) => {
    if (isLocked) return;
    onSelectionChange(propId, { answer: value });
  };

  const handleClearSelection = (propId) => {
    if (isLocked) return;
    onSelectionChange(propId, { answer: null, wager: 0 });
  };

  const handleWagerChange = (propId, raw) => {
    if (isLocked) return;
    const max = getMaxWager(propId);
    const value = Math.max(0, Math.min(max, Number(raw) || 0));
    onSelectionChange(propId, { wager: value });
  };

  const activeProps = propBets.filter((prop) => prop?.active !== false);

  if (!activeProps.length) {
    return null;
  }

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
            <FaDice className="inline-block mr-2 text-indigo-500" />
            Prop Bets
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Assign a wager to each prop (max wager shown below). Correct answers pay the amount you wager.
            {selectionLimit > 0 && (
              <>
                {' '}
                You can wager on up to {selectionLimit} props.
              </>
            )}
          </p>
        </div>
        {isLocked && (
          <div className="flex items-center text-xs text-red-600">
            <FaLock className="mr-1" /> Locked
          </div>
        )}
      </div>

      <div className="space-y-6">
        {activeProps
          .filter((prop) => {
            if (!showOnlySelectedProps) return true;
            const selection = selections?.[prop.id];
            return Boolean(selection?.answer || Number(selection?.wager) > 0);
          })
          .map((prop) => {
          const selection = selections?.[prop.id] || {};
          const maxWager = getMaxWager(prop.id);
          const hasWager = Number(selection.wager) > 0;
          const official = getPropOfficialAnswer(prop);
          const options = formatOptions(prop.options);
          const roundLabel = prop.round ? ROUND_DISPLAY_NAMES[prop.round] : null;
          const matchupLabel = prop.matchupLabel || prop.matchupInfo;
          if (options.length === 0) {
            return (
              <div key={prop.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-500">
                No options configured for this prop yet.
              </div>
            );
          }

          return (
            <div
              key={prop.id}
              className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <div className="flex flex-col gap-1 mb-3">
                <div className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                  {roundLabel || 'Prop Bet'} {matchupLabel ? `• ${matchupLabel}` : ''}
                </div>
                <div className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {prop.line || prop.title || 'Prop Bet'}
                </div>
                {prop.title && prop.line && prop.title !== prop.line && (
                  <div className="text-xs text-gray-500">
                    {prop.title}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Max Wager: {maxWager} pts &bull; Correct answers pay your wager.
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Your Answer
                  </label>
                  <div className="space-y-2">
                    {options.map((option) => (
                      <label
                        key={`${prop.id}-${option}`}
                        className={`flex items-center p-2 border rounded cursor-pointer ${
                          selection.answer === option
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`prop-${prop.id}`}
                          value={option}
                          checked={selection.answer === option}
                          onChange={() => handleAnswerChange(prop.id, option)}
                          disabled={isLocked || (selectionLimit > 0 && !hasWager && activeWagers >= selectionLimit)}
                          className="mr-3"
                        />
                        <span className="text-sm text-gray-800">{option}</span>
                      </label>
                    ))}
                    {(selection.answer || Number(selection.wager) > 0) && (
                      <button
                        type="button"
                        onClick={() => handleClearSelection(prop.id)}
                        disabled={isLocked}
                        className={`text-xs font-semibold px-3 py-1 rounded border ${
                          isLocked
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Wager
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={maxWager}
                    step="1"
                    value={selection.wager ?? ''}
                    onChange={(e) => handleWagerChange(prop.id, e.target.value)}
                    disabled={
                      isLocked ||
                      (selectionLimit > 0 && !hasWager && activeWagers >= selectionLimit)
                    }
                    placeholder={`0 - ${maxWager}`}
                    className={`w-full md:w-32 px-3 py-2 border rounded-lg ${
                      isLocked ||
                      (selectionLimit > 0 && !hasWager && activeWagers >= selectionLimit)
                        ? 'bg-gray-100 cursor-not-allowed'
                        : 'bg-white'
                    }`}
                  />
                </div>

                {official && (
                  <div className="text-xs text-gray-500">
                    Official Result: <span className="font-semibold">{official}</span>
                  </div>
                )}
                {selectionLimit > 0 && !hasWager && activeWagers >= selectionLimit && (
                  <p className="text-[0.65rem] text-red-600 mt-1">
                    Remove another wager to add this prop (limit {selectionLimit}).
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PropBetsSection;

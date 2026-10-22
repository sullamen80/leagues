import React from 'react';
import { formatNumber } from '../../../utils/formatters';
import ProgressChart from './visualizations/ProgressChart';

const formatLabel = (key = '') => (
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d+)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bOf\b/g, 'of')
);

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const formatPrimitive = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? formatNumber(value) : value.toFixed(1);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatPrimitive(item)).join(', ');
  }

  if (isPlainObject(value)) {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== '')
      .map(([key, item]) => `${formatLabel(key)}: ${formatPrimitive(item)}`)
      .join(', ');
  }

  return String(value);
};

export const formatPercentage = (value) => {
  const numericValue = Number(value || 0);
  return `${(numericValue * 100).toFixed(1)}%`;
};

export const renderAdapterColumnValue = (column = {}, record = {}) => {
  if (typeof column.render === 'function') {
    return column.render(record);
  }

  const value = record[column.key];

  switch (column.key) {
    case 'score':
      return formatNumber(Number(value || 0));
    case 'accuracy':
      return formatPercentage(value);
    case 'correctPicks':
      return `${record.correctPicks || 0} / ${record.totalPossible || 0}`;
    case 'rank':
      return record.rankValue || record.rank || '—';
    case 'specialPicks':
      return formatPrimitive(record.specialPicks || record.fullData?.specialPicks || value);
    default:
      return formatPrimitive(value);
  }
};

const renderKeyValueGrid = (entries = []) => {
  const normalizedEntries = entries.filter(
    (entry) => entry && entry.label && entry.value !== undefined && entry.value !== null
  );

  if (!normalizedEntries.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {normalizedEntries.map((entry) => (
        <div key={entry.label} className="bg-white p-3 rounded shadow-sm">
          <h5 className="text-sm font-medium text-gray-500">{entry.label}</h5>
          <p className="text-base font-semibold text-gray-900">{formatPrimitive(entry.value)}</p>
        </div>
      ))}
    </div>
  );
};

const STATUS_CLASS_NAMES = Object.freeze({
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700'
});

const TONE_CLASS_NAMES = Object.freeze({
  indigo: 'text-indigo-600',
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  teal: 'text-teal-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  purple: 'text-purple-600',
  slate: 'text-slate-900'
});

const formatDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? formatNumber(value) : value.toFixed(1);
  }

  return String(value);
};

const renderMetricCards = (items = [], title = null) => {
  const rows = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {title ? <h5 className="text-sm font-medium text-gray-700">{title}</h5> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {item.label}
            </div>
            <div className={`mt-2 text-2xl font-semibold ${TONE_CLASS_NAMES[item.tone] || TONE_CLASS_NAMES.slate}`}>
              {formatDisplayValue(item.value)}
            </div>
            {item.meta ? <div className="mt-1 text-xs text-slate-500">{item.meta}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const renderContextGrid = (items = [], title = null) => {
  const rows = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {title ? <h5 className="text-sm font-medium text-gray-700">{title}</h5> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {item.label}
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">{formatDisplayValue(item.value)}</div>
            {item.helper ? <div className="mt-1 text-xs text-slate-500">{item.helper}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const renderSpecialPickCards = (items = [], title = 'Special Picks') => {
  const rows = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-medium text-gray-700">{title}</h5>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((item) => {
          const statusClass = STATUS_CLASS_NAMES[item.status] || STATUS_CLASS_NAMES.neutral;

          return (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatDisplayValue(item.value)}</div>
                  {item.helper ? <div className="mt-1 text-sm text-slate-500">{item.helper}</div> : null}
                </div>
                {item.badge ? (
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                    {item.badge}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const renderStructuredTable = (table = {}) => {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const columns = Array.isArray(table.columns) ? table.columns : [];

  if (!rows.length || !columns.length) {
    return null;
  }

  const footer = Array.isArray(table.footer) ? table.footer : [];

  return (
    <div className="space-y-3">
      {table.title ? <h5 className="text-sm font-medium text-gray-700">{table.title}</h5> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 ${
                    column.align === 'right'
                      ? 'text-right'
                      : column.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={row.id || row.label || rowIndex} className={row.rowClassName || ''}>
                {columns.map((column) => (
                  <td
                    key={`${row.id || row.label || rowIndex}-${column.key}`}
                    className={`px-4 py-3 text-sm ${
                      column.align === 'right'
                        ? 'text-right'
                        : column.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    } ${column.valueClassName || 'text-slate-700'} ${row.isTotal ? 'font-semibold' : ''}`}
                  >
                    {formatDisplayValue(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer.length > 0 ? (
            <tfoot className="divide-y divide-slate-200 bg-slate-50">
              {footer.map((row, rowIndex) => (
                <tr key={row.id || row.label || `footer-${rowIndex}`}>
                  {columns.map((column) => (
                    <td
                      key={`${row.id || row.label || rowIndex}-${column.key}`}
                      className={`px-4 py-3 text-sm font-semibold ${
                        column.align === 'right'
                          ? 'text-right'
                          : column.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      } ${column.valueClassName || 'text-slate-900'}`}
                    >
                      {formatDisplayValue(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
};

const renderScoringBreakdown = (content, fallbackRecord = {}) => (
  <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Detailed View
        </div>
        <h4 className="mt-1 text-lg font-semibold text-gray-900">
          {content?.title || 'Detailed Performance'}
        </h4>
      </div>
      <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
        {formatPercentage(fallbackRecord.accuracy)}
      </div>
    </div>
    {renderMetricCards(content.summaryCards || [], content.summaryTitle || null)}
    {renderMetricCards(content.scoringCards || [], content.scoringTitle || null)}
    {renderContextGrid(content.contextItems || [], content.contextTitle || null)}
    {renderSpecialPickCards(content.specialPickCards || [], content.specialTitle || 'Special Picks')}
    {renderStructuredTable(content.table || {})}
  </div>
);

const renderRoundBreakdown = (roundBreakdown = {}) => {
  const rows = Object.entries(roundBreakdown || {});

  if (!rows.length) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Possible</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map(([roundKey, value]) => {
            const correct = Number(value?.correctPicks ?? value?.correct ?? 0);
            const possible = Number(value?.possiblePicks ?? value?.possible ?? value?.totalPossible ?? 0);
            const percentage = possible > 0
              ? correct / possible
              : Number(value?.percentage || 0);

            return (
              <tr key={roundKey}>
                <td className="px-3 py-2 text-sm font-medium text-gray-900">{formatLabel(roundKey)}</td>
                <td className="px-3 py-2 text-sm text-gray-500">{correct}</td>
                <td className="px-3 py-2 text-sm text-gray-500">{possible}</td>
                <td className="px-3 py-2 text-sm text-gray-500">{formatPercentage(percentage)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const buildRoundChartData = (roundBreakdown = {}) => (
  Object.entries(roundBreakdown || {}).map(([roundKey, value]) => {
    const correct = Number(value?.correctPicks ?? value?.correct ?? 0);
    const possible = Number(value?.possiblePicks ?? value?.possible ?? value?.totalPossible ?? 0);
    const percentage = possible > 0
      ? correct / possible
      : Number(value?.percentage || 0);

    return {
      name: formatLabel(roundKey),
      correct,
      possible,
      percentage
    };
  }).filter((entry) => entry.correct > 0 || entry.possible > 0 || entry.percentage > 0)
);

export const renderAdapterExpandedContent = (content, fallbackRecord = {}) => {
  if (React.isValidElement(content)) {
    return content;
  }

  if (content?.layout === 'scoringBreakdown') {
    return renderScoringBreakdown(content, fallbackRecord);
  }

  const sections = Array.isArray(content?.sections) ? content.sections : [];
  const details = isPlainObject(content?.details) ? content.details : {};
  const roundBreakdown = isPlainObject(content?.roundBreakdown)
    ? content.roundBreakdown
    : isPlainObject(fallbackRecord.roundBreakdown)
      ? fallbackRecord.roundBreakdown
      : {};

  const detailEntries = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({ label: formatLabel(key), value }));
  const roundChartData = buildRoundChartData(roundBreakdown);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Detailed View
          </div>
          <h4 className="mt-1 text-lg font-semibold text-gray-900">
          {content?.title || 'Detailed Performance'}
          </h4>
        </div>
        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {formatPercentage(fallbackRecord.accuracy)}
        </div>
      </div>
      {renderKeyValueGrid([
        { label: 'Score', value: fallbackRecord.score },
        { label: 'Accuracy', value: formatPercentage(fallbackRecord.accuracy) },
        { label: 'Correct Picks', value: `${fallbackRecord.correctPicks || 0} / ${fallbackRecord.totalPossible || 0}` },
        ...(detailEntries.length > 0 ? detailEntries : [])
      ])}
      {roundChartData.length > 0 ? (
        <ProgressChart
          data={roundChartData}
          type="line"
          xAxisKey="name"
          title="Round Trend"
          subtitle="Accuracy across each round"
          series={[
            { dataKey: 'percentage', name: 'Accuracy', color: '#F97316' }
          ]}
          percent
          height={260}
        />
      ) : null}
      {sections.length > 0 ? (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Highlights</h5>
          {renderKeyValueGrid(sections)}
        </div>
      ) : null}
      {Object.keys(roundBreakdown).length > 0 ? (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Round Breakdown</h5>
          {renderRoundBreakdown(roundBreakdown)}
        </div>
      ) : null}
    </div>
  );
};

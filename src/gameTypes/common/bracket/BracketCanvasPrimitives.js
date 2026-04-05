import React from 'react';

export const CanvasFrame = ({
  width,
  height,
  leftAccentClass = 'from-sky-50/80',
  rightAccentClass = 'from-rose-50/80',
  topRuleClass = 'from-sky-200 via-slate-200 to-rose-200',
  shellClassName = '',
  innerClassName = '',
  children
}) => (
  <div className={`w-max rounded-[34px] bg-white/75 p-3 shadow-[0_28px_64px_-42px_rgba(15,23,42,0.45)] ${shellClassName}`.trim()}>
    <div
      className={`relative overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,250,252,0.96)_28%,_rgba(241,245,249,0.98)_100%)] ${innerClassName}`.trim()}
      style={{ width, height }}
    >
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-[38%] bg-gradient-to-r ${leftAccentClass} to-transparent`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-[38%] bg-gradient-to-l ${rightAccentClass} to-transparent`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[86px] border-b border-slate-200/70 bg-white/76 backdrop-blur-[2px]" />
      <div className={`pointer-events-none absolute inset-x-8 top-[50px] h-px bg-gradient-to-r ${topRuleClass}`} />
      {children}
    </div>
  </div>
);

export const MatchupPosition = ({ left, top, width, height, children }) => (
  <div
    className="absolute"
    style={{ left, top, width, height }}
  >
    {children}
  </div>
);

export const StageLabel = ({ left, width, top, label, tone = 'slate' }) => {
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

export const MatchupMeta = ({ left, width, top, gamesLabel, scoringLabel = '', extraLabel = '', extraTitle = '' }) => (
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
    {extraLabel ? (
      <div className="mt-1">
        {extraTitle ? (
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {extraTitle}
          </div>
        ) : null}
        <div className="mt-0.5 text-[11px] font-semibold text-slate-700">
          {extraLabel}
        </div>
      </div>
    ) : null}
  </div>
);

export const ConnectorPath = ({ points, tone = 'neutral', emphasized = false }) => {
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

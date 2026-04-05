import React from 'react';

const BracketLayoutToggle = ({ value = 'bracket', onChange, className = '' }) => (
  <div className={`inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100/95 p-1 shadow-sm ${className}`.trim()}>
    <span className="pl-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      View
    </span>
    <button
      type="button"
      onClick={() => onChange?.('bracket')}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        value === 'bracket'
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-slate-700 hover:bg-white/90 hover:text-slate-950'
      }`}
    >
      Bracket
    </button>
    <button
      type="button"
      onClick={() => onChange?.('rounds')}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        value === 'rounds'
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-slate-700 hover:bg-white/90 hover:text-slate-950'
      }`}
    >
      Rounds
    </button>
  </div>
);

export default BracketLayoutToggle;

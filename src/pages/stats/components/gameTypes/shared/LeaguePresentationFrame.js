import React from 'react';
import { classNames } from '../../../../../utils/formatters';
import { formatCompactNumber, formatPercent, safeArray } from './presentationUtils';

const toneClassNames = {
  slate: 'text-slate-900 bg-slate-100 border-slate-200',
  amber: 'text-amber-900 bg-amber-50 border-amber-200',
  blue: 'text-blue-900 bg-blue-50 border-blue-200',
  emerald: 'text-emerald-900 bg-emerald-50 border-emerald-200',
  teal: 'text-teal-900 bg-teal-50 border-teal-200',
  rose: 'text-rose-900 bg-rose-50 border-rose-200',
  violet: 'text-violet-900 bg-violet-50 border-violet-200'
};

const toneValueClassNames = {
  slate: 'text-slate-900',
  amber: 'text-amber-700',
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  teal: 'text-teal-700',
  rose: 'text-rose-700',
  violet: 'text-violet-700'
};

const heroBandClassNames = {
  slate: 'bg-slate-300',
  amber: 'bg-amber-400',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500'
};

const Card = ({ card, compact = false }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
      {card.label}
    </div>
    <div className={classNames('mt-2 text-2xl font-semibold', toneValueClassNames[card.tone] || toneValueClassNames.slate)}>
      {typeof card.value === 'number' ? formatCompactNumber(card.value) : card.value}
    </div>
    {card.meta ? (
      <div className={classNames('mt-1 text-sm text-slate-500', compact ? 'text-xs' : '')}>
        {card.meta}
      </div>
    ) : null}
  </div>
);

const Chip = ({ chip }) => (
  <span
    className={classNames(
      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold',
      toneClassNames[chip.tone] || toneClassNames.slate
    )}
  >
    <span className="uppercase tracking-[0.16em] opacity-70">{chip.label}</span>
    <span>{chip.value}</span>
  </span>
);

const StoryBlock = ({ section }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {section.kicker || 'Story'}
    </div>
    <h3 className="mt-2 text-lg font-semibold text-slate-900">{section.title}</h3>
    {section.copy ? <p className="mt-2 text-sm leading-6 text-slate-600">{section.copy}</p> : null}
    {safeArray(section.points).length ? (
      <ul className="mt-4 space-y-2">
        {section.points.map((point) => (
          <li key={point} className="flex gap-2 text-sm text-slate-600">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);

const RoundTable = ({ title, rows, footerNote = '' }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Round Story
      </div>
      <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
      {footerNote ? <p className="mt-1 text-sm text-slate-500">{footerNote}</p> : null}
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Round</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Correct</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Possible</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-5 py-3 text-sm font-medium text-slate-900">{row.label}</td>
              <td className="px-5 py-3 text-right text-sm text-slate-600">{formatCompactNumber(row.correct)}</td>
              <td className="px-5 py-3 text-right text-sm text-slate-600">{formatCompactNumber(row.possible)}</td>
              <td className="px-5 py-3 text-right text-sm text-slate-600">
                <div className="inline-flex w-40 items-center justify-end gap-2">
                  <span>{formatPercent(row.accuracy)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={classNames(
                        'block h-full rounded-full',
                        row.accuracy >= 0.7 ? 'bg-emerald-500' : row.accuracy >= 0.5 ? 'bg-blue-500' : 'bg-amber-500'
                      )}
                      style={{ width: `${Math.max(8, row.accuracy * 100)}%` }}
                    />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const LeaderSpotlight = ({ leaders = [], title, copy }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {title}
    </div>
    {copy ? <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p> : null}
    <div className="mt-4 space-y-3">
      {leaders.map((leader) => (
        <div key={leader.userId || leader.userName} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">{leader.userName}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                Rank #{leader.rank || '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{formatCompactNumber(leader.score)}</div>
              <div className="text-xs text-slate-500">{formatPercent(leader.accuracy || 0)} accuracy</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const LeaguePresentationFrame = ({
  presentation,
  leaders = [],
  roundRows = [],
  children = null
}) => {
  if (!presentation) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className={classNames('h-1.5 w-full', heroBandClassNames[presentation.theme] || heroBandClassNames.slate)} />
        <div className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
                {presentation.kicker}
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {presentation.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{presentation.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {safeArray(presentation.chips).map((chip) => (
                <Chip key={`${chip.label}-${chip.value}`} chip={chip} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {safeArray(presentation.cards).map((card) => (
          <Card key={card.label} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {safeArray(presentation.storySections).map((section) => (
          <StoryBlock key={section.title} section={section} />
        ))}
      </div>

      {roundRows.length > 0 ? (
        <RoundTable
          title={presentation.roundTitle || 'Round-by-round story'}
          rows={roundRows}
          footerNote={presentation.roundFootnote || ''}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {safeArray(presentation.spotlightSections).map((spotlight) => (
          <LeaderSpotlight
            key={spotlight.title}
            title={spotlight.title}
            copy={spotlight.copy}
            leaders={spotlight.leaders || leaders}
          />
        ))}
      </div>

      {children}
    </div>
  );
};

export default LeaguePresentationFrame;

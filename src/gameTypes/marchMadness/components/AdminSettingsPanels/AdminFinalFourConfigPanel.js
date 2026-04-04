// src/gameTypes/marchMadness/components/AdminSettingsPanels/AdminFinalFourConfigPanel.js
import React, { useEffect, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import {
  DEFAULT_REGION_SEED_ORDER,
  deriveFinalFourConfigFromRegionSeeds,
  normalizeRegionSeedOrder
} from '../../utils/bracketUtils';

const REGION_OPTIONS = ['South', 'East', 'Midwest', 'West'];
const REGION_STYLES = {
  South: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  East: 'text-blue-700 bg-blue-50 border-blue-200',
  Midwest: 'text-amber-700 bg-amber-50 border-amber-200',
  West: 'text-rose-700 bg-rose-50 border-rose-200'
};

/**
 * Panel component for configuring Final Four matchups from region seed order.
 * NCAA pairings are derived as overall seed 1 vs 4 and 2 vs 3.
 */
const AdminFinalFourConfigPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback
}) => {
  const tournamentData = data?.tournamentData || {};
  const [regionSeedOrder, setRegionSeedOrder] = useState(
    normalizeRegionSeedOrder(
      tournamentData.regionSeedOrder ?? data?.regionSeedOrder,
      tournamentData.finalFourConfig ?? data?.finalFourConfig
    )
  );

  useEffect(() => {
    setRegionSeedOrder(
      normalizeRegionSeedOrder(
        tournamentData.regionSeedOrder ?? data?.regionSeedOrder,
        tournamentData.finalFourConfig ?? data?.finalFourConfig
      )
    );
  }, [data, tournamentData.finalFourConfig, tournamentData.regionSeedOrder]);

  const finalFourConfig = deriveFinalFourConfigFromRegionSeeds(regionSeedOrder);

  const handleRegionRankChange = (region, rank) => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }

    const nextOrder = { ...regionSeedOrder };
    const nextRank = Number(rank);
    const swappedRegion = Object.entries(nextOrder).find(
      ([candidateRegion, candidateRank]) => candidateRegion !== region && Number(candidateRank) === nextRank
    )?.[0];

    nextOrder[region] = nextRank;
    if (swappedRegion) {
      nextOrder[swappedRegion] = regionSeedOrder[region];
    }

    const normalizedOrder = normalizeRegionSeedOrder(nextOrder);
    const derivedConfig = deriveFinalFourConfigFromRegionSeeds(normalizedOrder);

    setRegionSeedOrder(normalizedOrder);
    setFeedback("Region seed order updated. Final Four pairings recalculated.");

    onDataChange({
      ...data,
      tournamentData: {
        ...tournamentData,
        regionSeedOrder: normalizedOrder,
        finalFourConfig: derivedConfig
      },
      finalFourConfigChanged: true
    });
  };

  const handleReset = () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }

    const normalizedOrder = normalizeRegionSeedOrder(DEFAULT_REGION_SEED_ORDER);
    const derivedConfig = deriveFinalFourConfigFromRegionSeeds(normalizedOrder);

    setRegionSeedOrder(normalizedOrder);
    setFeedback("Region seed order reset to default.");

    onDataChange({
      ...data,
      tournamentData: {
        ...tournamentData,
        regionSeedOrder: normalizedOrder,
        finalFourConfig: derivedConfig
      },
      finalFourConfigChanged: true
    });
  };

  return (
    <div className="mt-8 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold">Region Seeding</h2>
        <button
          type="button"
          onClick={handleReset}
          disabled={isArchived}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset To Default
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 flex items-start">
        <FaInfoCircle className="mt-1 mr-2 flex-shrink-0" />
        <p>
          Seed the four regions by the committee&apos;s overall No. 1 seed ranking. Final Four pairings are then derived automatically as
          {' '}<strong>1 vs 4</strong>{' '}and{' '}<strong>2 vs 3</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {REGION_OPTIONS.map((region) => (
          <div key={region} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${REGION_STYLES[region]}`}>
                  {region}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  Assign this region&apos;s overall No. 1 seed rank.
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
                  Overall Seed
                </label>
                <select
                  value={regionSeedOrder[region]}
                  onChange={(e) => handleRegionRankChange(region, e.target.value)}
                  disabled={isArchived}
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {[1, 2, 3, 4].map((seed) => (
                    <option key={`${region}-${seed}`} value={seed}>
                      {seed}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-5">
        <h3 className="text-lg font-bold text-center mb-4">Derived Final Four Matchups</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
              Semifinal 1
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className={`min-w-28 rounded-lg border px-3 py-3 text-center font-bold ${REGION_STYLES[finalFourConfig.semifinal1.region1]}`}>
                #{regionSeedOrder[finalFourConfig.semifinal1.region1]} {finalFourConfig.semifinal1.region1}
              </div>
              <div className="text-sm font-semibold text-slate-500">vs</div>
              <div className={`min-w-28 rounded-lg border px-3 py-3 text-center font-bold ${REGION_STYLES[finalFourConfig.semifinal1.region2]}`}>
                #{regionSeedOrder[finalFourConfig.semifinal1.region2]} {finalFourConfig.semifinal1.region2}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
              Semifinal 2
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className={`min-w-28 rounded-lg border px-3 py-3 text-center font-bold ${REGION_STYLES[finalFourConfig.semifinal2.region1]}`}>
                #{regionSeedOrder[finalFourConfig.semifinal2.region1]} {finalFourConfig.semifinal2.region1}
              </div>
              <div className="text-sm font-semibold text-slate-500">vs</div>
              <div className={`min-w-28 rounded-lg border px-3 py-3 text-center font-bold ${REGION_STYLES[finalFourConfig.semifinal2.region2]}`}>
                #{regionSeedOrder[finalFourConfig.semifinal2.region2]} {finalFourConfig.semifinal2.region2}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinalFourConfigPanel;

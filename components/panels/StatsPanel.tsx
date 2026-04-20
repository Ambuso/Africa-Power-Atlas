/* ==================== components/panels/StatsPanel.tsx ====================
 * Floating analytics panel on the right side.
 */

'use client';

import { useMemo, useState } from 'react';
import { BarChart3, ChevronRight, Leaf, TrendingUp, X } from 'lucide-react';
import type { CountryStat, FuelStat } from '@/lib/types';
import { colorForFuel } from '@/components/map/fuelColors';
import { flagFor, resolveIso2, nameFor } from '@/lib/countries';

/* ─────────── props ─────────── */

interface Props {
  countryStats: CountryStat[];
  techStats: FuelStat[];
  totalGW: string;
  onCountryClick?: (country: string) => void;
  selectedCountries?: string[];
}

/* ─────────── component ─────────── */

export default function StatsPanel({
  countryStats,
  techStats,
  totalGW,
  onCountryClick,
  selectedCountries = [],
}: Props) {
  const [open, setOpen] = useState(true);

  const top = useMemo(() => countryStats.slice(0, 8), [countryStats]);

  // Safe maxGW calculation
  const maxGW = useMemo(() => {
    if (top.length === 0) return 0;
    return top[0]?.gw ?? 0;           // ← Fixed with optional chaining
  }, [top]);

  // Renewable share across all plants
  const renewableShare = useMemo(() => {
    const totalMW = techStats.reduce((sum, s) => sum + s.mw, 0);
    if (totalMW === 0) return 0;

    const renewableFuels = new Set([
      'Solar', 'Wind', 'Offshore Wind', 'Hydro',
      'Geothermal', 'Biomass', 'Storage', 'Pumped Storage',
    ]);

    const renewableMW = techStats
      .filter((s) => renewableFuels.has(s.fuel))
      .reduce((sum, s) => sum + s.mw, 0);

    return (renewableMW / totalMW) * 100;
  }, [techStats]);

  if (countryStats.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`absolute right-4 top-20 z-30 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/85 text-slate-300 shadow-lg backdrop-blur-md transition hover:border-white/20 hover:text-white ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-label="Open analytics"
      >
        <BarChart3 size={16} />
      </button>

      <aside
        className={`absolute right-4 top-20 z-20 hidden w-[300px] flex-col overflow-hidden rounded-[22px] panel-surface transition-all duration-300 md:flex ${
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              Analytics
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={12} />
          </button>
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider text-slate-500">
              <TrendingUp size={10} />
              Total
            </div>
            <p className="mt-1 text-[18px] font-bold tabular-nums text-cyan-300">
              {totalGW} <span className="text-[11px] font-semibold text-cyan-400/60">GW</span>
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider text-slate-500">
              <Leaf size={10} />
              Renewable
            </div>
            <p className="mt-1 text-[18px] font-bold tabular-nums text-emerald-300">
              {renewableShare.toFixed(0)}
              <span className="text-[11px] font-semibold text-emerald-400/60">%</span>
            </p>
          </div>
        </div>

        {/* Top countries */}
        <div className="border-b border-white/8 px-4 py-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Top countries
            </span>
            <span className="text-[9.5px] tabular-nums text-slate-600">by GW</span>
          </div>

          <div className="space-y-2">
            {top.map((stat) => {
              const pct = maxGW > 0 ? (stat.gw / maxGW) * 100 : 0;
              const iso2 = resolveIso2(stat.iso3 ?? stat.country) ?? '';
              const isSelected = iso2 !== '' && selectedCountries.includes(iso2);
              const displayName = nameFor(stat.iso3 ?? stat.country) ?? stat.country;

              return (
                <button
                  key={stat.country}
                  onClick={() => onCountryClick?.(iso2 || stat.country)}
                  className={`flex w-full flex-col gap-1 rounded-lg px-1 py-1 text-left transition ${
                    isSelected ? 'bg-cyan-500/8 ring-1 ring-cyan-400/20' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">{flagFor(stat.iso3 ?? stat.country)}</span>
                    <span className="flex-1 truncate text-[11.5px] font-medium text-slate-200">
                      {displayName}
                    </span>
                    <span className="text-[10px] font-semibold tabular-nums text-slate-300">
                      {stat.gw.toFixed(1)}
                    </span>
                    <span className="w-6 text-right text-[9.5px] font-semibold tabular-nums text-slate-500">
                      GW
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all"
                        style={{
                          width: `${pct}%`,
                          boxShadow: isSelected ? '0 0 6px rgba(34,211,238,0.6)' : 'none',
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-[9.5px] tabular-nums text-slate-600">
                      {stat.plantCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fuel mix compact */}
        <div className="px-4 py-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Fuel mix
            </span>
            <span className="text-[9.5px] tabular-nums text-slate-600">% of capacity</span>
          </div>

          {/* Stacked bar */}
          <div className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-white/5">
            {techStats.slice(0, 8).map((s) => (
              <div
                key={s.fuel}
                style={{
                  width: `${s.percentage ?? 0}%`,
                  background: colorForFuel(s.fuel),
                }}
                title={`${s.fuel}: ${(s.percentage ?? 0).toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Top 6 fuel legend */}
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
            {techStats.slice(0, 6).map((s) => (
              <div key={s.fuel} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: colorForFuel(s.fuel) }}
                />
                <span className="flex-1 truncate text-[10.5px] text-slate-400">{s.fuel}</span>
                <span className="text-[10px] font-semibold tabular-nums text-slate-500">
                  {(s.percentage ?? 0).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
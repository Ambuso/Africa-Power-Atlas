/* ==================== components/topbar/TopBar.tsx ====================
 * Top bar — the primary discoverability surface.
 *
 * Left:   brand mark + country picker
 * Center: live KPI stats (capacity / plants / visible)
 * Right:  view mode, renewable toggle, bubble size slider
 * ==================================================== */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, CircleDot, Flame, Globe2, Grid2X2, Layers,
  Leaf, MapPin, Zap,
} from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import { AFRICAN_COUNTRIES } from '@/lib/countries';

/* ─────────── view mode ─────────── */

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'cluster', label: 'Cluster',  icon: <Grid2X2 size={12} /> },
  { id: 'points',  label: 'Points',   icon: <MapPin size={12} /> },
  { id: 'heatmap', label: 'Heatmap',  icon: <Flame size={12} /> },
];

/* ─────────── props ─────────── */

interface Props {
  selectedCountries: string[];
  onToggleCountry: (code: string) => void;
  onSelectAllCountries?: () => void;
  onClearCountries?: () => void;

  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;

  bubbleScale: number;
  onBubbleScaleChange: (v: number) => void;

  renewableOnly: boolean;
  onRenewableOnlyChange: (v: boolean) => void;

  totalGW: string;
  totalPlants: number;
  visiblePlantCount: number;

  loading?: boolean;
}

/* ─────────── component ─────────── */

export default function TopBar({
  selectedCountries,
  onToggleCountry,
  onSelectAllCountries,
  onClearCountries,
  viewMode,
  onViewModeChange,
  bubbleScale,
  onBubbleScaleChange,
  renewableOnly,
  onRenewableOnlyChange,
  totalGW,
  totalPlants,
  visiblePlantCount,
  loading = false,
}: Props) {
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!countryMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCountryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryMenuOpen]);

  const selectedLabel =
    selectedCountries.length === 0
      ? 'All of Africa'
      : selectedCountries.length === 1
      ? AFRICAN_COUNTRIES.find((c) => c.iso2 === selectedCountries[0])?.name ?? selectedCountries[0]
      : `${selectedCountries.length} countries`;

  const visibleFiltered = AFRICAN_COUNTRIES.filter((c) => {
    if (!countrySearch.trim()) return true;
    const q = countrySearch.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q)
    );
  });

  const regions: Record<string, typeof AFRICAN_COUNTRIES> = {};
  for (const c of visibleFiltered) {
    (regions[c.region] ||= []).push(c);
  }

  return (
    <>
      {loading && <div className="top-progress" />}

      <div className="pointer-events-auto absolute inset-x-0 top-0 z-40 h-16 border-b border-white/8 bg-slate-950/75 px-4 backdrop-blur-xl md:px-6">
        <div className="flex h-full items-center justify-between gap-4">
          {/* ─── LEFT ─── */}
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 shadow-[0_0_24px_-4px_rgba(34,211,238,0.55)]">
                <Zap size={15} className="text-slate-950" strokeWidth={2.6} />
              </div>
              <div className="hidden md:block leading-tight">
                <div className="text-[13px] font-bold tracking-tight text-white">
                  Africa Power Atlas
                </div>
                <div className="text-[9.5px] uppercase tracking-[0.22em] text-slate-500">
                  Live infrastructure explorer
                </div>
              </div>
            </div>

            <div className="hidden h-7 w-px bg-white/10 md:block" />

            {/* Country picker */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setCountryMenuOpen((v) => !v)}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                <Globe2 size={13} className="text-cyan-400" />
                <span className="tabular-nums">{selectedLabel}</span>
                <ChevronDown
                  size={12}
                  className={`text-slate-500 transition-transform ${countryMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {countryMenuOpen && (
                <div className="panel-surface absolute left-0 top-[calc(100%+8px)] z-50 max-h-[min(70vh,560px)] w-[min(90vw,480px)] overflow-hidden rounded-2xl animate-fade-in-up">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Filter by country
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onSelectAllCountries?.()}
                        className="text-[11px] font-semibold text-cyan-400 transition hover:text-cyan-300"
                      >
                        All
                      </button>
                      <button
                        onClick={() => onClearCountries?.()}
                        className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="border-b border-white/5 px-3 py-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search country or region…"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-white/[0.05] focus:outline-none"
                    />
                  </div>

                  <div className="max-h-[calc(70vh-108px)] overflow-y-auto py-2">
                    {Object.entries(regions).length === 0 ? (
                      <p className="px-4 py-6 text-center text-[11px] text-slate-500">
                        No matching countries
                      </p>
                    ) : (
                      Object.entries(regions).map(([region, list]) => (
                        <div key={region} className="px-2 py-1.5">
                          <div className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                            {region} Africa
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {list.map((c) => {
                              const active = selectedCountries.includes(c.iso2);
                              return (
                                <button
                                  key={c.iso2}
                                  onClick={() => onToggleCountry(c.iso2)}
                                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition ${
                                    active
                                      ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30'
                                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                  }`}
                                >
                                  <span className="text-base leading-none">{c.flag}</span>
                                  <span className="flex-1 truncate font-medium">{c.name}</span>
                                  <span className="text-[9px] tabular-nums text-slate-600">{c.iso2}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── CENTER ─── */}
          <div className="hidden items-center gap-5 lg:flex">
            <Stat label="Capacity" value={`${totalGW} GW`} accent="text-cyan-300" />
            <Divider />
            <Stat label="Plants" value={totalPlants.toLocaleString()} accent="text-violet-300" />
            <Divider />
            <Stat label="Visible" value={visiblePlantCount.toLocaleString()} accent="text-emerald-300" />
          </div>

          {/* ─── RIGHT ─── */}
          <div className="flex items-center gap-2.5">
            {/* View mode segmented */}
            <div className="hidden rounded-full border border-white/10 bg-white/[0.04] p-0.5 sm:inline-flex">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onViewModeChange(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition ${
                    viewMode === m.id
                      ? 'bg-white/12 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  aria-label={`View as ${m.label}`}
                >
                  {m.icon}
                  <span className="hidden md:inline">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Renewable */}
            <button
              onClick={() => onRenewableOnlyChange(!renewableOnly)}
              className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition sm:inline-flex ${
                renewableOnly
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
              }`}
            >
              <Leaf size={12} />
              Renewable
            </button>

            {/* Bubble slider */}
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <CircleDot size={12} className="text-slate-400" />
              <span className="hidden text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:block">
                Bubble
              </span>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={bubbleScale}
                onChange={(e) => onBubbleScaleChange(parseFloat(e.target.value))}
                className="w-20 md:w-28"
                aria-label="Bubble size"
              />
              <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-cyan-300">
                {bubbleScale.toFixed(1)}×
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── sub-components ─────────── */

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-sm font-bold tabular-nums ${accent}`}>{value}</span>
      <span className="text-[9.5px] uppercase tracking-[0.2em] text-slate-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-white/10" />;
}

/* ==================== components/topbar/TopBar.tsx ==================== */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe2, ChevronDown, Zap, Leaf, CircleDot } from 'lucide-react';

/* ────────── African country reference ────────── */
/* Sorted by installed generation capacity (descending). */
const AFRICAN_COUNTRIES: { code: string; name: string; flag: string; region: string }[] = [
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', region: 'Southern' },
  { code: 'EG', name: 'Egypt',        flag: '🇪🇬', region: 'North' },
  { code: 'NG', name: 'Nigeria',      flag: '🇳🇬', region: 'West' },
  { code: 'DZ', name: 'Algeria',      flag: '🇩🇿', region: 'North' },
  { code: 'MA', name: 'Morocco',      flag: '🇲🇦', region: 'North' },
  { code: 'LY', name: 'Libya',        flag: '🇱🇾', region: 'North' },
  { code: 'TN', name: 'Tunisia',      flag: '🇹🇳', region: 'North' },
  { code: 'ET', name: 'Ethiopia',     flag: '🇪🇹', region: 'East' },
  { code: 'KE', name: 'Kenya',        flag: '🇰🇪', region: 'East' },
  { code: 'TZ', name: 'Tanzania',     flag: '🇹🇿', region: 'East' },
  { code: 'UG', name: 'Uganda',       flag: '🇺🇬', region: 'East' },
  { code: 'RW', name: 'Rwanda',       flag: '🇷🇼', region: 'East' },
  { code: 'GH', name: 'Ghana',        flag: '🇬🇭', region: 'West' },
  { code: 'CI', name: "Côte d'Ivoire",flag: '🇨🇮', region: 'West' },
  { code: 'SN', name: 'Senegal',      flag: '🇸🇳', region: 'West' },
  { code: 'ZM', name: 'Zambia',       flag: '🇿🇲', region: 'Southern' },
  { code: 'ZW', name: 'Zimbabwe',     flag: '🇿🇼', region: 'Southern' },
  { code: 'MZ', name: 'Mozambique',   flag: '🇲🇿', region: 'Southern' },
  { code: 'AO', name: 'Angola',       flag: '🇦🇴', region: 'Central' },
  { code: 'CD', name: 'DR Congo',     flag: '🇨🇩', region: 'Central' },
  { code: 'CM', name: 'Cameroon',     flag: '🇨🇲', region: 'Central' },
  { code: 'NA', name: 'Namibia',      flag: '🇳🇦', region: 'Southern' },
  { code: 'BW', name: 'Botswana',     flag: '🇧🇼', region: 'Southern' },
  { code: 'MW', name: 'Malawi',       flag: '🇲🇼', region: 'Southern' },
  { code: 'MG', name: 'Madagascar',   flag: '🇲🇬', region: 'Southern' },
  { code: 'SD', name: 'Sudan',        flag: '🇸🇩', region: 'East' },
  { code: 'SS', name: 'South Sudan',  flag: '🇸🇸', region: 'East' },
];

type Props = {
  selectedCountries: string[];
  onToggleCountry: (code: string) => void;
  onSelectAllCountries?: () => void;
  onClearCountries?: () => void;

  bubbleScale: number;
  onBubbleScaleChange: (v: number) => void;

  renewableOnly: boolean;
  onRenewableOnlyChange: (v: boolean) => void;

  totalGW: string;
  totalPlants: number;
  visiblePlantCount: number;
};

export default function TopBar({
  selectedCountries,
  onToggleCountry,
  onSelectAllCountries,
  onClearCountries,
  bubbleScale,
  onBubbleScaleChange,
  renewableOnly,
  onRenewableOnlyChange,
  totalGW,
  totalPlants,
  visiblePlantCount,
}: Props) {
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close country dropdown when clicking outside */
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
      ? AFRICAN_COUNTRIES.find((c) => c.code === selectedCountries[0])?.name ?? selectedCountries[0]
      : `${selectedCountries.length} countries`;

  /* Group for dropdown */
  const regions: Record<string, typeof AFRICAN_COUNTRIES> = {};
  for (const c of AFRICAN_COUNTRIES) {
    (regions[c.region] ||= []).push(c);
  }

  return (
    <div className="top-bar pointer-events-auto absolute inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-4 border-b px-4 md:px-6">
      {/* ─────────── LEFT: brand + country picker ─────────── */}
      <div className="flex min-w-0 items-center gap-4">
        {/* Brand mark */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 shadow-[0_0_24px_-4px_rgba(34,211,238,0.55)]">
            <Zap size={15} className="text-slate-950" strokeWidth={2.6} />
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-white">
              Africa Power Grid
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Live infrastructure explorer
            </div>
          </div>
        </div>

        <div className="hidden h-7 w-px bg-white/10 md:block" />

        {/* Country picker */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setCountryMenuOpen((v) => !v)}
            className="country-pill group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
          >
            <Globe2 size={13} className="text-cyan-400" />
            <span className="tabular-nums">{selectedLabel}</span>
            <ChevronDown
              size={12}
              className={`text-slate-500 transition-transform ${countryMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {countryMenuOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[min(70vh,560px)] w-[min(90vw,460px)] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Filter by country
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onSelectAllCountries?.()}
                    className="text-[11px] text-cyan-400 transition hover:text-cyan-300"
                  >
                    All
                  </button>
                  <button
                    onClick={() => onClearCountries?.()}
                    className="text-[11px] text-slate-500 transition hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(70vh-48px)] overflow-y-auto py-2">
                {Object.entries(regions).map(([region, list]) => (
                  <div key={region} className="px-2 py-1.5">
                    <div className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                      {region} Africa
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {list.map((c) => {
                        const active = selectedCountries.includes(c.code);
                        return (
                          <button
                            key={c.code}
                            onClick={() => onToggleCountry(c.code)}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition ${
                              active
                                ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-base leading-none">{c.flag}</span>
                            <span className="flex-1 truncate font-medium">{c.name}</span>
                            <span className="text-[9px] tabular-nums text-slate-600">{c.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────── CENTER: live stats ─────────── */}
      <div className="hidden lg:flex items-center gap-5">
        <Stat label="Capacity" value={`${totalGW} GW`} accent="text-cyan-300" />
        <Divider />
        <Stat label="Plants" value={totalPlants.toLocaleString()} accent="text-violet-300" />
        <Divider />
        <Stat label="Visible" value={visiblePlantCount.toLocaleString()} accent="text-emerald-300" />
      </div>

      {/* ─────────── RIGHT: renewable toggle + bubble slider ─────────── */}
      <div className="flex items-center gap-3">
        {/* Renewable toggle */}
        <button
          onClick={() => onRenewableOnlyChange(!renewableOnly)}
          className={`hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            renewableOnly
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
          }`}
        >
          <Leaf size={12} />
          Renewable
        </button>

        {/* Bubble size slider — the signature OGW control */}
        <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <CircleDot size={12} className="text-slate-400" />
          <span className="hidden md:block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bubble
          </span>
          <input
            type="range"
            min={0.3}
            max={3}
            step={0.1}
            value={bubbleScale}
            onChange={(e) => onBubbleScaleChange(parseFloat(e.target.value))}
            className="h-1 w-24 appearance-none rounded-full bg-white/10 accent-cyan-400 md:w-32"
            aria-label="Bubble size"
          />
          <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-cyan-300">
            {bubbleScale.toFixed(1)}×
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── sub-components ─────────── */

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-sm font-bold tabular-nums ${accent}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-white/10" />;
}

/* ==================== components/sidebar/LayerPanel.tsx ====================
 * Left sidebar — the primary control surface.
 *
 * Sections (in render order):
 *   1. Header      — compact stats grid (capacity / plants / visible)
 *   2. Layers      — toggle each infrastructure + admin layer
 *   3. Fuel mix    — sortable, color-coded bar chart of techStats
 *   4. Basemap     — 2x3 swatch grid
 * ==================================================== */

'use client';

import { useMemo, useState } from 'react';
import {
  Activity, ChevronDown, ChevronRight, CloudRain, Globe, Layers,
  Map as MapIcon, Radio, Square, Type, Waves, X, Zap, TrendingUp,
  SlidersHorizontal, Filter, RotateCcw,
} from 'lucide-react';
import type { LayerVisibility, FuelStat, MapThemeKey } from '@/lib/types';
import { MAP_THEMES, MAP_THEME_META } from '@/components/map/mapThemes';
import { colorForFuel } from '@/components/map/fuelColors';

/* ─────────── props ─────────── */

interface Props {
  theme: MapThemeKey;
  onThemeChange: (t: MapThemeKey) => void;
  visibility: LayerVisibility;
  onVisibilityChange: (key: keyof LayerVisibility) => void;
  techStats: FuelStat[];
  renewableOnly: boolean;
  onRenewableOnlyChange: (v: boolean) => void;
  selectedFuels: string[];
  onToggleFuel: (fuel: string) => void;
  onResetFuelFilter: () => void;
  totalPlants: number;
  totalGW: string;
  visiblePlantCount: number;
}

type SectionKey = 'layers' | 'boundaries' | 'fuels' | 'themes';

const LAYER_ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { key: 'plants',          label: 'Power plants',     description: 'Generation sites',       icon: <Zap size={13} />,        color: '#facc15' },
  { key: 'transmission',    label: 'Transmission',     description: 'High-voltage grid',      icon: <Activity size={13} />,   color: '#38bdf8' },
  { key: 'substations',     label: 'Substations',      description: 'Grid nodes',             icon: <Radio size={13} />,      color: '#e0f2fe' },
  { key: 'dataCenters',     label: 'Data centers',     description: 'Digital infrastructure', icon: <Layers size={13} />,     color: '#67e8f9' },
  { key: 'submarineCables', label: 'Submarine cables', description: 'Subsea fiber',           icon: <Waves size={13} />,      color: '#22d3ee' },
  { key: 'plannedUpgrades', label: 'Planned upgrades', description: 'Announced projects',     icon: <TrendingUp size={13} />, color: '#fbbf24' },
  { key: 'waterStress',     label: 'Water stress',     description: 'WRI baseline stress',    icon: <CloudRain size={13} />,  color: '#3b82f6' },
];

const BOUNDARY_ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  { key: 'admin0',      label: 'Countries',        description: 'National borders',       icon: <Globe size={13} /> },
  { key: 'admin1',      label: 'States/Provinces', description: 'Regional subdivisions',  icon: <Square size={13} /> },
  { key: 'admin2',      label: 'Districts',        description: 'Finer detail (zoom in)', icon: <MapIcon size={13} /> },
  { key: 'placeLabels', label: 'Place labels',     description: 'Cities and capitals',    icon: <Type size={13} /> },
];

/* ─────────── component ─────────── */

export default function LayerPanel({
  theme,
  onThemeChange,
  visibility,
  onVisibilityChange,
  techStats,
  renewableOnly,
  onRenewableOnlyChange,
  selectedFuels,
  onToggleFuel,
  onResetFuelFilter,
  totalPlants,
  totalGW,
  visiblePlantCount,
}: Props) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    layers: true,
    boundaries: true,
    fuels: true,
    themes: false,
  });
  const [fuelSearch, setFuelSearch] = useState('');

  const toggleSection = (k: SectionKey) =>
    setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const hasFilter = selectedFuels.length > 0 || renewableOnly;

  const visiblePct =
    totalPlants > 0 ? Math.round((visiblePlantCount / totalPlants) * 100) : 0;

  // Max GW in techStats, for bar scaling
  const maxFuelGW = useMemo(
    () => techStats.reduce((m, s) => Math.max(m, s.gw ?? 0), 0),
    [techStats],
  );

  const filteredTechStats = useMemo(() => {
    if (!fuelSearch.trim()) return techStats;
    const q = fuelSearch.trim().toLowerCase();
    return techStats.filter((s) => s.fuel.toLowerCase().includes(q));
  }, [techStats, fuelSearch]);

  return (
    <>
      {/* Floating open button */}
      <button
        onClick={() => setOpen(true)}
        className={`absolute left-4 top-20 z-30 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/85 text-slate-300 shadow-lg backdrop-blur-md transition hover:border-white/20 hover:text-white ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-label="Open panel"
      >
        <SlidersHorizontal size={16} />
      </button>

      <aside
        className={`absolute left-4 top-20 z-20 flex max-h-[calc(100vh-104px)] w-[300px] flex-col overflow-hidden rounded-[22px] panel-surface transition-all duration-300 ${
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-4 opacity-0'
        }`}
      >
        {/* ─── Header ─── */}
        <div className="flex-shrink-0 border-b border-white/8 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-cyan-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                Control panel
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
              aria-label="Close panel"
            >
              <X size={12} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatCard label="Capacity" value={`${totalGW} GW`}  accent="text-cyan-400" />
            <StatCard label="Plants"   value={totalPlants.toLocaleString()} accent="text-violet-400" />
            <StatCard
              label={totalPlants > 0 ? `Visible · ${visiblePct}%` : 'Visible'}
              value={visiblePlantCount.toLocaleString()}
              accent="text-emerald-400"
            />
          </div>
        </div>

        {/* ─── Scroll area ─── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Infrastructure */}
          <Section
            label="Infrastructure"
            sectionKey="layers"
            expanded={expanded.layers}
            onToggle={toggleSection}
          >
            <div className="space-y-0.5 px-2.5 pb-3">
              {LAYER_ITEMS.map(({ key, label, description, icon, color }) => (
                <LayerRow
                  key={key}
                  active={visibility[key]}
                  label={label}
                  description={description}
                  icon={icon}
                  color={color}
                  onClick={() => onVisibilityChange(key)}
                />
              ))}
            </div>
          </Section>

          {/* Boundaries & labels */}
          <Section
            label="Boundaries & labels"
            sectionKey="boundaries"
            expanded={expanded.boundaries}
            onToggle={toggleSection}
          >
            <div className="space-y-0.5 px-2.5 pb-3">
              {BOUNDARY_ITEMS.map(({ key, label, description, icon }) => (
                <LayerRow
                  key={key}
                  active={Boolean(visibility[key])}
                  label={label}
                  description={description}
                  icon={icon}
                  color="#22d3ee"
                  onClick={() => onVisibilityChange(key)}
                />
              ))}
            </div>
          </Section>

          {/* Fuel mix */}
          <Section
            label="Fuel mix"
            sectionKey="fuels"
            expanded={expanded.fuels}
            onToggle={toggleSection}
            action={
              hasFilter ? (
                <button
                  onClick={onResetFuelFilter}
                  className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-white/10"
                >
                  <RotateCcw size={9} />
                  Reset
                </button>
              ) : null
            }
          >
            <div className="space-y-2.5 px-3 pb-3">
              {/* Renewable quick-toggle */}
              <button
                onClick={() => onRenewableOnlyChange(!renewableOnly)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  renewableOnly
                    ? 'border-emerald-400/40 bg-emerald-400/8 text-emerald-300'
                    : 'border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/16 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Filter size={12} />
                  Renewables only
                </span>
                <span
                  className={`h-4 w-7 flex-shrink-0 rounded-full transition ${
                    renewableOnly ? 'bg-emerald-400' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`block h-3 w-3 rounded-full bg-slate-950 shadow transition-transform ${
                      renewableOnly ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                    style={{ marginTop: 2 }}
                  />
                </span>
              </button>

              {/* Search */}
              {techStats.length > 6 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter fuel type…"
                    value={fuelSearch}
                    onChange={(e) => setFuelSearch(e.target.value)}
                    className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-white/[0.05] focus:outline-none"
                  />
                </div>
              )}

              {/* Fuel stats bars */}
              {filteredTechStats.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-slate-500">No matching fuel types.</p>
              ) : (
                <div className="space-y-1">
                  {filteredTechStats.map((stat) => {
                    const color = colorForFuel(stat.fuel);
                    const active = selectedFuels.includes(stat.fuel);
                    const pct = maxFuelGW > 0 ? ((stat.gw ?? 0) / maxFuelGW) * 100 : 0;
                    return (
                      <button
                        key={stat.fuel}
                        onClick={() => onToggleFuel(stat.fuel)}
                        className={`group relative flex w-full flex-col gap-1 rounded-lg px-2.5 py-1.5 text-left transition ${
                          active
                            ? 'bg-white/8 ring-1 ring-cyan-400/30'
                            : 'hover:bg-white/[0.035]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{
                              background: color,
                              opacity: active ? 1 : 0.75,
                              boxShadow: active ? `0 0 8px ${color}` : `0 0 4px ${color}55`,
                            }}
                          />
                          <span
                            className={`flex-1 truncate text-[11.5px] font-medium ${
                              active ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {stat.fuel}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-500">
                            {stat.count.toLocaleString()}
                          </span>
                          <span className="min-w-[42px] text-right text-[10px] font-semibold tabular-nums text-slate-400">
                            {(stat.gw ?? 0).toFixed(1)} GW
                          </span>
                        </div>

                        {/* Capacity bar */}
                        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: color,
                              boxShadow: active ? `0 0 8px ${color}` : 'none',
                              opacity: active ? 1 : 0.6,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* Basemap */}
          <Section
            label="Basemap"
            sectionKey="themes"
            expanded={expanded.themes}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              {(Object.keys(MAP_THEMES) as MapThemeKey[]).map((key) => {
                const meta = MAP_THEME_META[key];
                const active = theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => onThemeChange(key)}
                    className={`group relative overflow-hidden rounded-xl border p-0 text-left transition ${
                      active
                        ? 'border-cyan-500/50 ring-1 ring-cyan-400/40'
                        : 'border-white/8 hover:border-white/20'
                    }`}
                  >
                    <ThemeSwatch themeKey={key} />
                    <div className="flex flex-col gap-0.5 border-t border-white/5 bg-slate-950/75 px-2.5 py-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-semibold ${
                            active ? 'text-cyan-200' : 'text-slate-200'
                          }`}
                        >
                          {meta.label}
                        </span>
                        {active && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background: meta.accent,
                              boxShadow: `0 0 6px ${meta.accent}`,
                            }}
                          />
                        )}
                      </div>
                      <span className="truncate text-[9px] uppercase tracking-wider text-slate-500">
                        {meta.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/6 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Africa Power Atlas
            </p>
            <span className="text-[9px] tabular-nums text-slate-600">v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─────────── sub-components ─────────── */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
      <p className={`text-[13px] font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 truncate text-[9.5px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function LayerRow({
  active,
  label,
  description,
  icon,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
        active
          ? 'bg-white/[0.04] text-white'
          : 'text-slate-500 hover:bg-white/[0.025] hover:text-slate-300'
      }`}
    >
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          background: active ? `${color}1c` : 'rgba(255,255,255,0.04)',
          color: active ? color : 'inherit',
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium">{label}</span>
        <span className="block truncate text-[10px] text-slate-500">{description}</span>
      </span>
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full transition-opacity ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
    </button>
  );
}

function Section({
  label,
  sectionKey,
  expanded,
  onToggle,
  action,
  children,
}: {
  label: string;
  sectionKey: SectionKey;
  expanded: boolean;
  onToggle: (k: SectionKey) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/6">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggle(sectionKey)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(sectionKey);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left transition hover:bg-white/[0.02] focus:outline-none focus-visible:bg-white/[0.03]"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          {expanded ? (
            <ChevronDown size={12} className="text-slate-600" />
          ) : (
            <ChevronRight size={12} className="text-slate-600" />
          )}
        </div>
      </div>
      {expanded && <div>{children}</div>}
    </div>
  );
}

function ThemeSwatch({ themeKey }: { themeKey: MapThemeKey }) {
  const gradients: Record<MapThemeKey, string> = {
    dark:      'linear-gradient(135deg, #071226 0%, #0f1a2e 45%, #1b2a44 70%, #0e4a6e 100%)',
    light:     'linear-gradient(135deg, #eef2f7 0%, #cbd5e1 50%, #94a3b8 100%)',
    streets:   'linear-gradient(135deg, #f8f4ec 0%, #d9e8c8 45%, #f6c96b 75%, #9cc7e6 100%)',
    hybrid:    'linear-gradient(135deg, #0a2e4a 0%, #0f4a2e 50%, #5a3b14 100%)',
    satellite: 'linear-gradient(135deg, #0a3a2a 0%, #5a3b14 55%, #0f2a4e 100%)',
    minimal:   'linear-gradient(135deg, #040816 0%, #0b1222 60%, #111a2e 100%)',
  };

  return (
    <div
      className="h-12 w-full"
      style={{ background: gradients[themeKey], backgroundSize: '160% 160%' }}
    >
      <div className="h-full w-full bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.14),transparent_55%)]" />
    </div>
  );
}

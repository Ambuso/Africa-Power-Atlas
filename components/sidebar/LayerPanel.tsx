/* ==================== components/sidebar/LayerPanel.tsx ==================== */
'use client';

import { useState } from 'react';
import {
  Layers, Zap, Activity, Globe, Radio, Waves, TrendingUp,
  CloudRain, ChevronDown, ChevronRight, X, SlidersHorizontal,
  Map as MapIcon, Type, Square,
} from 'lucide-react';
import type { LayerVisibility, FuelStat, MapThemeKey } from '@/lib/types';
import { MAP_THEMES, MAP_THEME_META } from '@/components/map/mapThemes';
import { fuelColors } from '@/components/map/fuelColors';

type Props = {
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
};

type SectionKey = 'layers' | 'boundaries' | 'fuels' | 'themes';

const LAYER_ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { key: 'plants',          label: 'Power plants',     icon: <Zap size={13} />,        color: '#facc15' },
  { key: 'transmission',    label: 'Transmission',     icon: <Activity size={13} />,   color: '#38bdf8' },
  { key: 'substations',     label: 'Substations',      icon: <Radio size={13} />,      color: '#e0f2fe' },
  { key: 'dataCenters',     label: 'Data centers',     icon: <Layers size={13} />,     color: '#67e8f9' },
  { key: 'submarineCables', label: 'Submarine cables', icon: <Waves size={13} />,      color: '#22d3ee' },
  { key: 'plannedUpgrades', label: 'Planned upgrades', icon: <TrendingUp size={13} />, color: '#fbbf24' },
  { key: 'waterStress',     label: 'Water stress',     icon: <CloudRain size={13} />,  color: '#3b82f6' },
];

const BOUNDARY_ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  { key: 'admin0',      label: 'Countries',       description: 'National borders',        icon: <Globe size={13} /> },
  { key: 'admin1',      label: 'States/Provinces', description: 'Regional subdivisions',  icon: <Square size={13} /> },
  { key: 'admin2',      label: 'Districts',       description: 'Finer detail (zoom in)',  icon: <MapIcon size={13} /> },
  { key: 'placeLabels', label: 'Place labels',    description: 'Cities and capitals',     icon: <Type size={13} /> },
];

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

  const toggleSection = (k: SectionKey) =>
    setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const hasFilter = selectedFuels.length > 0 || renewableOnly;

  const visiblePct =
    totalPlants > 0 ? Math.round((visiblePlantCount / totalPlants) * 100) : 0;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`absolute left-4 top-20 z-30 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-slate-300 shadow-lg backdrop-blur-md transition hover:border-white/20 hover:text-white ${
          open ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Open panel"
      >
        <SlidersHorizontal size={16} />
      </button>

      <aside
        className={`absolute left-4 top-20 z-20 flex max-h-[calc(100vh-104px)] w-72 flex-col overflow-hidden rounded-[20px] border border-white/8 bg-slate-950/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/8 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-cyan-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Control panel
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-slate-600 transition hover:text-slate-300"
              aria-label="Close panel"
            >
              <X size={12} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatCard label="Capacity"  value={`${totalGW} GW`} accent="text-cyan-400" />
            <StatCard label="Plants"    value={totalPlants.toLocaleString()} accent="text-violet-400" />
            <StatCard
              label={totalPlants > 0 ? `Visible (${visiblePct}%)` : 'Visible'}
              value={visiblePlantCount.toLocaleString()}
              accent="text-emerald-400"
            />
          </div>
        </div>

        {/* Scroll area */}
        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* Infrastructure layers */}
          <Section
            label="Infrastructure"
            sectionKey="layers"
            expanded={expanded.layers}
            onToggle={toggleSection}
          >
            <div className="space-y-0.5 px-3 pb-3">
              {LAYER_ITEMS.map(({ key, label, icon, color }) => (
                <button
                  key={key}
                  onClick={() => onVisibilityChange(key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                    visibility[key]
                      ? 'bg-white/5 text-white'
                      : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-400'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: visibility[key] ? `${color}22` : 'rgba(255,255,255,0.04)',
                      color:      visibility[key] ? color : 'inherit',
                    }}
                  >
                    {icon}
                  </span>
                  <span className="flex-1 text-xs font-medium">{label}</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 transition-opacity ${
                      visibility[key] ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                </button>
              ))}
            </div>
          </Section>

          {/* Administrative units */}
          <Section
            label="Boundaries & labels"
            sectionKey="boundaries"
            expanded={expanded.boundaries}
            onToggle={toggleSection}
          >
            <div className="space-y-0.5 px-3 pb-3">
              {BOUNDARY_ITEMS.map(({ key, label, description, icon }) => {
                const on = Boolean(visibility[key]);
                return (
                  <button
                    key={key}
                    onClick={() => onVisibilityChange(key)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                      on
                        ? 'bg-white/5 text-white'
                        : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-400'
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: on ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255,255,255,0.04)',
                        color:      on ? '#22d3ee' : 'inherit',
                      }}
                    >
                      {icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs font-medium">{label}</span>
                      <span className="truncate text-[10px] text-slate-600">{description}</span>
                    </span>
                    <span
                      className={`relative h-4 w-7 flex-shrink-0 rounded-full border transition-colors ${
                        on
                          ? 'border-cyan-400/40 bg-cyan-400/25'
                          : 'border-white/15 bg-white/5'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                          on ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Fuel filter */}
          <Section
            label="Fuel type"
            sectionKey="fuels"
            expanded={expanded.fuels}
            onToggle={toggleSection}
            action={
              hasFilter ? (
                <button
                  onClick={onResetFuelFilter}
                  className="text-[10px] font-medium uppercase tracking-wider text-cyan-400 transition hover:text-cyan-300"
                >
                  Reset
                </button>
              ) : null
            }
          >
            <div className="space-y-2 px-3 pb-3">
              <button
                onClick={() => onRenewableOnlyChange(!renewableOnly)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
                  renewableOnly
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/8 text-slate-400 hover:border-white/15 hover:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>♻</span>
                  <span className="font-medium">Renewable only</span>
                </span>
                <span
                  className={`relative h-4 w-7 rounded-full border transition-colors ${
                    renewableOnly
                      ? 'border-emerald-500/50 bg-emerald-500/30'
                      : 'border-white/15 bg-white/5'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      renewableOnly ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              {techStats.length > 0 && (
                <div className="space-y-0.5">
                  {techStats.map((stat) => {
                    const color =
                      fuelColors[stat.fuel as keyof typeof fuelColors] ?? fuelColors.Unknown;
                    const active = selectedFuels.includes(stat.fuel);
                    return (
                      <button
                        key={stat.fuel}
                        onClick={() => onToggleFuel(stat.fuel)}
                        className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition ${
                          active
                            ? 'bg-white/8 text-white'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-300'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{
                            background: color,
                            opacity: active ? 1 : 0.65,
                            boxShadow: active ? `0 0 8px ${color}` : 'none',
                          }}
                        />
                        <span className="flex-1 text-xs font-medium">{stat.fuel}</span>
                        <span className="text-[10px] tabular-nums text-slate-600">
                          {stat.count.toLocaleString()}
                        </span>
                        {stat.gw != null && stat.gw > 0 && (
                          <span className="min-w-[42px] text-right text-[10px] tabular-nums text-slate-500">
                            {stat.gw} GW
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* Basemap swatches */}
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
                    <div className="flex flex-col gap-0.5 border-t border-white/5 bg-slate-950/80 px-2.5 py-1.5">
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
                            style={{ background: meta.accent, boxShadow: `0 0 6px ${meta.accent}` }}
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

        {/* Footer — your own branding */}
        <div className="flex-shrink-0 border-t border-white/6 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Africa Power Atlas
            </p>
            <span className="text-[9px] text-slate-600">v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── sub-components ─── */

function StatCard({
  label, value, accent,
}: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
      <p className={`text-sm font-semibold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function Section({
  label, sectionKey, expanded, onToggle, action, children,
}: {
  label: string;
  sectionKey: SectionKey;
  expanded: boolean;
  onToggle: (k: SectionKey) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  /*
   * NOTE: the header is a <div role="button">, not a real <button>, because
   * the `action` slot may contain its own <button> (e.g. the "Reset" affordance
   * in the Fuel section). Nested buttons are invalid HTML and produce a
   * React hydration error. Keeping the outer element a div with ARIA
   * semantics keeps the entire row clickable while allowing sibling buttons
   * inside `action` to work normally.
   */
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
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {action}
          {expanded ? (
            <ChevronDown size={12} className="text-slate-600" />
          ) : (
            <ChevronRight size={12} className="text-slate-600" />
          )}
        </div>
      </div>
      {expanded && children}
    </div>
  );
}

/**
 * Miniature preview swatch rendered with CSS gradients — avoids loading
 * a second map instance per button. Each theme has a deliberately
 * distinctive palette so users can recognize them at a glance.
 */
function ThemeSwatch({ themeKey }: { themeKey: MapThemeKey }) {
  const gradients: Record<MapThemeKey, string> = {
    dark:
      'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)',
    light:
      'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #94a3b8 100%)',
    streets:
      'linear-gradient(135deg, #1e293b 0%, #334155 40%, #7c2d12 100%)',
    hybrid:
      'linear-gradient(135deg, #1e3a8a 0%, #064e3b 50%, #713f12 100%)',
    satellite:
      'linear-gradient(135deg, #064e3b 0%, #713f12 60%, #1e3a8a 100%)',
    minimal:
      'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
  };

  return (
    <div
      className="h-11 w-full"
      style={{
        background: gradients[themeKey],
        backgroundSize: '160% 160%',
      }}
    >
      <div className="h-full w-full bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.12),transparent_55%)]" />
    </div>
  );
}

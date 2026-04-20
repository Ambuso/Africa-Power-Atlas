/* ==================== components/map/MapLegend.tsx ====================
 * Map legend — only shows sections for currently-visible layers.
 * Compact, collapsible, bottom-right.
 *
 * Includes a "Data sources" section so users always know provenance.
 * ==================================================== */

'use client';

import { useState } from 'react';
import { ChevronDown, Database } from 'lucide-react';
import { colorForFuel } from './fuelColors';
import type { LayerVisibility } from '@/lib/types';

const VOLTAGE_LEGEND: { label: string; color: string }[] = [
  { label: '735 kV+',    color: '#ef4444' },
  { label: '500–734 kV', color: '#f97316' },
  { label: '345–499 kV', color: '#fbbf24' },
  { label: '230–344 kV', color: '#38bdf8' },
  { label: '100–229 kV', color: '#22c55e' },
  { label: '31–99 kV',   color: '#a78bfa' },
];

const FUEL_ORDER: string[] = [
  'Solar', 'Wind', 'Hydro', 'Geothermal', 'Biomass',
  'Gas', 'Coal', 'Oil', 'Nuclear', 'Storage',
];

/* ─────────── data sources ─────────── */

const DATA_SOURCES: { label: string; detail: string; href: string }[] = [
  {
    label: 'Power plants',
    detail: 'Global Energy Monitor · WRI GPPDB',
    href: 'https://globalenergymonitor.org/',
  },
  {
    label: 'Transmission grid',
    detail: 'OpenStreetMap · OpenInfraMap',
    href: 'https://openinframap.org/',
  },
  {
    label: 'Submarine cables',
    detail: 'TeleGeography Submarine Cable Map',
    href: 'https://www.submarinecablemap.com/',
  },
  {
    label: 'Data centers',
    detail: 'Data Center Map · Xalam Analytics',
    href: 'https://www.datacentermap.com/',
  },
  {
    label: 'Admin boundaries',
    detail: 'Natural Earth · geoBoundaries',
    href: 'https://www.naturalearthdata.com/',
  },
  {
    label: 'Water stress',
    detail: 'WRI Aqueduct',
    href: 'https://www.wri.org/aqueduct',
  },
];

interface Props {
  visibility: LayerVisibility;
}

export default function MapLegend({ visibility }: Props) {
  const [open, setOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const anyVisible =
    visibility.plants ||
    visibility.transmission ||
    visibility.submarineCables ||
    visibility.dataCenters ||
    visibility.substations ||
    visibility.plannedUpgrades;

  if (!anyVisible) return null;

  return (
    <div className="pointer-events-auto absolute bottom-6 right-4 z-30 flex w-[232px] flex-col gap-2">
      {/* ─── Main legend ─── */}
      <div className="panel-surface overflow-hidden rounded-2xl">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 transition hover:bg-white/[0.03]"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Legend
          </span>
          <ChevronDown
            size={12}
            className={`text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </button>

        {open && (
          <div className="space-y-3.5 border-t border-white/8 px-3.5 py-3">
            {visibility.plants && (
              <section>
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Power plants
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {FUEL_ORDER.map((fuel) => {
                    const color = colorForFuel(fuel);
                    return (
                      <div key={fuel} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
                        />
                        <span className="text-[10px] text-slate-400">{fuel}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {visibility.transmission && (
              <section>
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Transmission
                </div>
                <div className="space-y-1">
                  {VOLTAGE_LEGEND.map((v) => (
                    <div key={v.label} className="flex items-center gap-2">
                      <span
                        className="h-[2px] w-6 flex-shrink-0 rounded-full"
                        style={{ background: v.color }}
                      />
                      <span className="text-[10px] text-slate-400">{v.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {visibility.submarineCables && (
              <section>
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Submarine cables
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-[2px] w-6 flex-shrink-0"
                    style={{
                      background: 'repeating-linear-gradient(90deg, #22d3ee 0 6px, transparent 6px 10px)',
                    }}
                  />
                  <span className="text-[10px] text-slate-400">Fiber-optic</span>
                </div>
              </section>
            )}

            {visibility.dataCenters && (
              <section>
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Data centers
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full border"
                    style={{
                      background: '#67e8f9',
                      borderColor: '#0891b2',
                      boxShadow: '0 0 8px rgba(103,232,249,0.6)',
                    }}
                  />
                  <span className="text-[10px] text-slate-400">Facility</span>
                </div>
              </section>
            )}

            {visibility.plants && (
              <section>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Size = capacity
                </div>
                <div className="flex items-end gap-2">
                  <SizeDot size={4}  label="100" />
                  <SizeDot size={7}  label="500" />
                  <SizeDot size={10} label="1 GW" />
                  <SizeDot size={14} label="5 GW" />
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ─── Data sources (separate panel) ─── */}
      <div className="panel-surface overflow-hidden rounded-2xl">
        <button
          onClick={() => setSourcesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 transition hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-2">
            <Database size={10} className="text-cyan-400/80" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Data sources
            </span>
          </div>
          <ChevronDown
            size={12}
            className={`text-slate-500 transition-transform ${sourcesOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {sourcesOpen && (
          <div className="border-t border-white/8 px-3.5 py-3 space-y-2">
            {DATA_SOURCES.map((src) => (
              <a
                key={src.label}
                href={src.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-300 group-hover:text-cyan-300">
                    {src.label}
                  </span>
                  <span className="text-[8px] text-slate-600 group-hover:text-slate-400">↗</span>
                </div>
                <div className="mt-0.5 text-[9.5px] leading-snug text-slate-500 group-hover:text-slate-400">
                  {src.detail}
                </div>
              </a>
            ))}

            <div className="mt-2 border-t border-white/5 pt-2 text-[8.5px] leading-relaxed text-slate-600">
              Data compiled from open sources. Values are indicative and may
              not reflect the most recent project updates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SizeDot({ size, label }: { size: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="rounded-full border border-white/30"
        style={{
          width: `${size * 2}px`,
          height: `${size * 2}px`,
          background: 'rgba(34,211,238,0.4)',
          boxShadow: '0 0 8px rgba(34,211,238,0.3)',
        }}
      />
      <span className="text-[9px] tabular-nums text-slate-500">{label}</span>
    </div>
  );
}

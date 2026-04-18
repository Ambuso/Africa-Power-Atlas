/* ==================== components/map/MapLegend.tsx ==================== */
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fuelColors } from './fuelColors';
import type { LayerVisibility } from '@/lib/types';

const VOLTAGE_LEGEND: { label: string; color: string }[] = [
  { label: '735 kV+',     color: '#ef4444' },
  { label: '500–734 kV',  color: '#f97316' },
  { label: '345–499 kV',  color: '#fbbf24' },
  { label: '230–344 kV',  color: '#38bdf8' },
  { label: '100–229 kV',  color: '#22c55e' },
  { label: '31–99 kV',    color: '#a78bfa' },
];

const FUEL_ORDER: string[] = [
  'Solar', 'Wind', 'Hydro', 'Geothermal', 'Biomass',
  'Gas', 'Coal', 'Oil', 'Nuclear', 'Storage',
];

type Props = {
  visibility: LayerVisibility;
};

export default function MapLegend({ visibility }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-auto absolute bottom-6 right-4 z-30 w-[220px]">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 shadow-2xl backdrop-blur-xl">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 transition hover:bg-white/[0.03]"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Legend
          </span>
          <ChevronDown
            size={12}
            className={`text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </button>

        {open && (
          <div className="border-t border-white/8 px-3.5 py-3">
            {visibility.plants && (
              <div className="mb-3">
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Power plants
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {FUEL_ORDER.map((fuel) => {
                    const color =
                      fuelColors[fuel as keyof typeof fuelColors] ?? fuelColors.Unknown;
                    return (
                      <div key={fuel} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{
                            background: color,
                            boxShadow: `0 0 6px ${color}88`,
                          }}
                        />
                        <span className="text-[10px] text-slate-400">{fuel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {visibility.transmission && (
              <div className="mb-3">
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
              </div>
            )}

            {visibility.plants && (
              <div>
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Plant size = Capacity
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <SizeDot size={5}  label="100" />
                  <SizeDot size={8}  label="500" />
                  <SizeDot size={11} label="1 GW" />
                  <SizeDot size={16} label="5 GW" />
                </div>
              </div>
            )}
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
        className="rounded-full border border-white/30 bg-cyan-400/40"
        style={{
          width: `${size * 2}px`,
          height: `${size * 2}px`,
          boxShadow: '0 0 8px rgba(34,211,238,0.3)',
        }}
      />
      <span className="text-[9px] tabular-nums text-slate-500">{label}</span>
    </div>
  );
}

/* ==================== components/map/fuelColors.ts ====================
 * Single source of truth for fuel → color.
 * Palette tuned for dark navy AND satellite imagery.
 * ==================================================== */

export const fuelColors = {
  // Renewables
  Solar:            '#facc15',
  Wind:             '#22d3ee',
  'Offshore Wind':  '#06b6d4',
  Hydro:            '#38bdf8',
  Geothermal:       '#14b8a6',
  Biomass:          '#84cc16',
  'Pumped Storage': '#db2777',
  Storage:          '#ec4899',
  // Fossil
  Gas:     '#fb923c',
  Coal:    '#78716c',
  Oil:     '#a8a29e',
  Nuclear: '#a855f7',
  // Fallback
  Other:   '#94a3b8',
  Unknown: '#64748b',
} as const;

export type FuelType = keyof typeof fuelColors;

export const FUEL_DISPLAY_ORDER: FuelType[] = [
  'Solar', 'Wind', 'Offshore Wind', 'Hydro', 'Geothermal', 'Biomass',
  'Storage', 'Pumped Storage',
  'Gas', 'Coal', 'Oil',
  'Nuclear',
  'Other', 'Unknown',
];

export function colorForFuel(fuel: string | undefined | null): string {
  if (!fuel) return fuelColors.Unknown;
  return (fuelColors as Record<string, string>)[fuel] ?? fuelColors.Unknown;
}

export const VOLTAGE_COLORS = {
  '735kV+':    '#ef4444',
  '500-734kV': '#f97316',
  '345-499kV': '#fbbf24',
  '230-344kV': '#38bdf8',
  '100-229kV': '#22c55e',
  '31-99kV':   '#a78bfa',
  '<31kV':     '#64748b',
  Unknown:     '#64748b',
} as const;
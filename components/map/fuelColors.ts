// src/lib/fuelColors.ts
export const fuelColors = {
  Solar: '#facc15',
  Wind: '#22d3ee',
  'Offshore Wind': '#06b6d4',
  Hydro: '#38bdf8',
  Geothermal: '#14b8a6',
  Biomass: '#84cc16',
  'Pumped Storage': '#db2777',
  Storage: '#ec4899',

  Gas: '#a78bfa',
  Coal: '#64748b',
  Oil: '#f87171',
  Nuclear: '#ef4444',

  Other: '#94a3b8',
  Unknown: '#94a3b8',
} as const;

export type FuelType = keyof typeof fuelColors;
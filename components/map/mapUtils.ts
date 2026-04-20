// src/lib/mapUtils.ts
import type { FeatureCollection, MapDataBundle, PlantBundle } from '@/lib/types';

export const RENEWABLE_FUELS = new Set(['Solar','Wind','Hydro','Geothermal','Biomass','Pumped Storage','Storage'] as const);

function titleCase(s: string): string {
  if (!s || typeof s !== 'string') return '';
  
  return s
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p[0]?.toUpperCase() ?? '') + p.slice(1))
    .join(' ');
}

export function normalizeFuel(raw: unknown): string {
  const value = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (value.includes('offshorewind') || value.includes('wind')) return 'Wind';
  if (value.includes('solar')) return 'Solar';
  if (value.includes('pumped')) return 'Pumped Storage';
  if (value.includes('hydro')) return 'Hydro';
  if (value.includes('geothermal')) return 'Geothermal';
  if (value.includes('battery') || value.includes('storage')) return 'Storage';
  if (value.includes('biomass')) return 'Biomass';
  if (value.includes('gas')) return 'Gas';
  if (value.includes('coal') || value.includes('lignite')) return 'Coal';
  if (value.includes('oil') || value.includes('diesel')) return 'Oil';
  if (value.includes('nuclear')) return 'Nuclear';
  
  return titleCase(String(raw ?? 'Other'));
}

export function isRenewableFuel(fuel: string): boolean {
  return RENEWABLE_FUELS.has(fuel as any);
}

export function classifyVoltage(raw: unknown): string {
  const v = Number(String(raw ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(v) || v <= 0) return 'Unknown';
  if (v >= 735) return '735kV+';
  if (v >= 500) return '500-734kV';
  if (v >= 345) return '345-499kV';
  if (v >= 230) return '230-344kV';
  if (v >= 100) return '100-229kV';
  if (v >= 31) return '31-99kV';
  return '<31kV';
}

// Placeholder prepare functions
export function preparePowerPlants(data: any): any {
  return { type: 'FeatureCollection', features: [] };
}

export function prepareTransmission(data: any): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function prepareDataCenters(data: any): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function prepareSubstations(data: any): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function preparePlannedUpgrades(data: any): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

// Final empty data that satisfies ALL types
export async function loadAndPreparePowerGridData(): Promise<MapDataBundle> {
  const emptyFC: FeatureCollection = { 
    type: 'FeatureCollection', 
    features: [] 
  };

  const emptyPlantBundle: PlantBundle = {
    plants: emptyFC,
    totalPlants: 0,
    totalGW: "0",
    techStats: [],
    countryStats: [],
  };

  return {
    plants: emptyPlantBundle,
    transmission: emptyFC,        // ← changed from null
    substations: emptyFC,         // ← changed from null
    dataCenters: emptyFC,         // ← changed from null
    waterStress: emptyFC,         // ← changed from null
    submarineCables: emptyFC,     // ← changed from null
    plannedUpgrades: emptyFC,     // ← changed from null
    admin0: emptyFC,
    admin1: emptyFC,
    admin2: emptyFC,
    placeLabels: emptyFC,
  };
}
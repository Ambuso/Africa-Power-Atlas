import type { FeatureCollection, FuelStat, MapDataBundle } from '@/lib/types';
import { fuelColors } from './fuelColors';

export const RENEWABLE_FUELS = new Set([
  'Solar',
  'Wind',
  'Hydro',
  'Geothermal',
  'Biomass',
  'Pumped Storage',
  'Storage',
] as const);

const VOLTAGE_COLORS: Record<string, string> = {
  '735kV+': '#ef4444',
  '500-734kV': '#f97316',
  '345-499kV': '#fbbf24',
  '230-344kV': '#38bdf8',
  '100-229kV': '#22c55e',
  '31-99kV': '#a78bfa',
  '<31kV': '#64748b',
  Unknown: '#64748b',
};

const EMPTY_FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p.length > 0 ? p.charAt(0).toUpperCase() + p.slice(1) : ''))
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

export function preparePowerPlants(data: any) {
  return {
    plants: EMPTY_FC,
    totalPlants: 0,
    totalGW: '0',
    techStats: [] as FuelStat[],
    countryStats: [],
  };
}

export function prepareTransmission(data: any): FeatureCollection {
  return EMPTY_FC;
}

export function prepareDataCenters(data: any): FeatureCollection {
  return EMPTY_FC;
}

export function prepareSubstations(data: any): FeatureCollection {
  return EMPTY_FC;
}

export function preparePlannedUpgrades(data: any): FeatureCollection {
  return EMPTY_FC;
}

export async function loadAndPreparePowerGridData(): Promise<MapDataBundle> {
  return {
    plants: {
      plants: EMPTY_FC,
      totalPlants: 0,
      totalGW: '0',
      techStats: [] as FuelStat[],
      countryStats: [],
    },
    transmission: EMPTY_FC,
    substations: EMPTY_FC,
    dataCenters: EMPTY_FC,
    waterStress: EMPTY_FC,
    submarineCables: EMPTY_FC,
    plannedUpgrades: EMPTY_FC,
    admin0: EMPTY_FC,
    admin1: EMPTY_FC,
    admin2: EMPTY_FC,
    placeLabels: EMPTY_FC,
  };
}
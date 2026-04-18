/* ==================== components/map/dataPrep.ts ==================== */
import type { FeatureCollection, FuelStat, MapDataBundle } from '@/lib/types';
import { fuelColors } from './fuelColors';

export const RENEWABLE_FUELS = new Set([
  'Solar', 'Wind', 'Hydro', 'Geothermal', 'Biomass',
  'Pumped Storage', 'Storage',
] as const);

const VOLTAGE_COLORS: Record<string, string> = {
  '735kV+':    '#ef4444',
  '500-734kV': '#f97316',
  '345-499kV': '#fbbf24',
  '230-344kV': '#38bdf8',
  '100-229kV': '#22c55e',
  '31-99kV':   '#a78bfa',
  '<31kV':     '#64748b',
  Unknown:     '#64748b',
};

type EnrichedFuelStat = FuelStat & { gw: number; percentage: number };
type CountryStat = { country: string; gw: number; mw: number };

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function normalizeFuel(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return 'Other';
  const lower = value.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower.includes('offshorewind') || lower.includes('onshorewind') || lower.includes('wind')) return 'Wind';
  if (lower.includes('solarpv') || lower.includes('solarthermal') || lower.includes('solar')) return 'Solar';
  if (lower.includes('pumpedhydro') || lower.includes('pumpedstorage') || lower.includes('pumped')) return 'Pumped Storage';
  if (lower.includes('hydro')) return 'Hydro';
  if (lower.includes('geothermal') || lower.includes('geo')) return 'Geothermal';
  if (lower.includes('battery') || lower.includes('bess') || lower.includes('storage')) return 'Storage';
  if (lower.includes('biomass') || lower.includes('biofuel') || lower.includes('biogas')) return 'Biomass';
  if (lower.includes('naturalgas') || lower.includes('gasccgt') || lower.includes('gasocgt') || lower.includes('lng') || lower.includes('ng') || lower.includes('gas')) return 'Gas';
  if (lower.includes('lignite') || lower.includes('coal')) return 'Coal';
  if (lower.includes('diesel') || lower.includes('hfo') || lower.includes('heavyfuel') || lower.includes('lfo') || lower.includes('oil')) return 'Oil';
  if (lower.includes('nuclear')) return 'Nuclear';

  return titleCase(value);
}

export function isRenewableFuel(fuel: string): boolean {
  return RENEWABLE_FUELS.has(fuel as any);
}

export function classifyVoltage(raw: unknown): string {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
  const v = Number(cleaned);
  if (!Number.isFinite(v) || v <= 0) return 'Unknown';
  if (v >= 735) return '735kV+';
  if (v >= 500) return '500-734kV';
  if (v >= 345) return '345-499kV';
  if (v >= 230) return '230-344kV';
  if (v >= 100) return '100-229kV';
  if (v >= 31)  return '31-99kV';
  return '<31kV';
}

/* ====================== POWER PLANTS ====================== */
export function preparePowerPlants(data: any) {
  const rawFeatures = Array.isArray(data?.features) ? data.features : [];

  if (rawFeatures.length === 0) {
    return {
      plants: { type: 'FeatureCollection' as const, features: [] },
      totalPlants: 0,
      totalGW: '0.0',
      techStats: [] as EnrichedFuelStat[],
      countryStats: [] as CountryStat[],
    };
  }

  const capacities = rawFeatures.map((f: any) =>
    Math.max(0, toNumber(f?.properties?.capacity_mw, 0)),
  );
  const maxMW = Math.max(1, ...capacities);

  const fuelGroups = new Map<string, FuelStat>();
  const countryGroups = new Map<string, number>();

  const processedFeatures = rawFeatures.map((f: any) => {
    const props = { ...(f?.properties || {}) };
    const fuel = normalizeFuel(props.technology || props.primary_fuel || props.fuel || 'Other');
    const capacityMW = Math.max(0, toNumber(props.capacity_mw, 0));
    const normalized = capacityMW / maxMW;
    const country = String(props.country || props.country_code || props.iso3 || 'Unknown').trim() || 'Unknown';

    props.fuel = fuel;
    props.renewable = isRenewableFuel(fuel);
    props.color = fuelColors[fuel as keyof typeof fuelColors] ?? fuelColors.Unknown;
    props.capacity_mw = capacityMW;
    props.country = country;
    props.intensity = Number(Math.min(1, Math.pow(normalized, 0.6)).toFixed(3));

    if (!fuelGroups.has(fuel)) {
      fuelGroups.set(fuel, { fuel, count: 0, mw: 0, color: props.color });
    }
    const stat = fuelGroups.get(fuel)!;
    stat.count += 1;
    stat.mw += capacityMW;

    countryGroups.set(country, (countryGroups.get(country) || 0) + capacityMW);

    return { ...f, properties: props };
  });

  const totalMW = Array.from(fuelGroups.values()).reduce((sum, s) => sum + s.mw, 0);

  const techStats: EnrichedFuelStat[] = Array.from(fuelGroups.values())
    .map((s) => ({
      ...s,
      gw: Number((s.mw / 1000).toFixed(1)),
      percentage: totalMW > 0 ? Number(((s.mw / totalMW) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.mw - a.mw);

  const countryStats: CountryStat[] = Array.from(countryGroups.entries())
    .map(([country, mw]) => ({
      country,
      mw,
      gw: Number((mw / 1000).toFixed(1)),
    }))
    .sort((a, b) => b.mw - a.mw);

  return {
    plants: {
      type: 'FeatureCollection' as const,
      features: processedFeatures,
    } as FeatureCollection,
    totalPlants: processedFeatures.length,
    totalGW: (totalMW / 1000).toFixed(1),
    techStats,
    countryStats,
  };
}

/* ====================== OTHER LAYERS ====================== */
export function prepareTransmission(data: any): FeatureCollection {
  const features = (Array.isArray(data?.features) ? data.features : []).map((f: any) => {
    const voltageClass = classifyVoltage(f?.properties?.voltage_kv ?? f?.properties?.voltage);
    return {
      ...f,
      properties: {
        ...f.properties,
        voltage_class: voltageClass,
        color: VOLTAGE_COLORS[voltageClass] ?? VOLTAGE_COLORS.Unknown,
      },
    };
  });
  return { type: 'FeatureCollection' as const, features };
}

export function prepareDataCenters(data: any): FeatureCollection {
  const features = (Array.isArray(data?.features) ? data.features : []).map((f: any) => ({
    ...f,
    properties: { ...f.properties, color: '#67e8f9', radius: 8, type: 'data_center' },
  }));
  return { type: 'FeatureCollection' as const, features };
}

export function prepareSubstations(data: any): FeatureCollection {
  const features = (Array.isArray(data?.features) ? data.features : []).map((f: any) => ({
    ...f,
    properties: { ...f.properties, color: '#e0f2fe', radius: 6, type: 'substation' },
  }));
  return { type: 'FeatureCollection' as const, features };
}

export function preparePlannedUpgrades(data: any): FeatureCollection {
  const features = (Array.isArray(data?.features) ? data.features : []).map((f: any) => ({
    ...f,
    properties: { ...f.properties, color: '#fbbf24', planned: true },
  }));
  return { type: 'FeatureCollection' as const, features };
}

/**
 * Admin boundaries are passed straight through — we just guarantee a valid
 * FeatureCollection shape and preserve all original properties (name_en,
 * NAME_1, ADMIN, etc.) so the label layers can find them.
 */
function passThroughFC(data: any): FeatureCollection {
  if (!data || !Array.isArray(data.features)) {
    return { type: 'FeatureCollection', features: [] };
  }
  return { type: 'FeatureCollection', features: data.features };
}

/* ====================== MAIN LOADER ====================== */
export async function loadAndPreparePowerGridData(): Promise<MapDataBundle> {
  const urls = {
    plants:          '/data/plants/africa_power_plants.geojson',
    transmission:    '/data/grid/africa_transmission.geojson',
    substations:     '/data/grid/africa_substations.geojson',
    dataCenters:     '/data/digital/africa_datacenters.geojson',
    waterStress:     '/data/context/africa_water_stress.geojson',
    submarineCables: '/data/grid/africa_submarine_cables.geojson',
    plannedUpgrades: '/data/grid/africa_planned_upgrades.geojson',
    admin0:          '/data/admin/africa_admin0.geojson',
    admin1:          '/data/admin/africa_admin1.geojson',
    admin2:          '/data/admin/africa_admin2.geojson',
    placeLabels:     '/data/admin/africa_places.geojson',
  } as const;

  const fetchOne = async (url: string) => {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  };

  try {
    const keys = Object.keys(urls) as Array<keyof typeof urls>;
    const results = await Promise.all(keys.map((k) => fetchOne(urls[k])));
    const raw = Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<
      keyof typeof urls,
      any
    >;

    return {
      plants:          preparePowerPlants(raw.plants),
      transmission:    prepareTransmission(raw.transmission),
      substations:     prepareSubstations(raw.substations),
      dataCenters:     prepareDataCenters(raw.dataCenters),
      waterStress:     raw.waterStress
        ? { type: 'FeatureCollection' as const, features: raw.waterStress.features || [] }
        : null,
      submarineCables: raw.submarineCables
        ? { type: 'FeatureCollection' as const, features: raw.submarineCables.features || [] }
        : null,
      plannedUpgrades: preparePlannedUpgrades(raw.plannedUpgrades),

      // Admin + labels pass through
      admin0:      raw.admin0      ? passThroughFC(raw.admin0)      : null,
      admin1:      raw.admin1      ? passThroughFC(raw.admin1)      : null,
      admin2:      raw.admin2      ? passThroughFC(raw.admin2)      : null,
      placeLabels: raw.placeLabels ? passThroughFC(raw.placeLabels) : null,
    };
  } catch (err) {
    console.error('Failed to load power grid data:', err);
    return {
      plants: {
        plants: { type: 'FeatureCollection' as const, features: [] },
        totalPlants: 0,
        totalGW: '0.0',
        techStats: [],
        countryStats: [],
      },
      transmission:    { type: 'FeatureCollection' as const, features: [] },
      substations:     { type: 'FeatureCollection' as const, features: [] },
      dataCenters:     { type: 'FeatureCollection' as const, features: [] },
      waterStress:     null,
      submarineCables: null,
      plannedUpgrades: { type: 'FeatureCollection' as const, features: [] },
      admin0:          null,
      admin1:          null,
      admin2:          null,
      placeLabels:     null,
    };
  }
}

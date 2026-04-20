/* ==================== components/map/dataPrep.ts ====================
 * Pure functions that convert raw GeoJSON (fetched from /public/data)
 * into the normalized shape the renderer expects.
 * ==================================================== */

import type {
  CountryStat,
  FeatureCollection,
  FuelStat,
  MapDataBundle,
  PlantBundle,
  PlantFeatureCollection,
} from '@/lib/types';
import { colorForFuel, VOLTAGE_COLORS } from './fuelColors';

/* ─────────── constants ─────────── */

export const RENEWABLE_FUELS = new Set<string>([
  'Solar',
  'Wind',
  'Offshore Wind',
  'Hydro',
  'Geothermal',
  'Biomass',
  'Pumped Storage',
  'Storage',
]);

/* Common country names in ALL CAPS that sometimes leak into admin1 `name` fields
 * when the source GeoJSON is malformed. We reject these as subnational labels. */
const AFRICAN_COUNTRY_NAMES_UPPER = new Set([
  'ALGERIA','ANGOLA','BENIN','BOTSWANA','BURKINA FASO','BURUNDI','CABO VERDE',
  'CAMEROON','CENTRAL AFRICAN REPUBLIC','CHAD','COMOROS','CONGO',
  'DEMOCRATIC REPUBLIC OF THE CONGO','DJIBOUTI','EGYPT','EQUATORIAL GUINEA',
  'ERITREA','ESWATINI','ETHIOPIA','GABON','GAMBIA','GHANA','GUINEA',
  'GUINEA-BISSAU','IVORY COAST','KENYA','LESOTHO','LIBERIA','LIBYA',
  'MADAGASCAR','MALAWI','MALI','MAURITANIA','MAURITIUS','MOROCCO','MOZAMBIQUE',
  'NAMIBIA','NIGER','NIGERIA','REPUBLIC OF THE CONGO','RWANDA',
  'SAO TOME AND PRINCIPE','SENEGAL','SEYCHELLES','SIERRA LEONE','SOMALIA',
  'SOUTH AFRICA','SOUTH SUDAN','SUDAN','TANZANIA','TOGO','TUNISIA','UGANDA',
  'WESTERN SAHARA','ZAMBIA','ZIMBABWE',
]);

/* ─────────── helpers ─────────── */

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

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as any).type === 'FeatureCollection' &&
    Array.isArray((value as any).features)
  );
}

export function normalizeFuel(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return 'Other';

  const lower = value.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower.includes('offshorewind')) return 'Offshore Wind';
  if (lower.includes('onshorewind') || lower.includes('wind')) return 'Wind';
  if (
    lower.includes('solarpv') ||
    lower.includes('solarthermal') ||
    lower.includes('solar')
  ) {
    return 'Solar';
  }
  if (
    lower.includes('pumpedhydro') ||
    lower.includes('pumpedstorage') ||
    lower.includes('pumped')
  ) {
    return 'Pumped Storage';
  }
  if (lower.includes('hydro')) return 'Hydro';
  if (lower.includes('geothermal') || lower.includes('geo')) return 'Geothermal';
  if (
    lower.includes('battery') ||
    lower.includes('bess') ||
    lower.includes('storage')
  ) {
    return 'Storage';
  }
  if (
    lower.includes('biomass') ||
    lower.includes('biofuel') ||
    lower.includes('biogas')
  ) {
    return 'Biomass';
  }
  if (
    lower.includes('naturalgas') ||
    lower.includes('gasccgt') ||
    lower.includes('gasocgt') ||
    lower.includes('lng') ||
    lower === 'ng' ||
    lower.includes('gas')
  ) {
    return 'Gas';
  }
  if (lower.includes('lignite') || lower.includes('coal')) return 'Coal';
  if (
    lower.includes('diesel') ||
    lower.includes('hfo') ||
    lower.includes('heavyfuel') ||
    lower.includes('lfo') ||
    lower.includes('oil')
  ) {
    return 'Oil';
  }
  if (lower.includes('nuclear')) return 'Nuclear';

  return titleCase(value);
}

export function isRenewableFuel(fuel: string): boolean {
  return RENEWABLE_FUELS.has(fuel);
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
  if (v >= 31) return '31-99kV';
  return '<31kV';
}

/* ─────────── power plants ─────────── */

export function preparePowerPlants(data: unknown): PlantBundle {
  const raw = data as { features?: unknown[] } | null;
  const rawFeatures = Array.isArray(raw?.features) ? raw.features : [];

  if (rawFeatures.length === 0) {
    return {
      plants: { type: 'FeatureCollection', features: [] },
      totalPlants: 0,
      totalGW: '0.0',
      techStats: [],
      countryStats: [],
    };
  }

  const capacities = rawFeatures.map((f: any) =>
    Math.max(0, toNumber(f?.properties?.capacity_mw, 0)),
  );
  const maxMW = Math.max(1, ...capacities);

  const fuelGroups = new Map<string, FuelStat>();
  const countryGroups = new Map<
    string,
    {
      mw: number;
      plants: number;
      renewableMW: number;
      iso3?: string;
    }
  >();

  const processedFeatures = rawFeatures.map((f: any) => {
    const props = { ...(f?.properties || {}) };

    const fuel = normalizeFuel(
      props.technology || props.primary_fuel || props.fuel || 'Other',
    );
    const capacityMW = Math.max(0, toNumber(props.capacity_mw, 0));
    const normalized = capacityMW / maxMW;

    const country =
      String(props.country || props.country_code || props.iso3 || 'Unknown').trim() ||
      'Unknown';

    const iso3 =
      String(props.iso3 || props.country_code || '').trim() || undefined;

    const renewable = isRenewableFuel(fuel);
    const color = colorForFuel(fuel);

    props.fuel = fuel;
    props.renewable = renewable;
    props.color = color;
    props.capacity_mw = capacityMW;
    props.country = country;
    if (iso3) props.iso3 = iso3;
    props.intensity = Number(Math.min(1, Math.pow(normalized, 0.6)).toFixed(3));

    if (!fuelGroups.has(fuel)) {
      fuelGroups.set(fuel, { fuel, count: 0, mw: 0, color });
    }
    const fuelStat = fuelGroups.get(fuel)!;
    fuelStat.count += 1;
    fuelStat.mw += capacityMW;

    const countryStat = countryGroups.get(country) ?? {
      mw: 0,
      plants: 0,
      renewableMW: 0,
      iso3,
    };

    countryStat.mw += capacityMW;
    countryStat.plants += 1;
    if (renewable) countryStat.renewableMW += capacityMW;
    if (!countryStat.iso3 && iso3) countryStat.iso3 = iso3;
    countryGroups.set(country, countryStat);

    return { ...f, properties: props };
  });

  const totalMW = Array.from(fuelGroups.values()).reduce((sum, s) => sum + s.mw, 0);

  const techStats: FuelStat[] = Array.from(fuelGroups.values())
    .map((s) => ({
      ...s,
      gw: Number((s.mw / 1000).toFixed(1)),
      percentage:
        totalMW > 0 ? Number(((s.mw / totalMW) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.mw - a.mw);

  const countryStats: CountryStat[] = Array.from(countryGroups.entries())
    .map(([country, s]) => ({
      country,
      iso3: s.iso3,
      mw: s.mw,
      gw: Number((s.mw / 1000).toFixed(2)),
      plantCount: s.plants,
      renewableShare:
        s.mw > 0 ? Number((s.renewableMW / s.mw).toFixed(3)) : 0,
    }))
    .sort((a, b) => b.mw - a.mw);

  return {
    plants: {
      type: 'FeatureCollection',
      features: processedFeatures,
    } as PlantFeatureCollection,
    totalPlants: processedFeatures.length,
    totalGW: (totalMW / 1000).toFixed(1),
    techStats,
    countryStats,
  };
}

/* ─────────── supporting layers ─────────── */

export function prepareTransmission(data: unknown): FeatureCollection {
  const raw = data as { features?: unknown[] } | null;
  const features = (Array.isArray(raw?.features) ? raw.features : []).map((f: any) => {
    const voltageClass = classifyVoltage(
      f?.properties?.voltage_kv ?? f?.properties?.voltage,
    );

    return {
      ...f,
      properties: {
        ...f.properties,
        voltage_class: voltageClass,
        color:
          VOLTAGE_COLORS[voltageClass as keyof typeof VOLTAGE_COLORS] ??
          VOLTAGE_COLORS.Unknown,
      },
    };
  });

  return { type: 'FeatureCollection', features };
}

export function prepareDataCenters(data: unknown): FeatureCollection {
  const raw = data as { features?: unknown[] } | null;
  const features = (Array.isArray(raw?.features) ? raw.features : []).map((f: any) => ({
    ...f,
    properties: { ...f.properties, color: '#67e8f9', type: 'data_center' },
  }));
  return { type: 'FeatureCollection', features };
}

export function prepareSubstations(data: unknown): FeatureCollection {
  const raw = data as { features?: unknown[] } | null;
  const features = (Array.isArray(raw?.features) ? raw.features : []).map((f: any) => ({
    ...f,
    properties: { ...f.properties, color: '#e0f2fe', type: 'substation' },
  }));
  return { type: 'FeatureCollection', features };
}

export function preparePlannedUpgrades(data: unknown): FeatureCollection {
  const raw = data as { features?: unknown[] } | null;
  const features = (Array.isArray(raw?.features) ? raw.features : []).map((f: any) => ({
    ...f,
    properties: { ...f.properties, color: '#fbbf24', planned: true },
  }));
  return { type: 'FeatureCollection', features };
}

function passThroughFC(data: unknown): FeatureCollection {
  if (!isFeatureCollection(data)) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: data.features as any[],
  };
}

/* ─────────── admin boundary normalization ──────────────────────────
 * ROOT-CAUSE FIX for "KENYA" appearing scattered across the country when
 * zoomed in.
 *
 * In many admin1 GeoJSON sources (Natural Earth, geoBoundaries, OSM),
 * a feature's subnational `name` field is sometimes:
 *   - BLANK / missing (for unmapped regions)
 *   - The COUNTRY name itself (badly-tagged features)
 *   - An ALL-CAPS copy of the country name
 *
 * The map's symbol layer then stamps the country name on every county
 * polygon that has these bad values. We fix this at load time by:
 *   1. Extracting a clean subnational name per feature
 *   2. Dropping features where no valid subnational name exists
 *   3. Writing the clean name to `properties.name` so the renderer
 *      can use a simple, predictable field.
 * ================================================================== */

function extractSubnationalName(props: any, countryName?: string): string | null {
  // Gather candidate field values, in order of preference
  const candidates = [
    props?.name_en,
    props?.shapeName,
    props?.name,
    props?.NAME_1,
    props?.NAME,
    props?.region,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  if (candidates.length === 0) return null;

  const countryUpper = countryName ? countryName.trim().toUpperCase() : '';

  for (const cand of candidates) {
    const candUpper = cand.toUpperCase();

    // Reject if it's literally a country name
    if (AFRICAN_COUNTRY_NAMES_UPPER.has(candUpper)) continue;

    // Reject if it matches the parent country name explicitly
    if (countryUpper && candUpper === countryUpper) continue;

    return cand;
  }

  return null;
}

export function prepareAdminBoundaries(
  data: unknown,
  level: 0 | 1 | 2,
): FeatureCollection | null {
  if (!isFeatureCollection(data)) return null;

  const cleaned = data.features.reduce<any[]>((acc, f: any) => {
    const props = { ...(f?.properties ?? {}) };

    if (level === 0) {
      // For admin0 we just keep the country name cleanly in `name`
      const name =
        (typeof props.name_en === 'string' && props.name_en.trim()) ||
        (typeof props.ADMIN === 'string' && props.ADMIN.trim()) ||
        (typeof props.NAME === 'string' && props.NAME.trim()) ||
        (typeof props.name === 'string' && props.name.trim()) ||
        '';
      if (!name) return acc;
      props.name = name;
      acc.push({ ...f, properties: props });
      return acc;
    }

    // admin1 / admin2: figure out parent country
    const country =
      (typeof props.admin === 'string' && props.admin) ||
      (typeof props.ADMIN === 'string' && props.ADMIN) ||
      (typeof props.country === 'string' && props.country) ||
      (typeof props.COUNTRY === 'string' && props.COUNTRY) ||
      (typeof props.shapeGroup === 'string' && props.shapeGroup) ||
      undefined;

    const subName = extractSubnationalName(props, country);
    if (!subName) {
      // Drop the feature entirely — it cannot render a useful label
      return acc;
    }

    props.name = subName;
    acc.push({ ...f, properties: props });
    return acc;
  }, []);

  console.log(
    `[dataPrep] admin${level}: kept ${cleaned.length} / ${data.features.length} features ` +
      `after name sanitization`,
  );

  return { type: 'FeatureCollection', features: cleaned };
}

async function fetchFirstAvailable(
  candidates: string[],
  label: string,
): Promise<unknown | null> {
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;

      const json = await res.json();
      if (isFeatureCollection(json)) {
        console.log(`[dataPrep] loaded ${label}: ${url} (${json.features.length} features)`);
        return json;
      }
    } catch {
      // try next candidate
    }
  }

  console.warn(`[dataPrep] failed to load ${label}. Tried:`, candidates);
  return null;
}

/* ─────────── main loader ─────────── */

export async function loadAndPreparePowerGridData(): Promise<MapDataBundle> {
  const urlCandidates = {
    plants: [
      '/data/plants/africa_power_plants.geojson',
    ],
    transmission: [
      '/data/grid/africa_transmission.geojson',
    ],
    substations: [
      '/data/grid/africa_substations.geojson',
    ],
    dataCenters: [
      '/data/digital/africa_datacenters.geojson',
    ],
    waterStress: [
      '/data/context/africa_water_stress.geojson',
    ],
    submarineCables: [
      '/data/grid/africa_submarine_cables.geojson',
    ],
    plannedUpgrades: [
      '/data/grid/africa_planned_upgrades.geojson',
    ],
    admin0: [
      '/data/admin/africa_admin0.geojson',
      '/data/context/africa_admin0.geojson',
      '/data/grid/africa_admin0.geojson',
      '/data/africa_admin0.geojson',
    ],
    admin1: [
      '/data/admin/africa_admin1.geojson',
      '/data/context/africa_admin1.geojson',
      '/data/grid/africa_admin1.geojson',
      '/data/africa_admin1.geojson',
    ],
    admin2: [
      '/data/admin/africa_admin2.geojson',
      '/data/context/africa_admin2.geojson',
      '/data/grid/africa_admin2.geojson',
      '/data/africa_admin2.geojson',
    ],
    placeLabels: [
      '/data/admin/africa_places.geojson',
      '/data/context/africa_places.geojson',
      '/data/africa_places.geojson',
    ],
  } as const;

  const keys = Object.keys(urlCandidates) as Array<keyof typeof urlCandidates>;

  const results = await Promise.all(
    keys.map((key) => fetchFirstAvailable([...urlCandidates[key]], key)),
  );

  const raw = Object.fromEntries(
    keys.map((key, i) => [key, results[i]]),
  ) as Record<keyof typeof urlCandidates, unknown | null>;

  const bundle: MapDataBundle = {
    plants: preparePowerPlants(raw.plants),
    transmission: prepareTransmission(raw.transmission),
    substations: prepareSubstations(raw.substations),
    dataCenters: prepareDataCenters(raw.dataCenters),
    waterStress: raw.waterStress ? passThroughFC(raw.waterStress) : null,
    submarineCables: raw.submarineCables ? passThroughFC(raw.submarineCables) : null,
    plannedUpgrades: preparePlannedUpgrades(raw.plannedUpgrades),
    admin0: prepareAdminBoundaries(raw.admin0, 0),
    admin1: prepareAdminBoundaries(raw.admin1, 1),
    admin2: prepareAdminBoundaries(raw.admin2, 2),
    placeLabels: raw.placeLabels ? passThroughFC(raw.placeLabels) : null,
  };

  console.log('[dataPrep] admin0 features:', bundle.admin0?.features?.length ?? 0);
  console.log('[dataPrep] admin1 features:', bundle.admin1?.features?.length ?? 0);
  console.log('[dataPrep] admin2 features:', bundle.admin2?.features?.length ?? 0);

  return bundle;
}
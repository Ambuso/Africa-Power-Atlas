export const TRANSITION_DATASETS = {
  hydrogen: { label: 'Hydrogen', short: 'H₂', color: '#69d9c2', file: 'hydrogen.geojson', unit: 'kt H₂/year', description: 'Hydrogen production projects, technology, announced output, and project stage.' },
  carbonCapture: { label: 'Carbon capture & storage', short: 'CO₂', color: '#c4b5fd', file: 'carbon-capture.geojson', unit: 'Mt CO₂/year', description: 'Capture and storage projects, reported capacity, and development status.' },
  geothermal: { label: 'Geothermal', short: 'GEO', color: '#fbbf86', file: 'geothermal.geojson', unit: 'MW', description: 'Geothermal generating units, nameplate capacity, technology, and operating status.' },
  emissions: { label: 'Power-sector emissions', short: 'GHG', color: '#fb8fa3', file: 'emissions.geojson', unit: 't CO₂e/year', description: 'Estimated annual greenhouse-gas emissions from mapped African power facilities.' },
} as const;

export type TransitionDataset = keyof typeof TRANSITION_DATASETS;
export const TRANSITION_KEYS = Object.keys(TRANSITION_DATASETS) as TransitionDataset[];

export interface TransitionProperties {
  id: string;
  dataset: TransitionDataset;
  name: string;
  country: string;
  iso3: string;
  status: string;
  source_status: string;
  technology: string;
  capacity_value: number | null;
  capacity_unit: string;
  year: number | null;
  operator: string;
  source: string;
  source_url: string;
  source_release: string;
  location_accuracy: string;
  emissions_tonnes: number | null;
  gas: string;
  notes: string;
  [key: string]: unknown;
}

export interface TransitionRecord {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] } | null;
  properties: TransitionProperties;
}

export interface DatasetSnapshot {
  label: string;
  source: string;
  source_url: string;
  download_url: string;
  source_release: string;
  retrieved_at: string;
  license: string;
  sha256: string;
  record_count: number;
  mapped_count: number;
  country_count: number;
  coverage: string;
  limitations: string[];
}

export interface TransitionManifest {
  generated_at: string;
  datasets: Record<TransitionDataset, DatasetSnapshot>;
}

export const STATUS_LABELS: Record<string, string> = {
  operating: 'Operating', construction: 'Construction / FID', planned: 'Planned / announced',
  paused: 'Shelved / mothballed', cancelled: 'Cancelled', retired: 'Retired',
  inventory: 'Estimated inventory', unknown: 'Not reported',
};

export function filterTransitionRecords(records: TransitionRecord[], filters: {
  query?: string; country?: string; status?: string; dataset?: string;
}): TransitionRecord[] {
  const query = (filters.query || '').toLocaleLowerCase().trim();
  return records.filter(({ properties: p }) =>
    (!filters.dataset || filters.dataset === 'all' || p.dataset === filters.dataset) &&
    (!filters.country || filters.country === 'all' || p.iso3 === filters.country) &&
    (!filters.status || filters.status === 'all' || p.status === filters.status) &&
    (!query || [p.name, p.country, p.technology, p.operator, p.source_status].join(' ').toLocaleLowerCase().includes(query)),
  );
}

export function formatCapacity(p: TransitionProperties): string {
  if (p.capacity_value === null || !Number.isFinite(p.capacity_value)) return 'Not reported';
  return `${p.capacity_value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${p.capacity_unit}`;
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Public records can contain spreadsheet formulas; export them as literal text.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportTransitionCsv(records: TransitionRecord[]): string {
  const columns: Array<keyof TransitionProperties> = ['id', 'dataset', 'name', 'country', 'iso3', 'status', 'source_status', 'technology', 'capacity_value', 'capacity_unit', 'year', 'emissions_tonnes', 'gas', 'operator', 'source', 'source_url', 'source_release', 'location_accuracy', 'notes'];
  return [columns.map(csvCell).join(','), ...records.map(({ properties: p, geometry }) =>
    columns.map((key) => csvCell(p[key])).join(',') + ',' + csvCell(geometry?.coordinates[0]) + ',' + csvCell(geometry?.coordinates[1]),
  )].map((row, i) => i === 0 ? row + ',"longitude","latitude"' : row).join('\r\n');
}

export function calculateEmissionsScenario(baseline: number, activityChangePct: number, reductionPct: number) {
  if (!Number.isFinite(baseline) || baseline <= 0) throw new Error('Choose records with a positive, reported emissions baseline.');
  if (!Number.isFinite(activityChangePct) || activityChangePct < -90 || activityChangePct > 200) throw new Error('Activity change must be between −90% and 200%.');
  if (!Number.isFinite(reductionPct) || reductionPct < 0 || reductionPct > 100) throw new Error('Reduction must be between 0% and 100%.');
  const activityAdjusted = baseline * (1 + activityChangePct / 100);
  const scenario = activityAdjusted * (1 - reductionPct / 100);
  return { baseline, activityAdjusted, scenario, difference: baseline - scenario };
}

export function isTransitionDataset(value: string | null): value is TransitionDataset {
  return !!value && Object.hasOwn(TRANSITION_DATASETS, value);
}

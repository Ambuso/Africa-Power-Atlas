import { SITE_LAYERS, type SiteReport } from './site-check';

export const SHORTLIST_KEY = 'mapkwetu:kenya-shortlist:v1';
export const MAX_CANDIDATES = 5;
export const KENYA_STARTERS = [
  { label: 'Nairobi area', latitude: -1.2921, longitude: 36.8219 },
  { label: 'Naivasha area', latitude: -0.7172, longitude: 36.431 },
  { label: 'Nakuru area', latitude: -0.3031, longitude: 36.08 },
  { label: 'Mombasa area', latitude: -4.0435, longitude: 39.6682 },
];

export function readShortlist(raw: string | null): SiteReport[] {
  try {
    const value: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SiteReport => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.version !== 'string' || typeof item.createdAt !== 'string' || item.country !== 'Kenya') return false;
      if (!item.site || typeof item.site.label !== 'string' || !Number.isFinite(item.site.latitude) || !Number.isFinite(item.site.longitude) || ![10, 25, 50, 100].includes(item.site.radiusKm)) return false;
      if (!Array.isArray(item.fuelMix) || !item.fuelMix.every((group: { reportedMW?: number }) => Number.isFinite(group?.reportedMW)) || !item.water || typeof item.water.category !== 'string') return false;
      return SITE_LAYERS.every((key) => Array.isArray(item.nearest?.[key]) && item.nearest[key].every((asset: { distanceKm?: number; name?: string }) => Number.isFinite(asset?.distanceKm) && typeof asset?.name === 'string') && typeof item.sources?.[key]?.count === 'number' && typeof item.sources[key].release === 'string' && typeof item.sources[key].name === 'string' && typeof item.sources[key].url === 'string') && Array.isArray(item.unknowns) && item.unknowns.every((value: unknown) => typeof value === 'string') && Array.isArray(item.methodology) && item.methodology.every((value: unknown) => typeof value === 'string');
    }).slice(0, MAX_CANDIDATES);
  } catch { return []; }
}

export function siteBrief(reports: SiteReport[]): string {
  return ['ATLAS INTELLIGENCE · KENYA SITE SCREENING', 'Preliminary research brief · MapKwetu', 'Grid proximity does not establish capacity, connection availability or suitability.', '', ...reports.flatMap((report) => [
    report.site.label, `${report.country} · ${report.site.latitude}, ${report.site.longitude} · ${report.site.radiusKm} km radius`, `Checked: ${report.createdAt} · Data fingerprint: ${report.version}`, '',
    ...SITE_LAYERS.flatMap((key) => [`${report.sources[key].name} · ${report.sources[key].release} · ${report.sources[key].count} source records`, ...report.nearest[key].map((asset) => `  ${asset.name}: ${asset.distanceKm.toFixed(2)} km${asset.withinRadius ? '' : ' (outside radius)'} · ${asset.voltage} · ${asset.sourceUrl}`), report.sources[key].url, '']),
    'NEARBY GENERATION (REPORTED NAMEPLATE CAPACITY)', ...report.fuelMix.map((group) => `${group.fuel}: ${group.reportedMW} MW · ${group.plants} records · ${group.missingCapacity} missing capacities`),
    `Water: ${report.water.category} · ${report.water.scope} · ${report.water.note}`, '', 'REQUIRES VERIFICATION', ...report.unknowns, '', 'METHODS', ...report.methodology, '', '—', '',
  ])].join('\n');
}

import type { Geometry, Feature } from 'geojson';

export type Position = [number, number];
export const SITE_LAYERS = ['substations', 'transmission', 'plants', 'dataCentres', 'landingStations', 'fibreRoutes'] as const;
export type SiteLayer = typeof SITE_LAYERS[number];
export interface SiteAsset {
  id: string; name: string; geometry: Geometry;
  sphere: { centre: Position; radiusKm: number };
  country: string; fuel: string; capacityMW: number | null; voltageRaw: string; voltageUnit: 'V' | 'kV' | 'unknown';
  status: string; accuracy: string; sourceUrl: string;
}
export interface SiteSource {
  name: string; release: string; url: string; count: number; omitted: number; note: string;
}
export interface SiteIndex {
  version: string; preparedAt: string;
  layers: Record<SiteLayer, { source: SiteSource; assets: SiteAsset[] }>;
  countries: Feature[]; water: Feature[];
}
export interface SiteSpec { longitude: number; latitude: number; label: string; radiusKm: number }
export interface NearbyAsset {
  id: string; name: string; distanceKm: number; withinRadius: boolean; voltage: string;
  fuel: string; capacityMW: number | null; status: string; accuracy: string; sourceUrl: string; country: string;
}
export interface SiteReport {
  id: string; version: string; createdAt: string; site: SiteSpec; country: string;
  nearest: Record<SiteLayer, NearbyAsset[]>; sources: Record<SiteLayer, SiteSource>;
  fuelMix: Array<{ fuel: string; plants: number; reportedMW: number; missingCapacity: number }>;
  water: { country: string; score: number | null; category: string; scope: string; note: string };
  unknowns: string[]; methodology: string[];
}

const R = 6371.0088;
const rad = (angle: number) => angle * Math.PI / 180;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
type Vector = [number, number, number];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vector) => Math.hypot(...a);
const normal = (a: Vector): Vector => { const size = length(a); return [a[0] / size, a[1] / size, a[2] / size]; };
const vector = ([lon, lat]: Position): Vector => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];
const angle = (a: Vector, b: Vector) => Math.atan2(length(cross(a, b)), clamp(dot(a, b)));

export function distanceKm(a: Position, b: Position): number { return R * angle(vector(a), vector(b)); }

export function segmentDistanceKm(point: Position, start: Position, end: Position): number {
  const q = vector(point), a = vector(start), b = vector(end); const arc = angle(a, b);
  if (arc < 1e-12) return R * angle(q, a);
  if (Math.PI - arc < 1e-8) throw new Error('Ambiguous antipodal source segment.');
  const n = normal(cross(a, b)); const projection: Vector = [q[0] - dot(q, n) * n[0], q[1] - dot(q, n) * n[1], q[2] - dot(q, n) * n[2]];
  let nearest = Math.min(angle(q, a), angle(q, b));
  if (length(projection) > 1e-12) {
    const projected = normal(projection);
    for (const candidate of [projected, projected.map((value) => -value) as Vector]) {
      if (dot(cross(a, candidate), n) >= -1e-12 && dot(cross(candidate, b), n) >= -1e-12) nearest = Math.min(nearest, angle(q, candidate));
    }
  }
  return R * nearest;
}

export function geometryDistanceKm(point: Position, geometry: Geometry): number {
  if (geometry.type === 'Point') return distanceKm(point, geometry.coordinates as Position);
  if (geometry.type === 'MultiPoint') return Math.min(...geometry.coordinates.map((p) => distanceKm(point, p as Position)));
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') return Infinity;
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  let best = Infinity;
  for (const line of lines) for (let index = 1; index < line.length; index++) best = Math.min(best, segmentDistanceKm(point, line[index - 1] as Position, line[index] as Position));
  return best;
}

export function nearestAssets(point: Position, assets: SiteAsset[], limit: number): Array<{ asset: SiteAsset; distanceKm: number }> {
  const candidates = assets.map((asset) => ({ asset, bound: Math.max(0, distanceKm(point, asset.sphere.centre) - asset.sphere.radiusKm) })).sort((a, b) => a.bound - b.bound || a.asset.id.localeCompare(b.asset.id));
  const best: Array<{ asset: SiteAsset; distanceKm: number }> = [];
  for (const { asset, bound } of candidates) {
    if (best.length >= limit && bound > (best[best.length - 1]?.distanceKm ?? Infinity) + 1e-8) break;
    let distance;
    try { distance = geometryDistanceKm(point, asset.geometry); } catch { continue; }
    if (!Number.isFinite(distance)) continue;
    best.push({ asset, distanceKm: distance }); best.sort((a, b) => a.distanceKm - b.distanceKm || a.asset.id.localeCompare(b.asset.id));
    if (best.length > limit) best.pop();
  }
  return best;
}

function ringMatch(point: Position, ring: number[][]): 'inside' | 'boundary' | 'outside' {
  let inside = false; const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as Position, b = ring[j] as Position;
    const area = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
    if (Math.abs(area) < 1e-10 && x >= Math.min(a[0], b[0]) - 1e-10 && x <= Math.max(a[0], b[0]) + 1e-10 && y >= Math.min(a[1], b[1]) - 1e-10 && y <= Math.max(a[1], b[1]) + 1e-10) return 'boundary';
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export function polygonMatch(point: Position, geometry: Geometry | null): 'inside' | 'boundary' | 'outside' {
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return 'outside';
  for (const polygon of geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) {
    const exterior = ringMatch(point, polygon[0] || []); if (exterior === 'outside') continue;
    let inHole = false;
    for (const hole of polygon.slice(1)) { const result = ringMatch(point, hole); if (result === 'boundary') return 'boundary'; if (result === 'inside') inHole = true; }
    if (!inHole) return exterior;
  }
  return 'outside';
}

export function voltageLabel(raw: string, unit: SiteAsset['voltageUnit']): string {
  if (!raw || unit === 'unknown') return raw ? `${raw} (units unverified)` : 'Not reported';
  const values = raw.split(/[;,]/).map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return `${raw} (source value; not normalised)`;
  return [...new Set(values.map((value) => unit === 'V' ? value / 1000 : value))].sort((a, b) => b - a).map((value) => value.toLocaleString(undefined, { maximumFractionDigits: 3 })).join(' / ') + ' kV';
}

export function validateSiteSpec(value: unknown): SiteSpec {
  const input = value as Partial<SiteSpec> | null;
  if (!input || typeof input.longitude !== 'number' || typeof input.latitude !== 'number' || !Number.isFinite(input.longitude) || !Number.isFinite(input.latitude) || input.longitude < -26 || input.longitude > 64 || input.latitude < -38 || input.latitude > 39) throw new Error('Choose a location within the African coverage area.');
  const radiusKm = input.radiusKm ?? 50;
  if (![10, 25, 50, 100].includes(radiusKm)) throw new Error('Choose a 10, 25, 50 or 100 km search radius.');
  const label = typeof input.label === 'string' ? input.label.trim().replace(/[\x00-\x1f]/g, ' ').slice(0, 160) : '';
  return { longitude: input.longitude, latitude: input.latitude, radiusKm, label: label || 'Selected site' };
}

export function analyseSite(spec: SiteSpec, index: SiteIndex, limit = 3): SiteReport {
  const point: Position = [spec.longitude, spec.latitude];
  const matches = index.countries.filter((feature) => polygonMatch(point, feature.geometry) !== 'outside');
  const country = matches.length === 1 ? String(matches[0]?.properties?.name || 'Country not identified') : matches.length > 1 ? 'Boundary context is ambiguous' : 'Outside mapped country polygons';
  const nearest = {} as SiteReport['nearest'], sources = {} as SiteReport['sources'];
  for (const key of SITE_LAYERS) {
    sources[key] = index.layers[key].source;
    nearest[key] = nearestAssets(point, index.layers[key].assets, limit).map(({ asset, distanceKm: distance }) => ({ id: asset.id, name: asset.name, distanceKm: distance, withinRadius: distance <= spec.radiusKm, voltage: voltageLabel(asset.voltageRaw, asset.voltageUnit), fuel: asset.fuel, capacityMW: asset.capacityMW, status: asset.status, accuracy: asset.accuracy, sourceUrl: asset.sourceUrl, country: asset.country }));
  }
  const fuelGroups = new Map<string, { fuel: string; plants: number; reportedMW: number; missingCapacity: number }>();
  for (const asset of index.layers.plants.assets) {
    if (geometryDistanceKm(point, asset.geometry) > spec.radiusKm) continue;
    const fuel = asset.fuel || 'Unknown'; const group = fuelGroups.get(fuel) || { fuel, plants: 0, reportedMW: 0, missingCapacity: 0 };
    group.plants++; if (asset.capacityMW === null) group.missingCapacity++; else group.reportedMW += asset.capacityMW; fuelGroups.set(fuel, group);
  }
  const waterMatches = index.water.filter((feature) => polygonMatch(point, feature.geometry) !== 'outside');
  const waterProperties = waterMatches.length === 1 ? waterMatches[0]?.properties : null;
  const rawScore = waterProperties?.bws_score;
  const score = typeof rawScore === 'number' && Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 5 ? rawScore : null;
  const unknowns = ['Available grid capacity, headroom, connection approval and connection cost have not been verified.', 'Mapped voltage is nominal voltage, not power available to this site.', 'Plant capacity is source-reported nameplate capacity, not reliable supply or current generation.', 'Mapped fibre and cable stations do not establish service availability, network access, resilience or commercial terms.', 'Country-level water stress does not establish site water supply, permits or seasonal reliability.', 'Project status, route geometry and facility locations require current operator or field verification.'];
  if (matches.length !== 1) unknowns.push('Country identification is uncertain at this point; the map boundaries are generalised.');
  if (score === null) unknowns.push('A unique scored water-stress polygon was not available for this location.');
  for (const key of SITE_LAYERS) if (!nearest[key].some((asset) => asset.withinRadius)) unknowns.push(`No ${key} record was found within ${spec.radiusKm} km in this snapshot. This does not prove the infrastructure is absent.`);
  return { id: '', version: index.version, createdAt: new Date().toISOString(), site: spec, country, nearest, sources, fuelMix: [...fuelGroups.values()].sort((a, b) => b.reportedMW - a.reportedMW), water: { country: String(waterProperties?.name || country), score, category: score === null ? 'Unknown / ambiguous' : String(waterProperties?.stress_class || 'Category not reported'), scope: 'Country-level baseline context', note: waterMatches.length > 1 ? 'Overlapping or boundary polygons make the country context ambiguous.' : 'WRI Aqueduct country rankings; not a site-level water assessment.' }, unknowns, methodology: ['Distances are approximate straight-line great-circle distances on a sphere (radius 6,371.0088 km). They are not road, trench, cable-path or connection distances.', 'Line distances evaluate segment interiors, including disjoint line parts, rather than choosing only endpoints. Source geometry is interpreted as short great-circle segments.', 'Only source records are searched. Missing coordinates and missing capacities are not imputed. Distant nearest records are labelled outside the chosen search radius.', 'Generation mix includes mapped plants within the selected radius and sums only reported MW. Missing capacities remain explicit.', 'No suitability score, connection guarantee, engineering feasibility conclusion or measured emissions reduction is inferred.'] };
}

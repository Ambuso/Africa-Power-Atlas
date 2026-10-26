#!/usr/bin/env python3
"""Build a server-only spatial index and a small local city-search catalogue."""
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R = 6371.0088
LAYERS = {
    'substations': ('grid/africa_substations.geojson', 'OpenStreetMap substations', 'Extraction date not recorded', 'https://www.openstreetmap.org/copyright', 'OSM voltage tags in this prepared source are volts, despite the legacy voltage_kv field name.'),
    'transmission': ('grid/africa_transmission.geojson', 'World Bank Africa transmission / source fallback', 'Primary source: 2017; preparation date not recorded', 'https://datacatalog.worldbank.org/', 'Status and units are retained conservatively. Routes do not establish current connection access.'),
    'plants': ('plants/africa_power_plants.geojson', 'WRI Global Power Plant Database', 'Committed atlas snapshot; record dates vary', 'https://datasets.wri.org/dataset/globalpowerplantdatabase', 'Reported capacity and fuel; incomplete historical inventory, not current generation.'),
    'dataCentres': ('digital/africa_datacenters.geojson', 'OSM and curated data-centre list', 'Snapshot date not recorded', 'https://www.openstreetmap.org/copyright', 'Curated coordinates can be approximate city-level locations; facility operation is not verified.'),
    'landingStations': ('site-check/landing-stations.geojson', 'OpenStreetMap cable landing stations', '', 'https://www.openstreetmap.org/copyright', 'Explicitly tagged OSM stations; point or bounding-box centre, not a surveyed beach landing or a service guarantee.'),
    'fibreRoutes': ('site-check/fibre-routes.geojson', 'OpenStreetMap terrestrial fibre ways', '', 'https://www.openstreetmap.org/copyright', 'Only ways explicitly tagged as fibre are included. Coverage is sparse, especially for underground routes.'),
}


def vector(point):
    lon, lat = map(math.radians, point[:2]); return (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))


def angular(a, b):
    return math.atan2(math.sqrt(sum(value * value for value in (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]))), max(-1, min(1, sum(x*y for x, y in zip(a, b)))))


def cap(geometry):
    if geometry['type'] == 'Point': return {'centre': geometry['coordinates'][:2], 'radiusKm': 0}
    lines = [geometry['coordinates']] if geometry['type'] == 'LineString' else geometry['coordinates']
    points = [point[:2] for line in lines for point in line]
    if not points: raise ValueError('Empty route geometry')
    centre = [sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points)]
    c = vector(centre); radius = 0
    for line in lines:
        for a_point, b_point in zip(line, line[1:]):
            a, b = vector(a_point), vector(b_point); arc = angular(a, b)
            if math.pi - arc < 1e-8: raise ValueError('Antipodal route segment')
            summed = [x+y for x,y in zip(a,b)]; size = math.sqrt(sum(value*value for value in summed))
            midpoint = tuple(value/size for value in summed)
            radius = max(radius, angular(c, midpoint) + arc/2)
    return {'centre': centre, 'radiusKm': min(math.pi, radius) * R + 1e-7}


def numeric(value):
    if value is None or str(value).strip() == '': return None
    try:
        number = float(value); return number if math.isfinite(number) and number >= 0 else None
    except (ValueError, TypeError): return None


def main():
    base = ROOT / 'public/data'; digest = hashlib.sha256(); prepared = datetime.now(timezone.utc).isoformat()
    def read(relative):
        raw = (base / relative).read_bytes(); digest.update(raw); data = json.loads(raw)
        if data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list): raise ValueError(relative + ': invalid FeatureCollection')
        return data['features']
    countries = read('admin/africa_admin0.geojson'); water = read('context/africa_water_stress.geojson'); places = read('admin/africa_places.geojson')
    telecom = json.loads((base / 'site-check/telecom-manifest.json').read_text()); layers = {}
    for key, (relative, name, release, url, note) in LAYERS.items():
        features = read(relative); assets = []; omitted = 0
        for index, feature in enumerate(features):
            geometry = feature.get('geometry'); p = feature.get('properties') or {}
            if not geometry or geometry['type'] not in {'Point', 'LineString', 'MultiLineString'}: omitted += 1; continue
            try: sphere = cap(geometry)
            except (ValueError, TypeError, IndexError): omitted += 1; continue
            raw_voltage = p.get('voltage_kv') if p.get('voltage_kv') is not None else p.get('voltage')
            voltage_unit = 'V' if key == 'substations' else 'kV' if key == 'transmission' and p.get('status') else 'unknown'
            accuracy = p.get('accuracy') or ('Curated coordinate; may be approximate' if key == 'dataCentres' else 'Published source geometry; accuracy not recorded')
            assets.append({'id': str(p.get('id') or feature.get('id') or f'{key}:{index}'), 'name': str(p.get('name') or 'Unnamed mapped record'), 'geometry': geometry, 'sphere': sphere, 'country': str(p.get('country_long') or p.get('country') or 'Not reported'), 'fuel': str(p.get('primary_fuel') or p.get('fuel') or p.get('technology') or ''), 'capacityMW': numeric(p.get('capacity_mw')), 'voltageRaw': '' if raw_voltage is None else str(raw_voltage), 'voltageUnit': voltage_unit, 'status': str(p.get('status') or 'Not reported / not independently verified'), 'accuracy': accuracy, 'sourceUrl': p.get('source_url') or url})
        layers[key] = {'source': {'name': name, 'release': release or 'OSM extraction ' + telecom['extracted_at'][:10], 'url': url, 'count': len(assets), 'omitted': omitted, 'note': note}, 'assets': assets}
        print(key, len(assets), 'indexed records;', omitted, 'omitted')
    output = ROOT / '.generated/site-check'; output.mkdir(parents=True, exist_ok=True)
    (output / 'index.json').write_text(json.dumps({'version': digest.hexdigest(), 'preparedAt': prepared, 'layers': layers, 'countries': countries, 'water': water}, ensure_ascii=False, separators=(',', ':')))
    catalogue = []
    for feature in places:
        p = feature.get('properties') or {}; geometry = feature.get('geometry')
        if geometry and geometry['type'] == 'Point': catalogue.append({'name': str(p.get('name_en') or p.get('name') or ''), 'country': str(p.get('country') or p.get('adm0name') or next((f['properties']['name'] for f in countries if f['properties'].get('iso3') == p.get('iso3')), '')), 'longitude': geometry['coordinates'][0], 'latitude': geometry['coordinates'][1]})
    public = base / 'site-check'; public.mkdir(parents=True, exist_ok=True)
    (public / 'places.json').write_text(json.dumps(catalogue, ensure_ascii=False, separators=(',', ':')))
    print('Site Check index ready:', (output / 'index.json').stat().st_size, 'bytes')


if __name__ == '__main__': main()

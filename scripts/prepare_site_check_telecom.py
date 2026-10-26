#!/usr/bin/env python3
"""Prepare explicitly tagged OSM telecom records for Site Check (ODbL)."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from functools import lru_cache

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/site-check'
QUERIES = {
    'landing-stations': '[out:json][timeout:180][bbox:-36,-26,38,64];(nwr["telecom"="cable_landing_station"];nwr["man_made"="cable_landing_station"];nwr["telecom:submarine"="cable_landing_station"];);out body center;',
    'fibre-routes': '[out:json][timeout:240][bbox:-36,-26,38,64];(way["communication"="line"]["telecom:medium"~"^(fibre|fiber)$"]["submarine"!="yes"]["location"!="underwater"]["seamark:type"!="cable_submarine"];way["telecom"~"^(line|cable)$"]["telecom:medium"~"^(fibre|fiber)$"]["submarine"!="yes"]["location"!="underwater"]["seamark:type"!="cable_submarine"];);out body geom;',
}


def inside_ring(point, ring):
    x, y = point; inside = False
    for index, a in enumerate(ring):
        b = ring[index - 1]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]: inside = not inside
    return inside


@lru_cache(maxsize=100)
def bounds(serialized):
    geometry = json.loads(serialized)
    def points(value):
        if isinstance(value[0], (int, float)): yield value
        else:
            for part in value: yield from points(part)
    coordinates = list(points(geometry['coordinates']))
    return min(p[0] for p in coordinates), min(p[1] for p in coordinates), max(p[0] for p in coordinates), max(p[1] for p in coordinates)


def country_for(point, countries):
    for feature in countries:
        geometry = feature['geometry']; west, south, east, north = feature['_bounds']
        if not (west <= point[0] <= east and south <= point[1] <= north): continue
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        if any(inside_ring(point, polygon[0]) and not any(inside_ring(point, hole) for hole in polygon[1:]) for polygon in polygons): return feature['properties']['name']
    return None


def main():
    countries = json.loads((ROOT / 'public/data/admin/africa_admin0.geojson').read_text())['features']
    for feature in countries: feature['_bounds'] = bounds(json.dumps(feature['geometry']))
    generated = datetime.now(timezone.utc).isoformat(); outputs = {}; manifest = {'extracted_at': generated, 'publisher': 'OpenStreetMap contributors', 'license': 'ODbL 1.0', 'attribution_url': 'https://www.openstreetmap.org/copyright', 'coverage_note': 'Explicit OSM telecom tags within the query bbox and mapped African country polygons. Coarse coastal boundaries can omit stations. Absence of a record does not imply absence of infrastructure.', 'datasets': {}}
    for key, query in QUERIES.items():
        print('Fetching', key, flush=True); payload = urllib.parse.urlencode({'data': query}).encode(); data = None
        for endpoint in ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']:
            try:
                request = urllib.request.Request(endpoint + '?' + urllib.parse.urlencode({'data': query}), headers={'User-Agent': 'MapKwetu Site Check open-data preparation', 'Content-Type': 'application/x-www-form-urlencoded'})
                data = json.load(urllib.request.urlopen(request, timeout=100))
                if 'elements' not in data or data.get('remark'): raise ValueError(str(data.get('remark') or 'Invalid Overpass response'))
                break
            except Exception as error: print(endpoint, str(error), flush=True)
        if data is None or 'elements' not in data or data.get('remark'): raise RuntimeError('Telecom source could not be downloaded; retaining existing snapshots.')
        features = []; seen = set()
        for element in data['elements']:
            identifier = f'{element["type"]}/{element["id"]}'
            if identifier in seen: continue
            seen.add(identifier); tags = element.get('tags', {})
            if any(str(tags.get(flag, '')).lower() in {'yes', 'true', '1'} for flag in ['disused', 'abandoned', 'proposed', 'construction']): continue
            if key == 'landing-stations':
                source = element if element['type'] == 'node' else element.get('center', {})
                if source.get('lon') is None or source.get('lat') is None: continue
                coordinates = [source['lon'], source['lat']]; country = country_for(coordinates, countries)
                if not country: continue
                geometry = {'type': 'Point', 'coordinates': coordinates}; accuracy = 'OSM node coordinate' if element['type'] == 'node' else 'OSM feature bounding-box centre'
            else:
                coordinates = [[point['lon'], point['lat']] for point in element.get('geometry', []) if point.get('lon') is not None and point.get('lat') is not None]
                if len(coordinates) < 2: continue
                represented = sorted({name for point in coordinates if (name := country_for(point, countries))})
                if not represented: continue
                country = ' / '.join(represented); geometry = {'type': 'LineString', 'coordinates': coordinates}; accuracy = 'Mapped OSM fibre way; physical route not independently verified'
            features.append({'type': 'Feature', 'geometry': geometry, 'properties': {'id': identifier, 'name': tags.get('name') or ('Mapped cable landing station' if key == 'landing-stations' else 'Unnamed mapped fibre route'), 'operator': tags.get('operator', ''), 'country': country, 'accuracy': accuracy, 'status': 'Mapped; service availability not verified', 'source_url': 'https://www.openstreetmap.org/' + identifier, 'extracted_at': generated}})
        outputs[key + '.geojson'] = {'type': 'FeatureCollection', 'features': features}
        manifest['datasets'][key] = {'count': len(features), 'query': query, 'status': 'snapshot prepared'}
        print(key, len(features), 'African records', flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in outputs.items(): (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    (OUT / 'telecom-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__': main()

#!/usr/bin/env python3
"""Fetch, validate and atomically publish attributable African transition snapshots.

Uses only Python's standard library. Missing values remain missing; no project
locations, capacity values, operating status or emissions are imputed.
"""
import argparse
import ast
import hashlib
import io
import json
import math
import os
import posixpath
import re
import sqlite3
import tempfile
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/transition'
SOURCES = {
    'hydrogen': {
        'label': 'Hydrogen production projects', 'source': 'IEA-derived workbook, research-author mirror',
        'source_url': 'https://www.iea.org/data-and-statistics/data-product/hydrogen-production-and-infrastructure-projects-database',
        'download_url': 'https://raw.githubusercontent.com/NkJoseph/CCUS-impact-H2-Scalability/c8bc34d6c407194209bff7d58a8e70052a2a531d/IEA%20Hydrogen%20Production%20Projects%20Database_update_5_March_2025.xlsx',
        'source_release': 'Research mirror dated 5 March 2025', 'license': 'CC BY 4.0 (IEA source attribution retained)',
        'coverage': 'African rows with numeric project references from the IEA-derived workbook; coordinates are retained only where published.',
        'limitations': ['This pinned research mirror predates the June 2026 official IEA release.', 'Source normalised hydrogen-output capacities can be estimates; they are not measured production.', 'Project status is historical; targets and announcements are not operating output.'],
    },
    'carbonCapture': {
        'label': 'Carbon capture and storage projects', 'source': 'IEA CCUS 2026 via CCUS Policy Hub mirror',
        'source_url': 'https://www.iea.org/data-and-statistics/data-product/ccus-projects-database',
        'download_url': 'https://raw.githubusercontent.com/liuh886/ccus-policy-hub/d48c2960b882c51c1be26d1ba634152f7823175b/agent/ccus-ai-agent/db/ccus_master.sqlite',
        'source_release': 'IEA 2026 / mirror audit March 2026', 'license': 'CC BY 4.0 (IEA source attribution retained)',
        'coverage': 'African project records from the pinned IEA-derived mirror. Capture, use, storage and full-chain entries are kept distinct.',
        'limitations': ['Mirror records are not independently verified current project status.', 'Country and state anchors in the mirror are excluded from facility markers.', 'Project capacities can overlap within a hub and must not be summed as unique captured or avoided emissions.'],
    },
    'geothermal': {
        'label': 'Geothermal power units', 'source': 'Global Energy Monitor (TU Berlin / PyPSA download mirror)',
        'source_url': 'https://globalenergymonitor.org/projects/global-geothermal-power-tracker',
        'download_url': 'https://tubcloud.tu-berlin.de/s/spGtyE3oPZrMeB3/download/Geothermal-Power-Tracker-March-2026-Final.xlsx',
        'source_release': 'March 2026', 'license': 'CC BY 4.0',
        'coverage': 'African generating-unit records from the March 2026 Global Geothermal Power Tracker. Several units may share one plant and coordinates.',
        'limitations': ['Unit counts are not plant-site counts.', 'Capacity is nameplate MW, not electricity generation.', 'Approximate locations and source project statuses are retained and identified.'],
    },
    'emissions': {
        'label': 'Power-sector emissions estimates', 'source': 'Climate TRACE v7 public API',
        'source_url': 'https://www.climatetrace.org/data',
        'download_url': 'https://api.climatetrace.org/v7/sources?year=2025&gas=co2e_100yr&sectors=power&continent=Africa&limit=1000&offset=0',
        'source_release': '2025 annual inventory / retrieved October 2026', 'license': 'CC BY 4.0 (emissions and source metadata)',
        'coverage': 'African point-source power-sector records, year 2025, gas co2e_100yr. Totals apply only to retained inventory records.',
        'limitations': ['Estimated greenhouse-gas emissions, not direct measurements.', 'Units are metric tonnes CO2e, AR6 GWP100, per year.', 'Restricted activity and capacity fields are omitted; inventory sums are not national totals.'],
    },
}
FILES = {'hydrogen': 'hydrogen.geojson', 'carbonCapture': 'carbon-capture.geojson', 'geothermal': 'geothermal.geojson', 'emissions': 'emissions.geojson'}


def norm(value):
    text = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', text)


def country_index():
    text = (ROOT / 'lib/countries.ts').read_text()
    pattern = r"\{ iso2: '([^']+)', iso3: '([^']+)', name:\s*(\"[^\"]*\"|'[^']*')"
    index = {}
    for iso2, iso3, quoted in re.findall(pattern, text):
        name = ast.literal_eval(quoted)
        for key in [iso2, iso3, name]:
            index[norm(key)] = (iso3, name)
    aliases = {'Democratic Republic of the Congo': 'COD', 'Dem. Rep. Congo': 'COD', 'Republic of the Congo': 'COG', 'Cape Verde': 'CPV', 'Ivory Coast': 'CIV', 'Swaziland': 'SWZ', 'United Republic of Tanzania': 'TZA', 'Sao Tome and Principe': 'STP', 'The Gambia': 'GMB'}
    for name, iso3 in aliases.items():
        index[norm(name)] = index[norm(iso3)]
    if len({value[0] for value in index.values()}) < 54:
        raise ValueError('African country crosswalk could not be read.')
    return index


def number(value):
    if value is None or isinstance(value, bool) or str(value).strip() in {'', '--', '-', 'N/A', 'NA', 'unknown'}:
        return None
    try:
        result = float(str(value).replace(',', '').strip())
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def year(value):
    numeric = number(value)
    if numeric is not None and numeric.is_integer() and 1900 <= numeric <= 2200:
        return int(numeric)
    match = re.fullmatch(r'\s*((?:19|20|21)\d{2})\s*', str(value or ''))
    return int(match.group(1)) if match else None


def status(value):
    text = str(value or '').strip().lower()
    if any(word in text for word in ['cancel', 'abandon']): return 'cancelled'
    if any(word in text for word in ['suspend', 'shelv', 'mothball', 'pause']): return 'paused'
    if any(word in text for word in ['retir', 'decommission', 'closed']): return 'retired'
    if text in {'operational', 'operating', 'in operation', 'active'}: return 'operating'
    if any(word in text for word in ['pre-construction', 'announc', 'plan', 'concept', 'feasibility', 'development']): return 'planned'
    if 'construction' in text or text == 'fid': return 'construction'
    return 'unknown'


def geometry(lon, lat):
    lon, lat = number(lon), number(lat)
    if lon is None or lat is None or not -180 <= lon <= 180 or not -90 <= lat <= 90 or (lon == 0 and lat == 0):
        return None
    return {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]}


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'MapKwetu/1.0 public-data-research', 'Accept': '*/*'})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(25_000_001)
    if len(data) > 25_000_000: raise ValueError('Unexpectedly large source download.')
    return data


def xlsx_rows(data, sheet_name):
    if not data.startswith(b'PK'): raise ValueError('Source is not an XLSX workbook.')
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 150_000_000:
            raise ValueError('Workbook uncompressed size exceeds expected limits.')
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns)]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relationships = {item.attrib['Id']: item.attrib['Target'] for item in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        target = None
        for sheet in workbook.findall('s:sheets/s:sheet', ns):
            if norm(sheet.attrib['name']) == norm(sheet_name):
                relationship = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
                target = relationships[relationship]
        if target is None: raise ValueError(f'Missing worksheet {sheet_name}.')
        target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
        rows = []
        for row in ET.fromstring(archive.read(target)).findall('s:sheetData/s:row', ns):
            values = {}
            for cell in row.findall('s:c', ns):
                value_element = cell.find('s:v', ns)
                inline = cell.find('s:is', ns)
                value = value_element.text if value_element is not None else ''.join(inline.itertext()) if inline is not None else ''
                if cell.get('t') == 's' and value: value = strings[int(value)]
                values[re.sub(r'\d', '', cell.get('r'))] = value
            rows.append(values)
        return rows


def records_from_rows(rows, required):
    for index, row in enumerate(rows[:15]):
        if required.issubset({norm(value) for value in row.values()}):
            return [{str(header or '').strip(): values.get(column, '') for column, header in row.items() if header} for values in rows[index + 1:]]
    raise ValueError('Required workbook header fields not found: ' + str(required))


def make_record(key, identifier, name, country, raw_status, technology='', capacity=None, unit='', start=None, operator='', geo=None, accuracy='', notes='', source_url=None, **extra):
    iso3, country_name = country
    p = dict(id=f'{key}:{identifier}', dataset=key, name=str(name).strip(), country=country_name, iso3=iso3, status=status(raw_status), source_status=str(raw_status or '').strip(), technology=str(technology or '').strip(), capacity_value=capacity, capacity_unit=unit, year=year(start), operator=str(operator or '').strip(), source=SOURCES[key]['source'], source_url=source_url or SOURCES[key]['source_url'], source_release=SOURCES[key]['source_release'], location_accuracy=accuracy if geo else 'Not published / not mapped as a facility', emissions_tonnes=None, gas='', notes=notes)
    p.update(extra)
    return {'type': 'Feature', 'geometry': geo, 'properties': p}


def hydrogen(data, countries):
    rows = records_from_rows(xlsx_rows(data, 'Projects'), {'ref', 'projectname', 'country', 'latitude', 'longitude'})
    result = []
    for row in rows:
        reference = number(row.get('Ref'))
        country = countries.get(norm(row.get('Country')))
        if reference is None or country is None: continue
        geo = geometry(row.get('Longitude'), row.get('Latitude'))
        result.append(make_record('hydrogen', f'{reference:g}', row['Project name'], country, row.get('Status'), row.get('Technology'), number(row.get('Capacity_kt H2/y')), 'kt H₂/year', row.get('Date online'), geo=geo, accuracy='Source coordinates; accuracy not specified', notes='Hydrogen output capacity is source-normalised and may be estimated. It is not measured output. Electrolyser MWel is stored separately.', electrolyser_mw=number(row.get('Capacity_MWel')), source_references=str(row.get('References') or '')))
    return result


def geothermal(data, countries):
    rows = records_from_rows(xlsx_rows(data, 'Data'), {'countryarea', 'projectname', 'gemunitid'})
    result = []
    for row in rows:
        country = countries.get(norm(row.get('Country/Area')))
        if country is None: continue
        unit = str(row.get('Unit Name') or '').strip()
        name = row['Project Name'] + (f' — unit {unit}' if unit not in {'', '--'} else '')
        geo = geometry(row.get('Longitude'), row.get('Latitude'))
        result.append(make_record('geothermal', row['GEM unit ID'], name, country, row.get('Status'), row.get('Technology'), number(row.get('Unit Capacity (MW)')), 'MW', row.get('Start Year'), row.get('Operator') or row.get('Owner'), geo=geo, accuracy=str(row.get('Location Accuracy') or 'Source coordinates; accuracy not specified'), notes='Generating-unit record. Multiple units may share a plant and location. Capacity is nameplate MW.', source_url=row.get('Wiki URL') or None, site_id=row.get('GEM location ID'), data_center_ppa=row.get('Data Center PPA'), green_hydrogen_producing=row.get('Green Hydrogen Producing')))
    return result


def carbon_capture(data, countries):
    if not data.startswith(b'SQLite format 3'): raise ValueError('CCUS source is not a SQLite database.')
    result = []
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / 'source.sqlite'; path.write_bytes(data)
        connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True); connection.row_factory = sqlite3.Row
        for source in connection.execute("SELECT f.*,i.* FROM facilities f JOIN facility_i18n i ON f.id=i.facility_id AND i.lang='en'"):
            row = dict(source); country = countries.get(norm(row.get('country')))
            if country is None: continue
            precision = str(row.get('precision') or '').lower()
            geo = geometry(row.get('lng'), row.get('lat')) if precision in {'exact', 'site', 'facility', 'verified'} else None
            capacity = number(row.get('estimated_capacity'))
            announced_min, announced_max = number(row.get('announced_capacity_min')), number(row.get('announced_capacity_max'))
            if announced_min is not None and announced_min == announced_max: capacity = announced_min
            raw_status = row.get('status')
            notes = f"Project type: {row.get('type') or 'not reported'}. Carbon fate: {row.get('fate_of_carbon') or 'not reported'}. Announced capacity: {row.get('announced_capacity_raw') or 'not reported'} Mt CO₂/year. Capacity is not measured carbon removed or net avoided emissions."
            source_url = None
            if 'in salah' in str(row.get('name')).lower():
                raw_status = 'Suspended'; source_url = 'https://sequestration.mit.edu/tools/projects/in_salah.html'
                notes += ' Status correction: injection suspended in June 2011, per MIT project factsheet.'
            result.append(make_record('carbonCapture', row['id'], row['name'], country, raw_status, row.get('capture_technology') or row.get('type'), capacity, 'Mt CO₂/year', row.get('operation'), row.get('operator'), geo=geo, accuracy=f'Mirror location precision: {precision}', notes=notes, source_url=source_url, project_type=row.get('type'), source_location_precision=precision))
        connection.close()
    return result


def emissions(countries):
    all_rows, seen = [], set(); offset = 0; hasher = hashlib.sha256()
    while True:
        url = SOURCES['emissions']['download_url'].replace('offset=0', f'offset={offset}')
        data = fetch(url); hasher.update(data); page = json.loads(data)
        if not isinstance(page, list): raise ValueError('Unexpected Climate TRACE API envelope.')
        if not page: break
        new = 0
        for row in page:
            key = (row.get('id'), row.get('year'), row.get('gas'))
            if key in seen: continue
            seen.add(key); new += 1
            if row.get('year') != 2025 or row.get('gas') != 'co2e_100yr' or row.get('sector') != 'power': raise ValueError('Climate TRACE returned a different gas, year, or sector.')
            country = countries.get(norm(row.get('country')))
            if country is None: raise ValueError('Climate TRACE returned non-African coverage.')
            if row.get('sourceType') != 'point-source': continue
            quantity = number(row.get('emissionsQuantity'))
            centroid = row.get('centroid') or {}; geo = geometry(centroid.get('longitude'), centroid.get('latitude'))
            record = make_record('emissions', str(row['id']), row['name'], country, 'Estimated inventory', row.get('assetType') or row.get('subsector'), quantity, 't CO₂e/year', 2025, geo=geo, accuracy='Climate TRACE source centroid', notes='2025 estimated power-sector emissions; AR6 GWP100. Activity and capacity fields with restricted licensing are not redistributed.', source_url='https://www.climatetrace.org/explore')
            record['properties'].update(status='inventory', emissions_tonnes=quantity, gas='co2e_100yr')
            all_rows.append(record)
        if new == 0: raise ValueError('Climate TRACE pagination repeated a page.')
        offset += len(page)
        if offset > 10000: raise ValueError('Unexpected power inventory size; inspect pagination before importing.')
    return all_rows, hasher.hexdigest()


def validate(records, key):
    if not records: raise ValueError(f'{key}: no African records; refusing to publish an empty success.')
    identifiers = [record['properties']['id'] for record in records]
    if len(identifiers) != len(set(identifiers)): raise ValueError(f'{key}: duplicate record IDs.')
    for record in records:
        props = record['properties']
        if not props['name'] or not props['iso3'] or props['dataset'] != key: raise ValueError('Invalid identity or coverage.')
        for field in ['capacity_value', 'emissions_tonnes']:
            value = props[field]
            if value is not None and (not math.isfinite(value) or value < 0): raise ValueError(f'Invalid {field}.')
        if not props['source_url'].startswith('https://'): raise ValueError('Unexpected source link protocol.')


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--validate-only', action='store_true'); args = parser.parse_args()
    if args.validate_only:
        for key, filename in FILES.items(): validate(json.loads((OUT / filename).read_text())['features'], key)
        print('All transition snapshots validated.'); return
    countries = country_index(); generated = datetime.now(timezone.utc).isoformat(); outputs = {}; manifest = {'generated_at': generated, 'datasets': {}}
    for key in SOURCES:
        print(f'Fetching {key}…', flush=True)
        if key == 'emissions': records, digest = emissions(countries)
        else:
            data = fetch(SOURCES[key]['download_url']); digest = hashlib.sha256(data).hexdigest()
            records = {'hydrogen': hydrogen, 'geothermal': geothermal, 'carbonCapture': carbon_capture}[key](data, countries)
        validate(records, key)
        records.sort(key=lambda record: (record['properties']['country'], record['properties']['name'], record['properties']['id']))
        outputs[FILES[key]] = {'type': 'FeatureCollection', 'features': records}
        manifest['datasets'][key] = {**SOURCES[key], 'retrieved_at': generated, 'sha256': digest, 'record_count': len(records), 'mapped_count': sum(record['geometry'] is not None for record in records), 'country_count': len({record['properties']['iso3'] for record in records})}
        print(f'{key}: {len(records)} records, {manifest["datasets"][key]["mapped_count"]} source locations', flush=True)
    # Write only after all four sources and invariants pass; never replace valid
    # snapshots with empty collections on a download or schema failure.
    OUT.mkdir(parents=True, exist_ok=True)
    outputs['manifest.json'] = manifest
    for filename, data in outputs.items():
        temporary = OUT / (filename + '.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
        os.replace(temporary, OUT / filename)
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()

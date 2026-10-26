const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers.cjs');
const { calculateEmissionsScenario, filterTransitionRecords, exportTransitionCsv, formatCapacity } = loadTypeScript('lib/transition.ts');
const { prepareTransitionMapData } = loadTypeScript('components/map/transitionMapData.ts');

const record = (id, fields = {}, geometry = null) => ({ type: 'Feature', geometry, properties: {
  id, dataset: 'hydrogen', name: 'Example project', country: 'Kenya', iso3: 'KEN',
  status: 'planned', source_status: 'Feasibility study', technology: 'Electrolysis',
  capacity_value: null, capacity_unit: 'kt H₂/year', source: 'IEA',
  source_url: 'https://www.iea.org/', source_release: '2025 source snapshot',
  location_accuracy: 'Not published', notes: '', ...fields,
} });

test('scenario arithmetic preserves tonnes and separates activity change from reduction', () => {
  const result = calculateEmissionsScenario(1000000, 50, 20);
  assert.equal(result.activityAdjusted, 1500000);
  assert.equal(result.scenario, 1200000);
  assert.equal(result.difference, -200000);
  assert.equal(calculateEmissionsScenario(100, 0, 100).scenario, 0);
  assert.equal(calculateEmissionsScenario(100, 0, 0).scenario, 100);
  for (const values of [[0, 0, 20], [-1, 0, 20], [NaN, 0, 20], [100, 201, 20], [100, 0, -1], [100, 0, 101]]) {
    assert.throws(() => calculateEmissionsScenario(...values));
  }
});

test('search combines dataset, country, and source status without treating missing capacity as zero', () => {
  const records = [record('h1'), record('h2', { status: 'operating', capacity_value: 0 }), record('g1', { dataset: 'geothermal', technology: 'Flash steam', capacity_unit: 'MW' }), record('h3', { country: 'Namibia', iso3: 'NAM' })];
  assert.deepEqual(Array.from(filterTransitionRecords(records, { dataset: 'hydrogen', country: 'KEN', status: 'planned', query: 'electrolysis' }), (row) => row.properties.id), ['h1']);
  assert.equal(formatCapacity(records[0].properties), 'Not reported');
  assert.equal(formatCapacity(records[1].properties), '0 kt H₂/year');
});

test('CSV exports source attribution and safely escapes spreadsheet formulas and multiline text', () => {
  const records = [record('h1', { name: '=HYPERLINK("bad")', notes: 'A note, with commas\nand another line' })];
  const csv = exportTransitionCsv(records);
  assert.ok(csv.startsWith('"id","dataset"'));
  assert.ok(csv.includes('https://www.iea.org/'));
  assert.ok(csv.includes('2025 source snapshot'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"A note, with commas\nand another line"'));
  assert.ok(csv.split('\r\n')[0].endsWith('"longitude","latitude"'));
});

test('map displays source points and country coverage for unlocated records without inventing coordinates', () => {
  const geometry = { type: 'Polygon', coordinates: [[[33, -1], [34, -1], [34, 0], [33, -1]]] };
  const countries = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry, properties: { name: 'Kenya', iso3: 'KEN' } }] };
  const raw = { type: 'FeatureCollection', features: [record('missing'), record('known', {}, { type: 'Point', coordinates: [36.8, -1.3] })] };
  const result = prepareTransitionMapData('hydrogen', raw, countries, []);
  assert.equal(result.features.length, 2);
  assert.equal(result.features[0].geometry.type, 'Point');
  assert.equal(result.features[1].geometry.type, 'Polygon');
  assert.equal(result.features[1].properties.record_count, 1);
  assert.equal(result.features[1].properties.record_kind, 'country_summary');
  assert.ok(result.features[1].properties.location_accuracy.includes('not a project location'));
  assert.equal(raw.features[0].geometry, null);
  assert.equal(prepareTransitionMapData('hydrogen', raw, countries, ['ZA']).features.length, 0);
});

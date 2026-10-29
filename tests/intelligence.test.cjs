const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { loadTypeScript } = require('./helpers.cjs');
const { analyseSite, SITE_LAYERS } = loadTypeScript('lib/site-check.ts');
const { readShortlist, siteBrief, KENYA_STARTERS } = loadTypeScript('lib/intelligence.ts');

function fixture() {
  const source = { name: 'Test source', release: 'Source snapshot unavailable', url: 'https://example.com/source', count: 0, omitted: 0, note: 'Coverage gap' };
  const countries = [{ type: 'Feature', properties: { name: 'Kenya' }, geometry: { type: 'Polygon', coordinates: [[[33,-5],[42,-5],[42,6],[33,6],[33,-5]]] } }];
  const layers = Object.fromEntries(SITE_LAYERS.map(key => [key, { source: { ...source }, assets: [] }]));
  const report = analyseSite({ label: 'Test site', latitude: -1.2921, longitude: 36.8219, radiusKm: 50 }, { version: 'test-fingerprint', countries, water: [], layers });
  report.id = 'report-test';
  return report;
}

test('shortlist tolerates corrupt storage and rejects malformed or non-Kenyan reports', () => {
  assert.equal(readShortlist('not JSON').length, 0);
  assert.equal(readShortlist('{"id":1}').length, 0);
  const report = fixture();
  assert.equal(readShortlist(JSON.stringify([report])).length, 1);
  for (const invalid of [{ ...report, country: 'Uganda' }, { ...report, nearest: {} }, { ...report, site: null }, { ...report, fuelMix: [null] }]) {
    assert.equal(readShortlist(JSON.stringify([invalid])).length, 0);
  }
  assert.equal(readShortlist(JSON.stringify(Array(10).fill(report))).length, 5);
});

test('brief keeps provenance, radius and unknowns alongside missing infrastructure evidence', () => {
  const report = fixture();
  const text = siteBrief([report]);
  for (const expected of ['Test site', '50 km radius', 'test-fingerprint', 'Source snapshot unavailable', 'https://example.com/source', 'Grid proximity does not establish', ...report.unknowns, ...report.methodology]) assert.ok(text.includes(expected), expected);
  assert.equal(report.water.score, null);
  assert.equal(report.nearest.substations.length, 0);
});

test('Kenyan starter coordinates are inside the committed country boundaries', () => {
  const { polygonMatch } = loadTypeScript('lib/site-check.ts');
  const countries = JSON.parse(fs.readFileSync('public/data/admin/africa_admin0.geojson', 'utf8'));
  const kenya = countries.features.find(feature => feature.properties.name === 'Kenya');
  assert.ok(kenya);
  for (const site of KENYA_STARTERS) assert.equal(polygonMatch([site.longitude, site.latitude], kenya.geometry), 'inside', site.label);
});

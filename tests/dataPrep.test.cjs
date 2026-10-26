const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers.cjs');

const empty = { type: 'FeatureCollection', features: [] };
const hidden = {
  plants: false, transmission: false, substations: false, dataCenters: false,
  waterStress: false, submarineCables: false, plannedUpgrades: false,
  admin0: false, admin1: false, admin2: false, placeLabels: false,
};
const ok = (value = empty) => ({ ok: true, json: async () => value });

test('disabled layers are deferred and successful layers are reused when enabled again', async () => {
  const calls = [];
  const { loadAndPreparePowerGridData: load } = loadTypeScript('components/map/dataPrep.ts', {
    fetch: async (url, options) => { calls.push({ url, options }); return ok(); },
  });
  await load({ visibleLayers: hidden });
  assert.deepEqual(calls.map((c) => c.url), ['/data/plants/africa_power_plants.geojson']);
  const enabled = { ...hidden, substations: true };
  await load({ visibleLayers: enabled });
  await load({ visibleLayers: hidden });
  await load({ visibleLayers: enabled });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, '/data/grid/africa_substations.geojson');
  assert.ok(calls.every((c) => c.options?.cache !== 'no-store'));
});

test('failed layers report errors, preserve successful progress, and retry independently', async () => {
  const calls = [];
  let fail = true;
  const { loadAndPreparePowerGridData: load } = loadTypeScript('components/map/dataPrep.ts', {
    fetch: async (url) => {
      calls.push(url);
      return fail && url.includes('substations') ? { ok: false } : ok();
    },
  });
  const layers = [];
  const visibleLayers = { ...hidden, substations: true };
  await assert.rejects(load({ visibleLayers, onLayerLoaded: (layer) => layers.push(layer) }), /substations/);
  assert.equal(layers.length, 1);
  assert.ok(layers[0].plants);
  fail = false;
  const data = await load({ visibleLayers });
  assert.equal(data.substations.features.length, 0);
  assert.equal(calls.filter((url) => url.includes('plants')).length, 1);
  assert.equal(calls.filter((url) => url.includes('substations')).length, 2);
});

test('network failures, invalid JSON and invalid collections are retryable errors', async () => {
  for (const failure of [
    async () => { throw new Error('offline'); },
    async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }),
    async () => ok({ type: 'FeatureCollection', features: null }),
  ]) {
    let fetch = failure;
    const { loadAndPreparePowerGridData: load } = loadTypeScript('components/map/dataPrep.ts', {
      fetch: (...args) => fetch(...args),
    });
    await assert.rejects(load({ visibleLayers: hidden }), /plants/);
    fetch = async () => ok();
    const data = await load({ visibleLayers: hidden });
    assert.equal(data.plants.totalPlants, 0);
  }
});

test('labels load their boundary sources even when boundary lines are hidden', async () => {
  const calls = [];
  const { loadAndPreparePowerGridData: load } = loadTypeScript('components/map/dataPrep.ts', {
    fetch: async (url) => { calls.push(url); return ok(); },
  });
  await load({ visibleLayers: { ...hidden, placeLabels: true } });
  assert.ok(calls.includes('/data/admin/africa_admin0.geojson'));
  assert.ok(calls.includes('/data/admin/africa_admin1.geojson'));
  assert.ok(calls.includes('/data/admin/africa_places.geojson'));
  assert.ok(!calls.includes('/data/admin/africa_admin2.geojson'));
});

test('plants publish before a slow grid layer completes and concurrent loads share requests', async () => {
  const calls = [];
  let releaseGrid;
  const grid = new Promise((resolve) => { releaseGrid = () => resolve(ok()); });
  const { loadAndPreparePowerGridData: load } = loadTypeScript('components/map/dataPrep.ts', {
    fetch: async (url) => {
      calls.push(url);
      return url.includes('transmission') ? grid : ok();
    },
  });
  const visibleLayers = { ...hidden, transmission: true };
  let plantsReady;
  const ready = new Promise((resolve) => { plantsReady = resolve; });
  let finished = false;
  const first = load({ visibleLayers, onLayerLoaded: (layer) => {
    if (layer.plants) plantsReady();
  } }).then(() => { finished = true; });
  const second = load({ visibleLayers });
  await ready;
  assert.equal(finished, false);
  releaseGrid();
  await Promise.all([first, second]);
  assert.equal(calls.length, 2);
});

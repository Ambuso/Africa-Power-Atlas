/* ==================== components/map/mapStyles.ts ====================
 * All data-overlay sources + layers.
 *
 * Key changes vs previous:
 *  - Power plants now have a THREE-LAYER stack: outer pulse, mid glow, core dot.
 *    The outer pulse scales with capacity so big plants dominate visually (hierarchy).
 *  - Data centers get the same pulsing treatment.
 *  - Africa's admin0 borders have a strong cyan glow (keeps the "continent lit up" look)
 *    while other continents' borders (if ever rendered) stay muted.
 * ==================================================== */

import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, LayerVisibility, ViewMode } from '@/lib/types';

/* ─────────── IDs ─────────── */

export const SOURCE_IDS = {
  plants: 'plants-src',
  transmission: 'transmission-src',
  substations: 'substations-src',
  dataCenters: 'data-centers-src',
  waterStress: 'water-stress-src',
  submarineCables: 'submarine-cables-src',
  plannedUpgrades: 'planned-upgrades-src',
  admin0: 'admin0-src',
  admin1: 'admin1-src',
  admin2: 'admin2-src',
  placeLabels: 'place-labels-src',
} as const;

export const LAYER_IDS = {
  waterStress: 'water-stress-fill',
  admin2: 'admin2-line',
  admin1: 'admin1-line',
  admin0Glow: 'admin0-glow',
  admin0: 'admin0-line',
  submarineCables: 'submarine-cables-line',
  transmission: 'transmission-line',
  plannedUpgrades: 'planned-upgrades-line',

  substationsGlow: 'substations-glow',
  substations: 'substations-circle',

  // Data centers — three layers for hierarchy
  dataCentersPulse: 'data-centers-pulse',
  dataCentersGlow: 'data-centers-glow',
  dataCenters: 'data-centers-circle',

  plantsHeatmap: 'plants-heatmap',

  // Plants — three layers for hierarchy
  plantsPulse: 'plants-pulse',
  plantsGlow: 'plants-glow',
  plants: 'plants-circle',

  plantsDiamond: 'plants-diamond',
  plantsClusters: 'plants-clusters',
  plantsClusterCount: 'plants-cluster-count',

  admin1Label: 'admin1-label',
  admin0Label: 'admin0-label',
  capitalLabel: 'capital-label',
  placeLabel: 'place-label',
} as const;

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

/* Resting opacities — also the end values of MapCanvas' fade-in animation.
 * Borders are kept quiet so plants and grid lines carry the map. */
export const ADMIN0_GLOW_OPACITY = 0.14;
export const ADMIN0_LINE_OPACITY = 0.55;
export const SUBMARINE_CABLE_OPACITY = 0.5;

const DIAMOND_CAPACITY_SIZE = [
  'interpolate', ['linear'],
  ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
  0, 0.25, 100, 0.4, 500, 0.6, 1000, 0.8, 5000, 1.15,
];

/** Scale a data-driven radius with zoom so markers don't swamp the continent view. */
export function zoomScaled(expr: unknown): any {
  return ['interpolate', ['linear'], ['zoom'], 2, ['*', 0.45, expr], 5, ['*', 0.8, expr], 9, ['*', 1.2, expr]];
}

/* ─────────── typography ─────────── */

// Single-font stacks: glyph servers (OpenFreeMap, MapTiler) serve one font
// per request, and a combined stack 404s and silently drops every label.
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_ITALIC = ['Noto Sans Italic'];

/* ─────────── helpers ─────────── */

function ensureSource(
  map: MapLibreMap,
  id: string,
  opts: { cluster?: boolean; clusterRadius?: number; clusterMaxZoom?: number } = {},
) {
  if (map.getSource(id)) return;
  map.addSource(id, {
    type: 'geojson',
    data: EMPTY_FC,
    cluster: opts.cluster ?? false,
    clusterRadius: opts.clusterRadius ?? 50,
    clusterMaxZoom: opts.clusterMaxZoom ?? 6,
    clusterProperties: opts.cluster
      ? {
          sum_mw: ['+', ['coalesce', ['to-number', ['get', 'capacity_mw']], 0]],
        }
      : undefined,
    generateId: true,
  });
}

function ensureLayer(map: MapLibreMap, layer: any, beforeId?: string) {
  if (map.getLayer(layer.id)) return;
  if (beforeId && map.getLayer(beforeId)) {
    map.addLayer(layer, beforeId);
  } else {
    map.addLayer(layer);
  }
}

function firstSymbolId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((l) => l.type === 'symbol')?.id;
}

/* ─────────── main installer ─────────── */

export function installMapDataLayers(map: MapLibreMap) {
  ensureSource(map, SOURCE_IDS.plants, { cluster: true, clusterRadius: 45, clusterMaxZoom: 5 });
  ensureSource(map, SOURCE_IDS.transmission);
  ensureSource(map, SOURCE_IDS.substations);
  ensureSource(map, SOURCE_IDS.dataCenters);
  ensureSource(map, SOURCE_IDS.waterStress);
  ensureSource(map, SOURCE_IDS.submarineCables);
  ensureSource(map, SOURCE_IDS.plannedUpgrades);
  ensureSource(map, SOURCE_IDS.admin0);
  ensureSource(map, SOURCE_IDS.admin1);
  ensureSource(map, SOURCE_IDS.admin2);
  ensureSource(map, SOURCE_IDS.placeLabels);

  const beforeLabels = firstSymbolId(map);

  /* ── water stress ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.waterStress,
      type: 'fill',
      source: SOURCE_IDS.waterStress,
      paint: {
        'fill-color': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'stress']], 0],
          0, '#0c4a6e',
          0.5, '#3b82f6',
          1, '#f59e0b',
          2, '#dc2626',
        ],
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.08,
          5, 0.14,
          8, 0.2,
        ],
        'fill-outline-color': 'rgba(255,255,255,0.05)',
      },
    },
    beforeLabels,
  );

  /* ── admin2 ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.admin2,
      type: 'line',
      source: SOURCE_IDS.admin2,
      minzoom: 3.5,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'none',
      },
      paint: {
        'line-color': 'rgba(148,163,184,0.55)',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          3.5, 0.45,
          6, 0.9,
          9, 1.4,
          12, 1.8,
        ],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          3.5, 0.18,
          5, 0.32,
          8, 0.5,
          11, 0.65,
        ],
        'line-dasharray': [2, 2],
        'line-blur': 0.2,
      },
    },
    beforeLabels,
  );

  /* ── admin1 ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.admin1,
      type: 'line',
      source: SOURCE_IDS.admin1,
      minzoom: 2.2,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': 'rgba(226,232,240,0.82)',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2.2, 0.8,
          4, 1.2,
          7, 1.8,
          10, 2.4,
        ],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          2.2, 0.32,
          4, 0.55,
          7, 0.82,
          10, 0.95,
        ],
        'line-dasharray': [3, 2],
        'line-blur': 0.15,
      },
    },
    beforeLabels,
  );

  /* ── admin0 glow (outer halo, strong cyan) ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.admin0Glow,
      type: 'line',
      source: SOURCE_IDS.admin0,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#22d3ee',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2, 4, 3.5, 8, 6],
        'line-opacity': ADMIN0_GLOW_OPACITY,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 1, 2, 8, 4],
      },
    },
    beforeLabels,
  );

  /* ── admin0 line (crisp core cyan stroke — this is what "lights up Africa") ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.admin0,
      type: 'line',
      source: SOURCE_IDS.admin0,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#7dd3fc',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 4, 0.9, 8, 1.6],
        'line-opacity': ADMIN0_LINE_OPACITY,
      },
    },
    beforeLabels,
  );

  /* ── submarine cables ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.submarineCables,
      type: 'line',
      source: SOURCE_IDS.submarineCables,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#22d3ee',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 6, 1.6, 10, 2.8],
        'line-opacity': SUBMARINE_CABLE_OPACITY,
        'line-dasharray': [3, 2],
      },
    },
    beforeLabels,
  );

  /* ── transmission ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.transmission,
      type: 'line',
      source: SOURCE_IDS.transmission,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match', ['get', 'voltage_class'],
          '735kV+', '#ef4444',
          '500-734kV', '#f97316',
          '345-499kV', '#fbbf24',
          '230-344kV', '#38bdf8',
          '100-229kV', '#22c55e',
          '31-99kV', '#a78bfa',
          '#64748b',
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          3, [
            'match', ['get', 'voltage_class'],
            '735kV+', 1.4, '500-734kV', 1.1, '345-499kV', 0.9,
            '230-344kV', 0.7, '100-229kV', 0.55, '31-99kV', 0.4,
            0.4,
          ],
          8, [
            'match', ['get', 'voltage_class'],
            '735kV+', 4.5, '500-734kV', 3.5, '345-499kV', 2.8,
            '230-344kV', 2.2, '100-229kV', 1.8, '31-99kV', 1.3,
            1.5,
          ],
        ],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.35, 5, 0.6, 8, 0.88],
      },
    },
    beforeLabels,
  );

  /* ── planned upgrades ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plannedUpgrades,
      type: 'line',
      source: SOURCE_IDS.plannedUpgrades,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#fbbf24',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 3],
        'line-opacity': 0.85,
        'line-dasharray': [2, 2],
      },
    },
    beforeLabels,
  );

  /* ─────────── substations (glow + core) ─────────── */

  ensureLayer(
    map,
    {
      id: LAYER_IDS.substationsGlow,
      type: 'circle',
      source: SOURCE_IDS.substations,
      paint: {
        'circle-color': '#e0f2fe',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 6, 10, 10],
        'circle-opacity': 0.22,
        'circle-blur': 0.8,
      },
    },
    beforeLabels,
  );

  ensureLayer(
    map,
    {
      id: LAYER_IDS.substations,
      type: 'circle',
      source: SOURCE_IDS.substations,
      paint: {
        'circle-color': '#e0f2fe',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 3, 10, 5],
        'circle-stroke-color': '#0c4a6e',
        'circle-stroke-width': 1,
        'circle-opacity': 0.9,
      },
    },
    beforeLabels,
  );

  /* ─────────── data centers (pulse + glow + core = hierarchy) ─────────── */

  // Outer pulse — biggest, most diffuse, scales with power if available
  ensureLayer(
    map,
    {
      id: LAYER_IDS.dataCentersPulse,
      type: 'circle',
      source: SOURCE_IDS.dataCenters,
      paint: {
        'circle-color': '#67e8f9',
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'power_mw']], ['to-number', ['get', 'capacity_mw']], 20],
          0, 12,
          10, 18,
          50, 26,
          200, 38,
          1000, 54,
        ],
        'circle-opacity': 0.12,
        'circle-blur': 1.0,
      },
    },
    beforeLabels,
  );

  // Mid glow — moderate
  ensureLayer(
    map,
    {
      id: LAYER_IDS.dataCentersGlow,
      type: 'circle',
      source: SOURCE_IDS.dataCenters,
      paint: {
        'circle-color': '#67e8f9',
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'power_mw']], ['to-number', ['get', 'capacity_mw']], 20],
          0, 6,
          10, 9,
          50, 13,
          200, 19,
          1000, 28,
        ],
        'circle-opacity': 0.28,
        'circle-blur': 0.6,
      },
    },
    beforeLabels,
  );

  // Crisp core
  ensureLayer(
    map,
    {
      id: LAYER_IDS.dataCenters,
      type: 'circle',
      source: SOURCE_IDS.dataCenters,
      paint: {
        'circle-color': '#67e8f9',
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'power_mw']], ['to-number', ['get', 'capacity_mw']], 20],
          0, 3,
          10, 4,
          50, 5.5,
          200, 7.5,
          1000, 10,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.2,
        'circle-opacity': 0.95,
      },
    },
    beforeLabels,
  );

  /* ─────────── plants heatmap ─────────── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plantsHeatmap,
      type: 'heatmap',
      source: SOURCE_IDS.plants,
      maxzoom: 7,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'capacity_mw']], 0],
          0, 0,
          100, 0.3,
          500, 0.6,
          1500, 0.9,
          5000, 1,
        ],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 2.8],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.15, 'rgba(14,165,233,0.25)',
          0.35, 'rgba(34,211,238,0.45)',
          0.55, 'rgba(250,204,21,0.6)',
          0.75, 'rgba(249,115,22,0.78)',
          1, 'rgba(239,68,68,0.88)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 6, 32],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 5, 1, 7, 0],
      },
    },
    beforeLabels,
  );

  /* ─────────── plants (pulse + glow + core for hierarchy) ─────────── */

  // Outer pulse — BIGGEST, scales strongly with capacity so 5GW plants dominate
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plantsPulse,
      type: 'circle',
      source: SOURCE_IDS.plants,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
          0, 12,
          100, 20,
          500, 32,
          1000, 46,
          5000, 70,
        ],
        'circle-opacity': 0.1,
        'circle-blur': 1.1,
      },
    },
    beforeLabels,
  );

  // Mid glow
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plantsGlow,
      type: 'circle',
      source: SOURCE_IDS.plants,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
          0, 7, 100, 12, 500, 19, 1000, 27, 5000, 42,
        ],
        'circle-opacity': 0.32,
        'circle-blur': 0.7,
      },
    },
    beforeLabels,
  );

  // Crisp core dot
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plants,
      type: 'circle',
      source: SOURCE_IDS.plants,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
          0, 3, 100, 5, 500, 8, 1000, 11, 5000, 16,
        ],
        'circle-stroke-color': 'rgba(255,255,255,0.5)',
        'circle-stroke-width': 0.7,
        'circle-opacity': 1,
      },
    },
    beforeLabels,
  );

  /* ── plant diamonds (alternate Points view) ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plantsDiamond,
      type: 'symbol',
      source: SOURCE_IDS.plants,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'plant-diamond',
        // Capacity sets relative size; zoom keeps the continent view uncluttered.
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          2, ['*', 0.32, DIAMOND_CAPACITY_SIZE],
          5, ['*', 0.6, DIAMOND_CAPACITY_SIZE],
          9, ['*', 1, DIAMOND_CAPACITY_SIZE],
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': ['coalesce', ['get', 'color'], '#22d3ee'],
        'icon-halo-color': 'rgba(255,255,255,0.9)',
        'icon-halo-width': 1,
        'icon-halo-blur': 0.3,
        'icon-opacity': 1,
      },
    },
  );

  /* ── cluster bubbles ── */
  ensureLayer(
    map,
    {
      id: LAYER_IDS.plantsClusters,
      type: 'circle',
      source: SOURCE_IDS.plants,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#22d3ee',
          10, '#38bdf8',
          50, '#818cf8',
          200, '#a855f7',
          500, '#ec4899',
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          14, 10, 18, 50, 24, 200, 32, 500, 40,
        ],
        'circle-stroke-color': 'rgba(255,255,255,0.85)',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9,
      },
    },
    beforeLabels,
  );

  ensureLayer(
    map,
    {
      id: LAYER_IDS.plantsClusterCount,
      type: 'symbol',
      source: SOURCE_IDS.plants,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': [
          'case',
          ['>=', ['get', 'point_count'], 1000],
          ['concat', ['number-format', ['/', ['get', 'point_count'], 1000], { 'max-fraction-digits': 1 }], 'k'],
          ['get', 'point_count_abbreviated'],
        ],
        'text-font': FONT_BOLD,
        'text-size': ['step', ['get', 'point_count'], 11, 50, 12, 200, 13],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(2,6,23,0.85)',
        'text-halo-width': 1,
      },
    },
  );

  /* ── labels ── */
  ensureLayer(map, {
    id: LAYER_IDS.admin1Label,
    type: 'symbol',
    source: SOURCE_IDS.admin1,
    minzoom: 4,
    // dataPrep.prepareAdminBoundaries guarantees:
    //   - `name` exists and is non-empty
    //   - `name` is a true subnational name (never the country name)
    // Features that don't satisfy these are dropped at load time, so
    // the layer just renders whatever `name` contains.
    filter: ['has', 'name'],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT_ITALIC,
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 6, 11, 9, 13],
      'text-letter-spacing': 0.08,
      'text-transform': 'uppercase',
      'text-max-width': 8,
      'text-padding': 25,
      'text-allow-overlap': false,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': 'rgba(226,232,240,0.78)',
      'text-halo-color': 'rgba(2,6,23,0.95)',
      'text-halo-width': 1.5,
      'text-halo-blur': 0.8,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5, 0.7, 8, 0.98],
    },
  });

  ensureLayer(map, {
    id: LAYER_IDS.admin0Label,
    type: 'symbol',
    source: SOURCE_IDS.admin0,
    // Hide country labels once user zooms into a country — past z=5 the
    // admin1 (region) and place labels take over.
    maxzoom: 5,
    filter: ['has', 'name'],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT_BOLD,
      'text-size': ['interpolate', ['linear'], ['zoom'], 1.5, 10, 3, 12, 5, 15],
      'text-letter-spacing': 0.14,
      'text-transform': 'uppercase',
      'text-max-width': 7,
      // Massive padding so same-name labels collide and get culled
      'text-padding': 60,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': '#f8fafc',
      'text-halo-color': 'rgba(2,6,23,0.96)',
      'text-halo-width': 2,
      'text-halo-blur': 0.9,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 1.5, 1, 4, 1, 5, 0],
    },
  });

  ensureLayer(map, {
    id: LAYER_IDS.capitalLabel,
    type: 'symbol',
    source: SOURCE_IDS.placeLabels,
    minzoom: 2.5,
    filter: ['==', ['get', 'capital'], true],
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name'], ''],
      'text-font': FONT_BOLD,
      'text-size': ['interpolate', ['linear'], ['zoom'], 2.5, 11, 5, 13, 8, 16],
      'text-anchor': 'top',
      'text-offset': [0, 0.7],
      'text-padding': 6,
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#fef3c7',
      'text-halo-color': 'rgba(2,6,23,0.95)',
      'text-halo-width': 1.6,
      'text-halo-blur': 0.5,
    },
  });

  ensureLayer(map, {
    id: LAYER_IDS.placeLabel,
    type: 'symbol',
    source: SOURCE_IDS.placeLabels,
    minzoom: 3,
    filter: ['!=', ['get', 'capital'], true],
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name'], ''],
      'text-font': FONT_REGULAR,
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 12, 9, 14],
      'text-anchor': 'top',
      'text-offset': [0, 0.6],
      'text-padding': 4,
      'text-max-width': 9,
    },
    paint: {
      'text-color': 'rgba(203,213,225,0.94)',
      'text-halo-color': 'rgba(2,6,23,0.92)',
      'text-halo-width': 1.4,
    },
  });
}

/* ─────────── data updates ─────────── */

export function updateSourceData(
  map: MapLibreMap,
  sourceId: string,
  data?: FeatureCollection | null,
) {
  const src = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(data ?? EMPTY_FC);
}

/* ─────────── visibility ─────────── */

export function applyLayerVisibility(
  map: MapLibreMap,
  v: LayerVisibility,
  viewMode: ViewMode = 'cluster',
) {
  const plantsVisible = v.plants;
  const heatmapMode = viewMode === 'heatmap';
  const clusterMode = viewMode === 'cluster';

  // In cluster mode the glow/pulse attach to individual points only (cluster layer handles the rest)
  // In points mode, pulse+glow+core all show
  const showPulseAndGlow = plantsVisible && !heatmapMode;

  const visibilityMap: Record<string, boolean> = {
    [LAYER_IDS.waterStress]: v.waterStress,
    [LAYER_IDS.admin2]: v.admin2,
    [LAYER_IDS.admin1]: v.admin1,
    [LAYER_IDS.admin0]: v.admin0,
    [LAYER_IDS.admin0Glow]: v.admin0,
    [LAYER_IDS.submarineCables]: v.submarineCables,
    [LAYER_IDS.transmission]: v.transmission,
    [LAYER_IDS.plannedUpgrades]: v.plannedUpgrades,

    [LAYER_IDS.substations]: v.substations,
    [LAYER_IDS.substationsGlow]: v.substations,

    [LAYER_IDS.dataCenters]: v.dataCenters,
    [LAYER_IDS.dataCentersGlow]: v.dataCenters,
    [LAYER_IDS.dataCentersPulse]: v.dataCenters,

    [LAYER_IDS.plantsHeatmap]: plantsVisible && heatmapMode,

    [LAYER_IDS.plantsPulse]: showPulseAndGlow,
    [LAYER_IDS.plantsGlow]: showPulseAndGlow,
    [LAYER_IDS.plants]: showPulseAndGlow && !clusterMode,
    [LAYER_IDS.plantsDiamond]: plantsVisible && !heatmapMode && !clusterMode,
    [LAYER_IDS.plantsClusters]: plantsVisible && !heatmapMode && clusterMode,
    [LAYER_IDS.plantsClusterCount]: plantsVisible && !heatmapMode && clusterMode,

    [LAYER_IDS.admin0Label]: v.placeLabels,
    [LAYER_IDS.admin1Label]: v.placeLabels,
    [LAYER_IDS.capitalLabel]: v.placeLabels,
    [LAYER_IDS.placeLabel]: v.placeLabels,
  };

  for (const [id, visible] of Object.entries(visibilityMap)) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

/** Toggle clustering on the plants source */
export function setPlantsClustering(map: MapLibreMap, enabled: boolean) {
  const existing = map.getSource(SOURCE_IDS.plants) as GeoJSONSource | undefined;
  if (!existing) return;
  const currentData = (existing as any)._data ?? EMPTY_FC;

  const layersToRemove = [
    LAYER_IDS.plants,
    LAYER_IDS.plantsGlow,
    LAYER_IDS.plantsPulse,
    LAYER_IDS.plantsClusters,
    LAYER_IDS.plantsClusterCount,
    LAYER_IDS.plantsHeatmap,
    LAYER_IDS.plantsDiamond,
  ];
  for (const id of layersToRemove) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_IDS.plants)) map.removeSource(SOURCE_IDS.plants);

  map.addSource(SOURCE_IDS.plants, {
    type: 'geojson',
    data: currentData,
    cluster: enabled,
    clusterRadius: 45,
    clusterMaxZoom: 5,
    clusterProperties: enabled
      ? { sum_mw: ['+', ['coalesce', ['to-number', ['get', 'capacity_mw']], 0]] }
      : undefined,
    generateId: true,
  });

  installMapDataLayers(map);
}

/* ─────────── atmosphere + globe fix ─────────── */

export function maybeApplyAtmosphere(map: MapLibreMap, light = false) {
  try {
    map.setProjection({ type: 'globe' } as any);
  } catch {}

  try {
    if (typeof (map as any).setSky === 'function') {
      (map as any).setSky(
        light
          ? {
              'sky-color': '#bcd7f0',
              'sky-horizon-blend': 0.5,
              'horizon-color': '#e2edf8',
              'horizon-fog-blend': 0.6,
              'fog-color': '#f1f5f9',
              'fog-ground-blend': 0.3,
              'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
            }
          : {
              'sky-color': '#0a0f1d',
              'sky-horizon-blend': 0.5,
              'horizon-color': '#1e3a5f',
              'horizon-fog-blend': 0.6,
              'fog-color': '#060912',
              'fog-ground-blend': 0.35,
              'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
            },
      );
    }
  } catch {}
}

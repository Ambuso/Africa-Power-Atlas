/* ==================== components/map/mapStyles.ts ==================== */
/**
 * All data-overlay sources and layers live here (plants, grid, admin
 * boundaries, place labels). The basemap itself comes from mapThemes.ts
 * and is swapped with `map.setStyle()`; every time the style changes we
 * re-install these layers on top.
 *
 * Layer z-order (bottom → top):
 *   water-stress fill (context)
 *   admin2 line       (districts, zoom ≥ 5)
 *   admin1 line       (provinces/states, zoom ≥ 3)
 *   admin0 line       (national borders)
 *   submarine cables
 *   transmission lines
 *   planned upgrades (dashed)
 *   substations
 *   data centers
 *   plant glow
 *   plant circle
 *   admin1 labels (province names, zoom ≥ 4)
 *   admin0 labels (country names)  ← always on top
 *   place labels  (cities, capitals)
 */

import type { FeatureCollection, LayerVisibility } from '@/lib/types';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

export const SOURCE_IDS = {
  plants: 'plants-source',
  transmission: 'transmission-source',
  substations: 'substations-source',
  dataCenters: 'data-centers-source',
  waterStress: 'water-stress-source',
  submarineCables: 'submarine-cables-source',
  plannedUpgrades: 'planned-upgrades-source',
  admin0: 'admin0-source',
  admin1: 'admin1-source',
  admin2: 'admin2-source',
  placeLabels: 'place-labels-source',
} as const;

export const LAYER_IDS = {
  // data
  plantsGlow: 'plants-glow',
  plants: 'plants-circle',
  transmission: 'transmission-line',
  substations: 'substations-circle',
  dataCenters: 'data-centers-circle',
  waterStress: 'water-stress-fill',
  submarineCables: 'submarine-cables-line',
  plannedUpgrades: 'planned-upgrades-line',

  // admin boundaries
  admin0: 'admin0-line',
  admin0Glow: 'admin0-line-glow',
  admin1: 'admin1-line',
  admin2: 'admin2-line',

  // labels
  admin0Label: 'admin0-label',
  admin1Label: 'admin1-label',
  placeLabel: 'place-label',
  capitalLabel: 'capital-label',
} as const;

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

/* ─────────────── typography ─────────────── */

/**
 * Font stacks for SDF text. MapLibre will fall through this list until
 * it finds a font the style's glyph endpoint provides. Our glyph URL
 * (openmaptiles) has Noto Sans Regular/Bold/Italic universally.
 */
const FONT_BOLD = ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'];
const FONT_REGULAR = ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'];
const FONT_ITALIC = ['Noto Sans Italic', 'Open Sans Italic', 'Arial Unicode MS Regular'];

/* ─────────────── helpers ─────────────── */

function ensureSource(map: MapLibreMap, id: string) {
  if (map.getSource(id)) return;
  map.addSource(id, { type: 'geojson', data: EMPTY_FC });
}

function ensureLayer(map: MapLibreMap, layer: any, beforeId?: string) {
  if (map.getLayer(layer.id)) return;
  if (beforeId && map.getLayer(beforeId)) {
    map.addLayer(layer, beforeId);
  } else {
    map.addLayer(layer);
  }
}

/* ─────────────── main installer ─────────────── */

export function installMapDataLayers(map: MapLibreMap) {
  Object.values(SOURCE_IDS).forEach((id) => ensureSource(map, id));

  /* ─── 1. water stress (background context) ─── */
  ensureLayer(map, {
    id: LAYER_IDS.waterStress,
    type: 'fill',
    source: SOURCE_IDS.waterStress,
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'stress']], 0],
        0, '#0c4a6e',
        0.5, '#3b82f6',
        1, '#f59e0b',
        2, '#dc2626',
      ],
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        2, 0.08,
        5, 0.14,
        8, 0.18,
      ],
      'fill-outline-color': 'rgba(255,255,255,0.05)',
    },
  });

  /* ─── 2. admin2 boundaries (districts/counties) ─── */
  ensureLayer(map, {
    id: LAYER_IDS.admin2,
    type: 'line',
    source: SOURCE_IDS.admin2,
    minzoom: 5,
    paint: {
      'line-color': 'rgba(148, 163, 184, 0.35)',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        5, 0.25,
        8, 0.7,
        11, 1.1,
      ],
      'line-opacity': [
        'interpolate', ['linear'], ['zoom'],
        5, 0.0,
        6, 0.18,
        9, 0.4,
        12, 0.55,
      ],
      'line-dasharray': [2, 3],
    },
  });

  /* ─── 3. admin1 boundaries (provinces/states) ─── */
  ensureLayer(map, {
    id: LAYER_IDS.admin1,
    type: 'line',
    source: SOURCE_IDS.admin1,
    minzoom: 3,
    paint: {
      'line-color': 'rgba(203, 213, 225, 0.5)',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.35,
        6, 0.95,
        10, 1.5,
      ],
      'line-opacity': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.15,
        5, 0.45,
        8, 0.7,
      ],
      'line-dasharray': [3, 2],
    },
  });

  /* ─── 4a. admin0 glow (halo under borders) ─── */
  ensureLayer(map, {
    id: LAYER_IDS.admin0Glow,
    type: 'line',
    source: SOURCE_IDS.admin0,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': 'rgba(34, 211, 238, 0.25)',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        1.5, 2.5,
        4, 4,
        7, 6,
      ],
      'line-opacity': 0.45,
      'line-blur': 2.5,
    },
  });

  /* ─── 4b. admin0 borders (countries) ─── */
  ensureLayer(map, {
    id: LAYER_IDS.admin0,
    type: 'line',
    source: SOURCE_IDS.admin0,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': 'rgba(255, 255, 255, 0.55)',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        1.5, 0.8,
        4, 1.3,
        7, 1.8,
      ],
      'line-opacity': 0.9,
    },
  });

  /* ─── 5. submarine cables ─── */
  ensureLayer(map, {
    id: LAYER_IDS.submarineCables,
    type: 'line',
    source: SOURCE_IDS.submarineCables,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#22d3ee',
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1, 6, 2.5, 10, 4],
      'line-opacity': 0.8,
      'line-blur': 0.4,
      'line-dasharray': [3, 2],
    },
  });

  /* ─── 6. transmission lines ─── */
  ensureLayer(map, {
    id: LAYER_IDS.transmission,
    type: 'line',
    source: SOURCE_IDS.transmission,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': [
        'match', ['get', 'voltage_class'],
        '735kV+',    '#ef4444',
        '500-734kV', '#f97316',
        '345-499kV', '#fbbf24',
        '230-344kV', '#38bdf8',
        '100-229kV', '#22c55e',
        '31-99kV',   '#a78bfa',
        '#64748b',
      ],
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        3, [
          'match', ['get', 'voltage_class'],
          '735kV+', 1.2, '500-734kV', 1.0, '345-499kV', 0.8,
          '230-344kV', 0.6, '100-229kV', 0.5, '31-99kV', 0.4,
          0.4,
        ],
        8, [
          'match', ['get', 'voltage_class'],
          '735kV+', 4.5, '500-734kV', 3.5, '345-499kV', 2.8,
          '230-344kV', 2.2, '100-229kV', 1.8, '31-99kV', 1.3,
          1.5,
        ],
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 8, 0.9],
    },
  });

  /* ─── 7. planned upgrades (dashed) ─── */
  ensureLayer(map, {
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
  });

  /* ─── 8. substations ─── */
  ensureLayer(map, {
    id: LAYER_IDS.substations,
    type: 'circle',
    source: SOURCE_IDS.substations,
    paint: {
      'circle-color': '#e0f2fe',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 3, 10, 5],
      'circle-stroke-color': '#0c4a6e',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
    },
  });

  /* ─── 9. data centers ─── */
  ensureLayer(map, {
    id: LAYER_IDS.dataCenters,
    type: 'circle',
    source: SOURCE_IDS.dataCenters,
    paint: {
      'circle-color': '#67e8f9',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 5, 10, 7],
      'circle-stroke-color': '#0891b2',
      'circle-stroke-width': 1.4,
      'circle-opacity': 0.92,
    },
  });

  /* ─── 10. plant glow ─── */
  ensureLayer(map, {
    id: LAYER_IDS.plantsGlow,
    type: 'circle',
    source: SOURCE_IDS.plants,
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
      'circle-radius': 8,
      'circle-opacity': 0.18,
      'circle-blur': 1.2,
      'circle-stroke-width': 0,
    },
  });

  /* ─── 11. plant circles ─── */
  ensureLayer(map, {
    id: LAYER_IDS.plants,
    type: 'circle',
    source: SOURCE_IDS.plants,
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
      'circle-radius': 6,
      'circle-stroke-color': 'rgba(255,255,255,0.35)',
      'circle-stroke-width': 0.8,
      'circle-opacity': 0.92,
    },
  });

  /* ──────────────────────────────────────────────
     12. LABELS — always rendered on top
     ────────────────────────────────────────────── */

  /* admin1 (province/state) labels */
  ensureLayer(map, {
    id: LAYER_IDS.admin1Label,
    type: 'symbol',
    source: SOURCE_IDS.admin1,
    minzoom: 4,
    layout: {
      'text-field': [
        'coalesce',
        ['get', 'name_en'],      // our own normalized field
        ['get', 'shapeName'],    // geoBoundaries
        ['get', 'name'],         // OSM / generic
        ['get', 'NAME_1'],       // Natural Earth / GADM
        ['get', 'NAME'],         // GADM older schema
        '',
      ],
      'text-font': FONT_ITALIC,
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        4, 9,
        6, 11,
        9, 13,
      ],
      'text-letter-spacing': 0.08,
      'text-transform': 'uppercase',
      'text-max-width': 8,
      'text-padding': 4,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': 'rgba(226, 232, 240, 0.72)',
      'text-halo-color': 'rgba(2, 6, 23, 0.85)',
      'text-halo-width': 1.4,
      'text-halo-blur': 0.6,
      'text-opacity': [
        'interpolate', ['linear'], ['zoom'],
        4, 0,
        5, 0.7,
        8, 0.95,
      ],
    },
  });

  /* country (admin0) labels — always on top, always readable */
  ensureLayer(map, {
    id: LAYER_IDS.admin0Label,
    type: 'symbol',
    source: SOURCE_IDS.admin0,
    layout: {
      'text-field': [
        'coalesce',
        ['get', 'name_en'],      // our normalized field
        ['get', 'shapeName'],    // geoBoundaries
        ['get', 'NAME_EN'],      // Natural Earth (upper)
        ['get', 'ADMIN'],        // Natural Earth ADMIN
        ['get', 'name'],         // OSM / generic
        ['get', 'NAME'],
        '',
      ],
      'text-font': FONT_BOLD,
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        1.5, 10,
        3, 12,
        5, 15,
        8, 18,
      ],
      'text-letter-spacing': 0.14,
      'text-transform': 'uppercase',
      'text-max-width': 7,
      'text-padding': 6,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': '#f8fafc',
      'text-halo-color': 'rgba(2, 6, 23, 0.92)',
      'text-halo-width': 1.8,
      'text-halo-blur': 0.8,
    },
  });

  /* place labels (cities) — only if we have a placeLabels source with data */
  ensureLayer(map, {
    id: LAYER_IDS.placeLabel,
    type: 'symbol',
    source: SOURCE_IDS.placeLabels,
    minzoom: 3,
    filter: ['!=', ['get', 'capital'], true],
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name'], ''],
      'text-font': FONT_REGULAR,
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        3, 10,
        6, 12,
        9, 14,
      ],
      'text-anchor': 'top',
      'text-offset': [0, 0.6],
      'text-padding': 4,
      'icon-image': '',
      'text-max-width': 9,
    },
    paint: {
      'text-color': 'rgba(203, 213, 225, 0.92)',
      'text-halo-color': 'rgba(2, 6, 23, 0.9)',
      'text-halo-width': 1.3,
    },
  });

  /* capital city labels */
  ensureLayer(map, {
    id: LAYER_IDS.capitalLabel,
    type: 'symbol',
    source: SOURCE_IDS.placeLabels,
    minzoom: 2.5,
    filter: ['==', ['get', 'capital'], true],
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name'], ''],
      'text-font': FONT_BOLD,
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        2.5, 11,
        5, 13,
        8, 16,
      ],
      'text-anchor': 'top',
      'text-offset': [0, 0.7],
      'text-padding': 6,
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#fef3c7',
      'text-halo-color': 'rgba(2, 6, 23, 0.95)',
      'text-halo-width': 1.6,
      'text-halo-blur': 0.5,
    },
  });
}

/* ─────────────── data updates ─────────────── */

export function updateSourceData(
  map: MapLibreMap,
  sourceId: string,
  data?: FeatureCollection | null,
) {
  const src = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!src) return;
  if (!data || !Array.isArray(data.features) || data.features.length === 0) return;
  src.setData(data);
}

/* ─────────────── visibility toggles ─────────────── */

export function applyLayerVisibility(map: MapLibreMap, v: LayerVisibility) {
  const visibilityMap: Record<string, boolean> = {
    // data
    [LAYER_IDS.plantsGlow]: v.plants,
    [LAYER_IDS.plants]: v.plants,
    [LAYER_IDS.transmission]: v.transmission,
    [LAYER_IDS.substations]: v.substations,
    [LAYER_IDS.dataCenters]: v.dataCenters,
    [LAYER_IDS.waterStress]: v.waterStress,
    [LAYER_IDS.submarineCables]: v.submarineCables,
    [LAYER_IDS.plannedUpgrades]: v.plannedUpgrades,

    // admin boundaries — default true if not explicitly set
    [LAYER_IDS.admin0]:     v.admin0 ?? true,
    [LAYER_IDS.admin0Glow]: v.admin0 ?? true,
    [LAYER_IDS.admin1]:     v.admin1 ?? true,
    [LAYER_IDS.admin2]:     v.admin2 ?? false,

    // labels — default true, independent of the boundary lines
    [LAYER_IDS.admin0Label]:  v.placeLabels ?? true,
    [LAYER_IDS.admin1Label]:  v.placeLabels ?? true,
    [LAYER_IDS.placeLabel]:   v.placeLabels ?? true,
    [LAYER_IDS.capitalLabel]: v.placeLabels ?? true,
  };

  for (const [id, visible] of Object.entries(visibilityMap)) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

/* ─────────────── globe / atmosphere (no-op on older maplibre) ─────────────── */

export function maybeApplyAtmosphere(map: MapLibreMap) {
  try {
    if (typeof (map as any).setProjection === 'function') {
      (map as any).setProjection({ type: 'globe' });
    }
    if (typeof (map as any).setFog === 'function') {
      (map as any).setFog({
        color: 'rgba(15, 23, 42, 0.6)',
        'horizon-blend': 0.15,
        'high-color': 'rgba(30, 40, 60, 0.7)',
        'space-color': 'rgba(2, 6, 23, 0.95)',
        'star-intensity': 0.12,
      });
    }
  } catch (e) {
    console.warn('Atmosphere setup skipped:', e);
  }
}

// src/lib/mapLayers.ts
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
} as const;

export const LAYER_IDS = {
  plantsGlow: 'plants-glow',
  plants: 'plants-circle',

  transmission: 'transmission-line',
  substations: 'substations-circle',
  dataCenters: 'data-centers-circle',
  waterStress: 'water-stress-fill',
  submarineCables: 'submarine-cables-line',
  plannedUpgrades: 'planned-upgrades-line',

  admin0: 'admin0-line',
  admin1: 'admin1-line',
  admin2: 'admin2-line',
} as const;

const EMPTY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function ensureSource(map: MapLibreMap, id: string) {
  if (!map.getSource(id)) {
    map.addSource(id, {
      type: 'geojson',
      data: EMPTY,
    });
  }
}

function ensureLayer(map: MapLibreMap, layer: any) {
  if (map.getLayer(layer.id)) return;

  const styleLayers = map.getStyle().layers || [];
  const firstSymbolId = styleLayers.find((l) => l.type === 'symbol')?.id;

  if (firstSymbolId) {
    map.addLayer(layer, firstSymbolId);
  } else {
    map.addLayer(layer);
  }
}

export function installMapDataLayers(map: MapLibreMap) {
  Object.values(SOURCE_IDS).forEach((id) => {
    ensureSource(map, id);
  });

  // Background contextual layer
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

  // Boundaries
  ensureLayer(map, {
    id: LAYER_IDS.admin2,
    type: 'line',
    source: SOURCE_IDS.admin2,
    minzoom: 5,
    paint: {
      'line-color': 'rgba(100,116,139,0.35)',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, 0.25,
        8, 0.7,
        11, 1.1,
      ],
      'line-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, 0.0,
        6, 0.18,
        9, 0.4,
        12, 0.55,
      ],
    },
  });

  ensureLayer(map, {
    id: LAYER_IDS.admin1,
    type: 'line',
    source: SOURCE_IDS.admin1,
    minzoom: 3,
    paint: {
      'line-color': 'rgba(148,163,184,0.45)',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 0.35,
        6, 0.95,
        10, 1.5,
      ],
      'line-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 0.12,
        5, 0.42,
        8, 0.75,
      ],
    },
  });

  ensureLayer(map, {
    id: LAYER_IDS.admin0,
    type: 'line',
    source: SOURCE_IDS.admin0,
    paint: {
      'line-color': 'rgba(255,255,255,0.34)',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        1.5, 0.7,
        4, 1.1,
        7, 1.6,
      ],
      'line-opacity': 0.85,
    },
  });

  // Submarine cables
  ensureLayer(map, {
    id: LAYER_IDS.submarineCables,
    type: 'line',
    source: SOURCE_IDS.submarineCables,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#22d3ee',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        2, 1,
        6, 2.5,
        10, 4,
      ],
      'line-opacity': 0.8,
      'line-blur': 0.4,
      'line-dasharray': [3, 2],
    },
  });

  // Transmission
  ensureLayer(map, {
    id: LAYER_IDS.transmission,
    type: 'line',
    source: SOURCE_IDS.transmission,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'voltage_class'],
        '735kV+', '#ef4444',
        '500-734kV', '#f97316',
        '345-499kV', '#fbbf24',
        '230-344kV', '#38bdf8',
        '100-229kV', '#22c55e',
        '31-99kV', '#a78bfa',
        '#64748b',
      ],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3,
        [
          'match',
          ['get', 'voltage_class'],
          '735kV+', 1.2,
          '500-734kV', 1.0,
          '345-499kV', 0.8,
          '230-344kV', 0.6,
          '100-229kV', 0.5,
          '31-99kV', 0.4,
          0.4,
        ],
        8,
        [
          'match',
          ['get', 'voltage_class'],
          '735kV+', 4.5,
          '500-734kV', 3.5,
          '345-499kV', 2.8,
          '230-344kV', 2.2,
          '100-229kV', 1.8,
          '31-99kV', 1.3,
          1.5,
        ],
      ],
      'line-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 0.55,
        8, 0.9,
      ],
    },
  });

  // Substations
  ensureLayer(map, {
    id: LAYER_IDS.substations,
    type: 'circle',
    source: SOURCE_IDS.substations,
    paint: {
      'circle-color': '#e0f2fe',
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 1.5,
        6, 3,
        10, 5,
      ],
      'circle-stroke-color': '#0c4a6e',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
    },
  });

  // Data centers
  ensureLayer(map, {
    id: LAYER_IDS.dataCenters,
    type: 'circle',
    source: SOURCE_IDS.dataCenters,
    paint: {
      'circle-color': '#67e8f9',
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 3,
        6, 5,
        10, 7,
      ],
      'circle-stroke-color': '#0891b2',
      'circle-stroke-width': 1.4,
      'circle-opacity': 0.92,
    },
  });

  // Plant glow
  ensureLayer(map, {
    id: LAYER_IDS.plantsGlow,
    type: 'circle',
    source: SOURCE_IDS.plants,
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 5,
        100, 9,
        500, 14,
        1000, 20,
        5000, 30,
      ],
      'circle-opacity': 0.18,
      'circle-blur': 1.2,
      'circle-stroke-width': 0,
    },
  });

  // Plant circles
  ensureLayer(map, {
    id: LAYER_IDS.plants,
    type: 'circle',
    source: SOURCE_IDS.plants,
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#94a3b8'],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 3,
        100, 5,
        500, 8,
        1000, 11,
        5000, 16,
      ],
      'circle-stroke-color': 'rgba(255,255,255,0.28)',
      'circle-stroke-width': 0.8,
      'circle-opacity': 0.92,
    },
  });

  // Planned upgrades
  ensureLayer(map, {
    id: LAYER_IDS.plannedUpgrades,
    type: 'line',
    source: SOURCE_IDS.plannedUpgrades,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#fbbf24',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 1,
        8, 3,
      ],
      'line-opacity': 0.85,
      'line-dasharray': [2, 2],
    },
  });
}

export function updateSourceData(
  map: MapLibreMap,
  id: string,
  data?: FeatureCollection | null,
) {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (!src) return;

  if (!data || !Array.isArray(data.features) || data.features.length === 0) {
    return;
  }

  src.setData(data);
}

export function applyLayerVisibility(map: MapLibreMap, v: LayerVisibility) {
  const visibilityMap: Record<string, boolean | undefined> = {
    [LAYER_IDS.plantsGlow]: v.plants,
    [LAYER_IDS.plants]: v.plants,
    [LAYER_IDS.transmission]: v.transmission,
    [LAYER_IDS.substations]: v.substations,
    [LAYER_IDS.dataCenters]: v.dataCenters,
    [LAYER_IDS.waterStress]: v.waterStress,
    [LAYER_IDS.submarineCables]: v.submarineCables,
    [LAYER_IDS.plannedUpgrades]: v.plannedUpgrades,
    [LAYER_IDS.admin0]: (v as any).admin0 ?? true,
    [LAYER_IDS.admin1]: (v as any).admin1 ?? true,
    [LAYER_IDS.admin2]: (v as any).admin2 ?? false,
  };

  for (const [id, visible] of Object.entries(visibilityMap)) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

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
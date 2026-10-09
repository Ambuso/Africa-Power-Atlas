/* ==================== components/map/mapThemes.ts ====================
 * Globe-safe basemap registry.
 *
 * "Dark" (default) is built from SELF-HOSTED Natural Earth layers in
 * public/basemap/ (see scripts/build_basemap.py) plus shaded relief from
 * the open AWS Terrain Tiles DEM, so its core look never depends on a
 * third-party tile server or API key. Road / town detail from OpenFreeMap
 * fades in once you zoom into a country.
 *
 * Every inline style shares one glyph server so the app's own overlay
 * labels (Noto Sans, see mapStyles.ts) always render.
 * ==================================================== */

import type {
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type { MapThemeKey } from '@/lib/types';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';

const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

/* ─────────── palette ─────────── */

const DARK = {
  space: '#020617',
  ocean: '#040b1a',
  land: '#15233d',
  coast: 'rgba(125, 211, 252, 0.35)',
  coastGlow: 'rgba(56, 189, 248, 0.18)',
  lake: '#06142b',
  river: 'rgba(56, 130, 200, 0.45)',
  border: 'rgba(148, 163, 184, 0.22)',
  landcoverGrass: '#132440',
  landcoverWood: '#12263f',
  landcoverSand: '#1a2640',
  landcoverIce: '#1e2a44',
  urban: '#1c2b48',
  water: '#06142b',
  waterway: '#0d2445',
  boundary: 'rgba(148, 163, 184, 0.3)',
  boundarySub: 'rgba(148, 163, 184, 0.14)',
  road: 'rgba(100, 116, 139, 0.3)',
  roadMajor: 'rgba(148, 163, 184, 0.38)',
  label: 'rgba(148, 163, 184, 0.75)',
  labelWater: 'rgba(96, 150, 210, 0.6)',
  halo: 'rgba(2, 6, 23, 0.9)',
};

/* ─────────── sources ─────────── */

const OPENFREEMAP_SOURCE: SourceSpecification = {
  type: 'vector',
  url: 'https://tiles.openfreemap.org/planet',
};

const DEM_SOURCE: SourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 12,
  attribution:
    'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS Terrain Tiles</a>',
};

const ESRI_SATELLITE_SOURCE: SourceSpecification = {
  type: 'raster',
  tiles: [
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ],
  tileSize: 256,
  maxzoom: 19,
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
};

/** Self-hosted Natural Earth layer from public/basemap/. */
function localSource(name: string): SourceSpecification {
  return {
    type: 'geojson',
    data: `/basemap/${name}.geojson`,
    maxzoom: 8,
    tolerance: 0.5,
    attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
  } as SourceSpecification;
}

/* ─────────── globe helper ─────────── */

function globeStyle(style: StyleSpecification): StyleSpecification {
  return { ...style, projection: { type: 'globe' } } as StyleSpecification;
}

/* ─────────── reusable OpenMapTiles layer groups ─────────── */

const OMT = 'omt';

function landLayers(c: typeof DARK): LayerSpecification[] {
  return [
    {
      id: 'landcover-ice',
      type: 'fill',
      source: OMT,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'ice'],
      paint: { 'fill-color': c.landcoverIce, 'fill-opacity': 0.8 },
    },
    {
      id: 'landcover-sand',
      type: 'fill',
      source: OMT,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'sand'],
      paint: { 'fill-color': c.landcoverSand, 'fill-opacity': 0.7 },
    },
    {
      id: 'landcover-grass',
      type: 'fill',
      source: OMT,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
      paint: { 'fill-color': c.landcoverGrass, 'fill-opacity': 0.55 },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: OMT,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': c.landcoverWood, 'fill-opacity': 0.65 },
    },
    {
      id: 'landuse-urban',
      type: 'fill',
      source: OMT,
      'source-layer': 'landuse',
      minzoom: 5,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial']]],
      paint: {
        'fill-color': c.urban,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 0.8],
      },
    },
  ];
}

function hillshadeLayer(
  shadow: string,
  highlight: string,
  exaggeration: number,
): LayerSpecification {
  return {
    id: 'hillshade',
    type: 'hillshade',
    source: 'dem',
    paint: {
      'hillshade-shadow-color': shadow,
      'hillshade-highlight-color': highlight,
      'hillshade-accent-color': shadow,
      'hillshade-exaggeration': exaggeration,
      'hillshade-illumination-direction': 315,
    },
  };
}

function roadLayers(minor: string, major: string): LayerSpecification[] {
  return [
    {
      id: 'road-minor',
      type: 'line',
      source: OMT,
      'source-layer': 'transportation',
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': minor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.3, 14, 2.5],
      },
    },
    {
      id: 'road-major',
      type: 'line',
      source: OMT,
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': major,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.3, 10, 1.4, 14, 4],
      },
    },
  ];
}

function boundaryLayers(country: string, state: string): LayerSpecification[] {
  return [
    {
      id: 'boundary-state',
      type: 'line',
      source: OMT,
      'source-layer': 'boundary',
      minzoom: 3,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: {
        'line-color': state,
        'line-dasharray': [2, 2],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 10, 1.2],
      },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: OMT,
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': country,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 5, 1, 10, 2],
      },
    },
  ];
}

/** Low-key basemap labels: water bodies always, towns only when zoomed in
 *  (the app draws its own country/capital/place labels on top). */
function basemapLabelLayers(text: string, water: string, halo: string): LayerSpecification[] {
  return [
    {
      id: 'label-water',
      type: 'symbol',
      source: OMT,
      'source-layer': 'water_name',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 13],
        'text-letter-spacing': 0.2,
        'text-max-width': 6,
      },
      paint: { 'text-color': water, 'text-halo-color': halo, 'text-halo-width': 1 },
    },
    {
      id: 'label-town',
      type: 'symbol',
      source: OMT,
      'source-layer': 'place',
      minzoom: 7,
      filter: ['in', ['get', 'class'], ['literal', ['town', 'village', 'suburb']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 13],
        'text-max-width': 8,
      },
      paint: { 'text-color': text, 'text-halo-color': halo, 'text-halo-width': 1.2 },
    },
  ];
}

/* ─────────── inline styles ─────────── */

/** Self-hosted base: ocean, land (whole world equally lit; Africa drawn at
 *  higher detail), relief, coast glow, lakes, rivers, borders and sea names. */
function naturalEarthBase(withRelief: boolean): {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
} {
  const sources: Record<string, SourceSpecification> = {
    'ne-ocean': localSource('ocean'),
    'ne-land': localSource('land'),
    'ne-land-africa': localSource('land_africa'),
    'ne-borders': localSource('borders'),
    'ne-lakes': localSource('lakes'),
    'ne-rivers': localSource('rivers'),
    'ne-marine': localSource('marine_labels'),
  };
  if (withRelief) sources.dem = DEM_SOURCE;

  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': DARK.ocean } },
    { id: 'ne-land', type: 'fill', source: 'ne-land', paint: { 'fill-color': DARK.land, 'fill-antialias': false } },
    {
      id: 'ne-land-africa',
      type: 'fill',
      source: 'ne-land-africa',
      paint: { 'fill-color': DARK.land, 'fill-antialias': false },
    },
    ...(withRelief
      ? [hillshadeLayer('rgba(0, 2, 10, 0.85)', 'rgba(160, 200, 245, 0.22)', 0.75)]
      : []),
    // Re-cover the sea so DEM bathymetry doesn't shade the ocean.
    { id: 'ne-ocean', type: 'fill', source: 'ne-ocean', paint: { 'fill-color': DARK.ocean, 'fill-antialias': false } },
    { id: 'ne-lakes', type: 'fill', source: 'ne-lakes', paint: { 'fill-color': DARK.lake } },
    {
      id: 'ne-rivers',
      type: 'line',
      source: 'ne-rivers',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': DARK.river,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2, ['interpolate', ['linear'], ['get', 'scalerank'], 0, 1.1, 7, 0.3],
          7, ['interpolate', ['linear'], ['get', 'scalerank'], 0, 3, 7, 1],
        ],
      },
    },
    {
      id: 'ne-coast-glow',
      type: 'line',
      source: 'ne-land',
      paint: {
        'line-color': DARK.coastGlow,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 8],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 6],
      },
    },
    {
      id: 'ne-coast',
      type: 'line',
      source: 'ne-land',
      paint: { 'line-color': DARK.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.2] },
    },
    // Africa's 10m coastline takes over from the 50m world line when zoomed in.
    {
      id: 'ne-coast-africa',
      type: 'line',
      source: 'ne-land-africa',
      minzoom: 4,
      paint: {
        'line-color': DARK.coast,
        'line-width': 1.2,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5, 1],
      },
    },
    {
      id: 'ne-borders',
      type: 'line',
      source: 'ne-borders',
      paint: { 'line-color': DARK.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1] },
    },
    {
      id: 'ne-marine-label',
      type: 'symbol',
      source: 'ne-marine',
      filter: ['<=', ['get', 'scalerank'], ['step', ['zoom'], 1, 3, 2, 4, 3]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 5, 13],
        'text-letter-spacing': 0.25,
        'text-max-width': 7,
      },
      paint: { 'text-color': DARK.labelWater, 'text-halo-color': DARK.halo, 'text-halo-width': 1 },
    },
  ];
  return { sources, layers };
}

/** Street-level detail from OpenFreeMap, faded in from z5 on top of the
 *  self-hosted base (if that server is unreachable the base still works). */
function zoomedDetailLayers(): LayerSpecification[] {
  return [
    ...landLayers(DARK).map((l) => ({ ...l, minzoom: 6 }) as LayerSpecification),
    ...roadLayers(DARK.road, DARK.roadMajor),
    ...basemapLabelLayers(DARK.label, DARK.labelWater, DARK.halo).filter((l) => l.id === 'label-town'),
  ];
}

/** DEFAULT — calm dark cartography with relief; the data is the focal point. */
const DARK_STYLE: StyleSpecification = (() => {
  const base = naturalEarthBase(true);
  // Detail layers sit under the coast/border/label layers of the base.
  const insertAt = base.layers.findIndex((l) => l.id === 'ne-coast-glow');
  return globeStyle({
    version: 8,
    name: 'Africa Power Atlas — Dark',
    glyphs: GLYPHS_URL,
    sources: { ...base.sources, [OMT]: OPENFREEMAP_SOURCE },
    layers: [
      ...base.layers.slice(0, insertAt),
      ...zoomedDetailLayers(),
      ...base.layers.slice(insertAt),
    ],
  });
})();

/** Local land / ocean under the imagery, shown while tiles load or if the
 *  imagery server is unreachable — the globe never goes black. */
const IMAGERY_UNDERLAY = (() => {
  const base = naturalEarthBase(false);
  return {
    sources: { 'ne-land': localSource('land') },
    layers: base.layers.filter((l) => l.id === 'background' || l.id === 'ne-land'),
  };
})();

/** Satellite imagery with thin vector borders + roads on top. */
const HYBRID_STYLE: StyleSpecification = globeStyle({
  version: 8,
  name: 'Africa Power Atlas — Hybrid',
  glyphs: GLYPHS_URL,
  sources: { ...IMAGERY_UNDERLAY.sources, esri: ESRI_SATELLITE_SOURCE, [OMT]: OPENFREEMAP_SOURCE },
  layers: [
    ...IMAGERY_UNDERLAY.layers,
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri',
      paint: {
        'raster-saturation': -0.15,
        'raster-contrast': 0.1,
        'raster-brightness-max': 0.85,
        'raster-fade-duration': 200,
      },
    },
    ...roadLayers('rgba(255, 255, 255, 0.22)', 'rgba(253, 230, 138, 0.45)'),
    ...boundaryLayers('rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.3)'),
    ...basemapLabelLayers('rgba(255, 255, 255, 0.9)', 'rgba(186, 230, 253, 0.85)', 'rgba(0, 0, 0, 0.75)'),
  ],
});

/** Pure imagery, lightly toned. */
const SATELLITE_STYLE: StyleSpecification = globeStyle({
  version: 8,
  name: 'Africa Power Atlas — Satellite',
  glyphs: GLYPHS_URL,
  sources: { ...IMAGERY_UNDERLAY.sources, esri: ESRI_SATELLITE_SOURCE },
  layers: [
    ...IMAGERY_UNDERLAY.layers,
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri',
      paint: { 'raster-saturation': -0.1, 'raster-contrast': 0.08, 'raster-fade-duration': 200 },
    },
  ],
});

/** Flat land / water silhouette, no relief or detail — maximum focus on data. */
const MINIMAL_STYLE: StyleSpecification = (() => {
  const base = naturalEarthBase(false);
  return globeStyle({
    version: 8,
    name: 'Africa Power Atlas — Minimal',
    glyphs: GLYPHS_URL,
    sources: base.sources,
    layers: base.layers.filter((l) => !['ne-rivers', 'ne-marine-label'].includes(l.id)),
  });
})();

/* ─────────── hosted vector styles ─────────── */

/** Light & Streets use full hosted styles. MapTiler is used when a key is
 *  set; otherwise OpenFreeMap (free, no key). Both serve Noto Sans glyphs,
 *  so overlay labels keep working. */
function hostedStyleUrl(flavor: 'light' | 'streets'): string {
  if (MAPTILER_KEY) {
    const name = flavor === 'light' ? 'dataviz-light' : 'streets-v2';
    return `https://api.maptiler.com/maps/${name}/style.json?key=${MAPTILER_KEY}`;
  }
  return `https://tiles.openfreemap.org/styles/${flavor === 'light' ? 'positron' : 'liberty'}`;
}

/* ─────────── registry ─────────── */

export interface MapThemeEntry {
  label: string;
  style: string | StyleSpecification;
}

export interface MapThemeMetaEntry {
  label: string;
  description: string;
  accent: string;
}

export const MAP_THEMES: Record<MapThemeKey, MapThemeEntry> = {
  dark: { label: 'Dark', style: DARK_STYLE },
  light: { label: 'Light', style: hostedStyleUrl('light') },
  streets: { label: 'Streets', style: hostedStyleUrl('streets') },
  hybrid: { label: 'Hybrid', style: HYBRID_STYLE },
  satellite: { label: 'Satellite', style: SATELLITE_STYLE },
  minimal: { label: 'Minimal', style: MINIMAL_STYLE },
};

export const MAP_THEME_META: Record<MapThemeKey, MapThemeMetaEntry> = {
  dark: { label: 'Dark', description: 'Terrain relief, whole world', accent: '#22d3ee' },
  light: { label: 'Light', description: 'Cartographic', accent: '#0ea5e9' },
  streets: { label: 'Streets', description: 'Roads & detail', accent: '#f59e0b' },
  hybrid: { label: 'Hybrid', description: 'Imagery + borders', accent: '#10b981' },
  satellite: { label: 'Satellite', description: 'Imagery only', accent: '#eab308' },
  minimal: { label: 'Minimal', description: 'Flat land & water', accent: '#a78bfa' },
};

/** Themes with a light background need a light sky/halo treatment. */
export function isLightTheme(key: MapThemeKey): boolean {
  return key === 'light' || key === 'streets';
}

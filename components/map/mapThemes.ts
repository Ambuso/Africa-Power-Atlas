/* ==================== components/map/mapThemes.ts ====================
 * Globe-safe basemap registry.
 *
 * The default "Dark" theme is a crisp VECTOR basemap (OpenFreeMap /
 * OpenMapTiles schema — free, no API key) with shaded relief from the
 * open AWS Terrain Tiles DEM. It replaces the old dimmed raster, which
 * looked blurry on the globe and went blank without a Geoapify key.
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
  ocean: '#071226',
  land: '#0f1a2e',
  landcoverGrass: '#112036',
  landcoverWood: '#0f2236',
  landcoverSand: '#18223a',
  landcoverIce: '#1e2a44',
  urban: '#16233d',
  water: '#071226',
  waterway: '#0d2445',
  boundary: 'rgba(148, 163, 184, 0.38)',
  boundarySub: 'rgba(148, 163, 184, 0.16)',
  road: 'rgba(100, 116, 139, 0.34)',
  roadMajor: 'rgba(148, 163, 184, 0.42)',
  label: 'rgba(148, 163, 184, 0.75)',
  labelWater: 'rgba(56, 120, 190, 0.7)',
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

function waterLayers(water: string, waterway: string): LayerSpecification[] {
  return [
    {
      id: 'water',
      type: 'fill',
      source: OMT,
      'source-layer': 'water',
      paint: { 'fill-color': water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: OMT,
      'source-layer': 'waterway',
      minzoom: 4,
      filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]],
      paint: {
        'line-color': waterway,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 4, 0.4, 10, 2, 14, 5],
      },
    },
  ];
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

/** DEFAULT — dark vector basemap + relief. Calm enough that the cyan
 *  Africa outline and glowing plants stay the focal point. */
const DARK_STYLE: StyleSpecification = globeStyle({
  version: 8,
  name: 'Africa Power Atlas — Dark',
  glyphs: GLYPHS_URL,
  sources: { [OMT]: OPENFREEMAP_SOURCE, dem: DEM_SOURCE },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': DARK.land } },
    ...landLayers(DARK),
    hillshadeLayer('rgba(0, 0, 0, 0.55)', 'rgba(120, 160, 220, 0.10)', 0.5),
    ...waterLayers(DARK.water, DARK.waterway),
    ...roadLayers(DARK.road, DARK.roadMajor),
    ...boundaryLayers(DARK.boundary, DARK.boundarySub),
    ...basemapLabelLayers(DARK.label, DARK.labelWater, DARK.halo),
  ],
});

/** Satellite imagery with thin vector borders + roads on top. */
const HYBRID_STYLE: StyleSpecification = globeStyle({
  version: 8,
  name: 'Africa Power Atlas — Hybrid',
  glyphs: GLYPHS_URL,
  sources: { esri: ESRI_SATELLITE_SOURCE, [OMT]: OPENFREEMAP_SOURCE },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': DARK.space } },
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
  sources: { esri: ESRI_SATELLITE_SOURCE },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': DARK.space } },
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri',
      paint: { 'raster-saturation': -0.1, 'raster-contrast': 0.08, 'raster-fade-duration': 200 },
    },
  ],
});

/** Land / water silhouette only — maximum focus on the data. */
const MINIMAL_STYLE: StyleSpecification = globeStyle({
  version: 8,
  name: 'Africa Power Atlas — Minimal',
  glyphs: GLYPHS_URL,
  sources: { [OMT]: OPENFREEMAP_SOURCE },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1222' } },
    {
      id: 'water',
      type: 'fill',
      source: OMT,
      'source-layer': 'water',
      paint: { 'fill-color': '#040816' },
    },
  ],
});

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
  dark: { label: 'Dark', description: 'Vector + terrain relief', accent: '#22d3ee' },
  light: { label: 'Light', description: 'Cartographic', accent: '#0ea5e9' },
  streets: { label: 'Streets', description: 'Roads & detail', accent: '#f59e0b' },
  hybrid: { label: 'Hybrid', description: 'Imagery + borders', accent: '#10b981' },
  satellite: { label: 'Satellite', description: 'Imagery only', accent: '#eab308' },
  minimal: { label: 'Minimal', description: 'Land & water only', accent: '#a78bfa' },
};

/** Themes with a light background need a light sky/halo treatment. */
export function isLightTheme(key: MapThemeKey): boolean {
  return key === 'light' || key === 'streets';
}

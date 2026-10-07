/* ==================== components/map/mapThemes.ts ====================
 * Globe-safe basemap registry.
 *
 * Default "dark" theme now shows the full world dimmed so Africa
 * (with its cyan admin0 overlay) becomes the focal point — other
 * continents are visible but muted for geospatial context.
 * ==================================================== */

import type { StyleSpecification } from 'maplibre-gl';
import type { MapThemeKey } from '@/lib/types';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';
const STADIA_KEY = process.env.NEXT_PUBLIC_STADIA_KEY ?? '';
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? '';

const GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

/* ─────────── palette ─────────── */

const COLOR_SPACE = '#020617';
const COLOR_OCEAN = '#050a18';

/* ─────────── globe helper ─────────── */

function withGlobeProjection(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    projection: { type: 'globe' } as any,
  };
}

/* ─────────── raster tile sources ─────────── */

const ESRI_SATELLITE_TILES = [
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];

/* ─────────── vector style URLs (optional rich themes) ─────────── */

type Flavor = 'dark' | 'darkmatter' | 'positron' | 'streets';

function vectorStyleUrl(flavor: Flavor): string {
  if (MAPTILER_KEY) {
    switch (flavor) {
      case 'dark':
        return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
      case 'darkmatter':
        return `https://api.maptiler.com/maps/darkmatter/style.json?key=${MAPTILER_KEY}`;
      case 'positron':
        return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER_KEY}`;
      case 'streets':
        return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`;
    }
  }

  if (STADIA_KEY) {
    switch (flavor) {
      case 'dark':
      case 'darkmatter':
        return `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=${STADIA_KEY}`;
      case 'positron':
        return `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${STADIA_KEY}`;
      case 'streets':
        return `https://tiles.stadiamaps.com/styles/outdoors.json?api_key=${STADIA_KEY}`;
    }
  }

  if (GEOAPIFY_KEY) {
    const g = (name: string) =>
      `https://maps.geoapify.com/v1/styles/${name}/style.json?apiKey=${GEOAPIFY_KEY}`;
    switch (flavor) {
      case 'dark':
      case 'darkmatter':
        return g('dark-matter-dark-grey');
      case 'positron':
        return g('positron');
      case 'streets':
        return g('osm-bright');
    }
  }

  switch (flavor) {
    case 'dark':
    case 'darkmatter':
      return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    case 'positron':
      return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    case 'streets':
      return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
  }
}

/* ─────────── inline styles ─────────── */

/**
 * DEFAULT DARK STYLE — CartoCDN dark raster (no API key, free),
 * composited heavily dimmed so the Africa cyan admin0 overlay dominates.
 */
const DARK_WORLD_STYLE: StyleSpecification = withGlobeProjection({
  version: 8,
  name: 'Africa Power Atlas — Dark World',
  glyphs: GLYPHS_URL,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        `https://maps.geoapify.com/v1/tile/dark-matter-dark-grey/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.geoapify.com/">Geoapify</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · ' +
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'space',
      type: 'background',
      paint: { 'background-color': COLOR_SPACE },
    },
    {
      id: 'world-land',
      type: 'raster',
      source: 'carto-dark',
      paint: {
        'raster-opacity': 0.75,
        'raster-saturation': -0.85,
        'raster-contrast': -0.15,
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 0.55,
      },
    },
    {
      id: 'world-wash',
      type: 'background',
      paint: {
        'background-color': 'rgba(6, 18, 40, 0.25)',
        'background-opacity': 0.5,
      },
    },
  ],
});

const HYBRID_STYLE: StyleSpecification = withGlobeProjection({
  version: 8,
  name: 'Africa Power Atlas Hybrid',
  glyphs: GLYPHS_URL,
  sources: {
    esri: {
      type: 'raster',
      tiles: ESRI_SATELLITE_TILES,
      tileSize: 256,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': COLOR_OCEAN } },
    {
      id: 'satellite-base',
      type: 'raster',
      source: 'esri',
      paint: {
        'raster-opacity': 0.9,
        'raster-saturation': -0.2,
        'raster-contrast': 0.16,
        'raster-brightness-min': 0.04,
        'raster-brightness-max': 0.9,
      },
    },
    {
      id: 'hybrid-wash',
      type: 'background',
      paint: {
        'background-color': 'rgba(9, 30, 66, 0.18)',
        'background-opacity': 0.45,
      },
    },
  ],
});

const SATELLITE_ONLY_STYLE: StyleSpecification = withGlobeProjection({
  version: 8,
  name: 'Africa Power Atlas Satellite',
  glyphs: GLYPHS_URL,
  sources: {
    esri: {
      type: 'raster',
      tiles: ESRI_SATELLITE_TILES,
      tileSize: 256,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': COLOR_SPACE } },
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri',
      paint: {
        'raster-opacity': 0.97,
        'raster-saturation': -0.25,
        'raster-contrast': 0.18,
        'raster-brightness-min': 0.03,
        'raster-brightness-max': 0.93,
      },
    },
  ],
});

const MINIMAL_DARK_STYLE: StyleSpecification = withGlobeProjection({
  version: 8,
  name: 'Africa Power Atlas Minimal',
  glyphs: GLYPHS_URL,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#040816' } },
  ],
});

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
  dark: {
    label: 'Dark',
    style: DARK_WORLD_STYLE,
  },
  light: {
    label: 'Light',
    style: vectorStyleUrl('positron'),
  },
  streets: {
    label: 'Streets',
    style: vectorStyleUrl('streets'),
  },
  hybrid: {
    label: 'Hybrid',
    style: HYBRID_STYLE,
  },
  satellite: {
    label: 'Satellite',
    style: SATELLITE_ONLY_STYLE,
  },
  minimal: {
    label: 'Minimal',
    style: MINIMAL_DARK_STYLE,
  },
};

export const MAP_THEME_META: Record<MapThemeKey, MapThemeMetaEntry> = {
  dark: {
    label: 'Dark',
    description: 'Global context, Africa highlighted',
    accent: '#22d3ee',
  },
  light: {
    label: 'Light',
    description: 'Cartographic',
    accent: '#0ea5e9',
  },
  streets: {
    label: 'Streets',
    description: 'Roads & detail',
    accent: '#f59e0b',
  },
  hybrid: {
    label: 'Hybrid',
    description: 'Satellite + overlays',
    accent: '#10b981',
  },
  satellite: {
    label: 'Satellite',
    description: 'Imagery only',
    accent: '#eab308',
  },
  minimal: {
    label: 'Minimal',
    description: 'No basemap',
    accent: '#a78bfa',
  },
};

export function isCompositedRasterTheme(key: MapThemeKey): boolean {
  return key === 'dark' || key === 'hybrid' || key === 'satellite' || key === 'minimal';
}
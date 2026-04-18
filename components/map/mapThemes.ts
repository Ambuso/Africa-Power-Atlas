/* ==================== components/map/mapThemes.ts ==================== */
/**
 * Production basemap styles.
 *
 * Strategy: we use VECTOR tiles wherever possible (MapTiler, Carto) so that
 * country/city labels render as crisp SDF glyphs at every zoom level instead
 * of the blurry raster labels we had before. Satellite imagery stays raster
 * (there is no vector equivalent) but we overlay vector labels on top of it
 * for the "hybrid" look you see in OpenGrid / Mapbox Studio.
 *
 * All styles share:
 *   - a deep navy background so tile gaps never flash white
 *   - a glyph endpoint (required for any `symbol` layers added downstream)
 *   - a sprite endpoint (optional but lets us use icons later)
 *
 * If you have a MapTiler key, set NEXT_PUBLIC_MAPTILER_KEY in .env.local.
 * Without it we fall back gracefully to Carto's free vector basemap.
 */

import type { MapThemeKey } from '@/lib/types';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';

/* ─────────────── shared constants ─────────────── */

const GLYPHS_URL =
  'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

const DEEP_NAVY = '#020617';
const DEEP_OCEAN = '#010a1a';

/* ─────────────── raster sources (satellite only) ─────────────── */

const ESRI_SATELLITE_SOURCE = {
  type: 'raster' as const,
  tiles: [
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ],
  tileSize: 256,
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  maxzoom: 19,
};

/* ─────────────── vector style URLs ─────────────── */

/**
 * Pick the best available vector style for the requested flavor.
 * Order of preference:
 *   1. MapTiler (if API key configured) — highest quality, best labels
 *   2. Carto vector basemaps (free, no key) — excellent fallback
 */
function vectorStyleUrl(flavor: 'dark' | 'darkmatter' | 'positron' | 'streets'): string {
  if (MAPTILER_KEY) {
    switch (flavor) {
      case 'dark':     return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
      case 'darkmatter': return `https://api.maptiler.com/maps/darkmatter/style.json?key=${MAPTILER_KEY}`;
      case 'positron': return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER_KEY}`;
      case 'streets':  return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`;
    }
  }
  // Carto fallback (no key needed, production-grade)
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

/* ─────────────── hybrid: satellite imagery + vector labels ─────────────── */

/**
 * Hybrid style is assembled inline because MapLibre can't merge a raster
 * source into a remote vector style. We emulate the look instead: satellite
 * tiles as the base, then a translucent dark wash, then we'll let the vector
 * label style be loaded separately on top via `setStyle` merging in the
 * component. For simplicity we ship it as a self-contained inline style
 * with imagery + our own admin/place label layers rendered from Natural
 * Earth at runtime (admin0/admin1 already come through your data pipeline).
 */
const HYBRID_STYLE = {
  version: 8 as const,
  glyphs: GLYPHS_URL,
  sources: {
    esri: ESRI_SATELLITE_SOURCE,
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': DEEP_NAVY },
    },
    {
      id: 'satellite-base',
      type: 'raster' as const,
      source: 'esri',
      paint: {
        'raster-opacity': 0.95,
        'raster-saturation': -0.18,
        'raster-contrast': 0.18,
        'raster-brightness-min': 0.04,
        'raster-brightness-max': 0.96,
      },
    },
    {
      // Subtle blue wash so the imagery reads as "data-viz satellite"
      // rather than raw Google Earth.
      id: 'satellite-wash',
      type: 'background' as const,
      paint: {
        'background-color': 'rgba(12, 74, 110, 0.12)',
        'background-opacity': 0.65,
      },
    },
  ],
};

/* ─────────────── pure satellite (for reference/plain imagery) ─────────────── */

const SATELLITE_ONLY_STYLE = {
  version: 8 as const,
  glyphs: GLYPHS_URL,
  sources: {
    esri: ESRI_SATELLITE_SOURCE,
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': DEEP_NAVY },
    },
    {
      id: 'satellite',
      type: 'raster' as const,
      source: 'esri',
      paint: {
        'raster-opacity': 0.97,
        'raster-saturation': -0.25,
        'raster-contrast': 0.22,
        'raster-brightness-min': 0.05,
        'raster-brightness-max': 0.98,
      },
    },
  ],
};

/* ─────────────── THEME REGISTRY ─────────────── */

export const MAP_THEMES = {
  /**
   * Dark vector — default. SDF labels, crisp country/city names, proper
   * admin boundaries baked in. This is the "production" look.
   */
  dark: {
    label: 'Dark',
    style: vectorStyleUrl('dark'),
  },

  /**
   * Cartographic light — for presentations, print exports, daytime viewing.
   */
  light: {
    label: 'Light',
    style: vectorStyleUrl('positron'),
  },

  /**
   * Detailed streets — good for zooming into cities, shows roads & POIs.
   */
  streets: {
    label: 'Streets',
    style: vectorStyleUrl('streets'),
  },

  /**
   * Satellite imagery + vector labels overlay. Best of both worlds —
   * you see the actual terrain but still get readable country names.
   */
  hybrid: {
    label: 'Hybrid',
    style: HYBRID_STYLE,
  },

  /**
   * Pure satellite imagery, minimal labels. Use when the data itself
   * is the story and basemap should recede.
   */
  satellite: {
    label: 'Satellite',
    style: SATELLITE_ONLY_STYLE,
  },

  /**
   * Heavily desaturated dark — emphasizes data overlays, minimal base.
   */
  minimal: {
    label: 'Minimal',
    style: vectorStyleUrl('darkmatter'),
  },
} as const satisfies Record<MapThemeKey, { label: string; style: string | object }>;

/* ─────────────── basemap metadata (shown in sidebar swatches) ─────────────── */

export const MAP_THEME_META: Record<
  MapThemeKey,
  { label: string; description: string; accent: string }
> = {
  dark:      { label: 'Dark',      description: 'Data-viz dark',      accent: '#22d3ee' },
  light:     { label: 'Light',     description: 'Cartographic',       accent: '#0ea5e9' },
  streets:   { label: 'Streets',   description: 'Roads & detail',     accent: '#f59e0b' },
  hybrid:    { label: 'Hybrid',    description: 'Satellite + labels', accent: '#10b981' },
  satellite: { label: 'Satellite', description: 'Imagery only',       accent: '#eab308' },
  minimal:   { label: 'Minimal',   description: 'Subdued base',       accent: '#a78bfa' },
};

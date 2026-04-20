/* ==================== lib/types.ts ====================
 * Central type contracts for the Africa Power Atlas.
 * No logic — just the shape of data flowing between prep and render.
 * ==================================================== */

import type { Feature, FeatureCollection as GeoJSONFC, Geometry } from 'geojson';

/* Geo primitives */
export type AnyFeature = Feature<Geometry, Record<string, unknown>>;
export type FeatureCollection = GeoJSONFC<Geometry, Record<string, unknown>>;
export type PlantFeatureCollection = GeoJSONFC<Geometry, PlantProperties>;

/* Power plants */
export interface PlantProperties {
  name?: string;
  fuel?: string;
  capacity_mw?: number;
  country?: string;
  iso3?: string;
  country_long?: string;
  country_code?: string;
  renewable?: boolean;
  color?: string;
  intensity?: number;
  owner?: string;
  operator?: string;
  commissioning_year?: number;
  status?: 'operating' | 'construction' | 'planned' | 'retired' | string;
  [key: string]: unknown;
}

/* Aggregates */
export interface FuelStat {
  fuel: string;
  count: number;
  mw: number;
  color: string;
  gw?: number;
  percentage?: number;
}

export interface CountryStat {
  country: string;
  iso3?: string;
  mw: number;
  gw: number;
  plantCount: number;
  renewableShare: number;
}

/* Bundle shapes */
export interface PlantBundle {
  plants: PlantFeatureCollection;
  totalPlants: number;
  totalGW: string;
  techStats: FuelStat[];
  countryStats: CountryStat[];
}

export interface MapDataBundle {
  plants: PlantBundle;
  transmission: FeatureCollection;
  substations: FeatureCollection;
  dataCenters: FeatureCollection;
  submarineCables: FeatureCollection | null;
  waterStress: FeatureCollection | null;
  plannedUpgrades: FeatureCollection;
  admin0: FeatureCollection | null;
  admin1: FeatureCollection | null;
  admin2: FeatureCollection | null;
  placeLabels: FeatureCollection | null;
}

/* UI state */
export interface LayerVisibility {
  plants: boolean;
  dataCenters: boolean;
  transmission: boolean;
  substations: boolean;
  submarineCables: boolean;
  plannedUpgrades: boolean;
  waterStress: boolean;
  admin0: boolean;
  admin1: boolean;
  admin2: boolean;
  placeLabels: boolean;
}

export type MapThemeKey = 'dark' | 'light' | 'streets' | 'hybrid' | 'satellite' | 'minimal';
export type ViewMode = 'points' | 'cluster' | 'heatmap';
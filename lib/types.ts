/* ==================== lib/types.ts ==================== */
import type { FeatureCollection as GeoJSONFeatureCollection, Point } from 'geojson';

export type FeatureCollection = GeoJSONFeatureCollection;
export type PlantFeatureCollection = GeoJSONFeatureCollection<Point>;

export type MapThemeKey =
  | 'dark'
  | 'light'
  | 'streets'
  | 'hybrid'
  | 'satellite'
  | 'minimal';

export type LayerVisibility = {
  plants: boolean;
  dataCenters: boolean;
  transmission: boolean;
  substations: boolean;
  submarineCables: boolean;
  plannedUpgrades: boolean;
  waterStress: boolean;
  /** Administrative boundaries (optional — default true in most themes) */
  admin0?: boolean;
  admin1?: boolean;
  admin2?: boolean;
  /** Country/city place labels rendered from our own Natural Earth data */
  placeLabels?: boolean;
};

export type FuelStat = {
  fuel: string;
  count: number;
  mw: number;
  color: string;
  gw?: number;
  percentage?: number;
};

export type CountryStat = {
  country: string;
  gw: number;
  mw: number;
};

export type PlantsBundle = {
  plants: FeatureCollection;
  totalPlants: number;
  totalGW: string;
  techStats: FuelStat[];
  countryStats: CountryStat[];
};

export type MapDataBundle = {
  plants: PlantsBundle;
  transmission: FeatureCollection;
  substations: FeatureCollection;
  dataCenters: FeatureCollection;
  waterStress: FeatureCollection | null;
  submarineCables: FeatureCollection | null;
  plannedUpgrades: FeatureCollection;
  admin0?: FeatureCollection | null;
  admin1?: FeatureCollection | null;
  admin2?: FeatureCollection | null;
  /** Optional: country/city points for high-quality label rendering */
  placeLabels?: FeatureCollection | null;
};

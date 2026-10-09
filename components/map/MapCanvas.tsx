/* ==================== components/map/MapCanvas.tsx ====================
 * The core map renderer.
 *
 * Changes vs previous:
 *  - Notifies parent via onMapReady() as soon as first paint happens so the
 *    LoadingScreen can fade out cleanly.
 *  - Runs a smooth "light up" fade-in when plant & data-center data first
 *    arrives: opacity ramps from 0 → full over ~700ms (opacity transitions
 *    on circle layers).
 *  - Continuous gentle pulse animation on plant pulse/glow layers via
 *    animated opacity loop — gives the "heartbeat" feel.
 *  - Guaranteed theme resolver added so activeTheme is never undefined.
 *  - Fixed Point coordinate typing for lng/lat popup payloads.
 * ==================================================== */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import maplibregl, { type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {
  MapDataBundle,
  LayerVisibility,
  PlantFeatureCollection,
  MapThemeKey,
  ViewMode,
} from '@/lib/types';
import { MAP_THEMES, isLightTheme } from './mapThemes';
import {
  SOURCE_IDS,
  LAYER_IDS,
  installMapDataLayers,
  updateSourceData,
  applyLayerVisibility,
  maybeApplyAtmosphere,
  ADMIN0_GLOW_OPACITY,
  ADMIN0_LINE_OPACITY,
  SUBMARINE_CABLE_OPACITY,
  zoomScaled,
} from './mapStyles';
import { fuelColors, colorForFuel } from './fuelColors';
import { featureMatchesCountries } from '@/lib/countries';
import { Zap, Database, X } from 'lucide-react';

/* ─────────── SDF diamond icon ─────────── */
function createDiamondImageData(size = 64): ImageData {
  if (typeof document === 'undefined') {
    return new ImageData(1, 1);
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new ImageData(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'white';
  const pad = 3;
  const mid = size / 2;
  ctx.beginPath();
  ctx.moveTo(mid, pad);
  ctx.lineTo(size - pad, mid);
  ctx.lineTo(mid, size - pad);
  ctx.lineTo(pad, mid);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function registerPlantIcon(map: maplibregl.Map) {
  if (map.hasImage('plant-diamond')) return;
  try {
    const data = createDiamondImageData(64);
    map.addImage('plant-diamond', data as any, { sdf: true });
  } catch (e) {
    console.warn('[MapLibre] failed to register plant diamond icon', e);
  }
}

/* ─────────── types ─────────── */

interface Props {
  data?: MapDataBundle | null;
  theme: MapThemeKey;
  visibleLayers: LayerVisibility;
  viewMode: ViewMode;
  selectedFuels?: string[];
  renewableOnly?: boolean;
  selectedCountries?: string[];
  bubbleScale?: number;
  /** Called once when style is loaded & data has been pushed to sources. */
  onMapReady?: () => void;
}

type PopupKind = 'plant' | 'datacenter';

interface PopupData {
  kind: PopupKind;
  name?: string;
  fuel?: string;
  capacity?: number;
  owner?: string;
  year?: number;
  renewable?: boolean;
  status?: string;
  operator?: string;
  powerMW?: number;
  tier?: string;
  city?: string;
  country?: string;
  lng: number;
  lat: number;
}

type ThemeConfig = (typeof MAP_THEMES)['dark'];

function getThemeConfig(theme: MapThemeKey): ThemeConfig {
  const themes = MAP_THEMES as Record<string, ThemeConfig | undefined>;
  return themes[theme] ?? MAP_THEMES.dark;
}

const EMPTY_FC: PlantFeatureCollection = { type: 'FeatureCollection', features: [] };

/* ─────────── component ─────────── */

export default function MapCanvas({
  data,
  theme,
  visibleLayers,
  viewMode,
  selectedFuels = [],
  renewableOnly = false,
  selectedCountries = [],
  bubbleScale = 1.2,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isStyleLoaded = useRef(false);
  const isFirstThemeRender = useRef(true);
  const interactionsInstalled = useRef(false);
  const hasLitUp = useRef(false);
  const pulseFrameRef = useRef<number | null>(null);
  /** Clustering state of the plants source (installMapDataLayers creates it clustered). */
  const plantsClusteredRef = useRef(true);
  const onMapReadyRef = useRef(onMapReady);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  const [popup, setPopup] = useState<PopupData | null>(null);

  /* ─ filtering ─ */
  const filteredPlants = useMemo<PlantFeatureCollection>(() => {
    const raw = data?.plants?.plants;
    if (!raw || raw.type !== 'FeatureCollection') return EMPTY_FC;

    let features = raw.features;

    if (renewableOnly) {
      features = features.filter((f) => f.properties?.renewable === true);
    }
    if (selectedFuels.length) {
      features = features.filter((f) => selectedFuels.includes(f.properties?.fuel ?? ''));
    }
    if (selectedCountries.length) {
      features = features.filter((f) =>
        featureMatchesCountries(f.properties as any, selectedCountries),
      );
    }

    return { type: 'FeatureCollection', features } as PlantFeatureCollection;
  }, [data, renewableOnly, selectedFuels, selectedCountries]);

  /* ─ refs that mirror state ─ */
  const dataRef = useRef(data);
  const filteredPlantsRef = useRef(filteredPlants);
  const visibleLayersRef = useRef(visibleLayers);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    filteredPlantsRef.current = filteredPlants;
  }, [filteredPlants]);

  useEffect(() => {
    visibleLayersRef.current = visibleLayers;
  }, [visibleLayers]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  /* ─ paint expressions ─ */
  const radiusExpression = useMemo<ExpressionSpecification>(
    () =>
      zoomScaled([
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 3 * bubbleScale,
        100, 5 * bubbleScale,
        500, 8 * bubbleScale,
        1000, 11 * bubbleScale,
        5000, 16 * bubbleScale,
      ]) as ExpressionSpecification,
    [bubbleScale],
  );

  const glowRadiusExpression = useMemo<ExpressionSpecification>(
    () =>
      zoomScaled([
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 7 * bubbleScale,
        100, 12 * bubbleScale,
        500, 19 * bubbleScale,
        1000, 27 * bubbleScale,
        5000, 42 * bubbleScale,
      ]) as ExpressionSpecification,
    [bubbleScale],
  );

  const pulseRadiusExpression = useMemo<ExpressionSpecification>(
    () =>
      zoomScaled([
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 12 * bubbleScale,
        100, 20 * bubbleScale,
        500, 32 * bubbleScale,
        1000, 46 * bubbleScale,
        5000, 70 * bubbleScale,
      ]) as ExpressionSpecification,
    [bubbleScale],
  );

  const colorExpression = useMemo<ExpressionSpecification>(() => {
    const expr: unknown[] = ['match', ['get', 'fuel']];
    for (const [fuel, color] of Object.entries(fuelColors)) {
      if (fuel !== 'Unknown') {
        expr.push(fuel, color);
      }
    }
    expr.push(fuelColors.Unknown);
    return expr as ExpressionSpecification;
  }, []);

  const applyPlantPaint = useCallback(
    (map: maplibregl.Map) => {
      if (map.getLayer(LAYER_IDS.plants)) {
        map.setPaintProperty(LAYER_IDS.plants, 'circle-color', colorExpression);
        map.setPaintProperty(LAYER_IDS.plants, 'circle-radius', radiusExpression);
      }
      if (map.getLayer(LAYER_IDS.plantsGlow)) {
        map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-color', colorExpression);
        map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-radius', glowRadiusExpression);
      }
      if (map.getLayer(LAYER_IDS.plantsPulse)) {
        map.setPaintProperty(LAYER_IDS.plantsPulse, 'circle-color', colorExpression);
        map.setPaintProperty(LAYER_IDS.plantsPulse, 'circle-radius', pulseRadiusExpression);
      }
    },
    [colorExpression, radiusExpression, glowRadiusExpression, pulseRadiusExpression],
  );

  const clampOpacity = (v: number): number => {
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  };

  const setOpacity = useCallback(
    (map: maplibregl.Map, layerId: string, prop: string, value: number) => {
      if (!map.getLayer(layerId)) return;
      try {
        map.setPaintProperty(layerId, prop, clampOpacity(value));
      } catch {}
    },
    [],
  );

  const lightUpAnimation = useCallback(
    (map: maplibregl.Map) => {
      if (hasLitUp.current) return;
      hasLitUp.current = true;

      const start = performance.now();
      const DURATION = 900;
      const EASE = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const raw = (now - start) / DURATION;
        const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
        const e = EASE(t);

        setOpacity(map, LAYER_IDS.admin0Glow, 'line-opacity', ADMIN0_GLOW_OPACITY * e);
        setOpacity(map, LAYER_IDS.admin0, 'line-opacity', ADMIN0_LINE_OPACITY * e);
        setOpacity(map, LAYER_IDS.transmission, 'line-opacity', 0.88 * e);
        setOpacity(map, LAYER_IDS.submarineCables, 'line-opacity', SUBMARINE_CABLE_OPACITY * e);
        setOpacity(map, LAYER_IDS.plants, 'circle-opacity', e);
        setOpacity(map, LAYER_IDS.plantsGlow, 'circle-opacity', 0.32 * e);
        setOpacity(map, LAYER_IDS.plantsPulse, 'circle-opacity', 0.10 * e);
        setOpacity(map, LAYER_IDS.dataCenters, 'circle-opacity', 0.95 * e);
        setOpacity(map, LAYER_IDS.dataCentersGlow, 'circle-opacity', 0.28 * e);
        setOpacity(map, LAYER_IDS.dataCentersPulse, 'circle-opacity', 0.12 * e);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          startPulseLoop(map);
        }
      };

      requestAnimationFrame(step);
    },
    [setOpacity],
  );

  const startPulseLoop = useCallback(
    (map: maplibregl.Map) => {
      if (pulseFrameRef.current !== null) return;

      const loop = () => {
        const phase = (Math.sin((performance.now() / 3000) * Math.PI * 2) + 1) / 2;
        const plantPulse = 0.08 + phase * 0.08;
        const dcPulse = 0.09 + phase * 0.09;

        setOpacity(map, LAYER_IDS.plantsPulse, 'circle-opacity', plantPulse);
        setOpacity(map, LAYER_IDS.dataCentersPulse, 'circle-opacity', dcPulse);

        pulseFrameRef.current = requestAnimationFrame(loop);
      };

      pulseFrameRef.current = requestAnimationFrame(loop);
    },
    [setOpacity],
  );

  const pushAllData = useCallback((map: maplibregl.Map) => {
    const fp = filteredPlantsRef.current;
    const d = dataRef.current;

    updateSourceData(map, SOURCE_IDS.plants, fp ?? EMPTY_FC);
    updateSourceData(map, SOURCE_IDS.transmission, d?.transmission ?? null);
    updateSourceData(map, SOURCE_IDS.substations, d?.substations ?? null);
    updateSourceData(map, SOURCE_IDS.dataCenters, d?.dataCenters ?? null);
    updateSourceData(map, SOURCE_IDS.waterStress, d?.waterStress ?? null);
    updateSourceData(map, SOURCE_IDS.submarineCables, d?.submarineCables ?? null);
    updateSourceData(map, SOURCE_IDS.plannedUpgrades, d?.plannedUpgrades ?? null);
    updateSourceData(map, SOURCE_IDS.admin0, d?.admin0 ?? null);
    updateSourceData(map, SOURCE_IDS.admin1, d?.admin1 ?? null);
    updateSourceData(map, SOURCE_IDS.admin2, d?.admin2 ?? null);
    updateSourceData(map, SOURCE_IDS.placeLabels, d?.placeLabels ?? null);
  }, []);

  /** The plants source is created clustered; only Cluster mode should group
   *  points, otherwise Points mode hides most plants below zoom 5. */
  const syncPlantClustering = useCallback((map: maplibregl.Map) => {
    const src = map.getSource(SOURCE_IDS.plants) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const want = viewModeRef.current === 'cluster';
    if (plantsClusteredRef.current === want) return;
    src.setClusterOptions({ cluster: want });
    plantsClusteredRef.current = want;
  }, []);

  const installInteractions = useCallback((map: maplibregl.Map) => {
    if (interactionsInstalled.current) return;
    interactionsInstalled.current = true;

    const onPointerEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onPointerLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('mouseenter', LAYER_IDS.plants, onPointerEnter);
    map.on('mouseleave', LAYER_IDS.plants, onPointerLeave);
    map.on('mouseenter', LAYER_IDS.plantsDiamond, onPointerEnter);
    map.on('mouseleave', LAYER_IDS.plantsDiamond, onPointerLeave);
    map.on('mouseenter', LAYER_IDS.plantsClusters, onPointerEnter);
    map.on('mouseleave', LAYER_IDS.plantsClusters, onPointerLeave);
    map.on('mouseenter', LAYER_IDS.dataCenters, onPointerEnter);
    map.on('mouseleave', LAYER_IDS.dataCenters, onPointerLeave);

    const plantClickHandler = (e: any) => {
      const f = e.features?.[0];
      if (!f || !f.geometry || f.geometry.type !== 'Point') return;

      const [lng, lat] = f.geometry.coordinates as [number, number];
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const country =
        p.country_long ?? p.country_name ?? p.country ?? p.country_code ?? p.iso3 ?? '';

      setPopup({
        kind: 'plant',
        name: String(p.name ?? 'Unknown plant'),
        fuel: String(p.fuel ?? ''),
        capacity: Number(p.capacity_mw) || undefined,
        country: String(country),
        owner: p.owner ? String(p.owner) : undefined,
        year: p.commissioning_year ? Number(p.commissioning_year) : undefined,
        renewable: Boolean(p.renewable),
        status: p.status ? String(p.status) : undefined,
        lng,
        lat,
      });
    };

    map.on('click', LAYER_IDS.plants, plantClickHandler);
    map.on('click', LAYER_IDS.plantsDiamond, plantClickHandler);

    map.on('click', LAYER_IDS.dataCenters, (e) => {
      const f = e.features?.[0];
      if (!f || !f.geometry || f.geometry.type !== 'Point') return;

      const [lng, lat] = f.geometry.coordinates as [number, number];
      const p = (f.properties ?? {}) as Record<string, unknown>;

      const name = p.name ?? p.facility_name ?? p.site_name ?? p.data_center_name ?? 'Data center';
      const operator = p.operator ?? p.company ?? p.owner ?? p.provider ?? undefined;
      const city = p.city ?? p.locality ?? undefined;
      const country =
        p.country_long ?? p.country_name ?? p.country ?? p.country_code ?? p.iso3 ?? '';
      const powerMW =
        Number(p.power_mw) ||
        Number(p.capacity_mw) ||
        Number(p.it_capacity_mw) ||
        Number(p.estimated_mw) ||
        undefined;
      const tier = p.tier ?? p.rating ?? undefined;

      setPopup({
        kind: 'datacenter',
        name: String(name),
        operator: operator ? String(operator) : undefined,
        city: city ? String(city) : undefined,
        country: String(country),
        powerMW,
        tier: tier ? String(tier) : undefined,
        lng,
        lat,
      });
    });

    map.on('click', LAYER_IDS.plantsClusters, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.plantsClusters],
      });
      const f = features[0];
      if (!f || f.geometry.type !== 'Point') return;

      const clusterId = f.properties?.cluster_id;
      const src = map.getSource(SOURCE_IDS.plants) as maplibregl.GeoJSONSource;
      if (clusterId == null || !src) return;

      src.getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: zoom + 0.2,
            duration: 600,
          });
        })
        .catch(() => {});
    });

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [
          LAYER_IDS.plants,
          LAYER_IDS.plantsDiamond,
          LAYER_IDS.plantsClusters,
          LAYER_IDS.dataCenters,
        ],
      });
      if (!hits.length) setPopup(null);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const activeTheme = getThemeConfig(theme);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: activeTheme.style as any,
      center: [20, 3],
      zoom: 2.9,
      minZoom: 1.2,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      fadeDuration: 180,
      renderWorldCopies: false,
    });

    map.on('error', (e) => {
      const message = e?.error?.message ?? String(e);
      // A failed tile/style fetch (offline, blocked host) is recoverable —
      // warn instead of error so it doesn't trip the Next.js error overlay.
      if (/AJAXError|Failed to fetch/i.test(message)) {
        console.warn('[MapLibre]', message);
      } else {
        console.error('[MapLibre]', message);
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-left');

    mapRef.current = map;

    map.on('load', () => {
      map.setProjection({ type: 'globe' });

      maybeApplyAtmosphere(map, isLightTheme(theme));
      registerPlantIcon(map);

      setTimeout(() => {
        installMapDataLayers(map);
        isStyleLoaded.current = true;
        pushAllData(map);
        applyPlantPaint(map);
        syncPlantClustering(map);
        applyLayerVisibility(map, visibleLayersRef.current, viewModeRef.current);
        installInteractions(map);

        onMapReadyRef.current?.();
        requestAnimationFrame(() => lightUpAnimation(map));
      }, 60);
    });

    return () => {
      isStyleLoaded.current = false;
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isFirstThemeRender.current) {
      isFirstThemeRender.current = false;
      return;
    }

    const activeTheme = getThemeConfig(theme);

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    isStyleLoaded.current = false;
    // diff:false guarantees a full reload so `style.load` always fires and the
    // overlay layers get reinstalled (a successful diff skips that event).
    map.setStyle(activeTheme.style as any, { diff: false });

    map.once('style.load', () => {
      // The new style recreates the plants source clustered.
      plantsClusteredRef.current = true;
      map.setProjection({ type: 'globe' });

      maybeApplyAtmosphere(map, isLightTheme(theme));
      registerPlantIcon(map);

      setTimeout(() => {
        installMapDataLayers(map);
        isStyleLoaded.current = true;
        pushAllData(map);
        applyPlantPaint(map);
        syncPlantClustering(map);
        applyLayerVisibility(map, visibleLayersRef.current, viewModeRef.current);
        installInteractions(map);

        map.jumpTo({
          center: currentCenter,
          zoom: currentZoom,
          pitch: currentPitch,
          bearing: currentBearing,
        });
      }, 60);
    });
  }, [theme, pushAllData, applyPlantPaint, syncPlantClustering, installInteractions]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;

    updateSourceData(map, SOURCE_IDS.plants, filteredPlants);
    applyPlantPaint(map);
  }, [filteredPlants, applyPlantPaint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;

    updateSourceData(map, SOURCE_IDS.transmission, data?.transmission ?? null);
    updateSourceData(map, SOURCE_IDS.substations, data?.substations ?? null);
    updateSourceData(map, SOURCE_IDS.dataCenters, data?.dataCenters ?? null);
    updateSourceData(map, SOURCE_IDS.waterStress, data?.waterStress ?? null);
    updateSourceData(map, SOURCE_IDS.submarineCables, data?.submarineCables ?? null);
    updateSourceData(map, SOURCE_IDS.plannedUpgrades, data?.plannedUpgrades ?? null);
    updateSourceData(map, SOURCE_IDS.admin0, data?.admin0 ?? null);
    updateSourceData(map, SOURCE_IDS.admin1, data?.admin1 ?? null);
    updateSourceData(map, SOURCE_IDS.admin2, data?.admin2 ?? null);
    updateSourceData(map, SOURCE_IDS.placeLabels, data?.placeLabels ?? null);

    if (!hasLitUp.current && data && isStyleLoaded.current) {
      requestAnimationFrame(() => lightUpAnimation(map));
    }
  }, [data, lightUpAnimation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;

    if (map.getLayer(LAYER_IDS.plants)) {
      map.setPaintProperty(LAYER_IDS.plants, 'circle-radius', radiusExpression);
    }
    if (map.getLayer(LAYER_IDS.plantsGlow)) {
      map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-radius', glowRadiusExpression);
    }
    if (map.getLayer(LAYER_IDS.plantsPulse)) {
      map.setPaintProperty(LAYER_IDS.plantsPulse, 'circle-radius', pulseRadiusExpression);
    }
  }, [radiusExpression, glowRadiusExpression, pulseRadiusExpression]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;
    syncPlantClustering(map);
    applyLayerVisibility(map, visibleLayers, viewMode);
  }, [visibleLayers, viewMode, syncPlantClustering]);

  const isDataCenter = popup?.kind === 'datacenter';
  const accentColor = isDataCenter
    ? '#67e8f9'
    : popup?.fuel
      ? colorForFuel(popup.fuel)
      : fuelColors.Unknown;

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {popup && (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 z-30 w-[min(92vw,360px)] -translate-x-1/2 overflow-hidden rounded-[20px] panel-surface animate-fade-in-up">
          <div
            className="h-[3px] w-full"
            style={{ background: accentColor, boxShadow: `0 0 14px ${accentColor}` }}
          />
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    {isDataCenter ? <Database size={11} /> : <Zap size={11} />}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {isDataCenter ? 'Data center' : 'Power plant'}
                  </span>
                </div>
                <p className="truncate text-[14px] font-semibold leading-snug text-white">
                  {popup.name}
                </p>

                {!isDataCenter && popup.fuel && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
                    />
                    <span className="text-[12px] text-slate-400">{popup.fuel}</span>
                    {popup.renewable && (
                      <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                        Renewable
                      </span>
                    )}
                    {popup.status && popup.status !== 'operating' && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                        {popup.status}
                      </span>
                    )}
                  </div>
                )}

                {isDataCenter && popup.tier && (
                  <div className="mt-1.5">
                    <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                      {popup.tier}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setPopup(null)}
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/8 pt-3">
              {isDataCenter ? (
                <>
                  {popup.operator && <Stat label="Operator" value={popup.operator} />}
                  {popup.powerMW != null && (
                    <Stat label="IT Load" value={`${popup.powerMW.toLocaleString()} MW`} />
                  )}
                  {popup.city && <Stat label="City" value={popup.city} />}
                  {popup.country && <Stat label="Country" value={popup.country} />}
                </>
              ) : (
                <>
                  {popup.country && <Stat label="Country" value={popup.country} />}
                  {popup.capacity != null && (
                    <Stat label="Capacity" value={`${popup.capacity.toLocaleString()} MW`} />
                  )}
                  {popup.owner && <Stat label="Owner" value={popup.owner} />}
                  {popup.year && <Stat label="Commissioned" value={String(popup.year)} />}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[12px] font-medium text-slate-200">{value}</p>
    </div>
  );
}
/* ==================== components/map/MapCanvas.tsx ==================== */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {
  MapDataBundle,
  LayerVisibility,
  PlantFeatureCollection,
  MapThemeKey,
} from '@/lib/types';
import { MAP_THEMES } from './mapThemes';
import {
  SOURCE_IDS,
  LAYER_IDS,
  installMapDataLayers,
  updateSourceData,
  applyLayerVisibility,
  maybeApplyAtmosphere,
} from './mapStyles';
import { fuelColors } from './fuelColors';

type Props = {
  data?: MapDataBundle | null;
  theme: MapThemeKey;
  onThemeChange: (t: MapThemeKey) => void;
  visibleLayers: LayerVisibility;
  onVisibilityChange: (key: keyof LayerVisibility) => void;
  selectedFuels?: string[];
  onToggleFuel?: (fuel: string) => void;
  onResetFuelFilter?: () => void;
  renewableOnly?: boolean;
  onRenewableOnlyChange?: (v: boolean) => void;
  selectedCountries?: string[];
  onToggleCountry?: (country: string) => void;
  bubbleScale?: number;
  onBubbleScaleChange?: (v: number) => void;
};

type PopupData = {
  name?: string;
  fuel?: string;
  capacity?: number;
  country?: string;
  owner?: string;
  year?: number;
  renewable?: boolean;
  lng: number;
  lat: number;
};

const EMPTY_FC: PlantFeatureCollection = { type: 'FeatureCollection', features: [] };

export default function MapCanvas({
  data,
  theme,
  visibleLayers,
  selectedFuels = [],
  renewableOnly = false,
  selectedCountries = [],
  bubbleScale = 1.2,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isStyleLoaded = useRef(false);
  const isFirstThemeRender = useRef(true);

  const [popupData, setPopupData] = useState<PopupData | null>(null);

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
      features = features.filter((f) => {
        const c =
          f.properties?.country ??
          f.properties?.iso3 ??
          f.properties?.country_code ??
          '';
        return selectedCountries.includes(c);
      });
    }

    return { type: 'FeatureCollection', features } as PlantFeatureCollection;
  }, [data, renewableOnly, selectedFuels, selectedCountries]);

  const radiusExpression = useMemo(
    (): maplibregl.ExpressionSpecification =>
      [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 3 * bubbleScale,
        100, 5 * bubbleScale,
        500, 8 * bubbleScale,
        1000, 11 * bubbleScale,
        5000, 16 * bubbleScale,
      ] as maplibregl.ExpressionSpecification,
    [bubbleScale],
  );

  const glowRadiusExpression = useMemo(
    (): maplibregl.ExpressionSpecification =>
      [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'capacity_mw']], 50],
        0, 5 * bubbleScale,
        100, 9 * bubbleScale,
        500, 14 * bubbleScale,
        1000, 20 * bubbleScale,
        5000, 30 * bubbleScale,
      ] as maplibregl.ExpressionSpecification,
    [bubbleScale],
  );

  const colorExpression = useMemo((): maplibregl.ExpressionSpecification => {
    const expr: unknown[] = ['match', ['get', 'fuel']];
    for (const [fuel, color] of Object.entries(fuelColors)) {
      if (fuel !== 'Unknown') {
        expr.push(fuel);
        expr.push(color);
      }
    }
    expr.push(fuelColors.Unknown);
    return expr as maplibregl.ExpressionSpecification;
  }, []);

  const applyPlantPaint = useCallback(
    (map: maplibregl.Map) => {
      if (map.getLayer(LAYER_IDS.plants)) {
        map.setPaintProperty(LAYER_IDS.plants, 'circle-color', colorExpression);
        map.setPaintProperty(LAYER_IDS.plants, 'circle-radius', radiusExpression);
        map.setPaintProperty(LAYER_IDS.plants, 'circle-opacity', 0.92);
        map.setPaintProperty(LAYER_IDS.plants, 'circle-stroke-width', 0.8);
        map.setPaintProperty(LAYER_IDS.plants, 'circle-stroke-color', 'rgba(255,255,255,0.35)');
      }
      if (map.getLayer(LAYER_IDS.plantsGlow)) {
        map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-color', colorExpression);
        map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-radius', glowRadiusExpression);
        map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-opacity', 0.22);
        map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-blur', 1.1);
      }
    },
    [colorExpression, radiusExpression, glowRadiusExpression],
  );

  const pushAllData = useCallback(
    (map: maplibregl.Map) => {
      if (filteredPlants.features.length > 0) {
        updateSourceData(map, SOURCE_IDS.plants, filteredPlants);
      }
      if (data?.transmission?.features?.length)    updateSourceData(map, SOURCE_IDS.transmission, data.transmission);
      if (data?.substations?.features?.length)     updateSourceData(map, SOURCE_IDS.substations, data.substations);
      if (data?.dataCenters?.features?.length)     updateSourceData(map, SOURCE_IDS.dataCenters, data.dataCenters);
      if (data?.waterStress?.features?.length)     updateSourceData(map, SOURCE_IDS.waterStress, data.waterStress);
      if (data?.submarineCables?.features?.length) updateSourceData(map, SOURCE_IDS.submarineCables, data.submarineCables);
      if (data?.plannedUpgrades?.features?.length) updateSourceData(map, SOURCE_IDS.plannedUpgrades, data.plannedUpgrades);
      if (data?.admin0?.features?.length)          updateSourceData(map, SOURCE_IDS.admin0, data.admin0);
      if (data?.admin1?.features?.length)          updateSourceData(map, SOURCE_IDS.admin1, data.admin1);
      if (data?.admin2?.features?.length)          updateSourceData(map, SOURCE_IDS.admin2, data.admin2);
      if (data?.placeLabels?.features?.length)     updateSourceData(map, SOURCE_IDS.placeLabels, data.placeLabels);
    },
    [data, filteredPlants],
  );

  /* ─────────── mount ─────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_THEMES[theme].style as any,
      center: [20, 5],
      zoom: 3,
      minZoom: 1.5,
      maxZoom: 18,
      pitch: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    map.on('load', () => {
      maybeApplyAtmosphere(map);
      installMapDataLayers(map);
      isStyleLoaded.current = true;

      pushAllData(map);
      applyPlantPaint(map);
      applyLayerVisibility(map, visibleLayers);

      map.on('mouseenter', LAYER_IDS.plants, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', LAYER_IDS.plants, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', LAYER_IDS.plants, (e) => {
        const f = e.features?.[0];
        if (!f || !f.geometry || f.geometry.type !== 'Point') return;

        const [lng, lat] = f.geometry.coordinates;

        if (typeof lng !== 'number' || typeof lat !== 'number') return;

        const p = (f.properties ?? {}) as Record<string, unknown>;

        setPopupData({
          name: String(p.name ?? 'Unknown plant'),
          fuel: String(p.fuel ?? ''),
          capacity: Number(p.capacity_mw) || undefined,
          country: String(p.country ?? p.country_code ?? p.iso3 ?? ''),
          owner: p.owner ? String(p.owner) : undefined,
          year: p.commissioning_year ? Number(p.commissioning_year) : undefined,
          renewable: Boolean(p.renewable),
          lng,
          lat,
        });
      });
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_IDS.plants] });
        if (!hits.length) setPopupData(null);
      });
    });

    return () => {
      isStyleLoaded.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────── theme swap ─────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isFirstThemeRender.current) {
      isFirstThemeRender.current = false;
      return;
    }

    isStyleLoaded.current = false;
    map.setStyle(MAP_THEMES[theme].style as any);

    map.once('style.load', () => {
      maybeApplyAtmosphere(map);
      installMapDataLayers(map);
      isStyleLoaded.current = true;
      pushAllData(map);
      applyPlantPaint(map);
      applyLayerVisibility(map, visibleLayers);
    });
  }, [theme, visibleLayers, pushAllData, applyPlantPaint]);

  /* ─────────── plants filter ─────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;
    if (filteredPlants.features.length === 0) return;

    updateSourceData(map, SOURCE_IDS.plants, filteredPlants);
    applyPlantPaint(map);

    if (filteredPlants.features.length < 3000) {
      const bounds = new maplibregl.LngLatBounds();
      let any = false;
      for (const f of filteredPlants.features) {
        if (f.geometry.type === 'Point') {
          bounds.extend(f.geometry.coordinates as [number, number]);
          any = true;
        }
      }
      if (any && !bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 100, maxZoom: 6, duration: 800 });
      }
    }
  }, [filteredPlants, applyPlantPaint]);

  /* ─────────── push other sources ─────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current || !data) return;

    if (data.transmission?.features?.length)    updateSourceData(map, SOURCE_IDS.transmission, data.transmission);
    if (data.substations?.features?.length)     updateSourceData(map, SOURCE_IDS.substations, data.substations);
    if (data.dataCenters?.features?.length)     updateSourceData(map, SOURCE_IDS.dataCenters, data.dataCenters);
    if (data.waterStress?.features?.length)     updateSourceData(map, SOURCE_IDS.waterStress, data.waterStress);
    if (data.submarineCables?.features?.length) updateSourceData(map, SOURCE_IDS.submarineCables, data.submarineCables);
    if (data.plannedUpgrades?.features?.length) updateSourceData(map, SOURCE_IDS.plannedUpgrades, data.plannedUpgrades);

    if (data.admin0?.features?.length)      updateSourceData(map, SOURCE_IDS.admin0, data.admin0);
    if (data.admin1?.features?.length)      updateSourceData(map, SOURCE_IDS.admin1, data.admin1);
    if (data.admin2?.features?.length)      updateSourceData(map, SOURCE_IDS.admin2, data.admin2);
    if (data.placeLabels?.features?.length) updateSourceData(map, SOURCE_IDS.placeLabels, data.placeLabels);
  }, [data]);

  /* ─────────── bubble scale ─────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;
    if (map.getLayer(LAYER_IDS.plants)) {
      map.setPaintProperty(LAYER_IDS.plants, 'circle-radius', radiusExpression);
    }
    if (map.getLayer(LAYER_IDS.plantsGlow)) {
      map.setPaintProperty(LAYER_IDS.plantsGlow, 'circle-radius', glowRadiusExpression);
    }
  }, [radiusExpression, glowRadiusExpression]);

  /* ─────────── visibility changes ─────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded.current) return;
    applyLayerVisibility(map, visibleLayers);
  }, [visibleLayers]);

  const dotColor = popupData?.fuel
    ? fuelColors[popupData.fuel as keyof typeof fuelColors] ?? fuelColors.Unknown
    : fuelColors.Unknown;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {popupData && (
        <div
          className="pointer-events-auto absolute bottom-8 left-1/2 z-30 w-[min(92vw,340px)] -translate-x-1/2 overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl"
          style={{ animation: 'fadeUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <style>{`
            @keyframes fadeUp {
              from { opacity: 0; transform: translateX(-50%) translateY(12px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>

          <div
            className="h-[3px] w-full"
            style={{ background: dotColor, boxShadow: `0 0 12px ${dotColor}` }}
          />

          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-snug text-white">
                  {popupData.name}
                </p>
                {popupData.fuel && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                    />
                    <span className="text-xs text-slate-400">{popupData.fuel}</span>
                    {popupData.renewable && (
                      <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                        Renewable
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setPopupData(null)}
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/8 pt-3">
              {popupData.country && <Stat label="Country" value={popupData.country} />}
              {popupData.capacity != null && (
                <Stat label="Capacity" value={`${popupData.capacity.toLocaleString()} MW`} />
              )}
              {popupData.owner && <Stat label="Owner" value={popupData.owner} />}
              {popupData.year && <Stat label="Commissioned" value={String(popupData.year)} />}
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
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="truncate text-xs font-medium text-slate-200">{value}</p>
    </div>
  );
}
/* ==================== app/page.tsx ==================== */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import LayerPanel from '@/components/sidebar/LayerPanel';
import TopBar from '@/components/topbar/TopBar';
import MapLegend from '@/components/map/MapLegend';
import StatsPanel from '@/components/panels/StatsPanel';
import LoadingScreen from '@/components/map/LoadingScreen';
import { loadAndPreparePowerGridData } from '@/components/map/dataPrep';
import { ALL_AFRICAN_ISO2, featureMatchesCountries, resolveIso2 } from '@/lib/countries';
import type {
  MapDataBundle,
  LayerVisibility,
  MapThemeKey,
  ViewMode,
} from '@/lib/types';

// Map is dynamic (client-only, MapLibre requires window)
const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => null,
});

export default function HomePage() {
  /* ─── data ─── */
  const [data, setData] = useState<MapDataBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ─── loading flow state ─── */
  // dataLoaded    → GeoJSON fetch completed
  // mapReady      → MapCanvas has installed layers + pushed data + first paint happened
  // loaderGone    → fade-out animation completed → we can unmount LoadingScreen
  const [mapReady, setMapReady] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);

  /* ─── UI state ─── */
  const [theme, setTheme] = useState<MapThemeKey>('dark');
  const [viewMode, setViewMode] = useState<ViewMode>('points');
  const [bubbleScale, setBubbleScale] = useState(1.0);

  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    plants: true,
    dataCenters: true,
    transmission: true,
    substations: false,
    submarineCables: true,
    plannedUpgrades: false,
    waterStress: false,
    admin0: true,
    admin1: false,
    admin2: false,
    placeLabels: true,
  });

  const [renewableOnly, setRenewableOnly] = useState(false);
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  /* ─── effects ─── */

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const result = await loadAndPreparePowerGridData();
      setData(result);
    } catch (error) {
      console.error('Failed to load power grid data:', error);
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load map data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await loadAndPreparePowerGridData();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load map data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Safety net: if something gets stuck, still reveal the map after 8s */
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 8000);
    return () => clearTimeout(t);
  }, []);

  /* ─── handlers ─── */

  const handleVisibilityChange = useCallback((key: keyof LayerVisibility) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleFuel = useCallback((fuel: string) => {
    setSelectedFuels((prev) =>
      prev.includes(fuel) ? prev.filter((f) => f !== fuel) : [...prev, fuel],
    );
  }, []);

  const handleResetFuelFilter = useCallback(() => {
    setSelectedFuels([]);
    setRenewableOnly(false);
  }, []);

  const handleToggleCountry = useCallback((raw: string) => {
    const iso2 = resolveIso2(raw) ?? raw;
    setSelectedCountries((prev) =>
      prev.includes(iso2) ? prev.filter((c) => c !== iso2) : [...prev, iso2],
    );
  }, []);

  const handleSelectAllCountries = useCallback(
    () => setSelectedCountries([...ALL_AFRICAN_ISO2]),
    [],
  );
  const handleClearCountries = useCallback(() => setSelectedCountries([]), []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const handleLoaderFadeComplete = useCallback(() => {
    setLoaderGone(true);
  }, []);

  /* ─── derived ─── */

  const visiblePlantCount = useMemo(() => {
    const plants = data?.plants?.plants?.features ?? [];
    return plants.filter((f) => {
      const renewable = f.properties?.renewable === true;
      const fuel = f.properties?.fuel;
      if (renewableOnly && !renewable) return false;
      if (selectedFuels.length && !selectedFuels.includes(String(fuel))) return false;
      if (!featureMatchesCountries(f.properties as any, selectedCountries)) return false;
      return true;
    }).length;
  }, [data, renewableOnly, selectedFuels, selectedCountries]);

  const totalGW = data?.plants?.totalGW ?? '0.0';
  const totalPlants = data?.plants?.totalPlants ?? 0;

  /* Loading is "truly ready" when BOTH data has arrived AND map has had
   * its first paint. This keeps the loader on screen through the most
   * expensive step (GeoJSON parsing + first GPU paint of thousands of points)
   * so the user never sees a half-rendered globe.
   */
  const readyForFadeOut = !loading && mapReady;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#070912] text-white">
      {/* Map always mounts immediately so it can start fetching tiles
          behind the loading screen */}
      <MapCanvas
        theme={theme}
        visibleLayers={visibleLayers}
        viewMode={viewMode}
        data={data}
        selectedFuels={selectedFuels}
        renewableOnly={renewableOnly}
        selectedCountries={selectedCountries}
        bubbleScale={bubbleScale}
        onMapReady={handleMapReady}
      />

      {/* Loading screen — fades out when readyForFadeOut, then unmounts */}
      {!loaderGone && (
        <LoadingScreen
          ready={readyForFadeOut}
          onFadeComplete={handleLoaderFadeComplete}
        />
      )}

      <TopBar
        selectedCountries={selectedCountries}
        onToggleCountry={handleToggleCountry}
        onSelectAllCountries={handleSelectAllCountries}
        onClearCountries={handleClearCountries}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        bubbleScale={bubbleScale}
        onBubbleScaleChange={setBubbleScale}
        renewableOnly={renewableOnly}
        onRenewableOnlyChange={setRenewableOnly}
        totalGW={totalGW}
        totalPlants={totalPlants}
        visiblePlantCount={visiblePlantCount}
        loading={loading}
      />

      <LayerPanel
        theme={theme}
        onThemeChange={setTheme}
        visibility={visibleLayers}
        onVisibilityChange={handleVisibilityChange}
        techStats={data?.plants?.techStats ?? []}
        renewableOnly={renewableOnly}
        onRenewableOnlyChange={setRenewableOnly}
        selectedFuels={selectedFuels}
        onToggleFuel={handleToggleFuel}
        onResetFuelFilter={handleResetFuelFilter}
        totalPlants={totalPlants}
        totalGW={totalGW}
        visiblePlantCount={visiblePlantCount}
      />

      <StatsPanel
        countryStats={data?.plants?.countryStats ?? []}
        techStats={data?.plants?.techStats ?? []}
        totalGW={totalGW}
        selectedCountries={selectedCountries}
        onCountryClick={handleToggleCountry}
      />

      <MapLegend visibility={visibleLayers} />

      {loadError && (
        <div className="absolute bottom-6 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-[22px] border border-red-500/25 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl animate-fade-in-up">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-red-300">Data load failed</div>
              <div className="text-xs text-slate-400">
                The map could not finish preparing all layers.
              </div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-6 text-slate-300">{loadError}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}
    </main>
  );
}

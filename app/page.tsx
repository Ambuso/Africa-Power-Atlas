/* ==================== app/page.tsx ==================== */
'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import LayerPanel from '@/components/sidebar/LayerPanel';
import TopBar from '@/components/topbar/TopBar';
import MapLegend from '@/components/map/MapLegend';
import { loadAndPreparePowerGridData } from '@/components/map/dataPrep';
import type { MapDataBundle, LayerVisibility, MapThemeKey } from '@/lib/types';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]">
      <div className="text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_70px_-18px_rgba(34,211,238,0.55)]">
          <div className="h-12 w-12 animate-[spin_3.2s_linear_infinite] rounded-full border-4 border-cyan-300 border-t-transparent" />
        </div>
        <h1 className="mb-2 text-4xl font-bold tracking-[-0.04em] text-white">
          AFRICA POWER GRID
        </h1>
        <p className="text-sm uppercase tracking-[0.30em] text-slate-400">
          Loading intelligence layers
        </p>
      </div>
    </div>
  ),
});

const ALL_AFRICAN_ISO2 = [
  'ZA','EG','NG','DZ','MA','LY','TN','ET','KE','TZ','UG','RW','GH','CI','SN',
  'ZM','ZW','MZ','AO','CD','CM','NA','BW','MW','MG','SD','SS',
];

export default function HomePage() {
  const [data, setData] = useState<MapDataBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [theme, setTheme] = useState<MapThemeKey>('dark');

  /* Admin boundaries + labels default ON — they're what makes the map readable. */
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    plants: true,
    dataCenters: true,
    transmission: true,
    substations: false,
    submarineCables: true,
    plannedUpgrades: false,
    waterStress: false,
    admin0: true,
    admin1: true,
    admin2: false,
    placeLabels: true,
  });

  const [renewableOnly, setRenewableOnly] = useState(false);
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [bubbleScale, setBubbleScale] = useState(1.2);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const result = await loadAndPreparePowerGridData();
        if (!cancelled) setData(result);
      } catch (error) {
        console.error('Failed to load power grid data:', error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load map data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleVisibilityChange = (key: keyof LayerVisibility) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleFuel = (fuel: string) => {
    setSelectedFuels((prev) =>
      prev.includes(fuel) ? prev.filter((item) => item !== fuel) : [...prev, fuel],
    );
  };

  const handleResetFuelFilter = () => {
    setSelectedFuels([]);
    setRenewableOnly(false);
  };

  const handleToggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSelectAllCountries = () => setSelectedCountries([...ALL_AFRICAN_ISO2]);
  const handleClearCountries = () => setSelectedCountries([]);

  const handleRetryLoad = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const result = await loadAndPreparePowerGridData();
      setData(result);
    } catch (error) {
      console.error('Retry failed:', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to reload map data.');
    } finally {
      setLoading(false);
    }
  };

  const visiblePlantCount = useMemo(() => {
    const plants = data?.plants?.plants?.features ?? [];
    return plants.filter((f) => {
      const renewable = f.properties?.renewable === true;
      const fuel = f.properties?.fuel;
      const country =
        f.properties?.country ??
        f.properties?.iso3 ??
        f.properties?.country_code ??
        '';
      if (renewableOnly && !renewable) return false;
      if (selectedFuels.length && !selectedFuels.includes(fuel)) return false;
      if (selectedCountries.length && !selectedCountries.includes(country)) return false;
      return true;
    }).length;
  }, [data, renewableOnly, selectedFuels, selectedCountries]);

  const totalGW = data?.plants?.totalGW ?? '0.0';
  const totalPlants = data?.plants?.totalPlants ?? 0;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020617] text-white">
      <MapCanvas
        theme={theme}
        onThemeChange={setTheme}
        visibleLayers={visibleLayers}
        onVisibilityChange={handleVisibilityChange}
        data={data}
        selectedFuels={selectedFuels}
        onToggleFuel={handleToggleFuel}
        onResetFuelFilter={handleResetFuelFilter}
        renewableOnly={renewableOnly}
        onRenewableOnlyChange={setRenewableOnly}
        selectedCountries={selectedCountries}
        onToggleCountry={handleToggleCountry}
        bubbleScale={bubbleScale}
        onBubbleScaleChange={setBubbleScale}
      />

      <TopBar
        selectedCountries={selectedCountries}
        onToggleCountry={handleToggleCountry}
        onSelectAllCountries={handleSelectAllCountries}
        onClearCountries={handleClearCountries}
        bubbleScale={bubbleScale}
        onBubbleScaleChange={setBubbleScale}
        renewableOnly={renewableOnly}
        onRenewableOnlyChange={setRenewableOnly}
        totalGW={totalGW}
        totalPlants={totalPlants}
        visiblePlantCount={visiblePlantCount}
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

      <MapLegend visibility={visibleLayers} />

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.07),transparent_28%)]" />

      {loading && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/85 px-4 py-2.5 text-sm text-slate-200 shadow-2xl backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            Loading infrastructure layers...
          </div>
        </div>
      )}

      {loadError && (
        <div className="absolute bottom-5 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-[24px] border border-red-500/25 bg-slate-950/92 p-5 shadow-2xl backdrop-blur-xl">
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
            onClick={handleRetryLoad}
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

'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as LibreMap, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_THEMES } from '@/components/map/mapThemes';

export default function SitePicker({ longitude, latitude, onSelect }: { longitude: number; latitude: number; onSelect: (longitude: number, latitude: number) => void }) {
  const container = useRef<HTMLDivElement | null>(null), map = useRef<LibreMap | null>(null), marker = useRef<Marker | null>(null);
  const callback = useRef(onSelect); const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { callback.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap;
    try {
      instance = new LibreMap({ container: container.current, style: MAP_THEMES.dark.style as any, center: [23, 0], zoom: 2.6, minZoom: 2, maxZoom: 18, maxBounds: [[-28, -42], [66, 43]], dragRotate: false } as any);
      map.current = instance;
      instance.on('load', () => instance.setProjection({ type: 'mercator' }));
      instance.on('click', (event) => callback.current(event.lngLat.lng, event.lngLat.lat));
      instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      marker.current = new Marker({ color: '#d9f273', draggable: true }).setLngLat([longitude, latitude]).addTo(instance);
      marker.current.on('dragend', () => { const point = marker.current?.getLngLat(); if (point) callback.current(point.lng, point.lat); });
    } catch { setUnavailable(true); return; }
    return () => { marker.current?.remove(); instance.remove(); map.current = null; };
  }, []); // Initialisation only; selection updates below.
  useEffect(() => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    marker.current?.setLngLat([longitude, latitude]);
    map.current?.easeTo({ center: [longitude, latitude], zoom: Math.max(map.current.getZoom(), 6), duration: 600 });
  }, [longitude, latitude]);
  return <div className="kw-site-picker"><div ref={container} aria-label="Site selection map. Click to place a site pin, or use the coordinate fields." />{unavailable && <p className="kw-picker-fallback">Map preview unavailable. You can still search a city or enter coordinates to run a check.</p>}<span className="kw-picker-instruction">Click to place a pin · drag to refine</span></div>;
}

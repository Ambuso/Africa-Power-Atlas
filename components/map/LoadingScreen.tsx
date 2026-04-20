/* ==================== components/map/LoadingScreen.tsx ====================
 * Fast, smooth loading screen.
 *
 * Design philosophy:
 *   - Boot visual should feel like the map is already loading behind it
 *   - Layer names cycle quickly (every 400ms) so it never feels stuck
 *   - When `ready` flips to true, the whole screen fades out in 500ms
 *     revealing the real map underneath — which is already fully rendered.
 *   - After fade completes, onFadeComplete() is called so the parent can
 *     unmount us entirely.
 * ==================================================== */

'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Flip to true once map data is loaded & first paint has happened. */
  ready?: boolean;
  /** Called once the fade-out animation fully completes (~500ms after ready). */
  onFadeComplete?: () => void;
}

const LAYERS = [
  { label: 'Basemap',           color: '#67e8f9' },
  { label: 'Country borders',   color: '#22d3ee' },
  { label: 'Transmission grid', color: '#38bdf8' },
  { label: 'Submarine cables',  color: '#06b6d4' },
  { label: 'Power plants',      color: '#facc15' },
  { label: 'Data centers',      color: '#a78bfa' },
] as const;

export default function LoadingScreen({ ready = false, onFadeComplete }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const fadeCompleteCalled = useRef(false);

  /* Cycle layer labels every 400ms for momentum */
  useEffect(() => {
    if (fadingOut) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % LAYERS.length);
    }, 400);
    return () => clearInterval(id);
  }, [fadingOut]);

  /* When ready flips true, start fade-out */
  useEffect(() => {
    if (!ready || fadingOut) return;
    setFadingOut(true);

    const t = setTimeout(() => {
      if (!fadeCompleteCalled.current) {
        fadeCompleteCalled.current = true;
        onFadeComplete?.();
      }
    }, 550);

    return () => clearTimeout(t);
  }, [ready, fadingOut, onFadeComplete]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center overflow-hidden bg-[#020617]"
      style={{
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
      aria-hidden={fadingOut}
    >
      {/* Ambient starfield gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.08), transparent 55%),' +
            'radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.06), transparent 45%),' +
            'radial-gradient(ellipse at 80% 70%, rgba(250,204,21,0.05), transparent 45%),' +
            '#020617',
        }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Central animation */}
      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Globe + pulse rings */}
        <div className="relative mb-10 flex h-[200px] w-[200px] items-center justify-center">
          {/* Concentric ripple rings */}
          {LAYERS.map((layer, i) => {
            const isActive = activeIndex === i;
            return (
              <div
                key={layer.label}
                className="absolute rounded-full"
                style={{
                  width: `${96 + i * 20}px`,
                  height: `${96 + i * 20}px`,
                  border: `1px solid ${isActive ? layer.color : 'rgba(148,163,184,0.08)'}`,
                  boxShadow: isActive ? `0 0 24px ${layer.color}55, inset 0 0 16px ${layer.color}22` : 'none',
                  opacity: isActive ? 0.8 : 0.25,
                  transform: isActive ? 'scale(1.04)' : 'scale(1)',
                  transition: 'all 420ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            );
          })}

          {/* Core globe SVG */}
          <svg
            viewBox="0 0 120 120"
            className="relative z-10 h-[88px] w-[88px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="globeCore" cx="40%" cy="40%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#0891b2" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.2" />
              </radialGradient>
              <filter id="coreGlow">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>

            {/* Globe body */}
            <circle cx="60" cy="60" r="42" fill="url(#globeCore)" />

            {/* Meridians */}
            <ellipse cx="60" cy="60" rx="42" ry="16" fill="none" stroke="rgba(103,232,249,0.4)" strokeWidth="0.6" />
            <ellipse cx="60" cy="60" rx="42" ry="30" fill="none" stroke="rgba(103,232,249,0.3)" strokeWidth="0.5" />
            <ellipse cx="60" cy="60" rx="16" ry="42" fill="none" stroke="rgba(103,232,249,0.4)" strokeWidth="0.6" />
            <ellipse cx="60" cy="60" rx="30" ry="42" fill="none" stroke="rgba(103,232,249,0.3)" strokeWidth="0.5" />
            <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(103,232,249,0.6)" strokeWidth="0.8" />

            {/* Africa silhouette overlay — stylized */}
            <path
              d="M 58 36 Q 68 34, 74 38 L 80 46 Q 82 54, 80 62 L 78 72 Q 80 80, 76 86 L 70 92 Q 64 94, 58 90 L 52 84 Q 48 76, 48 68 L 46 60 Q 44 52, 48 46 Z"
              fill="#facc15"
              opacity="0.85"
              filter="url(#coreGlow)"
              style={{ animation: 'africaPulse 2s ease-in-out infinite' }}
            />
          </svg>
        </div>

        {/* Brand */}
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-500">
          Africa Power Atlas
        </div>
        <div className="mb-8 bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-[22px] font-light tracking-tight text-transparent">
          Lighting up the continent
        </div>

        {/* Dynamic layer label */}
        <div className="relative flex h-5 items-center justify-center">
          {LAYERS.map((layer, i) => (
            <span
              key={layer.label}
              className="absolute whitespace-nowrap text-[11px] uppercase tracking-[0.25em]"
              style={{
                color: layer.color,
                opacity: activeIndex === i ? 1 : 0,
                transform: activeIndex === i ? 'translateY(0)' : 'translateY(4px)',
                transition: 'all 300ms ease',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                textShadow: `0 0 12px ${layer.color}80`,
              }}
            >
              Loading {layer.label}…
            </span>
          ))}
        </div>

        {/* Slim progress bar */}
        <div className="mt-6 h-[1.5px] w-48 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400"
            style={{ animation: 'slideProgress 1.4s ease-in-out infinite' }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes africaPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          transform-origin: center;
        }
        @keyframes slideProgress {
          0% { transform: translateX(-100%); width: 40%; }
          50% { width: 70%; }
          100% { transform: translateX(280%); width: 40%; }
        }
      `}</style>
    </div>
  );
}

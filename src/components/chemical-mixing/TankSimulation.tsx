'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * TankSimulation Component
 *
 * Provides a high-fidelity visual digital twin of the mixing reactor.
 *
 * Features:
 * - Dynamic SVG heating coil with state-based glow.
 * - CSS-animated mixer blades with speed synchronized to RPM.
 * - Procedural bubbles and surface agitation based on motor load.
 */
interface TankSimulationProps {
  rpm: number;
  temperature: number;
  ph: number;
  isRunning: boolean;
  isHeaterOn: boolean;
  liquidLevel?: number;
}

// Fixed bubble layout so re-renders (every telemetry tick) don't make them jump around.
const BUBBLES = [
  { size: 4, left: 12, bottom: 20, duration: 1.8 },
  { size: 3, left: 30, bottom: 55, duration: 2.4 },
  { size: 5, left: 48, bottom: 12, duration: 1.4 },
  { size: 2, left: 63, bottom: 70, duration: 2.9 },
  { size: 4, left: 78, bottom: 35, duration: 2.1 },
  { size: 3, left: 90, bottom: 60, duration: 1.6 },
];

export function TankSimulation({
  rpm,
  temperature,
  ph,
  isRunning,
  isHeaterOn,
  liquidLevel = 65,
}: TankSimulationProps) {
  // Rotate speed mapping: RPM 0-1000 -> duration 5s - 0.2s
  const rotationDuration = isRunning && rpm > 0 ? Math.max(0.1, 4 - rpm / 300) : 0;
  const fillLevel = Math.max(0, Math.min(100, liquidLevel));

  return (
    <div
      aria-label="Simulated chemical reactor schematic"
      className="relative flex min-h-[340px] w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-accent/20 bg-[#061524]/65 px-3 py-14 sm:px-7"
    >
      <div className="absolute left-3 top-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
        Reactor 01 · Simulated vessel
      </div>
      {/* Tank Container */}
      <div
        data-testid="reactor-vessel"
        className="relative h-72 w-52 overflow-hidden rounded-b-2xl border-2 border-[#4EA8FF]/50 bg-[#0B0F19]/60 shadow-[0_0_32px_rgba(0,224,255,0.09)] xl:h-80 xl:w-64"
      >
        {/* Liquid Layer */}
        <div
          className="absolute bottom-0 left-0 w-full bg-[#4EA8FF]/15 transition-all duration-1000 ease-in-out"
          style={{ height: `${fillLevel}%` }}
        >
          {/* Surface Animation */}
          <div
            className={cn(
              'absolute -top-3 left-0 w-[200%] h-6 bg-primary/20 blur-sm rounded-[40%]',
              isRunning && 'animate-liquid',
            )}
          />

          {/* Procedural Bubbles */}
          {isRunning && rpm > 50 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {BUBBLES.map((bubble, i) => (
                <div
                  key={i}
                  className="absolute bg-white/5 rounded-full animate-pulse"
                  style={{
                    width: `${bubble.size}px`,
                    height: `${bubble.size}px`,
                    left: `${bubble.left}%`,
                    bottom: `${bubble.bottom}%`,
                    animationDelay: `${i * 0.4}s`,
                    animationDuration: `${bubble.duration}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Heating Coil Visual */}
        <div className="absolute bottom-4 left-1/2 h-8 w-[85%] -translate-x-1/2">
          <svg viewBox="0 0 200 60" className="w-full h-full opacity-40">
            <path
              d="M10,30 Q20,10 30,30 T50,30 T70,30 T90,30 T110,30 T130,30 T150,30 T170,30 T190,30"
              fill="none"
              stroke={isHeaterOn ? '#fb923c' : '#46566e'}
              strokeWidth="4"
              className={cn('transition-colors duration-1000', isHeaterOn && 'animate-pulse')}
              style={{ filter: isHeaterOn ? 'drop-shadow(0 0 5px #ff4500)' : 'none' }}
            />
          </svg>
        </div>

        {/* Mixer Logic */}
        <div className="absolute left-1/2 top-0 z-10 h-[82%] w-1 -translate-x-1/2 bg-[#66758b]">
          <div
            className="hmi-mixer-blades absolute bottom-10 left-1/2 -translate-x-1/2"
            style={{
              animation:
                rotationDuration > 0 ? `spin ${rotationDuration}s linear infinite` : 'none',
            }}
          >
            <div className="relative w-24 h-2 bg-[#8F9BFF]/65 rounded-full flex items-center justify-between">
              <div className="w-6 h-3 bg-[#B9C5CE]/70 -ml-1 skew-x-12" />
              <div className="w-6 h-3 bg-[#B9C5CE]/70 -mr-1 -skew-x-12" />
            </div>
          </div>
        </div>
      </div>

      {/* HUD Overlay */}
      <div className="absolute top-2 right-2 text-right bg-[#061524]/85 p-1.5 rounded border border-accent/20">
        <div className="text-[11px] font-bold uppercase text-zinc-300">Mixer RPM</div>
        <div className="text-sm font-bold text-primary tabular-nums">{rpm.toFixed(0)}</div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 border-t border-accent/15 pt-2 font-mono text-[11px] text-zinc-300">
        <span>FILL: {fillLevel.toFixed(0)}%</span>
        <span>TEMP: {temperature.toFixed(1)} °C</span>
        <span>pH: {ph.toFixed(1)}</span>
        <span className={isHeaterOn ? 'text-orange-400' : 'text-zinc-400'}>
          HEATER: {isHeaterOn ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  );
}

"use client"

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

export function TankSimulation({
  rpm,
  isRunning,
  isHeaterOn,
  liquidLevel = 65
}: TankSimulationProps) {
  // Rotate speed mapping: RPM 0-1000 -> duration 5s - 0.2s
  const rotationDuration = isRunning && rpm > 0 ? Math.max(0.1, 4 - (rpm / 300)) : 0;
  
  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center bg-black/20 rounded-xl border border-primary/5 overflow-hidden">
      {/* Tank Container */}
      <div className="relative w-48 h-64 border-2 border-gray-600 rounded-b-2xl overflow-hidden bg-gray-900/30">
        
        {/* Liquid Layer */}
        <div 
          className="absolute bottom-0 left-0 w-full bg-primary/10 transition-all duration-1000 ease-in-out"
          style={{ height: `${liquidLevel}%` }}
        >
          {/* Surface Animation */}
          <div 
            className={cn(
              "absolute -top-3 left-0 w-[200%] h-6 bg-primary/20 blur-sm rounded-[40%]",
              isRunning && "animate-liquid"
            )}
          />
          
          {/* Procedural Bubbles */}
          {isRunning && rpm > 50 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
               {[...Array(6)].map((_, i) => (
                 <div 
                   key={i}
                   className="absolute bg-white/5 rounded-full animate-pulse"
                   style={{
                     width: `${Math.random() * 4 + 2}px`,
                     height: `${Math.random() * 4 + 2}px`,
                     left: `${Math.random() * 100}%`,
                     bottom: `${Math.random() * 100}%`,
                     animationDelay: `${i * 0.4}s`,
                     animationDuration: `${Math.random() * 2 + 1}s`
                   }}
                 />
               ))}
            </div>
          )}
        </div>

        {/* Heating Coil Visual */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-8">
          <svg viewBox="0 0 200 60" className="w-full h-full opacity-40">
            <path 
              d="M10,30 Q20,10 30,30 T50,30 T70,30 T90,30 T110,30 T130,30 T150,30 T170,30 T190,30" 
              fill="none" 
              stroke={isHeaterOn ? "#ff4500" : "#333"} 
              strokeWidth="4"
              className={cn("transition-colors duration-1000", isHeaterOn && "animate-pulse")}
              style={{ filter: isHeaterOn ? 'drop-shadow(0 0 5px #ff4500)' : 'none' }}
            />
          </svg>
        </div>

        {/* Mixer Logic */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-52 bg-gray-700 z-10">
          <div 
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
            style={{ 
              animation: rotationDuration > 0 ? `spin ${rotationDuration}s linear infinite` : 'none' 
            }}
          >
            <div className="relative w-24 h-2 bg-gray-500 rounded-full flex items-center justify-between">
              <div className="w-6 h-3 bg-gray-400 -ml-1 skew-x-12" />
              <div className="w-6 h-3 bg-gray-400 -mr-1 -skew-x-12" />
            </div>
          </div>
        </div>
      </div>
      
      {/* HUD Overlay */}
      <div className="absolute top-2 right-2 text-right bg-black/40 p-1.5 rounded border border-white/5">
        <div className="text-[7px] uppercase text-zinc-500 font-bold">Mixer RPM</div>
        <div className="text-sm font-bold text-primary tabular-nums">
          {rpm.toFixed(0)}
        </div>
      </div>
    </div>
  );
}

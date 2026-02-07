"use client"

import React from 'react';
import { cn } from '@/lib/utils';

interface TankSimulationProps {
  rpm: number;
  temperature: number;
  ph: number;
  isRunning: boolean;
  liquidLevel?: number; // 0 to 100
}

export function TankSimulation({
  rpm,
  isRunning,
  liquidLevel = 65
}: TankSimulationProps) {
  // Rotate speed mapping: RPM 0-1000 -> duration 5s - 0.2s
  const rotationDuration = isRunning && rpm > 0 ? Math.max(0.2, 5 - (rpm / 200)) : 0;
  
  return (
    <div className="relative w-full h-[400px] flex items-center justify-center p-8 bg-black/20 rounded-xl border border-primary/10 overflow-hidden">
      {/* Tank Container */}
      <div className="relative w-64 h-80 border-4 border-gray-600 rounded-b-3xl overflow-hidden bg-gray-900/50">
        {/* Liquid Level */}
        <div 
          className="absolute bottom-0 left-0 w-full bg-primary/20 transition-all duration-1000 ease-in-out"
          style={{ height: `${liquidLevel}%` }}
        >
          {/* Animated Wave Top */}
          <div 
            className={cn(
              "absolute -top-4 left-0 w-[200%] h-8 bg-primary/30 blur-sm rounded-[40%]",
              isRunning && "animate-liquid"
            )}
          />
          
          {/* Bubbles if running */}
          {isRunning && rpm > 100 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
               {[...Array(6)].map((_, i) => (
                 <div 
                   key={i}
                   className="absolute bg-white/10 rounded-full animate-pulse"
                   style={{
                     width: `${Math.random() * 8 + 4}px`,
                     height: `${Math.random() * 8 + 4}px`,
                     left: `${Math.random() * 100}%`,
                     bottom: `${Math.random() * 100}%`,
                     animationDelay: `${i * 0.5}s`,
                     animationDuration: `${Math.random() * 2 + 1}s`
                   }}
                 />
               ))}
            </div>
          )}
        </div>

        {/* Mixer Shaft */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-64 bg-gray-700 z-10">
          {/* Mixer Blades */}
          <div 
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
            style={{ 
              animation: rotationDuration > 0 ? `spin ${rotationDuration}s linear infinite` : 'none' 
            }}
          >
            <div className="relative w-32 h-4 bg-gray-500 rounded-full flex items-center justify-between">
              <div className="w-8 h-4 bg-gray-400 rounded-sm -ml-2 skew-x-12" />
              <div className="w-8 h-4 bg-gray-400 rounded-sm -mr-2 -skew-x-12" />
            </div>
            {/* Center bolt */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gray-300 rounded-full border border-gray-600" />
          </div>
        </div>
      </div>

      {/* Tank Support Brackets */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[340px] border-l border-r border-gray-700 pointer-events-none" />
      
      {/* RPM Gauge Overlay */}
      <div className="absolute top-4 right-4 text-right">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Mixer Speed</div>
        <div className="text-2xl font-bold text-primary tabular-nums">
          {rpm.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">RPM</span>
        </div>
      </div>
    </div>
  );
}

"use client"

import React from 'react';
import { Thermometer, Droplet, Activity, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusDisplayProps {
  mixingSpeed: number;
  temperature: number;
  ph: number;
  valveOpen: boolean;
}

export function StatusDisplay({ mixingSpeed, temperature, ph, valveOpen }: StatusDisplayProps) {
  const stats = [
    {
      label: "Mix Speed",
      value: mixingSpeed.toFixed(0),
      unit: "RPM",
      icon: Activity,
      color: "text-primary",
      glow: "border-primary/20 bg-primary/5"
    },
    {
      label: "Temperature",
      value: temperature.toFixed(1),
      unit: "°C",
      icon: Thermometer,
      color: "text-primary",
      glow: "border-primary/20 bg-primary/5"
    },
    {
      label: "pH Level",
      value: ph.toFixed(2),
      unit: "pH",
      icon: Droplet,
      color: "text-primary",
      glow: "border-primary/20 bg-primary/5"
    },
    {
      label: "Valve Status",
      value: valveOpen ? "OPEN" : "CLOSED",
      unit: "",
      icon: Database,
      color: valveOpen ? "text-primary" : "text-muted-foreground",
      glow: valveOpen ? "border-primary/20 bg-primary/5" : "border-zinc-800 bg-zinc-900/50"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div 
          key={i} 
          className={cn(
            "p-4 border rounded-lg transition-all duration-300 hover:scale-[1.02] cursor-default",
            stat.glow
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={cn("w-4 h-4", stat.color)} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn("text-3xl font-bold tabular-nums", stat.color)}>
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">{stat.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

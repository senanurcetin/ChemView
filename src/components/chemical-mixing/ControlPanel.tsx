"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Power, CircleStop, TriangleAlert, Settings2, Cpu, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  isRunning: boolean;
  isManualMode: boolean;
  onToggle: () => void;
  onToggleMode: () => void;
  onEmergencyStop: () => void;
  connectionStatus: "Connected" | "Disconnected" | "Connecting";
  targetRpm: number;
  targetTemp: number;
  setTargetRpm: (val: number) => void;
  setTargetTemp: (val: number) => void;
}

export function ControlPanel({ 
  isRunning, 
  isManualMode,
  onToggle, 
  onToggleMode,
  onEmergencyStop, 
  connectionStatus,
  targetRpm,
  targetTemp,
  setTargetRpm,
  setTargetTemp
}: ControlPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Primary Power Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          variant={isRunning ? "secondary" : "default"}
          size="lg"
          onClick={onToggle}
          className={cn(
            "h-16 text-sm font-bold gap-3 transition-all duration-300",
            !isRunning && "bg-primary text-primary-foreground glow-primary hover:bg-primary/90",
            isRunning && "bg-zinc-800 text-zinc-300 border border-zinc-700"
          )}
        >
          {isRunning ? <CircleStop className="w-5 h-5" /> : <Power className="w-5 h-5" />}
          {isRunning ? "STOP" : "START"}
        </Button>

        <Button 
          variant="destructive"
          size="lg"
          onClick={onEmergencyStop}
          className="h-16 text-sm font-bold gap-3 glow-destructive border-2 border-red-500/20"
        >
          <TriangleAlert className="w-5 h-5" />
          E-STOP
        </Button>
      </div>

      {/* Mode Control & Configuration */}
      <div className="hmi-panel flex flex-col gap-6 bg-zinc-950/50 border-white/5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className={cn("w-4 h-4", !isManualMode ? "text-primary" : "text-zinc-500")} />
            <Label className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
              Control Mode: {isManualMode ? "Manual" : "Auto"}
            </Label>
          </div>
          <Switch 
            checked={isManualMode} 
            onCheckedChange={onToggleMode}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Manual Override Sliders */}
        <div className={cn(
          "space-y-6 transition-opacity duration-300",
          !isManualMode ? "opacity-30 pointer-events-none" : "opacity-100"
        )}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Target Speed</span>
              <span className="text-xs font-mono text-primary font-bold">{targetRpm} RPM</span>
            </div>
            <Slider 
              value={[targetRpm]} 
              min={0} 
              max={1500} 
              step={10} 
              onValueChange={(vals) => setTargetRpm(vals[0])}
              className="[&_[role=slider]]:bg-primary"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Target Heat</span>
              <span className="text-xs font-mono text-primary font-bold">{targetTemp.toFixed(1)} °C</span>
            </div>
            <Slider 
              value={[targetTemp]} 
              min={20} 
              max={100} 
              step={0.5} 
              onValueChange={(vals) => setTargetTemp(vals[0])}
              className="[&_[role=slider]]:bg-primary"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              <span>WRITES: MODBUS_TCP_W</span>
            </div>
            <span>STATUS: {connectionStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

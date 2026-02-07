"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Power, 
  CircleStop, 
  TriangleAlert, 
  Cpu, 
  SlidersHorizontal, 
  Flame, 
  Database,
  Lock,
  Unlock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ControlPanelProps {
  isRunning: boolean;
  isManualMode: boolean;
  onToggle: () => void;
  onToggleMode: () => void;
  onEmergencyStop: () => void;
  connectionStatus: "Connected" | "Disconnected" | "Connecting";
  targetRpm: number;
  targetTemp: number;
  currentRpm: number;
  setTargetRpm: (val: number) => void;
  setTargetTemp: (val: number) => void;
  valveOpen: boolean;
  onToggleValve: () => void;
  isHeaterOn: boolean;
  onToggleHeater: () => void;
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
  currentRpm,
  setTargetRpm,
  setTargetTemp,
  valveOpen,
  onToggleValve,
  isHeaterOn,
  onToggleHeater
}: ControlPanelProps) {
  // Safety Interlocks
  const valveLocked = isRunning || currentRpm > 5;
  const mixerLocked = valveOpen;

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Power Actions */}
      <div className="grid grid-cols-2 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  variant={isRunning ? "secondary" : "default"}
                  size="lg"
                  onClick={onToggle}
                  className={cn(
                    "h-16 w-full text-sm font-bold gap-3 transition-all duration-300",
                    !isRunning && "bg-primary text-primary-foreground glow-primary hover:bg-primary/90",
                    isRunning && "bg-zinc-800 text-zinc-300 border border-zinc-700",
                    mixerLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {mixerLocked ? <Lock className="w-5 h-5 text-red-500" /> : isRunning ? <CircleStop className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                  {isRunning ? "STOP" : "START"}
                </Button>
              </div>
            </TooltipTrigger>
            {mixerLocked && (
              <TooltipContent className="bg-zinc-900 border-red-500/50 text-red-400">
                <p className="text-[10px] font-bold uppercase">Mixer Locked: Close valve first</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

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

      {/* Main Control Panel */}
      <div className="hmi-panel flex flex-col gap-6 bg-zinc-950/50 border-white/5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className={cn("w-4 h-4", !isManualMode ? "text-primary" : "text-zinc-500")} />
            <Label className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
              System Mode: {isManualMode ? "Manual Override" : "Auto Mode"}
            </Label>
          </div>
          <Switch 
            checked={isManualMode} 
            onCheckedChange={onToggleMode}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Secondary Industrial Switches */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border border-white/5 rounded-md bg-zinc-900/30 flex flex-col gap-3">
             <div className="flex items-center justify-between">
                <Flame className={cn("w-4 h-4", isHeaterOn ? "text-orange-500" : "text-zinc-600")} />
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Heater</span>
             </div>
             <div className="flex justify-center">
                <Switch 
                  checked={isHeaterOn} 
                  onCheckedChange={onToggleHeater}
                  className="data-[state=checked]:bg-orange-600"
                />
             </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  onClick={() => {
                    if (valveLocked) onToggleValve(); // Triggers the warning toast logic in parent if clicked while disabled
                  }}
                  className={cn(
                    "p-3 border rounded-md bg-zinc-900/30 flex flex-col gap-3 transition-colors cursor-pointer",
                    valveLocked ? "border-red-500/20 opacity-50" : "border-white/5"
                  )}
                >
                   <div className="flex items-center justify-between">
                      <Database className={cn("w-4 h-4", valveOpen ? "text-primary" : "text-zinc-600")} />
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Valve</span>
                   </div>
                   <div className="flex justify-center items-center gap-2">
                      {valveLocked && <Lock className="w-3 h-3 text-red-500" />}
                      <Switch 
                        checked={valveOpen} 
                        disabled={valveLocked}
                        onCheckedChange={onToggleValve}
                        className="data-[state=checked]:bg-primary"
                      />
                   </div>
                </div>
              </TooltipTrigger>
              {valveLocked && (
                <TooltipContent className="bg-zinc-900 border-red-500/50 text-red-400">
                  <p className="text-[10px] font-bold uppercase">Safety Lock: Mixer must be at 0 RPM</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Manual Override Sliders */}
        <div className={cn(
          "space-y-6 transition-all duration-300",
          !isManualMode ? "opacity-30 pointer-events-none grayscale" : "opacity-100"
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
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Heater Setpoint</span>
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
              <span>LOGIC: SAFETY_INTERLOCK_V2</span>
            </div>
            <span className={cn(connectionStatus === "Connected" ? "text-primary" : "text-red-500")}>
              {connectionStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

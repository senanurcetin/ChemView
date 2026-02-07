"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import { Power, CircleStop, TriangleAlert, Settings2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  isRunning: boolean;
  onToggle: () => void;
  onEmergencyStop: () => void;
  connectionStatus: "Connected" | "Disconnected" | "Connecting";
}

export function ControlPanel({ 
  isRunning, 
  onToggle, 
  onEmergencyStop, 
  connectionStatus 
}: ControlPanelProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-4">
        <Button 
          variant={isRunning ? "secondary" : "default"}
          size="lg"
          onClick={onToggle}
          className={cn(
            "h-20 text-lg font-bold gap-3 transition-all duration-300",
            !isRunning && "bg-primary text-primary-foreground glow-primary hover:bg-primary/90",
            isRunning && "bg-zinc-800 text-zinc-300 border border-zinc-700"
          )}
        >
          {isRunning ? <CircleStop className="w-6 h-6" /> : <Power className="w-6 h-6" />}
          {isRunning ? "STOP SYSTEM" : "START MIXER"}
        </Button>

        <Button 
          variant="destructive"
          size="lg"
          onClick={onEmergencyStop}
          className="h-20 text-lg font-bold gap-3 glow-destructive border-2 border-red-500/20"
        >
          <TriangleAlert className="w-6 h-6" />
          E-STOP
        </Button>
      </div>

      <div className="hmi-panel flex flex-col gap-3 flex-grow bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">System Status</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              connectionStatus === "Connected" ? "bg-primary animate-pulse" : "bg-red-500"
            )} />
            <span className="text-[10px] font-mono uppercase tracking-tighter text-muted-foreground">
              {connectionStatus}: 192.168.1.50:502
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-auto">
          <div className="p-3 bg-black/40 rounded border border-white/5">
            <div className="text-[10px] text-muted-foreground uppercase">Mode</div>
            <div className="text-sm font-bold text-primary">AUTO (MODBUS)</div>
          </div>
          <div className="p-3 bg-black/40 rounded border border-white/5">
            <div className="text-[10px] text-muted-foreground uppercase">Cycle Time</div>
            <div className="text-sm font-bold text-primary">1000ms</div>
          </div>
        </div>
      </div>
    </div>
  );
}

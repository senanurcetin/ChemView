'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ControlPanelProps {
  isRunning: boolean;
  estopLatched: boolean;
  isManualMode: boolean;
  onToggle: () => void;
  onToggleMode: () => void;
  onEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
  connectionStatus: 'Connected' | 'Disconnected' | 'Connecting' | 'Stale';
  targetRpm: number;
  targetTemp: number;
  rpmSetpointPending: boolean;
  tempSetpointPending: boolean;
  currentRpm: number;
  setTargetRpm: (val: number) => void;
  setTargetTemp: (val: number) => void;
  commitTargetRpm: (val: number) => void;
  commitTargetTemp: (val: number) => void;
  beginRpmEdit: () => void;
  endRpmEdit: () => void;
  beginTempEdit: () => void;
  endTempEdit: () => void;
  valveOpen: boolean;
  onToggleValve: () => void;
  isHeaterOn: boolean;
  onToggleHeater: () => void;
}

export function ControlPanel({
  isRunning,
  estopLatched,
  isManualMode,
  onToggle,
  onToggleMode,
  onEmergencyStop,
  onResetEmergencyStop,
  connectionStatus,
  targetRpm,
  targetTemp,
  rpmSetpointPending,
  tempSetpointPending,
  currentRpm,
  setTargetRpm,
  setTargetTemp,
  commitTargetRpm,
  commitTargetTemp,
  beginRpmEdit,
  endRpmEdit,
  beginTempEdit,
  endTempEdit,
  valveOpen,
  onToggleValve,
  isHeaterOn,
  onToggleHeater,
}: ControlPanelProps) {
  // Safety Interlocks
  const valveLocked = isRunning || currentRpm >= 1;
  const mixerLocked = valveOpen || estopLatched;
  const controlsAvailable = connectionStatus === 'Connected';
  const manualWriteEnabled = isManualMode && !estopLatched && controlsAvailable;

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Power Actions */}
      <div className="grid grid-cols-2 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button
                  variant={isRunning ? 'secondary' : 'default'}
                  size="lg"
                  onClick={onToggle}
                  disabled={estopLatched || !controlsAvailable}
                  className={cn(
                    'h-16 w-full text-sm font-bold gap-3 transition-all duration-300',
                    !isRunning &&
                      'bg-primary text-primary-foreground glow-primary hover:bg-primary/90',
                    isRunning && 'bg-secondary text-muted-foreground border border-accent/20',
                    mixerLocked && 'opacity-50',
                  )}
                >
                  {mixerLocked ? (
                    <Lock className="w-5 h-5 text-red-500" />
                  ) : isRunning ? (
                    <CircleStop className="w-5 h-5" />
                  ) : (
                    <Power className="w-5 h-5" />
                  )}
                  {isRunning ? 'STOP' : 'START'}
                </Button>
              </div>
            </TooltipTrigger>
            {mixerLocked && (
              <TooltipContent className="bg-[#061524]/75 border-red-500/50 text-red-400">
                <p className="text-[11px] font-bold uppercase">
                  {estopLatched ? 'Reset E-STOP first' : 'Mixer Locked: Close valve first'}
                </p>
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

      {estopLatched && (
        <div
          role="alert"
          className="rounded border border-red-500/50 bg-red-950/40 p-3 text-xs text-red-200 flex items-center justify-between gap-3"
        >
          <span>E-STOP LATCHED — reset before restarting.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetEmergencyStop}
            disabled={!controlsAvailable}
          >
            RESET E-STOP
          </Button>
        </div>
      )}

      {/* Main Control Panel */}
      <div className="hmi-panel flex flex-col gap-6 bg-[#061524]/60 border-white/5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className={cn('w-4 h-4', !isManualMode ? 'text-primary' : 'text-muted-foreground')} />
            <Label className="text-[11px] font-bold uppercase tracking-widest cursor-pointer">
              System Mode: {isManualMode ? 'Manual Override' : 'Auto Mode'}
            </Label>
          </div>
          <Switch
            aria-label="Manual mode"
            checked={isManualMode}
            disabled={!controlsAvailable || estopLatched}
            onCheckedChange={onToggleMode}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Secondary Industrial Switches */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border border-white/5 rounded-md bg-secondary/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Flame className={cn('w-4 h-4', isHeaterOn ? 'text-orange-500' : 'text-muted-foreground')} />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Heater</span>
            </div>
            <div className="flex justify-center">
              <Switch
                aria-label="Heater"
                checked={isHeaterOn}
                disabled={!controlsAvailable || estopLatched}
                onCheckedChange={onToggleHeater}
                className="data-[state=checked]:bg-orange-600"
              />
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'p-3 border rounded-md bg-secondary/30 flex flex-col gap-3 transition-colors',
                    valveLocked ? 'border-red-500/20 opacity-50' : 'border-white/5',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Database
                      className={cn('w-4 h-4', valveOpen ? 'text-primary' : 'text-muted-foreground')}
                    />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      Valve
                    </span>
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    {valveLocked && <Lock className="w-3 h-3 text-red-500" />}
                    <Switch
                      aria-label="Discharge valve"
                      checked={valveOpen}
                      disabled={!controlsAvailable || estopLatched}
                      onCheckedChange={onToggleValve}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </TooltipTrigger>
              {valveLocked && (
                <TooltipContent className="bg-[#061524]/75 border-red-500/50 text-red-400">
                  <p className="text-[11px] font-bold uppercase">
                    Safety Lock: Mixer must be at 0 RPM
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Manual Override Sliders */}
        <div
          className={cn(
            'space-y-6 transition-all duration-300',
            !manualWriteEnabled ? 'opacity-60 grayscale' : 'opacity-100',
          )}
        >
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-bold">
                Target Speed
              </span>
              <span className="text-xs font-mono text-primary font-bold">
                {targetRpm} RPM {rpmSetpointPending && '(PENDING)'}
              </span>
            </div>
            <Slider
              aria-label="Target RPM"
              value={[targetRpm]}
              min={0}
              max={1500}
              step={10}
              disabled={!manualWriteEnabled}
              onValueChange={(vals) => setTargetRpm(vals[0])}
              onValueCommit={(vals) => commitTargetRpm(vals[0])}
              onPointerDownCapture={beginRpmEdit}
              onPointerUpCapture={endRpmEdit}
              onPointerCancelCapture={endRpmEdit}
              onKeyDownCapture={beginRpmEdit}
              onKeyUpCapture={endRpmEdit}
              onBlurCapture={endRpmEdit}
              className="[&_[role=slider]]:bg-primary"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-bold">
                Heater Setpoint
              </span>
              <span className="text-xs font-mono text-primary font-bold">
                {targetTemp.toFixed(1)} °C {tempSetpointPending && '(PENDING)'}
              </span>
            </div>
            <Slider
              aria-label="Target temperature"
              value={[targetTemp]}
              min={20}
              max={100}
              step={0.5}
              disabled={!manualWriteEnabled}
              onValueChange={(vals) => setTargetTemp(vals[0])}
              onValueCommit={(vals) => commitTargetTemp(vals[0])}
              onPointerDownCapture={beginTempEdit}
              onPointerUpCapture={endTempEdit}
              onPointerCancelCapture={endTempEdit}
              onKeyDownCapture={beginTempEdit}
              onKeyUpCapture={endTempEdit}
              onBlurCapture={endTempEdit}
              className="[&_[role=slider]]:bg-primary"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              <span>LOGIC: SAFETY_INTERLOCK_V2</span>
            </div>
            <span
              className={cn(connectionStatus === 'Connected' ? 'text-primary' : 'text-red-500')}
            >
              {connectionStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

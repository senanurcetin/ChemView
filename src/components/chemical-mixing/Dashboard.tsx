'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { TankSimulation } from './TankSimulation';
import { TrendChart } from './TrendChart';
import { ControlPanel } from './ControlPanel';
import { StatusDisplay } from './StatusDisplay';
import { AlertPanel } from './AlertPanel';
import { AuditLog } from './AuditLog';
import { CommunicationLog } from './CommunicationLog';
import { NetworkStats } from './NetworkStats';
import { Button } from '@/components/ui/button';
import { Download, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTelemetry } from '@/hooks/use-telemetry';
import { useSyncedSetpoint } from '@/hooks/use-synced-setpoint';
import { cn } from '@/lib/utils';
import { GATEWAY_ADDRESS, OPERATOR_ID } from '@/lib/config';
import { initialState } from '@/server/sim/state';
import type { Command } from '@/server/sim/types';

const ACTIVITY_FLASH_MS = 150;

/** True for a short moment whenever `marker` changes (drives the RX/TX LEDs). */
function useFlash(marker: string | undefined) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!marker) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), ACTIVITY_FLASH_MS);
    return () => clearTimeout(t);
  }, [marker]);
  return active;
}

/**
 * Dashboard Component
 *
 * Operator HMI. All plant state (physics, interlocks, Modbus wire log, audit
 * trail, alerts) lives on the server; this component renders the SSE telemetry
 * stream and sends commands. Interlock denials come back from the server and
 * are shown as toasts.
 */
export function Dashboard() {
  const { toast } = useToast();
  const {
    snapshot,
    alerts,
    audit,
    status,
    lastUpdateAgeSeconds,
    sessionRestarted,
    rpmHistory,
    tempHistory,
    sendCommand,
  } = useTelemetry();

  const state = snapshot?.state ?? initialState();
  const network = snapshot?.network ?? { packetCount: 0, latencyMs: 0, errorCount: 0 };
  const traffic = snapshot?.traffic ?? [];

  const lastTx = [...traffic].reverse().find((t) => t.direction === 'TX')?.id;
  const lastRx = [...traffic].reverse().find((t) => t.direction === 'RX')?.id;
  const txActive = useFlash(lastTx);
  const rxActive = useFlash(lastRx);

  const controlsAvailable = Boolean(snapshot) && status === 'Connected';
  // Only the latest intent for a given control may show a delayed failure.
  // An E-STOP invalidates feedback from all older ordinary commands.
  const commandRequests = useRef({
    next: 0,
    estopGeneration: 0,
    lastByType: {} as Partial<Record<Command['type'], number>>,
  });
  const run = useCallback(
    async (command: Command) => {
      // The panel is disabled when readback is stale, but also reject events
      // that race with a status change. E-STOP must remain callable.
      if (command.type !== 'estop' && !controlsAvailable) {
        const reason = 'Telemetry is not current. Wait for a fresh gateway snapshot.';
        toast({ variant: 'destructive', title: 'Action Denied', description: reason });
        return { ok: false, reason };
      }
      const requests = commandRequests.current;
      const requestId = ++requests.next;
      if (command.type === 'estop') requests.estopGeneration += 1;
      else requests.lastByType[command.type] = requestId;
      const startedBeforeEstopGeneration = requests.estopGeneration;

      const outcome = await sendCommand(command);
      if (
        command.type !== 'estop' &&
        (outcome.obsolete ||
          requests.estopGeneration !== startedBeforeEstopGeneration ||
          requests.lastByType[command.type] !== requestId)
      ) {
        return { ...outcome, obsolete: true };
      }
      if (!outcome.ok) {
        toast({
          variant: 'destructive',
          title: command.type === 'start' ? 'Interlock Active' : 'Action Denied',
          description: `⛔ ${outcome.reason ?? 'Command rejected.'}`,
        });
      }
      return outcome;
    },
    [controlsAvailable, sendCommand, toast],
  );

  const setpointsEditable = controlsAvailable && state.isManualMode && !state.estopLatched;
  const rpmSetpoint = useSyncedSetpoint({
    appliedValue: state.targetRpmManual,
    runId: snapshot?.runId ?? null,
    seq: snapshot?.seq ?? 0,
    enabled: setpointsEditable,
    send: (value, expectedValue, expectedRunId) =>
      run({ type: 'set_rpm_setpoint', value, expectedValue, expectedRunId }),
  });
  const tempSetpoint = useSyncedSetpoint({
    appliedValue: state.targetTempManual,
    runId: snapshot?.runId ?? null,
    seq: snapshot?.seq ?? 0,
    enabled: setpointsEditable,
    send: (value, expectedValue, expectedRunId) =>
      run({ type: 'set_temp_setpoint', value, expectedValue, expectedRunId }),
  });

  // Server-side export: the last hour of persisted samples, not just the 60 s on screen.
  const exportToCsv = () => {
    window.location.href = '/api/export';
  };

  const { rpm, temp, ph, valveOpen, isRunning, isHeaterOn, isManualMode } = state;
  const systemState = state.estopLatched
    ? 'E-STOP LATCHED'
    : isRunning && rpm > 10
      ? 'MIXING'
      : isHeaterOn
        ? 'HEATING'
        : 'IDLE';
  const interlockActive =
    state.estopLatched || isRunning || rpm >= 1 || valveOpen ? 'ACTIVE' : 'INACTIVE';
  const errorRate = network.packetCount > 0 ? (network.errorCount / network.packetCount) * 100 : 0;
  const health = (100 - errorRate).toFixed(1);
  const connected = status === 'Connected';
  const ageLabel = lastUpdateAgeSeconds === null ? 'WAITING' : `${lastUpdateAgeSeconds}s AGO`;

  return (
    <div className="flex min-h-screen w-full max-w-[1800px] flex-col overflow-x-hidden bg-[#222222] p-4 lg:p-6 mx-auto">
      <header className="mb-4 flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tighter text-primary">
            CHEMVIEW <span className="text-white font-light">HMI 1.0</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Industrial Digital Twin Prototype
            </p>
            <span className="rounded border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Simulated Process
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end lg:gap-5">
          <div className="flex items-center gap-3 bg-zinc-900/50 px-3 py-1.5 rounded-md border border-white/5">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">RX</span>
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  rxActive ? 'bg-primary glow-primary' : 'bg-zinc-800',
                )}
              />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold text-zinc-500 uppercase">TX</span>
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  txActive ? 'bg-orange-500 shadow-orange-500' : 'bg-zinc-800',
                )}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            className="h-9 text-[11px] font-mono gap-2 border-white/10"
          >
            <Download className="w-3 h-3" /> EXPORT CSV
          </Button>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="w-3 h-3 text-primary" />
              ) : (
                <WifiOff className="w-3 h-3 text-destructive" />
              )}
              <span
                className={cn(
                  'text-[11px] font-mono font-bold uppercase',
                  connected ? 'text-primary' : 'text-destructive',
                )}
              >
                {connected ? 'Gateway Active' : `Gateway ${status}`}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{GATEWAY_ADDRESS}</span>
            <span
              data-testid="telemetry-age"
              className="text-[10px] text-muted-foreground font-mono"
            >
              LAST DATA: {ageLabel}
            </span>
            <span
              data-testid="telemetry-run-id"
              title={snapshot?.runId ?? 'Awaiting simulator session'}
              className="text-[10px] text-muted-foreground font-mono"
            >
              SESSION: {snapshot ? snapshot.runId.slice(0, 8) : 'WAITING'}
            </span>
          </div>
          <div
            className="flex items-center gap-2 border-l border-white/10 pl-3"
            aria-label="Nexus brand"
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">by</span>
            <Image
              src="/nexus-logo.png"
              alt="NEXUS"
              width={100}
              height={40}
              priority
              className="h-auto w-[86px]"
            />
          </div>
        </div>
      </header>

      {snapshot && !connected && (
        <div
          role="alert"
          data-testid="telemetry-warning"
          className="mb-3 shrink-0 rounded border border-amber-600/60 bg-amber-950/40 px-3 py-2 text-xs font-mono text-amber-200"
        >
          TELEMETRY NOT LIVE ({status.toUpperCase()}) — displayed values are the last validated
          snapshot. Verify gateway connectivity before relying on readback.
        </div>
      )}
      {sessionRestarted && (
        <div
          role="status"
          data-testid="simulation-restart"
          className="mb-3 shrink-0 rounded border border-sky-600/50 bg-sky-950/30 px-3 py-2 text-xs font-mono text-sky-200"
        >
          SIMULATION SESSION CHANGED — trend history is scoped to the new session.
        </div>
      )}

      <main className="grid min-w-0 flex-1 grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* Left Column: Telemetry & Visualization */}
        <section
          aria-label="Process telemetry"
          className="flex min-w-0 flex-col gap-4 xl:col-span-8"
        >
          <StatusDisplay
            mixingSpeed={rpm}
            temperature={temp}
            ph={ph}
            valveOpen={valveOpen}
            isHeaterOn={isHeaterOn}
          />

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="hmi-panel flex min-h-[360px] min-w-0 flex-col items-center justify-center p-4">
              <TankSimulation
                rpm={rpm}
                isRunning={isRunning}
                temperature={temp}
                ph={ph}
                isHeaterOn={isHeaterOn}
                liquidLevel={state.level}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <TrendChart
                title="Temperature"
                data={tempHistory}
                color="#00FFFF"
                unit="°C"
                domain={[20, 100]}
              />
              <TrendChart
                title="Mixer Speed"
                data={rpmHistory}
                color="#00FFFF"
                unit="RPM"
                domain={[0, 1500]}
              />
              <div className="min-w-0">
                <CommunicationLog logs={traffic} />
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Controls & Intelligence */}
        <section
          aria-label="Operator controls"
          className="flex min-w-0 flex-col gap-4 xl:col-span-4"
        >
          <NetworkStats
            packetCount={network.packetCount}
            latency={network.latencyMs}
            errorRate={errorRate}
          />

          <ControlPanel
            isRunning={isRunning}
            estopLatched={state.estopLatched}
            isManualMode={isManualMode}
            onToggle={() =>
              run({
                type: isRunning ? 'stop' : 'start',
                expectedRunning: isRunning,
                expectedRunId: snapshot?.runId,
              })
            }
            onToggleMode={() =>
              run({
                type: 'set_mode',
                manual: !isManualMode,
                expectedValue: isManualMode,
                expectedRunId: snapshot?.runId,
              })
            }
            onEmergencyStop={() => run({ type: 'estop' })}
            onResetEmergencyStop={() =>
              run({
                type: 'reset_estop',
                expectedRunId: snapshot?.runId,
                expectedEstopEpoch: snapshot?.estopEpoch,
              })
            }
            connectionStatus={status}
            targetRpm={rpmSetpoint.value}
            targetTemp={tempSetpoint.value}
            rpmSetpointPending={rpmSetpoint.pending}
            tempSetpointPending={tempSetpoint.pending}
            currentRpm={rpm}
            setTargetRpm={rpmSetpoint.onChange}
            setTargetTemp={tempSetpoint.onChange}
            commitTargetRpm={rpmSetpoint.onCommit}
            commitTargetTemp={tempSetpoint.onCommit}
            beginRpmEdit={rpmSetpoint.beginGesture}
            endRpmEdit={rpmSetpoint.endGesture}
            beginTempEdit={tempSetpoint.beginGesture}
            endTempEdit={tempSetpoint.endGesture}
            valveOpen={valveOpen}
            onToggleValve={() =>
              run({
                type: 'set_valve',
                open: !valveOpen,
                expectedValue: valveOpen,
                expectedRunId: snapshot?.runId,
              })
            }
            isHeaterOn={isHeaterOn}
            onToggleHeater={() =>
              run({
                type: 'set_heater',
                on: !isHeaterOn,
                expectedValue: isHeaterOn,
                expectedRunId: snapshot?.runId,
              })
            }
          />

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-1">
            <AlertPanel alerts={alerts} isGenerating={snapshot?.aiBusy ?? false} />
            <AuditLog logs={audit} />
          </div>
        </section>
      </main>

      <footer className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>LATENCY: {network.latencyMs.toFixed(1)}ms</span>
            <span>HEALTH: {health}%</span>
            <span>BUFFER: {traffic.length}/50</span>
          </div>
          <span>OPERATOR: {OPERATOR_ID}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-white/5 bg-zinc-900/50 p-2 font-mono text-[10px] uppercase text-zinc-400">
          <span>STATE: {systemState}</span>
          <span>INTERLOCK: {interlockActive}</span>
          <span>HEATER: {isHeaterOn ? 'ON' : 'OFF'}</span>
          <span>LOCK: {state.estopLatched ? 'E-STOP' : rpm < 1 ? 'READY' : 'BUSY'}</span>
        </div>
      </footer>
    </div>
  );
}

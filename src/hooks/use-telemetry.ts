'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Alert, Command, Snapshot } from '@/server/sim/types';
import {
  classifySnapshot,
  mergeAlertHistory,
  parseAlertHistory,
  parseHistorySamples,
  parseSnapshotEvent,
  type SnapshotCursor,
} from '@/lib/telemetry';
import { PRELOAD_WINDOW_MS, mergeHistory, toPoint, type HistoryPoint } from '@/lib/history';
import {
  telemetryAgeSeconds,
  telemetryStatus,
  type TransportState,
} from '@/lib/telemetry-freshness';

export type { HistoryPoint };

export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Connecting' | 'Stale';

export interface CommandOutcome {
  ok: boolean;
  reason?: string;
  /** The reply belongs to a previous simulator run, not the current screen. */
  obsolete?: boolean;
}

/** An old ordinary-command response must not report on a newer engine run. */
export function isObsoleteCommandResponse(
  command: Command,
  sentOnRun: string | null,
  currentRun: string | null,
): boolean {
  // E-STOP failure must still be reported even if the engine restarted meanwhile.
  return command.type !== 'estop' && sentOnRun !== currentRun;
}

/**
 * Subscribes to the server's SSE telemetry stream and exposes the latest
 * snapshot, rolling trend history and a command sender. The server owns all
 * plant state; this hook only mirrors it.
 */
export function useTelemetry() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [transportStatus, setTransportStatus] = useState<TransportState>('Connecting');
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [sessionRestarted, setSessionRestarted] = useState(false);
  const [alertHistory, setAlertHistory] = useState<Alert[]>([]);
  const [rpmHistory, setRpmHistory] = useState<HistoryPoint[]>([]);
  const [tempHistory, setTempHistory] = useState<HistoryPoint[]>([]);
  const lastCursor = useRef<SnapshotCursor | null>(null);
  const activeRunId = snapshot?.runId;
  const status = telemetryStatus(transportStatus, lastReceivedAt, nowMs);
  const lastUpdateAgeSeconds = telemetryAgeSeconds(lastReceivedAt, nowMs);

  // A hung SSE connection may remain OPEN. Periodically check application data age.
  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Only fetch persisted samples after the SSE stream identifies the current run.
  // Re-fetch on engine restart and discard responses from an older run.
  useEffect(() => {
    if (!activeRunId) return;
    const controller = new AbortController();
    const from = new Date(Date.now() - PRELOAD_WINDOW_MS).toISOString();
    fetch(
      `/api/history?from=${encodeURIComponent(from)}&runId=${encodeURIComponent(activeRunId)}`,
      { signal: controller.signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (controller.signal.aborted || lastCursor.current?.runId !== activeRunId) return;
        const samples = parseHistorySamples(body, activeRunId);
        if (!samples) return;
        setRpmHistory((prev) =>
          lastCursor.current?.runId === activeRunId
            ? mergeHistory(
                prev,
                samples.map((s) => toPoint(s.ts, s.rpm)),
              )
            : prev,
        );
        setTempHistory((prev) =>
          lastCursor.current?.runId === activeRunId
            ? mergeHistory(
                prev,
                samples.map((s) => toPoint(s.ts, s.temp)),
              )
            : prev,
        );
      })
      .catch(() => {
        /* History is optional; SSE still supplies live samples. */
      });
    return () => controller.abort();
  }, [activeRunId]);

  // Load persisted events for the currently validated simulator run.
  // Keep the last live SSE events if an older persisted response arrives afterward.
  useEffect(() => {
    if (!activeRunId) return;
    const controller = new AbortController();
    fetch(`/api/alerts?runId=${encodeURIComponent(activeRunId)}&limit=50`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (controller.signal.aborted || lastCursor.current?.runId !== activeRunId) return;
        const alerts = parseAlertHistory(body, activeRunId);
        if (!alerts) return;
        setAlertHistory((previous) =>
          lastCursor.current?.runId === activeRunId
            ? mergeAlertHistory(previous, alerts)
            : previous,
        );
      })
      .catch(() => {
        /* The live stream still provides the latest alarm events. */
      });
    return () => controller.abort();
  }, [activeRunId]);

  useEffect(() => {
    const source = new EventSource('/api/stream');

    // Transport establishment alone does not prove that telemetry is valid.
    source.onopen = () => setTransportStatus('Connecting');
    // EventSource retries on its own; CLOSED means it gave up.
    source.onerror = () =>
      setTransportStatus(source.readyState === EventSource.CLOSED ? 'Disconnected' : 'Connecting');
    source.onmessage = (event) => {
      const next = parseSnapshotEvent(event.data);
      if (!next) {
        // Keep the last valid process view; do not treat a corrupt payload as live data.
        setTransportStatus('Disconnected');
        return;
      }
      const transition = classifySnapshot(lastCursor.current, next);
      if (transition === 'ignore') return;
      if (transition === 'new-run') setSessionRestarted(true);
      setLastReceivedAt(Date.now());
      setTransportStatus('Connected');
      lastCursor.current = { runId: next.runId, seq: next.seq };
      setSnapshot(next);
      setAlertHistory((previous) =>
        transition === 'new-run'
          ? mergeAlertHistory([], next.alerts)
          : mergeAlertHistory(previous, next.alerts),
      );

      setRpmHistory((prev) =>
        transition === 'new-run'
          ? [toPoint(next.timestamp, next.state.rpm)]
          : mergeHistory(prev, [toPoint(next.timestamp, next.state.rpm)]),
      );
      setTempHistory((prev) =>
        transition === 'new-run'
          ? [toPoint(next.timestamp, next.state.temp)]
          : mergeHistory(prev, [toPoint(next.timestamp, next.state.temp)]),
      );
    };

    return () => source.close();
  }, []);

  const sendCommand = useCallback(async (command: Command): Promise<CommandOutcome> => {
    const sentOnRun = lastCursor.current?.runId ?? null;
    const wasSuperseded = () =>
      isObsoleteCommandResponse(command, sentOnRun, lastCursor.current?.runId ?? null);
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      const payload: unknown = await res.json();
      if (wasSuperseded()) return { ok: false, obsolete: true };
      if (!payload || typeof payload !== 'object' || !('ok' in payload)) {
        return { ok: false, reason: 'Invalid gateway command response.' };
      }
      const body = payload as { ok: unknown; reason?: unknown };
      if (typeof body.ok !== 'boolean') {
        return { ok: false, reason: 'Invalid gateway command response.' };
      }
      return {
        ok: res.ok && body.ok,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
      };
    } catch {
      if (wasSuperseded()) return { ok: false, obsolete: true };
      return { ok: false, reason: 'Gateway unreachable.' };
    }
  }, []);

  return {
    snapshot,
    alerts: alertHistory.filter((alert) => alert.runId === activeRunId),
    status,
    lastUpdateAgeSeconds,
    sessionRestarted,
    rpmHistory,
    tempHistory,
    sendCommand,
  };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, Snapshot } from '@/server/sim/types';
import {
  classifySnapshot,
  parseHistorySamples,
  parseSnapshotEvent,
  type SnapshotCursor,
} from '@/lib/telemetry';
import { PRELOAD_WINDOW_MS, mergeHistory, toPoint, type HistoryPoint } from '@/lib/history';

export type { HistoryPoint };

export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Connecting';

export interface CommandOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Subscribes to the server's SSE telemetry stream and exposes the latest
 * snapshot, rolling trend history and a command sender. The server owns all
 * plant state; this hook only mirrors it.
 */
export function useTelemetry() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('Connecting');
  const [rpmHistory, setRpmHistory] = useState<HistoryPoint[]>([]);
  const [tempHistory, setTempHistory] = useState<HistoryPoint[]>([]);
  const lastCursor = useRef<SnapshotCursor | null>(null);
  const activeRunId = snapshot?.runId;

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
        if (controller.signal.aborted) return;
        const samples = parseHistorySamples(body, activeRunId);
        if (!samples) return;
        setRpmHistory((prev) =>
          mergeHistory(
            prev,
            samples.map((s) => toPoint(s.ts, s.rpm)),
          ),
        );
        setTempHistory((prev) =>
          mergeHistory(
            prev,
            samples.map((s) => toPoint(s.ts, s.temp)),
          ),
        );
      })
      .catch(() => {
        /* History is optional; SSE still supplies live samples. */
      });
    return () => controller.abort();
  }, [activeRunId]);

  useEffect(() => {
    const source = new EventSource('/api/stream');

    // Transport establishment alone does not prove that telemetry is valid.
    source.onopen = () => setStatus('Connecting');
    // EventSource retries on its own; CLOSED means it gave up.
    source.onerror = () =>
      setStatus(source.readyState === EventSource.CLOSED ? 'Disconnected' : 'Connecting');
    source.onmessage = (event) => {
      const next = parseSnapshotEvent(event.data);
      if (!next) {
        // Keep the last valid process view; do not treat a corrupt payload as live data.
        setStatus('Disconnected');
        return;
      }
      const transition = classifySnapshot(lastCursor.current, next);
      setStatus('Connected');
      if (transition === 'ignore') return;
      lastCursor.current = { runId: next.runId, seq: next.seq };
      setSnapshot(next);

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
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      const body = (await res.json()) as CommandOutcome;
      return { ok: res.ok && body.ok, reason: body.reason };
    } catch {
      return { ok: false, reason: 'Gateway unreachable.' };
    }
  }, []);

  return { snapshot, status, rpmHistory, tempHistory, sendCommand };
}

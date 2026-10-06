'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, Snapshot } from '@/server/sim/types';
import type { TelemetrySample } from '@/server/store';
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
  const lastSeq = useRef(-1);

  // Seed the trends from the server's persisted samples so a page refresh does not start empty.
  useEffect(() => {
    const controller = new AbortController();
    const from = new Date(Date.now() - PRELOAD_WINDOW_MS).toISOString();
    fetch(`/api/history?from=${encodeURIComponent(from)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { samples: TelemetrySample[] } | null) => {
        if (!body) return;
        setRpmHistory((prev) =>
          mergeHistory(
            prev,
            body.samples.map((s) => toPoint(s.ts, s.rpm)),
          ),
        );
        setTempHistory((prev) =>
          mergeHistory(
            prev,
            body.samples.map((s) => toPoint(s.ts, s.temp)),
          ),
        );
      })
      .catch(() => {
        /* history is a nicety; the live stream still fills the trend */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const source = new EventSource('/api/stream');

    source.onopen = () => setStatus('Connected');
    // EventSource retries on its own; CLOSED means it gave up.
    source.onerror = () =>
      setStatus(source.readyState === EventSource.CLOSED ? 'Disconnected' : 'Connecting');
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as Snapshot;
      if (next.seq === lastSeq.current) return;
      // A lower seq means the server restarted: start the trends over.
      if (next.seq < lastSeq.current) {
        setRpmHistory([]);
        setTempHistory([]);
      }
      lastSeq.current = next.seq;
      setStatus('Connected');
      setSnapshot(next);

      setRpmHistory((prev) => mergeHistory(prev, [toPoint(next.timestamp, next.state.rpm)]));
      setTempHistory((prev) => mergeHistory(prev, [toPoint(next.timestamp, next.state.temp)]));
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

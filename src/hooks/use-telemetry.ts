"use client"

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, Snapshot } from '@/server/sim/types';

export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Connecting';

export interface HistoryPoint {
  time: string;
  value: number;
}

export interface CommandOutcome {
  ok: boolean;
  reason?: string;
}

const HISTORY_LIMIT = 60;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

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

      const time = clock(next.timestamp);
      setRpmHistory((prev) => [...prev, { time, value: next.state.rpm }].slice(-HISTORY_LIMIT));
      setTempHistory((prev) => [...prev, { time, value: next.state.temp }].slice(-HISTORY_LIMIT));
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

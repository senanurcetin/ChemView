import { z } from 'zod';
import type { Snapshot } from '@/server/sim/types';

const finite = z.number().finite();
const level = z.enum(['low', 'medium', 'high']);
const timestamp = z.string().datetime({ offset: true });

/** Validate the entire SSE payload before updating any operator-visible state. */
const snapshotSchema: z.ZodType<Snapshot> = z.object({
  runId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  timestamp,
  state: z.object({
    isRunning: z.boolean(),
    estopLatched: z.boolean(),
    isManualMode: z.boolean(),
    isHeaterOn: z.boolean(),
    valveOpen: z.boolean(),
    rpm: finite,
    temp: finite,
    ph: finite,
    level: finite,
    targetRpmManual: finite,
    targetTempManual: finite,
  }),
  network: z.object({
    packetCount: z.number().int().nonnegative(),
    latencyMs: finite,
    errorCount: z.number().int().nonnegative(),
  }),
  traffic: z.array(
    z.object({
      id: z.string(),
      timestamp,
      direction: z.enum(['RX', 'TX']),
      frame: z.string(),
    }),
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      timestamp,
      message: z.string(),
      level,
    }),
  ),
  alerts: z.array(
    z.object({
      id: z.string(),
      timestamp,
      source: z.enum(['rule', 'ai']),
      message: z.string(),
      urgency: level,
    }),
  ),
  aiBusy: z.boolean(),
});

export function parseSnapshotEvent(raw: string): Snapshot | null {
  try {
    const payload: unknown = JSON.parse(raw);
    const parsed = snapshotSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type SnapshotCursor = Pick<Snapshot, 'runId' | 'seq'>;
export type SnapshotTransition = 'initial' | 'advance' | 'new-run' | 'ignore';

/**
 * An older sequence in the same run is stale, not a simulator restart.
 * A new runId is a restart even if its sequence is already higher.
 */
export function classifySnapshot(
  previous: SnapshotCursor | null,
  next: SnapshotCursor,
): SnapshotTransition {
  if (!previous) return 'initial';
  if (next.runId !== previous.runId) return 'new-run';
  return next.seq > previous.seq ? 'advance' : 'ignore';
}

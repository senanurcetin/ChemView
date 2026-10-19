import { z } from 'zod';
import type { Alert, Snapshot } from '@/server/sim/types';
import { THRESHOLDS } from '@/server/sim/thresholds';
import type { TelemetrySample } from '@/server/store';

const finite = z.number().finite();
const level = z.enum(['low', 'medium', 'high']);
const rpm = finite.min(0).max(THRESHOLDS.rpmMax);
const temperature = finite.min(-273.15).max(300);
const ph = finite.min(0).max(14);
const fillLevel = finite.min(0).max(100);
const timestamp = z.string().datetime({ offset: true });

const alertSchema: z.ZodType<Alert> = z.object({
  id: z.string().min(1),
  runId: z.string().uuid().optional(),
  timestamp,
  source: z.enum(['rule', 'ai']),
  message: z.string(),
  urgency: level,
});

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
    rpm,
    temp: temperature,
    ph,
    level: fillLevel,
    targetRpmManual: rpm,
    targetTempManual: finite.min(THRESHOLDS.tempMin).max(THRESHOLDS.tempMax),
  }),
  network: z.object({
    packetCount: z.number().int().nonnegative(),
    latencyMs: finite.nonnegative(),
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
  alerts: z.array(alertSchema),
  aiBusy: z.boolean(),
});

const historySampleSchema: z.ZodType<TelemetrySample> = z.object({
  ts: timestamp,
  runId: z.string().uuid().optional(),
  rpm,
  temp: temperature,
  ph,
  level: fillLevel,
  isRunning: z.boolean(),
  isHeaterOn: z.boolean(),
  valveOpen: z.boolean(),
});

const historyResponseSchema = z.object({
  runId: z.string().uuid(),
  samples: z.array(historySampleSchema),
});

/** The /api/history response is external input even when produced by our server. */
export function parseHistorySamples(
  payload: unknown,
  expectedRunId?: string,
): TelemetrySample[] | null {
  const parsed = historyResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  if (expectedRunId && parsed.data.runId !== expectedRunId) return null;
  // Never merge samples from another run, including legacy untagged records.
  if (parsed.data.samples.some((sample) => sample.runId !== parsed.data.runId)) return null;
  return parsed.data.samples;
}

const alertHistorySchema = z.object({
  runId: z.string().uuid(),
  alerts: z.array(alertSchema),
});

/** Reject malformed, cross-run or untagged archived alarm records. */
export function parseAlertHistory(payload: unknown, expectedRunId: string): Alert[] | null {
  const parsed = alertHistorySchema.safeParse(payload);
  if (!parsed.success || parsed.data.runId !== expectedRunId) return null;
  if (parsed.data.alerts.some((alert) => alert.runId !== expectedRunId)) return null;
  return parsed.data.alerts;
}

/** Combine persisted and live alerts, newest first, with one entry per event ID. */
export function mergeAlertHistory(previous: Alert[], incoming: Alert[], limit = 50): Alert[] {
  const unique = new Map<string, Alert>();
  for (const alert of [...incoming, ...previous]) {
    if (!unique.has(alert.id)) unique.set(alert.id, alert);
  }
  return [...unique.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

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

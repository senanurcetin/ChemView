import { z } from 'zod';
import type { Alert, AuditEntry, Snapshot } from '@/server/sim/types';
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

const auditEntrySchema: z.ZodType<AuditEntry> = z.object({
  id: z.string().min(1),
  runId: z.string().uuid().optional(),
  timestamp,
  message: z.string(),
  level,
});

/** Validate the entire SSE payload before updating any operator-visible state. */
const snapshotSchema: z.ZodType<Snapshot> = z.object({
  runId: z.string().uuid(),
  scenario: z
    .enum(['nominal', 'thermal_excursion', 'low_inventory', 'ph_excursion', 'sensor_drift', 'comms_timeout'])
    .optional(),
  scenarioSeed: z.number().int().nonnegative().optional(),
  sensorDiagnostics: z
    .object({ phReference: ph, phBias: finite.min(-14).max(14) })
    .optional(),
  estopEpoch: z.number().int().nonnegative(),
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
  audit: z.array(auditEntrySchema),
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

const auditHistorySchema = z.object({
  runId: z.string().uuid(),
  entries: z.array(auditEntrySchema),
});

/** Audit archives are an untrusted API payload: reject legacy and cross-run entries. */
export function parseAuditHistory(payload: unknown, expectedRunId: string): AuditEntry[] | null {
  const parsed = auditHistorySchema.safeParse(payload);
  if (!parsed.success || parsed.data.runId !== expectedRunId) return null;
  if (parsed.data.entries.some((entry) => entry.runId !== expectedRunId)) return null;
  return parsed.data.entries;
}

/** Keep up to fifty unique audit events, newest first, across SSE and archive. */
export function mergeAuditHistory(
  previous: AuditEntry[],
  incoming: AuditEntry[],
  limit = 50,
): AuditEntry[] {
  const events = new Map<string, AuditEntry>();
  for (const entry of [...incoming, ...previous]) {
    if (!events.has(entry.id)) events.set(entry.id, entry);
  }
  return [...events.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
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
    if (!parsed.success) return null;
    const snapshot = parsed.data;
    // A syntactically valid SSE message must never smuggle another run's
    // audit or alarm records into the current operator session.
    if (snapshot.alerts.some((alert) => alert.runId !== snapshot.runId)) return null;
    if (snapshot.audit.some((entry) => entry.runId !== snapshot.runId)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export type SnapshotCursor = Pick<Snapshot, 'runId' | 'seq'> &
  Partial<Pick<Snapshot, 'estopEpoch'>>;
export type SnapshotTransition = 'initial' | 'advance' | 'new-run' | 'ignore';

/**
 * An older sequence in the same run is stale, not a simulator restart.
 * A new runId is a restart even if its sequence is already higher.
 */
export function classifySnapshot(
  previous: SnapshotCursor | null,
  next: SnapshotCursor,
  retiredRunIds: ReadonlySet<string> = new Set(),
): SnapshotTransition {
  if (retiredRunIds.has(next.runId)) return 'ignore';
  if (!previous) return 'initial';
  if (next.runId !== previous.runId) return 'new-run';
  // An E-STOP generation cannot decrease within a running engine, even
  // when a replayed packet has a larger SSE sequence.
  if (
    previous.estopEpoch !== undefined &&
    next.estopEpoch !== undefined &&
    next.estopEpoch < previous.estopEpoch
  ) {
    return 'ignore';
  }
  return next.seq > previous.seq ? 'advance' : 'ignore';
}

import type { Alert, AuditEntry, SimState } from './sim/types';

export interface TelemetrySample {
  /** ISO timestamp. */
  ts: string;
  /** Optional only for records written before run-scoped storage was introduced. */
  runId?: string;
  rpm: number;
  temp: number;
  ph: number;
  level: number;
  isRunning: boolean;
  isHeaterOn: boolean;
  valveOpen: boolean;
}

export interface HistoryRange {
  from: string;
  to: string;
  limit?: number;
  /** When supplied, return only telemetry belonging to this engine run. */
  runId?: string;
}

export interface Store {
  readonly kind: string;
  saveTelemetry(sample: TelemetrySample): Promise<void>;
  saveAlert(alert: Alert): Promise<void>;
  /** Alert events, newest first. When runId is omitted, only legacy alerts are returned. */
  recentAlerts(limit: number, runId?: string): Promise<Alert[]>;
  saveAudit(entry: AuditEntry): Promise<void>;
  /** Samples with `from <= ts <= to`, oldest first; at most `limit` of them (the oldest in range). */
  history(range: HistoryRange): Promise<TelemetrySample[]>;
  /** Newest audit entries from one run; unscoped queries return legacy records only. */
  recentAudit(limit: number, runId?: string): Promise<AuditEntry[]>;
}

export function toSample(state: SimState, ts: string, runId?: string): TelemetrySample {
  return {
    ts,
    ...(runId ? { runId } : {}),
    rpm: Math.round(state.rpm * 100) / 100,
    temp: Math.round(state.temp * 100) / 100,
    ph: Math.round(state.ph * 1000) / 1000,
    level: state.level,
    isRunning: state.isRunning,
    isHeaterOn: state.isHeaterOn,
    valveOpen: state.valveOpen,
  };
}

/** Bounded in-process store: the default when no Firebase credentials are configured. */
export class MemoryStore implements Store {
  readonly kind = 'memory';
  private samples: TelemetrySample[] = [];
  private audit: AuditEntry[] = [];
  private alerts: Alert[] = [];

  constructor(
    private readonly maxSamples = 5000,
    private readonly maxAudit = 500,
    private readonly maxAlerts = 200,
  ) {}

  async saveTelemetry(sample: TelemetrySample) {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples)
      this.samples.splice(0, this.samples.length - this.maxSamples);
  }

  async saveAlert(alert: Alert) {
    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) this.alerts.length = this.maxAlerts;
  }

  async recentAlerts(limit: number, runId?: string) {
    return this.alerts
      .filter((alert) => alert.runId === runId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async saveAudit(entry: AuditEntry) {
    this.audit.unshift(entry);
    if (this.audit.length > this.maxAudit) this.audit.length = this.maxAudit;
  }

  async history({ from, to, limit = 5000, runId }: HistoryRange) {
    return this.samples
      .filter((s) => s.ts >= from && s.ts <= to && s.runId === runId)
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .slice(0, limit);
  }

  async recentAudit(limit: number, runId?: string) {
    return this.audit
      .filter((entry) => entry.runId === runId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }
}

/** Firestore when FIREBASE_* env vars are present, otherwise {@link MemoryStore}. */
export async function createStore(
  env: Record<string, string | undefined> = process.env,
): Promise<Store> {
  const {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: clientEmail,
    FIREBASE_PRIVATE_KEY: key,
  } = env;
  if (!projectId || !clientEmail || !key) return new MemoryStore();
  const { FirestoreStore } = await import('./firestore-store');
  return new FirestoreStore({ projectId, clientEmail, privateKey: key.replace(/\\n/g, '\n') });
}

/** Defers to a store that is created asynchronously (the Firestore SDK is loaded lazily). */
class LazyStore implements Store {
  constructor(private readonly inner: Promise<Store>) {}
  get kind() {
    return 'lazy';
  }
  async saveTelemetry(sample: TelemetrySample) {
    return (await this.inner).saveTelemetry(sample);
  }
  async saveAlert(alert: Alert) {
    return (await this.inner).saveAlert(alert);
  }
  async recentAlerts(limit: number, runId?: string) {
    return (await this.inner).recentAlerts(limit, runId);
  }
  async saveAudit(entry: AuditEntry) {
    return (await this.inner).saveAudit(entry);
  }
  async history(range: HistoryRange) {
    return (await this.inner).history(range);
  }
  async recentAudit(limit: number, runId?: string) {
    return (await this.inner).recentAudit(limit, runId);
  }
}

const globalForStore = globalThis as unknown as { __chemviewStore?: Store };

/** Process-wide store singleton shared by the engine and the API routes. */
export function getStore(): Store {
  return (globalForStore.__chemviewStore ??= new LazyStore(
    createStore().catch((error) => {
      console.warn(
        '[store] falling back to memory:',
        error instanceof Error ? error.message : error,
      );
      return new MemoryStore();
    }),
  ));
}

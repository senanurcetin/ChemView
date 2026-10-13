import { evaluateRules, NOMINAL_MESSAGE } from './alerts';
import { Commentator } from './commentary';
import { applyCommand } from './interlocks';
import { commandFrame, readRequestFrame, readResponseFrame } from './modbus';
import { createRng, type Rng } from './rng';
import { initialState } from './state';
import { getStore, toSample, type Store } from '../store';
import type {
  Alert,
  AuditEntry,
  Command,
  CommandResult,
  NetworkCounters,
  SimState,
  Snapshot,
  TrafficEntry,
} from './types';

export { initialState };
export const TICK_MS = 1000;
const LOG_LIMIT = 50;
const ALERT_LIMIT = 5;
/** Persist one telemetry sample every N ticks (5 s at the 1 s tick). */
export const TELEMETRY_EVERY = 5;

/**
 * Advances the physical model by one polling tick (1 s).
 * Pure: all randomness comes from the injected `rng`.
 */
export function step(state: SimState, rng: Rng): SimState {
  // RPM: rotational inertia
  let rpm: number;
  if (!state.isRunning) {
    rpm = Math.max(0, state.rpm - 15);
  } else {
    const target = state.isManualMode ? state.targetRpmManual : 450 + rng() * 50;
    rpm = state.rpm + (target - state.rpm) * 0.1;
  }

  // Temperature: heater with thermal inertia, passive cooling towards ambient
  let temp: number;
  if (state.isHeaterOn) {
    const target = state.isManualMode ? state.targetTempManual : 75;
    temp = state.temp < target ? state.temp + 0.15 : state.temp + (rng() - 0.5) * 0.1;
  } else {
    temp = state.temp > 22.0 ? state.temp - 0.05 : state.temp + (rng() - 0.5) * 0.02;
  }

  // pH: slow stochastic drift
  const targetPh = 7.2 + rng() * 0.4;
  const ph = state.ph + (targetPh - state.ph) * 0.05;

  // Level: discharging while the valve is open
  const level = state.valveOpen ? Math.max(0, state.level - 2) : state.level;

  return { ...state, rpm, temp, ph, level };
}

export interface EngineOptions {
  seed?: number;
  rng?: Rng;
  now?: () => Date;
  /** Optional LLM commentary layered on top of the rule alarms. */
  commentator?: Commentator;
  /** Optional persistence; writes are best-effort and never block or break a tick. */
  store?: Store;
}

type Listener = (snapshot: Snapshot) => void;

/**
 * Server-side process simulation. Owns the plant state, the simulated Modbus
 * wire log and the audit trail, and fans snapshots out to subscribers.
 */
export class Engine {
  private state: SimState = initialState();
  private readonly rng: Rng;
  private readonly now: () => Date;
  private seq = 0;
  private txId = 0;
  private idCounter = 0;
  private network: NetworkCounters = { packetCount: 0, latencyMs: 15.2, errorCount: 0 };
  private traffic: TrafficEntry[] = [];
  private audit: AuditEntry[] = [];
  private alerts: Alert[] = [];
  private lastAlertKey: string | null = null;
  private readonly commentator?: Commentator;
  private readonly store?: Store;
  private readonly runId = Date.now().toString(36);
  private tickCount = 0;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: EngineOptions = {}) {
    this.rng = options.rng ?? createRng(options.seed ?? Date.now());
    this.now = options.now ?? (() => new Date());
    this.commentator = options.commentator;
    this.store = options.store;
  }

  private nextId(): string {
    return `${this.runId}-${++this.idCounter}`;
  }

  private persist(write: (store: Store) => Promise<void>) {
    if (!this.store) return;
    write(this.store).catch((error) =>
      console.warn('[store] write failed:', error instanceof Error ? error.message : error),
    );
  }

  /** Seeds the audit trail from the store after a restart (newest first). */
  hydrate(audit: AuditEntry[]) {
    if (this.audit.length === 0) this.audit = audit.slice(0, LOG_LIMIT);
  }

  private pushTraffic(direction: 'RX' | 'TX', frame: string) {
    this.network.packetCount += 1;
    this.traffic = [
      ...this.traffic,
      { id: this.nextId(), timestamp: this.now().toISOString(), direction, frame },
    ].slice(-LOG_LIMIT);
  }

  private pushAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    const full: AuditEntry = { id: this.nextId(), timestamp: this.now().toISOString(), ...entry };
    this.audit = [full, ...this.audit].slice(0, LOG_LIMIT);
    this.persist((store) => store.saveAudit(full));
  }

  private pushAlert(alert: Alert) {
    this.alerts = [alert, ...this.alerts].slice(0, ALERT_LIMIT);
    this.persist((store) => store.saveAlert(alert));
  }

  /** Raises a rule alert only when the active condition changes (edge-triggered). */
  private evaluateAlerts() {
    const rule = evaluateRules(this.state);
    const key = rule?.key ?? 'nominal';
    if (key === this.lastAlertKey) return;
    this.lastAlertKey = key;

    const message = rule?.message ?? NOMINAL_MESSAGE;
    const urgency = rule?.urgency ?? 'low';
    this.pushAlert({
      id: this.nextId(),
      timestamp: this.now().toISOString(),
      source: 'rule',
      message,
      urgency,
    });
    if (urgency !== 'low') this.pushAudit({ message, level: urgency });
  }

  /** Runs one polling cycle: master read request, slave response, physics step. */
  tick(): Snapshot {
    this.state = step(this.state, this.rng);
    const txId = ++this.txId;
    this.pushTraffic('TX', readRequestFrame(txId));
    this.network.latencyMs = 12 + this.rng() * 6;
    this.pushTraffic('RX', readResponseFrame(txId, this.state));
    this.evaluateAlerts();
    const ts = this.now().toISOString();
    this.commentator?.record(this.state, ts);
    if (++this.tickCount % TELEMETRY_EVERY === 0) {
      const sample = toSample(this.state, ts);
      this.persist((store) => store.saveTelemetry(sample));
    }
    void this.runCommentary();
    return this.emit();
  }

  /** Fire-and-forget: the LLM never blocks the tick, and its failure changes nothing. */
  private async runCommentary() {
    const commentator = this.commentator;
    if (!commentator || commentator.busy) return;
    const pending = commentator.maybeComment(this.state);
    if (commentator.busy) this.emit(); // let clients show "Analyzing..."
    const result = await pending;
    if (result) {
      this.pushAlert({
        id: this.nextId(),
        timestamp: this.now().toISOString(),
        source: 'ai',
        message: result.message,
        urgency: result.urgency,
      });
    }
    this.emit();
  }

  command(cmd: Command): CommandResult {
    const result = applyCommand(this.state, cmd);
    if (!result.ok) return result;
    this.state = result.state;
    if (result.wrote) this.pushTraffic('TX', commandFrame(++this.txId, cmd));
    if (result.audit) this.pushAudit(result.audit);
    this.emit();
    return result;
  }

  getSnapshot(): Snapshot {
    return {
      seq: this.seq,
      timestamp: this.now().toISOString(),
      state: this.state,
      network: { ...this.network },
      traffic: this.traffic,
      audit: this.audit,
      alerts: this.alerts,
      aiBusy: this.commentator?.busy ?? false,
    };
  }

  private emit(): Snapshot {
    this.seq += 1;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  /** Subscribes to snapshots. The tick timer runs only while there are subscribers. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }
}

const globalForEngine = globalThis as unknown as { __chemviewEngine?: Engine };

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getEngine(): Engine {
  if (!globalForEngine.__chemviewEngine) {
    const engine = new Engine({ commentator: createCommentator(), store: getStore() });
    globalForEngine.__chemviewEngine = engine;
    getStore()
      .recentAudit(LOG_LIMIT)
      .then((audit) => engine.hydrate(audit))
      .catch(() => {});
  }
  return globalForEngine.__chemviewEngine;
}

/** LLM commentary is enabled only when a Gemini key is configured. */
function createCommentator(): Commentator | undefined {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) return undefined;
  return new Commentator({
    // Lazy import keeps the genkit runtime out of unit tests and cold starts without a key.
    generate: async (input) => {
      const { generateIntelligentAlert } = await import('@/ai/flows/intelligent-alert-generation');
      return generateIntelligentAlert(input);
    },
  });
}

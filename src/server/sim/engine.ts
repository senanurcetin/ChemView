import { randomUUID } from 'node:crypto';
import { evaluateAllRules, NOMINAL_MESSAGE } from './alerts';
import { Commentator, triggerKey } from './commentary';
import { applyCommand } from './interlocks';
import { commandFrame, readRequestFrame, readResponseFrame } from './modbus';
import { createRng, type Rng } from './rng';
import { initialState } from './state';
import { scenarioInitialState } from './scenarios';
import { advancePhysicalState, MIN_HEATER_LEVEL_PERCENT } from './physics';
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
  ScenarioId,
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
  return advancePhysicalState(state, rng);
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
  private rng: Rng;
  private readonly now: () => Date;
  private seq = 0;
  private estopEpoch = 0;
  private commandRevision = 0;
  private txId = 0;
  private idCounter = 0;
  private network: NetworkCounters = { packetCount: 0, latencyMs: 15.2, errorCount: 0 };
  private traffic: TrafficEntry[] = [];
  private audit: AuditEntry[] = [];
  private alerts: Alert[] = [];
  private lastAlertKeys = new Set<string>();
  private hasEvaluatedAlarms = false;
  private readonly commentator?: Commentator;
  private readonly store?: Store;
  private runId = randomUUID();
  private scenario: ScenarioId = 'nominal';
  private scenarioSeed: number | undefined;
  private phSensorBias = 0;
  private tickCount = 0;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: EngineOptions = {}) {
    this.rng = options.rng ?? createRng(options.seed ?? Date.now());
    this.now = options.now ?? (() => new Date());
    this.commentator = options.commentator;
    this.store = options.store;
  }

  /**
   * A lab experiment starts a fresh in-memory simulator run. It is not an
   * ordinary Modbus command and must never bypass an E-STOP latch.
   */
  loadScenario(
    scenario: ScenarioId,
    seed: number,
    expectedRunId?: string,
  ): { ok: boolean; reason?: string; runId: string } {
    if (expectedRunId !== undefined && expectedRunId !== this.runId) {
      return { ok: false, reason: 'Simulator session changed.', runId: this.runId };
    }
    if (this.state.estopLatched) {
      return { ok: false, reason: 'Reset E-STOP before loading an experiment.', runId: this.runId };
    }
    this.runId = randomUUID();
    this.rng = createRng(seed);
    this.scenario = scenario;
    this.scenarioSeed = seed;
    this.phSensorBias = 0;
    this.state = scenarioInitialState(scenario);
    this.seq = 0;
    this.estopEpoch = 0;
    this.commandRevision += 1; // invalidate old in-flight commentary
    this.txId = 0;
    this.idCounter = 0;
    this.network = { packetCount: 0, latencyMs: 15.2, errorCount: 0 };
    this.traffic = [];
    this.audit = [];
    this.alerts = [];
    this.lastAlertKeys = new Set();
    this.hasEvaluatedAlarms = false;
    this.tickCount = 0;
    this.pushAudit({ message: `LAB SCENARIO: ${scenario} (seed ${seed})`, level: 'low' });
    this.emit();
    return { ok: true, runId: this.runId };
  }

  /** Synthetic pH sensor readback; physical/chemical pH remains unchanged. */
  private observedState(): SimState {
    if (this.phSensorBias === 0) return this.state;
    return {
      ...this.state,
      ph: Math.min(14, Math.max(0, this.state.ph + this.phSensorBias)),
    };
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

  /** Restore only records belonging to this exact engine run, never older runs. */
  hydrate(audit: AuditEntry[]) {
    if (this.audit.length !== 0) return;
    this.audit = audit.filter((entry) => entry.runId === this.runId).slice(0, LOG_LIMIT);
  }

  private pushTraffic(direction: 'RX' | 'TX', frame: string) {
    this.network.packetCount += 1;
    this.traffic = [
      ...this.traffic,
      { id: this.nextId(), timestamp: this.now().toISOString(), direction, frame },
    ].slice(-LOG_LIMIT);
  }

  private pushAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    const full: AuditEntry = {
      ...entry,
      id: this.nextId(),
      timestamp: this.now().toISOString(),
      runId: this.runId,
    };
    this.audit = [full, ...this.audit].slice(0, LOG_LIMIT);
    this.persist((store) => store.saveAudit(full));
  }

  private pushAlert(alert: Alert) {
    const tagged = { ...alert, runId: this.runId };
    this.alerts = [tagged, ...this.alerts].slice(0, ALERT_LIMIT);
    this.persist((store) => store.saveAlert(tagged));
  }

  /** Each active fault has an independent edge, so simultaneous faults survive. */
  private evaluateAlerts() {
    const rules = evaluateAllRules(this.observedState());
    const current = new Set(rules.map((rule) => rule.key));
    for (const rule of rules) {
      if (this.lastAlertKeys.has(rule.key)) continue;
      this.pushAlert({
        id: this.nextId(),
        timestamp: this.now().toISOString(),
        source: 'rule',
        message: rule.message,
        urgency: rule.urgency,
      });
      if (rule.urgency !== 'low') {
        this.pushAudit({ message: rule.message, level: rule.urgency });
      }
    }
    if (current.size === 0 && (this.lastAlertKeys.size > 0 || !this.hasEvaluatedAlarms)) {
      this.pushAlert({
        id: this.nextId(),
        timestamp: this.now().toISOString(),
        source: 'rule',
        message: NOMINAL_MESSAGE,
        urgency: 'low',
      });
    }
    this.lastAlertKeys = current;
    this.hasEvaluatedAlarms = true;
  }

  /** Runs one polling cycle: master read request, slave response, physics step. */
  tick(): Snapshot {
    this.state = step(this.state, this.rng);
    // The synthetic heater cannot run with insufficient liquid inventory.
    if (this.state.isHeaterOn && this.state.level <= MIN_HEATER_LEVEL_PERCENT) {
      this.state = { ...this.state, isHeaterOn: false };
      this.commandRevision += 1; // invalidate any pending AI explanation
      this.pushAudit({
        message: 'LOW LEVEL: simulated heater automatically disabled.',
        level: 'high',
      });
    }
    if (this.scenario === 'sensor_drift') {
      this.phSensorBias = Math.min(1.5, this.phSensorBias + 0.04);
    }
    const observed = this.observedState();
    const txId = ++this.txId;
    this.pushTraffic('TX', readRequestFrame(txId));
    this.network.latencyMs = 12 + this.rng() * 6;
    if (this.scenario === 'comms_timeout' && (this.tickCount + 1) % 4 === 0) {
      this.network.errorCount += 1;
      if (this.network.errorCount === 1) {
        this.pushAudit({
          message: 'SIMULATED MODBUS TIMEOUT: polling response omitted.',
          level: 'medium',
        });
      }
    } else {
      this.pushTraffic('RX', readResponseFrame(txId, observed));
    }
    this.evaluateAlerts();
    const ts = this.now().toISOString();
    this.commentator?.record(observed, ts);
    if (++this.tickCount % TELEMETRY_EVERY === 0) {
      const sample = toSample(observed, ts, this.runId);
      this.persist((store) => store.saveTelemetry(sample));
    }
    void this.runCommentary();
    return this.emit();
  }

  /** AI advice is optional, never delays interlocks, and cannot outlive its trigger. */
  private async runCommentary() {
    const commentator = this.commentator;
    if (!commentator || commentator.busy || this.state.estopLatched) return;

    const observedRevision = this.commandRevision;
    const observedRunId = this.runId;
    const observedEstopEpoch = this.estopEpoch;
    const observedTrigger = triggerKey(this.observedState());
    const pending = commentator.maybeComment(this.observedState());
    // maybeComment sets busy synchronously only if it actually started an AI call.
    // Suppressed/nominal ticks must not emit a second phantom SSE snapshot.
    if (!commentator.busy) return;

    this.emit(); // Tell operators that an optional analysis is in progress.
    const result = await pending;
    if (
      result &&
      this.runId === observedRunId &&
      !this.state.estopLatched &&
      this.commandRevision === observedRevision &&
      this.estopEpoch === observedEstopEpoch &&
      triggerKey(this.observedState()) === observedTrigger
    ) {
      this.pushAlert({
        id: this.nextId(),
        timestamp: this.now().toISOString(),
        source: 'ai',
        message: result.message,
        urgency: result.urgency,
      });
    }
    // Do not inject an old run's completion into the next experiment.
    if (this.runId === observedRunId) this.emit();
  }

  command(cmd: Command): CommandResult {
    // Every ordinary operator control can carry a simulator run guard. Browser
    // commands include it to prevent stale requests from a prior engine run.
    // E-STOP intentionally bypasses all optimistic preconditions.
    if (
      cmd.type !== 'estop' &&
      cmd.expectedRunId !== undefined &&
      cmd.expectedRunId !== this.runId
    ) {
      return {
        ok: false,
        reason: 'Simulator session changed. Refresh telemetry before issuing commands.',
        state: this.state,
        wrote: false,
      };
    }

    // A reset authorized against an earlier E-STOP event must not clear a
    // newer latch, even when both events occurred within the same engine run.
    if (
      cmd.type === 'reset_estop' &&
      cmd.expectedEstopEpoch !== undefined &&
      cmd.expectedEstopEpoch !== this.estopEpoch
    ) {
      return {
        ok: false,
        reason: 'A newer E-STOP occurred. Review the current latch before resetting.',
        state: this.state,
        wrote: false,
      };
    }

    // Compare the observed switch state before performing any simulated write.
    // Distinct process controls only conflict if their respective state changed.
    let observed: boolean | undefined;
    let expected: boolean | undefined;
    switch (cmd.type) {
      case 'start':
      case 'stop':
        observed = this.state.isRunning;
        expected = cmd.expectedRunning;
        break;
      case 'set_heater':
        observed = this.state.isHeaterOn;
        expected = cmd.expectedValue;
        break;
      case 'set_valve':
        observed = this.state.valveOpen;
        expected = cmd.expectedValue;
        break;
      case 'set_mode':
        observed = this.state.isManualMode;
        expected = cmd.expectedValue;
        break;
    }
    if (expected !== undefined && expected !== observed) {
      return {
        ok: false,
        reason: 'Control changed in another operator session. Review the current state.',
        state: this.state,
        wrote: false,
      };
    }

    // Compare-and-set the *authoritative* setpoint; unrelated telemetry ticks do not
    // invalidate a request. A stale operator must not silently overwrite another
    // operator's more recent adjustment or a restarted simulation session.
    if (cmd.type === 'set_rpm_setpoint' || cmd.type === 'set_temp_setpoint') {
      const applied =
        cmd.type === 'set_rpm_setpoint' ? this.state.targetRpmManual : this.state.targetTempManual;
      if (cmd.expectedValue !== undefined && cmd.expectedValue !== applied) {
        return {
          ok: false,
          reason: 'Setpoint changed in another operator session. Review current value and retry.',
          state: this.state,
          wrote: false,
        };
      }
    }

    const result = applyCommand(this.state, cmd);
    if (!result.ok) return result;
    // E-STOP always wins. Count even repeated requests against an existing
    // latch so a delayed RESET from the preceding event cannot clear it.
    if (cmd.type === 'estop') this.estopEpoch += 1;
    if (result.wrote) this.commandRevision += 1;
    this.state = result.state;
    if (result.wrote) {
      // Write the effective setpoint, not an out-of-range operator request, to the simulated wire.
      const appliedCommand: Command =
        cmd.type === 'set_rpm_setpoint'
          ? { type: 'set_rpm_setpoint', value: this.state.targetRpmManual }
          : cmd.type === 'set_temp_setpoint'
            ? { type: 'set_temp_setpoint', value: this.state.targetTempManual }
            : cmd;
      this.pushTraffic('TX', commandFrame(++this.txId, appliedCommand));
    }
    if (result.audit) this.pushAudit(result.audit);
    this.emit();
    return result;
  }

  getSnapshot(): Snapshot {
    return {
      runId: this.runId,
      scenario: this.scenario,
      scenarioSeed: this.scenarioSeed,
      sensorDiagnostics:
        this.scenario === 'sensor_drift'
          ? { phReference: this.state.ph, phBias: this.phSensorBias }
          : undefined,
      estopEpoch: this.estopEpoch,
      seq: this.seq,
      timestamp: this.now().toISOString(),
      state: this.observedState(),
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
      .recentAudit(LOG_LIMIT, engine.getSnapshot().runId)
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

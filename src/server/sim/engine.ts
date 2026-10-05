import { applyCommand } from './interlocks';
import { commandFrame, readRequestFrame, readResponseFrame } from './modbus';
import { createRng, type Rng } from './rng';
import type {
  AuditEntry,
  Command,
  CommandResult,
  NetworkCounters,
  SimState,
  Snapshot,
  TrafficEntry,
} from './types';

export const TICK_MS = 1000;
const LOG_LIMIT = 50;

export function initialState(): SimState {
  return {
    isRunning: false,
    isManualMode: false,
    isHeaterOn: false,
    valveOpen: false,
    rpm: 0,
    temp: 24.5,
    ph: 7.0,
    level: 65,
    targetRpmManual: 500,
    targetTempManual: 60,
  };
}

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
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: EngineOptions = {}) {
    this.rng = options.rng ?? createRng(options.seed ?? Date.now());
    this.now = options.now ?? (() => new Date());
  }

  private nextId(): string {
    return `e${++this.idCounter}`;
  }

  private pushTraffic(direction: 'RX' | 'TX', frame: string) {
    this.network.packetCount += 1;
    this.traffic = [
      ...this.traffic,
      { id: this.nextId(), timestamp: this.now().toISOString(), direction, frame },
    ].slice(-LOG_LIMIT);
  }

  /** Runs one polling cycle: master read request, slave response, physics step. */
  tick(): Snapshot {
    this.state = step(this.state, this.rng);
    const txId = ++this.txId;
    this.pushTraffic('TX', readRequestFrame(txId));
    this.network.latencyMs = 12 + this.rng() * 6;
    this.pushTraffic('RX', readResponseFrame(txId, this.state));
    return this.emit();
  }

  command(cmd: Command): CommandResult {
    const result = applyCommand(this.state, cmd);
    if (!result.ok) return result;
    this.state = result.state;
    if (result.wrote) this.pushTraffic('TX', commandFrame(++this.txId, cmd));
    if (result.audit) {
      this.audit = [
        { id: this.nextId(), timestamp: this.now().toISOString(), ...result.audit },
        ...this.audit,
      ].slice(0, LOG_LIMIT);
    }
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
  return (globalForEngine.__chemviewEngine ??= new Engine());
}

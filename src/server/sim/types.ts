export type Level = 'low' | 'medium' | 'high';

export interface SimState {
  isRunning: boolean;
  /** Stays locked after E-STOP until an explicit reset command. */
  estopLatched: boolean;
  isManualMode: boolean;
  isHeaterOn: boolean;
  valveOpen: boolean;
  rpm: number;
  temp: number;
  ph: number;
  /** Tank fill level in percent (0-100). */
  level: number;
  targetRpmManual: number;
  targetTempManual: number;
}

export type Command =
  | { type: 'start'; expectedRunning?: boolean; expectedRunId?: string }
  | { type: 'stop'; expectedRunning?: boolean; expectedRunId?: string }
  | { type: 'estop' }
  | {
      type: 'reset_estop';
      expectedRunId?: string;
      /** Reject resets prepared before a newer E-STOP event. */
      expectedEstopEpoch?: number;
    }
  | { type: 'set_heater'; on: boolean; expectedValue?: boolean; expectedRunId?: string }
  | { type: 'set_valve'; open: boolean; expectedValue?: boolean; expectedRunId?: string }
  | { type: 'set_mode'; manual: boolean; expectedValue?: boolean; expectedRunId?: string }
  | {
      type: 'set_rpm_setpoint';
      value: number;
      /** Optional compare-and-set readback to prevent lost operator updates. */
      expectedValue?: number;
      expectedRunId?: string;
    }
  | {
      type: 'set_temp_setpoint';
      value: number;
      expectedValue?: number;
      expectedRunId?: string;
    };

export interface AuditEntry {
  id: string;
  /** Optional only for pre-migration audit records. */
  runId?: string;
  timestamp: string;
  message: string;
  level: Level;
}

export interface CommandResult {
  ok: boolean;
  /** Operator-facing reason when a command is denied by an interlock. */
  reason?: string;
  state: SimState;
  audit?: Omit<AuditEntry, 'id' | 'timestamp'>;
  /** Frame kind generated on the (simulated) wire for this command. */
  wrote: boolean;
}

export interface TrafficEntry {
  id: string;
  timestamp: string;
  direction: 'RX' | 'TX';
  frame: string;
}

export interface NetworkCounters {
  packetCount: number;
  latencyMs: number;
  errorCount: number;
}

export interface Alert {
  id: string;
  /** Optional for alerts recorded before run-scoped history was introduced. */
  runId?: string;
  timestamp: string;
  /** `rule` = deterministic safety alarm, `ai` = Genkit-generated commentary. */
  source: 'rule' | 'ai';
  message: string;
  urgency: Level;
}

/** One telemetry message pushed to clients every tick. */
export interface Snapshot {
  /** Stable identity of this engine instance; changes on simulator restart. */
  runId: string;
  /** Increments on each E-STOP, including while already latched. */
  estopEpoch: number;
  seq: number;
  timestamp: string;
  state: SimState;
  network: NetworkCounters;
  traffic: TrafficEntry[];
  audit: AuditEntry[];
  alerts: Alert[];
  /** True while an LLM commentary request is in flight. */
  aiBusy: boolean;
}

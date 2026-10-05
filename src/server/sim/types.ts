export type Level = 'low' | 'medium' | 'high';

export interface SimState {
  isRunning: boolean;
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
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'estop' }
  | { type: 'set_heater'; on: boolean }
  | { type: 'set_valve'; open: boolean }
  | { type: 'set_mode'; manual: boolean }
  | { type: 'set_rpm_setpoint'; value: number }
  | { type: 'set_temp_setpoint'; value: number };

export interface AuditEntry {
  id: string;
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
  timestamp: string;
  /** `rule` = deterministic safety alarm, `ai` = Genkit-generated commentary. */
  source: 'rule' | 'ai';
  message: string;
  urgency: Level;
}

/** One telemetry message pushed to clients every tick. */
export interface Snapshot {
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

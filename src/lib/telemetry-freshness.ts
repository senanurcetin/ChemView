/** The simulator normally emits at least one validated snapshot each second. */
export const TELEMETRY_STALE_MS = 6_000;

export type TransportState = 'Connecting' | 'Connected' | 'Disconnected';
export type TelemetryStatus = TransportState | 'Stale';

/**
 * Age is measured from receipt of the last valid, advancing snapshot, not from
 * the server clock (which could be offset from the browser's clock).
 */
export function telemetryAgeSeconds(receivedAtMs: number | null, nowMs: number): number | null {
  if (receivedAtMs === null || nowMs <= 0) return null;
  return Math.max(0, Math.floor((nowMs - receivedAtMs) / 1000));
}

/**
 * EventSource can stay OPEN even when application data stops flowing. Only a
 * fresh validated message earns the Connected HMI indicator.
 */
export function telemetryStatus(
  transport: TransportState,
  receivedAtMs: number | null,
  nowMs: number,
  staleAfterMs = TELEMETRY_STALE_MS,
): TelemetryStatus {
  if (transport !== 'Connected') return transport;
  if (receivedAtMs === null || nowMs <= 0) return 'Connecting';
  return nowMs - receivedAtMs >= staleAfterMs ? 'Stale' : 'Connected';
}

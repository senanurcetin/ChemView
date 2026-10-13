export interface HistoryPoint {
  /** Display label (mm:ss). */
  time: string;
  value: number;
  /** ISO timestamp, used to order and de-duplicate points. */
  ts: string;
}

export const HISTORY_LIMIT = 60;
/** How far back the first page load asks the server for persisted samples. */
export const PRELOAD_WINDOW_MS = 60_000;

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

export const toPoint = (ts: string, value: number): HistoryPoint => ({
  time: clock(ts),
  value,
  ts,
});

/**
 * Merges new points into a trend: ordered by timestamp, one point per timestamp
 * (a later point wins), capped to the most recent `limit`.
 */
export function mergeHistory(
  prev: HistoryPoint[],
  incoming: HistoryPoint[],
  limit = HISTORY_LIMIT,
): HistoryPoint[] {
  const byTs = new Map<string, HistoryPoint>();
  for (const point of prev) byTs.set(point.ts, point);
  for (const point of incoming) byTs.set(point.ts, point);
  return [...byTs.values()].sort((a, b) => a.ts.localeCompare(b.ts)).slice(-limit);
}

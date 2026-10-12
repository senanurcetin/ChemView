/** Fixed-window in-memory rate limiter (single instance; see apphosting.yaml maxInstances).
 *
 * The tracked client map must remain bounded even when attackers rotate their
 * identity faster than any windows expire. A full map rejects NEW clients
 * rather than sacrificing the counters of currently rate-limited clients.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 1000,
  ) {
    if (!Number.isSafeInteger(limit) || limit <= 0
      || !Number.isFinite(windowMs) || windowMs <= 0
      || !Number.isSafeInteger(maxKeys) || maxKeys <= 0) {
      throw new RangeError('Rate limiter limits and windows must be positive finite values');
    }
  }

  /** Returns 0 if allowed, otherwise the milliseconds until the window resets. */
  check(key: string): number {
    const t = this.now();
    const entry = this.hits.get(key);
    if (entry && t < entry.resetAt) {
      if (entry.count >= this.limit) return entry.resetAt - t;
      entry.count += 1;
      return 0;
    }

    // Expired keys can re-enter immediately, even with a completely full map.
    if (entry) this.hits.delete(key);
    if (this.hits.size >= this.maxKeys) this.prune(t);

    // Do not evict LIVE clients to make room; that would reset their quota.
    // Returning a nonzero delay also guarantees callers never treat it as allowed.
    if (this.hits.size >= this.maxKeys) return this.windowMs;

    this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
    return 0;
  }

  private prune(t: number) {
    for (const [key, entry] of this.hits) {
      if (t >= entry.resetAt) this.hits.delete(key);
    }
  }
}

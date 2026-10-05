/** Fixed-window in-memory rate limiter (single instance; see apphosting.yaml maxInstances). */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns 0 if allowed, otherwise the milliseconds until the window resets. */
  check(key: string): number {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      if (this.hits.size > 1000) this.prune(t);
      return 0;
    }
    if (entry.count >= this.limit) return entry.resetAt - t;
    entry.count += 1;
    return 0;
  }

  private prune(t: number) {
    for (const [key, entry] of this.hits) if (t >= entry.resetAt) this.hits.delete(key);
  }
}

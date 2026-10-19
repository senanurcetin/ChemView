import { describe, expect, it, vi } from 'vitest';
import { telemetryToCsv } from './csv';
import { Engine, TELEMETRY_EVERY } from './sim/engine';
import { parseHistoryQuery } from './history-query';
import { RateLimiter } from './rate-limit';
import { createStore, MemoryStore, toSample, type Store } from './store';
import { initialState } from './sim/state';

const sample = (ts: string) => toSample(initialState(), ts);

describe('MemoryStore', () => {
  it('returns samples in range, oldest first, honoring limit', async () => {
    const store = new MemoryStore();
    for (const ts of [
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:05.000Z',
      '2026-01-01T00:00:10.000Z',
    ]) {
      await store.saveTelemetry(sample(ts));
    }
    const all = await store.history({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-01T00:00:10.000Z',
    });
    expect(all.map((s) => s.ts.slice(17, 19))).toEqual(['00', '05', '10']);
    const some = await store.history({
      from: '2026-01-01T00:00:05.000Z',
      to: '2026-01-01T00:00:10.000Z',
      limit: 1,
    });
    expect(some).toHaveLength(1);
  });

  it('keeps audit newest first and bounded', async () => {
    const store = new MemoryStore(10, 2);
    for (const id of ['a', 'b', 'c']) {
      await store.saveAudit({ id, timestamp: id, message: id, level: 'low' });
    }
    expect((await store.recentAudit(10)).map((e) => e.id)).toEqual(['c', 'b']);
  });
});

describe('alert history', () => {
  it('keeps a bounded run-scoped memory log independently of live snapshots', async () => {
    const store = new MemoryStore(10, 10, 3);
    const runA = 'run-A';
    const runB = 'run-B';
    for (const [id, runId] of [
      ['a1', runA],
      ['b1', runB],
      ['a2', runA],
      ['a3', runA],
      ['a4', runA],
    ]) {
      await store.saveAlert({
        id,
        runId,
        timestamp: '2026-01-01T00:00:00.000Z',
        source: 'rule',
        urgency: 'low',
        message: id,
      });
    }
    expect((await store.recentAlerts(10, runA)).map((a) => a.id)).toEqual(['a4', 'a3', 'a2']);
    expect((await store.recentAlerts(10, runB)).map((a) => a.id)).toEqual([]);
  });
});

describe('createStore', () => {
  it('uses memory when Firebase credentials are missing', async () => {
    expect((await createStore({})).kind).toBe('memory');
    expect((await createStore({ FIREBASE_PROJECT_ID: 'p' })).kind).toBe('memory');
  });
});

describe('Engine persistence', () => {
  it('samples telemetry every N ticks and persists audit entries', async () => {
    const store = new MemoryStore();
    const engine = new Engine({ seed: 1, store });
    engine.command({ type: 'start' });
    for (let i = 0; i < TELEMETRY_EVERY * 2; i++) engine.tick();
    await vi.waitFor(async () => {
      const samples = await store.history({
        from: '0000',
        to: '9999',
        runId: engine.getSnapshot().runId,
      });
      expect(samples).toHaveLength(2);
      const activeRunId = engine.getSnapshot().runId;
      expect(samples.every((sample) => sample.runId === activeRunId)).toBe(true);
    });
    const runId = engine.getSnapshot().runId;
    expect((await store.recentAudit(5, runId)).map((entry) => entry.message)).toContain(
      'INFO: Mixer STARTED by Operator',
    );
    expect(await store.recentAudit(5)).toEqual([]);
  });

  it('a failing store never breaks the tick', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: Store = {
      kind: 'broken',
      saveTelemetry: () => Promise.reject(new Error('down')),
      saveAlert: () => Promise.reject(new Error('down')),
      recentAlerts: () => Promise.reject(new Error('down')),
      saveAudit: () => Promise.reject(new Error('down')),
      history: () => Promise.reject(new Error('down')),
      recentAudit: () => Promise.reject(new Error('down')),
    };
    const engine = new Engine({ seed: 1, store: broken });
    engine.command({ type: 'start' });
    expect(() => {
      for (let i = 0; i < TELEMETRY_EVERY; i++) engine.tick();
    }).not.toThrow();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
  });

  it('persists generated rule alerts with the current engine run ID', async () => {
    const store = new MemoryStore();
    const e = new Engine({ seed: 1, store });
    e.tick();
    const { runId, alerts } = e.getSnapshot();
    expect(await store.recentAlerts(10, runId)).toEqual(alerts);
    expect(await store.recentAlerts(10, 'another-run')).toEqual([]);
  });

  it('never hydrates audit records from an earlier simulator session', () => {
    const engine = new Engine({ seed: 1 });
    const runId = engine.getSnapshot().runId;
    const entry = {
      id: 'x',
      timestamp: '2026-01-01T00:00:00.000Z',
      message: 'local',
      level: 'low' as const,
      runId,
    };
    engine.hydrate([
      { ...entry, runId: 'previous-session' },
      { ...entry, runId: undefined },
      entry,
    ]);
    expect(engine.getSnapshot().audit).toEqual([entry]);
    engine.hydrate([{ ...entry, id: 'another' }]);
    expect(engine.getSnapshot().audit).toHaveLength(1);
  });
});

describe('history query + csv', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  it('defaults to the last hour', () => {
    const q = parseHistoryQuery(new URLSearchParams(), now);
    expect(q).toMatchObject({
      ok: true,
      to: '2026-01-01T12:00:00.000Z',
      from: '2026-01-01T11:00:00.000Z',
      limit: 1000,
    });
  });
  it('rejects bad input', () => {
    expect(parseHistoryQuery(new URLSearchParams('from=nope'), now).ok).toBe(false);
    expect(parseHistoryQuery(new URLSearchParams('limit=99999'), now).ok).toBe(false);
    expect(parseHistoryQuery(new URLSearchParams('runId=invalid'), now).ok).toBe(false);
    const validRunId = '123e4567-e89b-42d3-a456-426614174000';
    const scopedQuery = new URLSearchParams({ runId: validRunId });
    expect(parseHistoryQuery(scopedQuery, now)).toMatchObject({ ok: true, runId: validRunId });
    expect(parseHistoryQuery(new URLSearchParams('from=2026-02-01&to=2026-01-01'), now).ok).toBe(
      false,
    );
  });
  it('renders a header and one row per sample', () => {
    const csv = telemetryToCsv([sample('2026-01-01T00:00:00.000Z')]);
    expect(csv.split('\n')[0]).toBe(
      'timestamp,run_id,rpm,temperature_c,ph,level_pct,mixer_running,heater_on,valve_open',
    );
    expect(csv.split('\n')[1]).toBe('2026-01-01T00:00:00.000Z,,0.00,24.50,7.000,65,0,0,0');
    const tagged = telemetryToCsv([
      sample('2026-01-01T00:00:00.000Z'),
      toSample(initialState(), '2026-01-01T00:00:05.000Z', 'run-demo'),
    ]);
    expect(tagged.split('\n')[2]).toContain('2026-01-01T00:00:05.000Z,run-demo,');
  });
});

describe('RateLimiter', () => {
  it('blocks after the limit and recovers after the window', () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect(rl.check('a')).toBe(0);
    expect(rl.check('a')).toBe(0);
    expect(rl.check('a')).toBeGreaterThan(0);
    expect(rl.check('b')).toBe(0);
    t = 1001;
    expect(rl.check('a')).toBe(0);
  });
  it('caps live keys under high-cardinality client churn without resetting existing quotas', () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t, 2);
    expect(rl.check('a')).toBe(0);
    expect(rl.check('b')).toBe(0);
    // Additional distinct clients cannot grow the live-key table.
    for (let i = 0; i < 100; i++) {
      expect(rl.check(`spoof-${i}`)).toBe(1000);
    }
    // Existing clients have their own remaining calls and cannot reset by churn.
    expect(rl.check('a')).toBe(0);
    expect(rl.check('a')).toBe(1000);
    expect(rl.check('b')).toBe(0);
    expect(rl.check('b')).toBe(1000);

    t = 1000;
    expect(rl.check('fresh')).toBe(0); // all old entries expired, room freed
    expect(rl.check('a')).toBe(0);
  });

  it('allows renewal of a tracked expired key even when capacity was full', () => {
    let t = 0;
    const rl = new RateLimiter(1, 1000, () => t, 1);
    expect(rl.check('a')).toBe(0);
    expect(rl.check('new')).toBe(1000);
    t = 1000;
    expect(rl.check('a')).toBe(0);
    expect(rl.check('new')).toBe(1000);
  });

  it('rejects invalid limiter configuration before accepting requests', () => {
    expect(() => new RateLimiter(0, 1000)).toThrow(RangeError);
    expect(() => new RateLimiter(1, 0)).toThrow(RangeError);
    expect(() => new RateLimiter(1, 1000, Date.now, 0)).toThrow(RangeError);
  });
});

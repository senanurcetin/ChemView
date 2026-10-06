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
      const samples = await store.history({ from: '0000', to: '9999' });
      expect(samples).toHaveLength(2);
    });
    expect((await store.recentAudit(5)).map((e) => e.message)).toContain(
      'INFO: Mixer STARTED by Operator',
    );
  });

  it('a failing store never breaks the tick', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: Store = {
      kind: 'broken',
      saveTelemetry: () => Promise.reject(new Error('down')),
      saveAlert: () => Promise.reject(new Error('down')),
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

  it('hydrates the audit trail only when empty', () => {
    const e = new Engine({ seed: 1 });
    const entry = { id: 'x', timestamp: 't', message: 'old', level: 'low' as const };
    e.hydrate([entry]);
    expect(e.getSnapshot().audit).toEqual([entry]);
    e.hydrate([{ ...entry, id: 'y' }]);
    expect(e.getSnapshot().audit).toHaveLength(1);
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
    expect(parseHistoryQuery(new URLSearchParams('from=2026-02-01&to=2026-01-01'), now).ok).toBe(
      false,
    );
  });
  it('renders a header and one row per sample', () => {
    const csv = telemetryToCsv([sample('2026-01-01T00:00:00.000Z')]);
    expect(csv.split('\n')[0]).toBe(
      'timestamp,rpm,temperature_c,ph,level_pct,mixer_running,heater_on,valve_open',
    );
    expect(csv.split('\n')[1]).toBe('2026-01-01T00:00:00.000Z,0.00,24.50,7.000,65,0,0,0');
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
});

import { beforeAll, describe, expect, it } from 'vitest';
import type { Alert, AuditEntry } from './sim/types';
import { MemoryStore, toSample, type Store } from './store';
import { initialState } from './sim/state';

/**
 * Behavior every Store implementation must share. The memory store always runs;
 * the Firestore store runs only against the emulator (FIRESTORE_EMULATOR_HOST),
 * see `npm run test:firestore`.
 */
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

const factories: { name: string; skip: boolean; create: () => Promise<Store> }[] = [
  { name: 'MemoryStore', skip: false, create: async () => new MemoryStore() },
  {
    name: 'FirestoreStore (emulator)',
    skip: !emulator,
    create: async () => {
      const { FirestoreStore } = await import('./firestore-store');
      return new FirestoreStore({ projectId: 'chemview-test' });
    },
  },
];

// Each run uses its own year so repeated runs against a long-lived emulator do not collide.
const base = Date.UTC(2100 + (Date.now() % 800), 0, 1);
const iso = (offsetSec: number) => new Date(base + offsetSec * 1000).toISOString();
const entry = (id: string, offsetSec: number): AuditEntry => ({
  id,
  timestamp: iso(offsetSec),
  message: id,
  level: 'low',
});

describe.each(factories)('Store contract: $name', ({ skip, create }) => {
  let store: Store;
  beforeAll(async () => {
    if (!skip) store = await create();
  });

  it.skipIf(skip)('returns samples in range, oldest first, inclusive of both ends', async () => {
    for (const t of [20, 0, 10, 5, 15]) await store.saveTelemetry(toSample(initialState(), iso(t)));
    const got = await store.history({ from: iso(5), to: iso(15) });
    expect(got.map((s) => s.ts)).toEqual([iso(5), iso(10), iso(15)]);
  });

  it.skipIf(skip)('limit keeps the oldest samples in range', async () => {
    const got = await store.history({ from: iso(0), to: iso(20), limit: 2 });
    expect(got.map((s) => s.ts)).toEqual([iso(0), iso(5)]);
  });

  it.skipIf(skip)('isolates sessions before applying the history limit', async () => {
    const runA = `contract-${Date.now()}-a`;
    const runB = `contract-${Date.now()}-b`;
    for (const [offset, runId] of [
      [40, runB],
      [40, runA],
      [45, runB],
      [50, runA],
    ] as const) {
      await store.saveTelemetry(toSample(initialState(), iso(offset), runId));
    }

    const samplesA = await store.history({ from: iso(40), to: iso(50), runId: runA, limit: 1 });
    const samplesB = await store.history({ from: iso(40), to: iso(50), runId: runB });
    expect(samplesA.map((sample) => [sample.ts, sample.runId])).toEqual([[iso(40), runA]]);
    expect(samplesB.map((sample) => [sample.ts, sample.runId])).toEqual([
      [iso(40), runB],
      [iso(45), runB],
    ]);
    expect(await store.history({ from: iso(40), to: iso(50) })).toEqual([]);
  });

  it.skipIf(skip)('returns nothing for an empty range', async () => {
    expect(await store.history({ from: iso(100), to: iso(200) })).toEqual([]);
  });

  it.skipIf(skip)('round-trips sample fields', async () => {
    const sample = toSample(
      { ...initialState(), rpm: 480.126, temp: 61.5, valveOpen: true },
      iso(30),
    );
    await store.saveTelemetry(sample);
    const [got] = await store.history({ from: iso(30), to: iso(30) });
    expect(got).toEqual(sample);
  });

  it.skipIf(skip)('returns bounded alert history isolated by simulator run', async () => {
    const runA = `alert-contract-${Date.now()}-a`;
    const runB = `alert-contract-${Date.now()}-b`;
    const alerts: Alert[] = [
      {
        id: `${runA}-1`,
        runId: runA,
        timestamp: iso(500),
        source: 'rule',
        message: 'A1',
        urgency: 'high',
      },
      {
        id: `${runB}-1`,
        runId: runB,
        timestamp: iso(501),
        source: 'ai',
        message: 'B1',
        urgency: 'medium',
      },
      {
        id: `${runA}-2`,
        runId: runA,
        timestamp: iso(502),
        source: 'rule',
        message: 'A2',
        urgency: 'low',
      },
    ];
    for (const alert of alerts) await store.saveAlert(alert);
    const recentA = await store.recentAlerts(1, runA);
    expect(recentA).toEqual([alerts[2]]);
    const recentB = await store.recentAlerts(10, runB);
    expect(recentB).toEqual([alerts[1]]);
  });

  it.skipIf(skip)('keeps audit history separate for each simulator run', async () => {
    const runA = `audit-contract-${Date.now()}-a`;
    const runB = `audit-contract-${Date.now()}-b`;
    const first = { ...entry(`${runA}-first`, 610), runId: runA };
    const second = { ...entry(`${runB}-second`, 611), runId: runB };
    const third = { ...entry(`${runA}-third`, 612), runId: runA };
    for (const record of [first, second, third]) await store.saveAudit(record);
    expect(await store.recentAudit(1, runA)).toEqual([third]);
    expect(await store.recentAudit(10, runB)).toEqual([second]);
  });

  it.skipIf(skip)('recentAudit returns newest first and honors the limit', async () => {
    await store.saveAudit(entry('a', 100));
    await store.saveAudit(entry('c', 300));
    await store.saveAudit(entry('b', 200));
    const got = await store.recentAudit(2);
    expect(got.map((e) => e.id)).toEqual(expect.arrayContaining(['c']));
    expect(got).toHaveLength(2);
    expect(got[0].timestamp >= got[1].timestamp).toBe(true);
  });
});

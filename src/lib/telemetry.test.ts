import { describe, expect, it } from 'vitest';
import { Engine } from '@/server/sim/engine';
import { initialState } from '@/server/sim/state';
import { toSample } from '@/server/store';
import { classifySnapshot, parseHistorySamples, parseSnapshotEvent } from './telemetry';

const sampleSnapshot = () =>
  new Engine({ seed: 7, now: () => new Date('2026-10-18T12:00:00Z') }).getSnapshot();

describe('parseSnapshotEvent', () => {
  it('accepts a real server engine snapshot', () => {
    const snapshot = sampleSnapshot();
    expect(parseSnapshotEvent(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('rejects malformed JSON without throwing', () => {
    expect(parseSnapshotEvent('{')).toBeNull();
    expect(parseSnapshotEvent('null')).toBeNull();
  });

  it('rejects missing run identity and invalid nested telemetry', () => {
    const snapshot = sampleSnapshot();
    expect(parseSnapshotEvent(JSON.stringify({ ...snapshot, runId: '' }))).toBeNull();
    expect(parseSnapshotEvent(JSON.stringify({ ...snapshot, seq: -1 }))).toBeNull();
    expect(
      parseSnapshotEvent(
        JSON.stringify({ ...snapshot, state: { ...snapshot.state, rpm: 'fast' } }),
      ),
    ).toBeNull();
    expect(
      parseSnapshotEvent(JSON.stringify({ ...snapshot, network: { packetCount: 'zero' } })),
    ).toBeNull();
    expect(
      parseSnapshotEvent(JSON.stringify({ ...snapshot, traffic: [{ frame: 123 }] })),
    ).toBeNull();
  });
});

describe('classifySnapshot', () => {
  const previous = { runId: 'engine-A', seq: 20 };

  it('initializes on first valid payload and advances within the same run', () => {
    expect(classifySnapshot(null, previous)).toBe('initial');
    expect(classifySnapshot(previous, { runId: 'engine-A', seq: 21 })).toBe('advance');
  });

  it('ignores duplicate and out-of-order packets from the same run', () => {
    expect(classifySnapshot(previous, { runId: 'engine-A', seq: 20 })).toBe('ignore');
    expect(classifySnapshot(previous, { runId: 'engine-A', seq: 19 })).toBe('ignore');
  });

  it('recognizes an engine restart even if its new sequence is larger', () => {
    expect(classifySnapshot(previous, { runId: 'engine-B', seq: 0 })).toBe('new-run');
    expect(classifySnapshot(previous, { runId: 'engine-B', seq: 500 })).toBe('new-run');
  });
});

describe('parseHistorySamples', () => {
  it('accepts persisted samples for the trend preload', () => {
    const sample = toSample(initialState(), '2026-10-18T12:00:00Z');
    expect(parseHistorySamples({ samples: [sample], count: 1 })).toEqual([sample]);
  });

  it('rejects incomplete and non-numeric historical samples', () => {
    const sample = toSample(initialState(), '2026-10-18T12:00:00Z');
    expect(parseHistorySamples(null)).toBeNull();
    expect(parseHistorySamples({ samples: {} })).toBeNull();
    expect(parseHistorySamples({ samples: [{ ...sample, temp: 'unknown' }] })).toBeNull();
    expect(parseHistorySamples({ samples: [{ ...sample, ts: 'not a date' }] })).toBeNull();
  });
});

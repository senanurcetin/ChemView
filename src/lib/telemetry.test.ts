import { describe, expect, it } from 'vitest';
import { Engine } from '@/server/sim/engine';
import { initialState } from '@/server/sim/state';
import { toSample } from '@/server/store';
import {
  classifySnapshot,
  mergeAlertHistory,
  parseAlertHistory,
  parseHistorySamples,
  parseSnapshotEvent,
} from './telemetry';

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
    expect(parseSnapshotEvent(JSON.stringify({ ...snapshot, estopEpoch: -1 }))).toBeNull();
    expect(parseSnapshotEvent(JSON.stringify({ ...snapshot, estopEpoch: 0.5 }))).toBeNull();
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

// This regression protects the HMI against impossible sensor readings.
describe('telemetry physical ranges', () => {
  it('rejects out-of-range physical values but preserves valid process alarms', () => {
    const snapshot = sampleSnapshot();
    const invalidStates = [
      { rpm: -1 },
      { rpm: 2000 },
      { temp: -300 },
      { ph: 15 },
      { level: 101 },
      { targetRpmManual: -1 },
      { targetTempManual: 150 },
    ];
    for (const override of invalidStates) {
      const state = { ...snapshot.state, ...override };
      expect(parseSnapshotEvent(JSON.stringify({ ...snapshot, state }))).toBeNull();
    }
    const warning = { ...snapshot.state, temp: 85, ph: 5.5, level: 0 };
    expect(parseSnapshotEvent(JSON.stringify({ ...snapshot, state: warning }))).not.toBeNull();
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

describe('alarm history transport', () => {
  const runId = '123e4567-e89b-42d3-a456-426614174000';
  const alert = (id: string, timestamp: string, selectedRunId = runId) => ({
    id,
    runId: selectedRunId,
    timestamp,
    source: 'rule' as const,
    message: id,
    urgency: 'high' as const,
  });

  it('rejects legacy, malformed, or cross-run alarm payloads', () => {
    const first = alert('a', '2026-10-18T12:00:01Z');
    expect(parseAlertHistory({ runId, alerts: [first] }, runId)).toEqual([first]);
    expect(parseAlertHistory({ runId, alerts: [{}] }, runId)).toBeNull();
    expect(parseAlertHistory({ runId, alerts: [first] }, 'another-run')).toBeNull();
    const missingRun = { ...first, runId: undefined };
    const foreignRun = alert('b', first.timestamp, 'other');
    expect(parseAlertHistory({ runId, alerts: [missingRun] }, runId)).toBeNull();
    expect(parseAlertHistory({ runId, alerts: [foreignRun] }, runId)).toBeNull();
  });

  it('deduplicates SSE/archive overlap and keeps newest bounded events', () => {
    const early = alert('a', '2026-10-18T12:00:01Z');
    const later = alert('b', '2026-10-18T12:00:03Z');
    const recent = alert('c', '2026-10-18T12:00:05Z');
    expect(mergeAlertHistory([early, later], [later, recent], 2).map((x) => x.id)).toEqual([
      'c',
      'b',
    ]);
  });
});

describe('parseHistorySamples', () => {
  it('accepts persisted samples for the trend preload', () => {
    const runId = sampleSnapshot().runId;
    const sample = toSample(initialState(), '2026-10-18T12:00:00Z', runId);
    expect(parseHistorySamples({ runId, samples: [sample], count: 1 }, runId)).toEqual([sample]);
  });

  it('rejects incomplete and non-numeric historical samples', () => {
    const runId = sampleSnapshot().runId;
    const sample = toSample(initialState(), '2026-10-18T12:00:00Z', runId);
    expect(parseHistorySamples(null)).toBeNull();
    expect(parseHistorySamples({ runId, samples: {} })).toBeNull();
    expect(parseHistorySamples({ runId, samples: [{ ...sample, temp: 'unknown' }] })).toBeNull();
    expect(parseHistorySamples({ runId, samples: [{ ...sample, ts: 'not a date' }] })).toBeNull();
    expect(parseHistorySamples({ runId, samples: [sample] }, 'other-run')).toBeNull();
    expect(parseHistorySamples({ runId, samples: [{ ...sample, runId: 'wrong' }] })).toBeNull();
    expect(parseHistorySamples({ runId, samples: [{ ...sample, runId: undefined }] })).toBeNull();
  });
});

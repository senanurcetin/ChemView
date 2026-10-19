import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_STALE_MS,
  telemetryAgeSeconds,
  telemetryStatus,
} from './telemetry-freshness';

describe('telemetryAgeSeconds', () => {
  it('returns null until a valid sample has been accepted', () => {
    expect(telemetryAgeSeconds(null, 10000)).toBeNull();
    expect(telemetryAgeSeconds(1000, 0)).toBeNull();
  });

  it('counts local receive age without negative seconds', () => {
    expect(telemetryAgeSeconds(1000, 1999)).toBe(0);
    expect(telemetryAgeSeconds(1000, 2001)).toBe(1);
    expect(telemetryAgeSeconds(2000, 1000)).toBe(0);
  });
});

describe('telemetryStatus', () => {
  it('does not mistake an open connection without snapshots for live telemetry', () => {
    expect(telemetryStatus('Connected', null, 10000)).toBe('Connecting');
    expect(telemetryStatus('Connected', 10000, 0)).toBe('Connecting');
  });

  it('marks a stalled connection stale at the six-second boundary', () => {
    const lastAcceptedAt = 1000;
    const boundary = lastAcceptedAt + TELEMETRY_STALE_MS;
    expect(telemetryStatus('Connected', lastAcceptedAt, boundary - 1)).toBe('Connected');
    expect(telemetryStatus('Connected', lastAcceptedAt, boundary)).toBe('Stale');
    expect(telemetryStatus('Connected', lastAcceptedAt, boundary + 60000)).toBe('Stale');
  });

  it('recovers after the next accepted snapshot and preserves transport errors', () => {
    expect(telemetryStatus('Connected', 10500, 10600)).toBe('Connected');
    expect(telemetryStatus('Connecting', 1000, 100000)).toBe('Connecting');
    expect(telemetryStatus('Disconnected', 1000, 100000)).toBe('Disconnected');
  });
});

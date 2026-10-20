import { describe, expect, it } from 'vitest';
import { buildSyntheticBenchmarks } from './science-benchmarks';

describe('synthetic continuous-time reference comparisons', () => {
  it('is finite, deterministic and independent of real process data', () => {
    const rows = buildSyntheticBenchmarks();
    expect(rows).toEqual(buildSyntheticBenchmarks());
    expect(rows.map((row) => row.id)).toEqual(['cooling', 'heating', 'draining', 'motor']);
    for (const row of rows) {
      expect(row.durationSeconds).toBeGreaterThan(0);
      expect(Number.isFinite(row.simulated)).toBe(true);
      expect(Number.isFinite(row.reference)).toBe(true);
      expect(row.absoluteError).toBeCloseTo(Math.abs(row.simulated - row.reference), 12);
    }
  });

  it('bounds one-second thermal Euler error versus continuous solutions', () => {
    const [cooling, heating] = buildSyntheticBenchmarks();
    expect(cooling.absoluteError).toBeLessThan(0.01);
    expect(heating.absoluteError).toBeLessThan(0.01);
    expect(cooling.simulated).toBeLessThan(cooling.reference);
    expect(heating.simulated).toBeGreaterThan(heating.reference);
  });

  it('quantifies hydraulic Euler discretization error instead of assuming exactness', () => {
    const draining = buildSyntheticBenchmarks().find((row) => row.id === 'draining');
    expect(draining).toBeDefined();
    expect(draining!.simulated).toBeLessThan(draining!.reference);
    expect(draining!.absoluteError).toBeGreaterThan(0.3);
    expect(draining!.absoluteError).toBeLessThan(0.5);
  });

  it('matches the exact exponential motor response at the sampled horizon', () => {
    const motor = buildSyntheticBenchmarks().find((row) => row.id === 'motor');
    expect(motor).toBeDefined();
    expect(motor!.absoluteError).toBeLessThan(1e-8);
    expect(motor!.simulated).toBeGreaterThan(0);
    expect(motor!.simulated).toBeLessThan(800);
  });
});

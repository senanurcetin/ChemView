import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { PHYSICS } from './physics';
import { SCENARIO_IDS } from './scenarios';

/**
 * Scientific demo acceptance: controlled synthetic experiments must be
 * reproducible and obey observable process invariants.
 */
describe('repeatable scientific scenario experiments', () => {
  const run = (scenario: (typeof SCENARIO_IDS)[number], seed: number, ticks = 60) => {
    const engine = new Engine({ seed, now: () => new Date('2026-01-01T00:00:00Z') });
    expect(engine.loadScenario(scenario, seed).ok).toBe(true);
    const states = [];
    for (let n = 0; n < ticks; n++) {
      const snapshot = engine.tick();
      states.push({
        ...snapshot.state,
        network: snapshot.network,
        alerts: snapshot.alerts.map((entry) => ({
          source: entry.source,
          message: entry.message,
          urgency: entry.urgency,
        })),
      });
    }
    return states;
  };

  it.each(SCENARIO_IDS)('%s reproduces a full trajectory with the same seed', (scenario) => {
    expect(run(scenario, 314, 30)).toEqual(run(scenario, 314, 30));
  });

  it('keeps simulated observables within their physical domains for each experiment', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const { rpm, temp, ph, level } of run(scenario, 91, 150)) {
        expect(Number.isFinite(rpm) && rpm >= 0 && rpm <= 1500).toBe(true);
        expect(Number.isFinite(temp) && temp >= PHYSICS.ambientC && temp <= 100).toBe(true);
        expect(Number.isFinite(ph) && ph >= 0 && ph <= 14).toBe(true);
        expect(Number.isFinite(level) && level >= 0 && level <= 100).toBe(true);
      }
    }
  });

  it('exhibits a real low-inventory heater cutout rather than just a warning', () => {
    const path = run('low_inventory', 44, 20);
    expect(path[0].isHeaterOn).toBe(true);
    const cutout = path.find((state) => state.level <= 10);
    expect(cutout).toBeDefined();
    expect(cutout?.isHeaterOn).toBe(false);
    expect(path.at(-1)?.isHeaterOn).toBe(false);
  });

  it('makes sensor drift visible without changing the synthetic chemical state', () => {
    const engine = new Engine({ seed: 10 });
    expect(engine.loadScenario('sensor_drift', 10).ok).toBe(true);
    for (let i = 0; i < 30; i++) engine.tick();
    const snap = engine.getSnapshot();
    expect(snap.sensorDiagnostics?.phReference).toBe(7);
    expect(snap.sensorDiagnostics?.phBias).toBeCloseTo(1.2, 8);
    expect(snap.state.ph).toBeCloseTo(8.2, 8);
  });

  it('reports failed protocol polls independently from the simulated physics', () => {
    const s = run('comms_timeout', 7, 12);
    expect(s.at(-1)?.network.errorCount).toBe(3);
    expect(s.at(-1)?.network.packetCount).toBe(21);
    expect(s.at(-1)?.rpm).toBeGreaterThan(0);
  });
});

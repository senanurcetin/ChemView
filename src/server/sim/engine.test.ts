import { describe, expect, it } from 'vitest';
import { Engine, initialState, step } from './engine';
import { NOMINAL_MESSAGE, evaluateRules } from './alerts';
import { applyCommand } from './interlocks';
import { commandFrame, readRequestFrame, readResponseFrame } from './modbus';
import { createRng } from './rng';
import { commandSchema } from './schema';
import type { SimState } from './types';

const base = (over: Partial<SimState> = {}): SimState => ({ ...initialState(), ...over });

describe('step', () => {
  it('is deterministic for the same seed', () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      let s = base({ isRunning: true, isHeaterOn: true });
      for (let i = 0; i < 30; i++) s = step(s, rng);
      return s;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('converges RPM towards the manual setpoint while running', () => {
    const rng = createRng(1);
    let s = base({ isRunning: true, isManualMode: true, targetRpmManual: 800 });
    for (let i = 0; i < 60; i++) s = step(s, rng);
    expect(s.rpm).toBeGreaterThan(790);
    expect(s.rpm).toBeLessThanOrEqual(800);
  });

  it('spins down by 15 RPM per tick and never goes negative', () => {
    const rng = createRng(1);
    let s = base({ rpm: 20 });
    s = step(s, rng);
    expect(s.rpm).toBe(5);
    s = step(s, rng);
    expect(s.rpm).toBe(0);
  });

  it('heats towards the setpoint and drains the tank when the valve is open', () => {
    const rng = createRng(1);
    let s = base({ isHeaterOn: true, isManualMode: true, targetTempManual: 60, valveOpen: true });
    s = step(s, rng);
    expect(s.temp).toBeCloseTo(24.65);
    expect(s.level).toBe(63);
  });
});

describe('interlocks', () => {
  it('denies mixer start while the valve is open', () => {
    const r = applyCommand(base({ valveOpen: true }), { type: 'start' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Valve/);
  });

  it('denies valve changes while running or still spinning', () => {
    expect(applyCommand(base({ isRunning: true }), { type: 'set_valve', open: true }).ok).toBe(
      false,
    );
    expect(applyCommand(base({ rpm: 3 }), { type: 'set_valve', open: true }).ok).toBe(false);
    expect(applyCommand(base({ rpm: 0 }), { type: 'set_valve', open: true }).ok).toBe(true);
  });

  it('E-STOP stops mixer and heater, zeroes RPM and logs a high-level audit entry', () => {
    const r = applyCommand(base({ isRunning: true, isHeaterOn: true, rpm: 480 }), {
      type: 'estop',
    });
    expect(r.state).toMatchObject({ isRunning: false, isHeaterOn: false, rpm: 0 });
    expect(r.audit?.level).toBe('high');
  });

  it('clamps setpoints to the allowed range', () => {
    expect(
      applyCommand(base(), { type: 'set_rpm_setpoint', value: 9999 }).state.targetRpmManual,
    ).toBe(1500);
    expect(
      applyCommand(base(), { type: 'set_temp_setpoint', value: -5 }).state.targetTempManual,
    ).toBe(20);
  });

  it('is idempotent for commands that change nothing', () => {
    const r = applyCommand(base(), { type: 'stop' });
    expect(r).toMatchObject({ ok: true, wrote: false });
    expect(r.audit).toBeUndefined();
  });
});

describe('modbus frames', () => {
  it('builds a well-formed read request', () => {
    expect(readRequestFrame(1)).toBe('00 01 00 00 00 06 01 03 00 00 00 04');
  });

  it('encodes live registers in the read response', () => {
    const frame = readResponseFrame(2, base({ rpm: 500, temp: 75.5, ph: 7.25, level: 65 }));
    // 500=01F4, 755=02F3, 725=02D5, 650=028A
    expect(frame).toBe('00 02 00 00 00 0B 01 03 08 01 F4 02 F3 02 D5 02 8A');
  });

  it('encodes coil and register writes', () => {
    expect(commandFrame(3, { type: 'start' })).toBe('00 03 00 00 00 06 01 05 00 00 FF 00');
    expect(commandFrame(4, { type: 'set_valve', open: false })).toBe(
      '00 04 00 00 00 06 01 05 00 02 00 00',
    );
    expect(commandFrame(5, { type: 'set_rpm_setpoint', value: 500 })).toBe(
      '00 05 00 00 00 06 01 06 00 0A 01 F4',
    );
  });
});

describe('Engine', () => {
  const make = () => new Engine({ seed: 7, now: () => new Date('2026-01-01T00:00:00Z') });

  it('exposes a stable engine run identifier that changes for a new engine', () => {
    const first = make();
    const second = make();
    expect(first.getSnapshot().runId).toBeTruthy();
    expect(first.tick().runId).toBe(first.getSnapshot().runId);
    expect(second.getSnapshot().runId).not.toBe(first.getSnapshot().runId);
  });

  it('each tick logs one TX request and one RX response', () => {
    const e = make();
    const snap = e.tick();
    expect(snap.network.packetCount).toBe(2);
    expect(snap.traffic.map((t) => t.direction)).toEqual(['TX', 'RX']);
  });

  it('records writes and audit entries for accepted commands only', () => {
    const e = make();
    expect(e.command({ type: 'start' }).ok).toBe(true);
    expect(e.getSnapshot().audit).toHaveLength(1);
    expect(e.getSnapshot().network.packetCount).toBe(1);

    expect(e.command({ type: 'set_valve', open: true }).ok).toBe(false);
    expect(e.getSnapshot().audit).toHaveLength(1);
    expect(e.getSnapshot().network.packetCount).toBe(1);
  });

  it('encodes the effective clamped setpoint in simulated Modbus writes', () => {
    const e = make();
    const cases = [
      {
        command: { type: 'set_rpm_setpoint', value: 9999 } as const,
        applied: { type: 'set_rpm_setpoint', value: 1500 } as const,
      },
      {
        command: { type: 'set_rpm_setpoint', value: -50 } as const,
        applied: { type: 'set_rpm_setpoint', value: 0 } as const,
      },
      {
        command: { type: 'set_temp_setpoint', value: 500 } as const,
        applied: { type: 'set_temp_setpoint', value: 100 } as const,
      },
      {
        command: { type: 'set_temp_setpoint', value: -5 } as const,
        applied: { type: 'set_temp_setpoint', value: 20 } as const,
      },
    ];

    cases.forEach(({ command, applied }, index) => {
      const result = e.command(command);
      expect(result.ok).toBe(true);
      expect(result.wrote).toBe(true);
      expect(e.getSnapshot().traffic[index].frame).toBe(commandFrame(index + 1, applied));
    });
    expect(e.getSnapshot().state).toMatchObject({
      targetRpmManual: 0,
      targetTempManual: 20,
    });
    expect(e.getSnapshot().network.packetCount).toBe(cases.length);
  });

  it('records a new high alarm only after recovery and a fresh excursion', () => {
    const e = make();
    e.command({ type: 'set_mode', manual: true });
    e.command({ type: 'set_temp_setpoint', value: 100 });
    e.command({ type: 'set_heater', on: true });
    for (let i = 0; i < 400; i++) e.tick();

    const initialHigh = e.getSnapshot().alerts[0];
    expect(initialHigh.urgency).toBe('high');
    expect(initialHigh.runId).toBe(e.getSnapshot().runId);
    e.tick();
    expect(e.getSnapshot().alerts[0].id).toBe(initialHigh.id);

    e.command({ type: 'set_heater', on: false });
    for (let i = 0; i < 140; i++) e.tick();
    expect(e.getSnapshot().alerts[0].message).toBe(NOMINAL_MESSAGE);

    e.command({ type: 'set_heater', on: true });
    for (let i = 0; i < 25; i++) e.tick();
    const secondHigh = e.getSnapshot().alerts[0];
    expect(secondHigh.urgency).toBe('high');
    expect(secondHigh.id).not.toBe(initialHigh.id);
  });

  it('rejects a stale operator setpoint without changing state or writing Modbus', () => {
    const e = make();
    const runId = e.getSnapshot().runId;
    const accepted = e.command({
      type: 'set_rpm_setpoint',
      value: 820,
      expectedValue: 500,
      expectedRunId: runId,
    });
    expect(accepted.ok).toBe(true);
    const before = e.getSnapshot();

    const conflicting = e.command({
      type: 'set_rpm_setpoint',
      value: 700,
      expectedValue: 500,
      expectedRunId: runId,
    });
    expect(conflicting).toMatchObject({ ok: false, wrote: false });
    expect(conflicting.reason).toMatch(/another operator/);
    expect(e.getSnapshot()).toEqual(before);

    // A telemetry tick changes the SSE seq but never invalidates a
    // compare-and-set readback that still matches the applied setpoint.
    e.tick();
    const valid = e.command({
      type: 'set_temp_setpoint',
      value: 65,
      expectedValue: 60,
      expectedRunId: runId,
    });
    expect(valid.ok).toBe(true);
    expect(e.getSnapshot().state.targetTempManual).toBe(65);
  });

  it('rejects a command for an earlier simulator run but never blocks E-STOP', () => {
    const old = make().getSnapshot().runId;
    const current = make();
    const before = current.getSnapshot();
    const stale = current.command({
      type: 'set_temp_setpoint',
      value: 75,
      expectedValue: 60,
      expectedRunId: old,
    });
    expect(stale).toMatchObject({ ok: false, wrote: false });
    expect(current.getSnapshot()).toEqual(before);
    expect(current.command({ type: 'estop' }).ok).toBe(true);
    expect(current.getSnapshot().state.estopLatched).toBe(true);
  });

  it('rejects stale switch commands without changing the process or Modbus trace', () => {
    const engine = make();
    const expectedRunId = engine.getSnapshot().runId;
    const first = engine.command({
      type: 'set_heater',
      on: true,
      expectedValue: false,
      expectedRunId,
    });
    expect(first.ok).toBe(true);
    const before = engine.getSnapshot();
    const stale = engine.command({
      type: 'set_heater',
      on: false,
      expectedValue: false,
      expectedRunId,
    });
    expect(stale).toMatchObject({ ok: false, wrote: false });
    expect(stale.reason).toMatch(/another operator/);
    expect(engine.getSnapshot()).toEqual(before);

    engine.tick();
    const mode = engine.command({
      type: 'set_mode',
      manual: true,
      expectedValue: false,
      expectedRunId,
    });
    expect(mode.ok).toBe(true);
    expect(engine.getSnapshot().state.isManualMode).toBe(true);

    const valveStart = engine.command({
      type: 'set_valve',
      open: true,
      expectedValue: false,
      expectedRunId,
    });
    expect(valveStart.ok).toBe(true);
    const snap = engine.getSnapshot();
    const oldValve = engine.command({
      type: 'set_valve',
      open: false,
      expectedValue: false,
      expectedRunId,
    });
    expect(oldValve).toMatchObject({ ok: false, wrote: false });
    expect(engine.getSnapshot()).toEqual(snap);
  });

  it('rejects controls for an old run without affecting E-STOP', () => {
    const oldRunId = make().getSnapshot().runId;
    const engine = make();
    const before = engine.getSnapshot();
    const stale = engine.command({
      type: 'start',
      expectedRunning: false,
      expectedRunId: oldRunId,
    });
    expect(stale).toMatchObject({ ok: false, wrote: false });
    expect(engine.getSnapshot()).toEqual(before);
    expect(engine.command({ type: 'estop' }).ok).toBe(true);
    expect(engine.getSnapshot().state.estopLatched).toBe(true);

    const staleReset = engine.command({
      type: 'reset_estop',
      expectedRunId: oldRunId,
    });
    expect(staleReset).toMatchObject({ ok: false, wrote: false });
    expect(engine.getSnapshot().state.estopLatched).toBe(true);

    const reset = engine.command({
      type: 'reset_estop',
      expectedRunId: engine.getSnapshot().runId,
    });
    expect(reset.ok).toBe(true);
    expect(engine.getSnapshot().state.estopLatched).toBe(false);
  });

  it('rejects an old RESET after a newer E-STOP event in the same run', () => {
    const engine = make();
    const runId = engine.getSnapshot().runId;
    expect(engine.getSnapshot().estopEpoch).toBe(0);
    engine.command({ type: 'estop' });
    const oldEpoch = engine.getSnapshot().estopEpoch;
    expect(oldEpoch).toBe(1);

    // A second E-STOP, even while latched, invalidates previously prepared resets.
    engine.command({ type: 'estop' });
    const before = engine.getSnapshot();
    expect(before.estopEpoch).toBe(2);
    const staleReset = engine.command({
      type: 'reset_estop',
      expectedRunId: runId,
      expectedEstopEpoch: oldEpoch,
    });
    expect(staleReset).toMatchObject({ ok: false, wrote: false });
    expect(staleReset.reason).toMatch(/newer E-STOP/);
    expect(engine.getSnapshot()).toEqual(before);

    const accepted = engine.command({
      type: 'reset_estop',
      expectedRunId: runId,
      expectedEstopEpoch: before.estopEpoch,
    });
    expect(accepted.ok).toBe(true);
    expect(engine.getSnapshot().state.estopLatched).toBe(false);
    expect(engine.getSnapshot().estopEpoch).toBe(2);
    // A later E-STOP must always work, even after the prior latch was reset.
    expect(engine.command({ type: 'estop' }).ok).toBe(true);
    expect(engine.getSnapshot().estopEpoch).toBe(3);
    expect(engine.getSnapshot().state.estopLatched).toBe(true);
  });

  it('guards a stale START/STOP transition but allows current readback', () => {
    const engine = make();
    const expectedRunId = engine.getSnapshot().runId;
    expect(engine.command({ type: 'start', expectedRunning: false, expectedRunId }).ok).toBe(true);
    const before = engine.getSnapshot();
    const stale = engine.command({ type: 'start', expectedRunning: false, expectedRunId });
    expect(stale.ok).toBe(false);
    expect(engine.getSnapshot()).toEqual(before);
    expect(engine.command({ type: 'stop', expectedRunning: true, expectedRunId }).ok).toBe(true);
  });

  it('caps log buffers at 50 entries', () => {
    const e = make();
    for (let i = 0; i < 40; i++) e.tick();
    expect(e.getSnapshot().traffic).toHaveLength(50);
  });

  it('notifies subscribers and stops its timer when the last one leaves', () => {
    const e = make();
    const seen: number[] = [];
    const unsub = e.subscribe((s) => seen.push(s.seq));
    e.command({ type: 'start' });
    expect(seen).toHaveLength(1);
    unsub();
    e.command({ type: 'stop' });
    expect(seen).toHaveLength(1);
  });
});

describe('commandSchema', () => {
  it('accepts valid commands and rejects malformed ones', () => {
    expect(commandSchema.safeParse({ type: 'set_valve', open: true }).success).toBe(true);
    expect(commandSchema.safeParse({ type: 'set_valve' }).success).toBe(false);
    expect(commandSchema.safeParse({ type: 'set_rpm_setpoint', value: Infinity }).success).toBe(
      false,
    );
    expect(commandSchema.safeParse({ type: 'nope' }).success).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'set_rpm_setpoint',
        value: 650,
        expectedValue: 500,
        expectedRunId: '123e4567-e89b-42d3-a456-426614174000',
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'set_rpm_setpoint',
        value: 650,
        expectedValue: NaN,
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'set_temp_setpoint',
        value: 65,
        expectedRunId: 'not-a-uuid',
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'set_valve',
        open: true,
        expectedValue: false,
        expectedRunId: '123e4567-e89b-42d3-a456-426614174000',
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'set_mode',
        manual: true,
        expectedValue: 'false',
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'stop',
        expectedRunning: false,
        expectedRunId: 'bad-session',
      }).success,
    ).toBe(false);
    expect(commandSchema.safeParse({ type: 'reset_estop', expectedEstopEpoch: 2 }).success).toBe(
      true,
    );
    expect(commandSchema.safeParse({ type: 'reset_estop', expectedEstopEpoch: -1 }).success).toBe(
      false,
    );
  });
});

describe('rule alerts', () => {
  it('raises a nominal alert on the first tick and does not repeat it', () => {
    const e = new Engine({ seed: 1 });
    e.tick();
    e.tick();
    const { alerts } = e.getSnapshot();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ source: 'rule', urgency: 'low' });
  });

  it('flags overheating with a high alert and an audit entry', () => {
    expect(evaluateRules(base({ temp: 81 }))).toMatchObject({ key: 'temp-high', urgency: 'high' });
    expect(evaluateRules(base({ ph: 5.5 }))).toMatchObject({ key: 'ph-range', urgency: 'medium' });
    expect(evaluateRules(base({ valveOpen: true, level: 0 }))).toMatchObject({ key: 'tank-empty' });
    expect(evaluateRules(base())).toBeNull();
    expect(evaluateRules(base({ temp: 81, ph: 5.5, valveOpen: true, level: 0 }))).toMatchObject({
      key: 'temp-high',
      urgency: 'high',
    });
  });
});

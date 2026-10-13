import { describe, expect, it } from 'vitest';
import { Engine, initialState, step } from './engine';
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

  it('flags overheating with a high alert and an audit entry', async () => {
    const { evaluateRules } = await import('./alerts');
    expect(evaluateRules(base({ temp: 81 }))).toMatchObject({ key: 'temp-high', urgency: 'high' });
    expect(evaluateRules(base({ ph: 5.5 }))).toMatchObject({ key: 'ph-range', urgency: 'medium' });
    expect(evaluateRules(base({ valveOpen: true, level: 0 }))).toMatchObject({ key: 'tank-empty' });
    expect(evaluateRules(base())).toBeNull();
  });
});

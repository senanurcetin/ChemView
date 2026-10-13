import { describe, expect, it } from 'vitest';
import { Engine, initialState } from './engine';
import { applyCommand } from './interlocks';
import { commandFrame } from './modbus';
import { commandSchema } from './schema';

describe('latched emergency stop — simulation only', () => {
  it('remains latched after the immediate stop, through later ticks', () => {
    const engine = new Engine({ seed: 7, now: () => new Date('2026-01-01T00:00:00Z') });
    expect(engine.command({ type: 'start' }).ok).toBe(true);
    expect(engine.command({ type: 'set_heater', on: true }).ok).toBe(true);

    const emergency = engine.command({ type: 'estop' });
    expect(emergency.ok).toBe(true);
    expect(emergency.state).toMatchObject({
      estopLatched: true,
      isRunning: false,
      isHeaterOn: false,
      rpm: 0,
    });
    engine.tick();
    expect(engine.getSnapshot().state.estopLatched).toBe(true);
    expect(engine.getSnapshot().state.isRunning).toBe(false);
  });

  it('rejects restart, heater activation, valve and setpoint changes until reset', () => {
    const state = applyCommand(initialState(), { type: 'estop' }).state;
    for (const command of [
      { type: 'start' },
      { type: 'set_heater', on: true },
      { type: 'set_valve', open: true },
      { type: 'set_rpm_setpoint', value: 500 },
    ] as const) {
      const result = applyCommand(state, command);
      expect(result.ok).toBe(false);
      expect(result.wrote).toBe(false);
      expect(result.state).toBe(state);
      expect(result.reason).toMatch(/Reset E-STOP/i);
    }
  });

  it('requires explicit reset; reset never starts the mixer or heater', () => {
    const emergency = applyCommand(initialState(), { type: 'estop' });
    const reset = applyCommand(emergency.state, { type: 'reset_estop' });
    expect(reset).toMatchObject({
      ok: true,
      wrote: true,
      state: { estopLatched: false, isRunning: false, isHeaterOn: false, rpm: 0 },
      audit: { level: 'medium' },
    });
    expect(applyCommand(reset.state, { type: 'start' }).ok).toBe(true);
    expect(applyCommand(emergency.state, { type: 'estop' }).state.estopLatched).toBe(true);
  });

  it('records reset on the simulated wire and validates its command schema', () => {
    expect(commandSchema.safeParse({ type: 'reset_estop' }).success).toBe(true);
    expect(commandSchema.safeParse({ type: 'reset_estop', on: true }).success).toBe(false);
    expect(commandFrame(2, { type: 'reset_estop' })).toBe('00 02 00 00 00 06 01 05 00 04 00 00');
  });
});

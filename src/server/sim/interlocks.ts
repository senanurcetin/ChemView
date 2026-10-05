import { THRESHOLDS } from './thresholds';
import type { Command, CommandResult, SimState } from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const deny = (state: SimState, reason: string): CommandResult => ({
  ok: false,
  reason,
  state,
  wrote: false,
});

/**
 * Applies an operator command to the state, enforcing the safety interlocks:
 * - the mixer cannot start while the discharge valve is open
 * - the discharge valve cannot move while the mixer is running or still spinning
 * - E-STOP always wins and immediately zeroes the rotor
 */
export function applyCommand(state: SimState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'start': {
      if (state.valveOpen) {
        return deny(state, 'Mixer cannot be started while Discharge Valve is OPEN.');
      }
      if (state.isRunning) return { ok: true, state, wrote: false };
      return {
        ok: true,
        wrote: true,
        state: { ...state, isRunning: true },
        audit: { message: 'INFO: Mixer STARTED by Operator', level: 'low' },
      };
    }
    case 'stop': {
      if (!state.isRunning) return { ok: true, state, wrote: false };
      return {
        ok: true,
        wrote: true,
        state: { ...state, isRunning: false },
        audit: { message: 'INFO: Mixer STOPPED by Operator', level: 'low' },
      };
    }
    case 'estop':
      return {
        ok: true,
        wrote: true,
        state: { ...state, isRunning: false, isHeaterOn: false, rpm: 0 },
        audit: { message: 'EMERGENCY STOP TRIGGERED BY OPERATOR', level: 'high' },
      };
    case 'set_heater':
      if (state.isHeaterOn === cmd.on) return { ok: true, state, wrote: false };
      return {
        ok: true,
        wrote: true,
        state: { ...state, isHeaterOn: cmd.on },
        audit: {
          message: `INFO: Heater System ${cmd.on ? 'ACTIVATED' : 'DEACTIVATED'} - Setpoint: ${state.targetTempManual.toFixed(1)}°C`,
          level: 'low',
        },
      };
    case 'set_valve': {
      if (state.valveOpen === cmd.open) return { ok: true, state, wrote: false };
      if (state.isRunning || state.rpm >= 1) {
        return deny(state, 'Safety Lock: Wait for 0 RPM before discharging.');
      }
      return {
        ok: true,
        wrote: true,
        state: { ...state, valveOpen: cmd.open },
        audit: {
          message: `INFO: Discharge Valve ${cmd.open ? 'OPENED' : 'CLOSED'} by Operator`,
          level: 'low',
        },
      };
    }
    case 'set_mode':
      return {
        ok: true,
        wrote: state.isManualMode !== cmd.manual,
        state: { ...state, isManualMode: cmd.manual },
      };
    case 'set_rpm_setpoint':
      return {
        ok: true,
        wrote: true,
        state: { ...state, targetRpmManual: clamp(cmd.value, 0, THRESHOLDS.rpmMax) },
      };
    case 'set_temp_setpoint':
      return {
        ok: true,
        wrote: true,
        state: {
          ...state,
          targetTempManual: clamp(cmd.value, THRESHOLDS.tempMin, THRESHOLDS.tempMax),
        },
      };
  }
}

import { THRESHOLDS } from './thresholds';
import { MIN_HEATER_LEVEL_PERCENT } from './physics';
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
 * - E-STOP always wins, zeros the rotor, and latches until an explicit reset
 */
export function applyCommand(state: SimState, cmd: Command): CommandResult {
  // E-STOP must always work, including when already latched.
  if (cmd.type === 'estop') {
    return {
      ok: true,
      wrote: true,
      state: { ...state, estopLatched: true, isRunning: false, isHeaterOn: false, rpm: 0 },
      audit: { message: 'EMERGENCY STOP TRIGGERED BY OPERATOR', level: 'high' },
    };
  }
  if (cmd.type === 'reset_estop') {
    if (!state.estopLatched) return { ok: true, wrote: false, state };
    return {
      ok: true,
      wrote: true,
      state: { ...state, estopLatched: false },
      audit: { message: 'E-STOP LATCH RESET BY OPERATOR', level: 'medium' },
    };
  }
  if (state.estopLatched) {
    return deny(state, 'Emergency stop latched. Reset E-STOP before other commands.');
  }
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
    case 'set_heater':
      if (cmd.on && state.level <= MIN_HEATER_LEVEL_PERCENT) {
        return deny(state, 'Low liquid level: simulated heater cannot be enabled.');
      }
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

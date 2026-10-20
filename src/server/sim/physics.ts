import type { SimState } from './types';
import type { Rng } from './rng';

/**
 * Dimensionally consistent, synthetic reactor model. Parameters describe an
 * illustrative 1 m³ aqueous vessel, not a fitted/validated physical plant.
 * The 1-second timestep is Euler integrated and all quantities use SI units
 * except the state readback (°C, rpm and fill percentage).
 */
export const PHYSICS = {
  tickSeconds: 1,
  ambientC: 22,
  capacityM3: 1,
  densityKgM3: 1000,
  specificHeatKJKgK: 4.18,
  heaterKW: 480,
  heatLossKWPerK: 2,
  thermalMassFloorFraction: 0.1,
  motorTimeConstantSeconds: 9.5,
  brakingRpmPerSecond: 15,
  /** Percent-fill per √(percent-fill) per second; Torricelli-style surrogate. */
  drainCoefficient: 0.25,
} as const;

export const MIN_HEATER_LEVEL_PERCENT = 10;

/**
 * Euler step:
 *   m Cp dT/dt = Q_heater − UA(T − T_ambient)
 *   dL/dt = −k √L  (when the discharge valve is open)
 *   dω/dt = (ω_target − ω)/τ (motor energized).
 *
 * The pH observable is held constant without chemical feed or dosing. This
 * avoids inventing an acid/base mass balance. It may be perturbed by a named
 * experiment, but pH dynamics are not claimed to be chemically predictive.
 */
export function advancePhysicalState(state: SimState, rng: Rng): SimState {
  const rpm = state.isRunning
    ? state.rpm +
      ((state.isManualMode ? state.targetRpmManual : 450 + rng() * 50) - state.rpm) *
        (1 - Math.exp(-PHYSICS.tickSeconds / PHYSICS.motorTimeConstantSeconds))
    : Math.max(0, state.rpm - PHYSICS.brakingRpmPerSecond * PHYSICS.tickSeconds);

  const activeMassFraction = Math.max(PHYSICS.thermalMassFloorFraction, state.level / 100);
  const thermalMassKJK =
    PHYSICS.capacityM3 * PHYSICS.densityKgM3 * activeMassFraction * PHYSICS.specificHeatKJKgK;
  const heaterSetpoint = state.isManualMode ? state.targetTempManual : 75;
  const heating =
    state.isHeaterOn && state.level > MIN_HEATER_LEVEL_PERCENT && state.temp < heaterSetpoint
      ? PHYSICS.heaterKW
      : 0;
  const netPowerKW = heating - PHYSICS.heatLossKWPerK * (state.temp - PHYSICS.ambientC);
  const temp = Math.max(
    PHYSICS.ambientC,
    state.temp + (netPowerKW * PHYSICS.tickSeconds) / thermalMassKJK,
  );

  const dischargedPercent = state.valveOpen
    ? PHYSICS.drainCoefficient * Math.sqrt(Math.max(0, state.level)) * PHYSICS.tickSeconds
    : 0;
  const level = Math.max(0, state.level - dischargedPercent);
  return { ...state, rpm, temp, ph: state.ph, level };
}

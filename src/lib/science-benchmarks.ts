import { advancePhysicalState, PHYSICS } from '@/server/sim/physics';
import { initialState } from '@/server/sim/state';
import type { SimState } from '@/server/sim/types';

/**
 * Independent continuous-time references for four deliberately simple,
 * reproducible synthetic model cases. These are NOT empirical plant data.
 *
 * Comparisons are meaningful only under the fixed conditions defined here:
 * sealed constant-mass vessel, heater below thermostat setpoint, free drain,
 * and constant manual-speed command.
 */
export interface ScienceBenchmark {
  id: 'cooling' | 'heating' | 'draining' | 'motor';
  label: string;
  durationSeconds: number;
  unit: string;
  simulated: number;
  reference: number;
  absoluteError: number;
}

const fixedRng = () => 0.5;

function runSteps(initial: SimState, steps: number): SimState {
  let state = initial;
  for (let i = 0; i < steps; i++) {
    state = advancePhysicalState(state, fixedRng);
  }
  return state;
}

function result(
  id: ScienceBenchmark['id'],
  label: string,
  durationSeconds: number,
  unit: string,
  simulated: number,
  reference: number,
): ScienceBenchmark {
  return {
    id,
    label,
    durationSeconds,
    unit,
    simulated,
    reference,
    absoluteError: Math.abs(simulated - reference),
  };
}

export function buildSyntheticBenchmarks(): ScienceBenchmark[] {
  const waterHeatCapacity =
    PHYSICS.capacityM3 * PHYSICS.densityKgM3 * 0.65 * PHYSICS.specificHeatKJKgK;
  const thermalRate = PHYSICS.heatLossKWPerK / waterHeatCapacity;

  const coolingSeconds = 120;
  const coolingStart = 68;
  const cooling = runSteps({ ...initialState(), level: 65, temp: coolingStart }, coolingSeconds);
  const coolingReference =
    PHYSICS.ambientC + (coolingStart - PHYSICS.ambientC) * Math.exp(-thermalRate * coolingSeconds);

  const heatingSeconds = 70;
  const heatingStart = 24.5;
  const heating = runSteps(
    {
      ...initialState(),
      level: 65,
      temp: heatingStart,
      isHeaterOn: true,
      isManualMode: true,
      targetTempManual: 100,
    },
    heatingSeconds,
  );
  const equilibrium = PHYSICS.ambientC + PHYSICS.heaterKW / PHYSICS.heatLossKWPerK;
  const heatingReference =
    equilibrium + (heatingStart - equilibrium) * Math.exp(-thermalRate * heatingSeconds);

  const drainingSeconds = 40;
  const drainingStart = 65;
  const draining = runSteps(
    { ...initialState(), level: drainingStart, valveOpen: true },
    drainingSeconds,
  );
  const drainingReference =
    Math.max(0, Math.sqrt(drainingStart) - (PHYSICS.drainCoefficient * drainingSeconds) / 2) ** 2;

  const motorSeconds = 60;
  const motorTarget = 800;
  const motor = runSteps(
    {
      ...initialState(),
      isRunning: true,
      isManualMode: true,
      targetRpmManual: motorTarget,
    },
    motorSeconds,
  );
  const motorReference =
    motorTarget * (1 - Math.exp(-motorSeconds / PHYSICS.motorTimeConstantSeconds));

  return [
    result('cooling', 'Passive cooling', coolingSeconds, '°C', cooling.temp, coolingReference),
    result(
      'heating',
      'Constant-power warming',
      heatingSeconds,
      '°C',
      heating.temp,
      heatingReference,
    ),
    result(
      'draining',
      'Free tank discharge',
      drainingSeconds,
      '% fill',
      draining.level,
      drainingReference,
    ),
    result('motor', 'Motor step response', motorSeconds, 'RPM', motor.rpm, motorReference),
  ];
}

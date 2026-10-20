import { initialState } from './state';
import type { ScenarioId, SimState } from './types';

export const SCENARIO_IDS = [
  'nominal',
  'thermal_excursion',
  'low_inventory',
  'ph_excursion',
  'comms_timeout',
] as const satisfies readonly ScenarioId[];

export const SCENARIO_LIBRARY: Record<ScenarioId, { label: string; summary: string }> = {
  nominal: {
    label: 'Normal batch',
    summary: 'Idle reactor with an ordinary, reproducible telemetry baseline.',
  },
  thermal_excursion: {
    label: 'Thermal excursion',
    summary: 'Reactor nearing 80 °C while a heater drives temperature upward.',
  },
  low_inventory: {
    label: 'Low inventory',
    summary: 'Draining vessel crosses the 10% inventory heater cutout.',
  },
  ph_excursion: {
    label: 'pH excursion',
    summary: 'Injects an out-of-range pH observation without inventing a dose reaction.',
  },
  comms_timeout: {
    label: 'Modbus timeout',
    summary: 'Drops every fourth simulated polling response while SSE remains connected.',
  },
};

/**
 * Each experiment starts from a named, inspectable synthetic initial condition.
 * The seed controls stochastic auto-RPM jitter and latency; it is not a fitted
 * empirical noise model. Scenarios do not mutate a real controller.
 */
export function scenarioInitialState(name: ScenarioId): SimState {
  const base = initialState();
  switch (name) {
    case 'nominal':
      return base;
    case 'thermal_excursion':
      return {
        ...base,
        isRunning: true,
        isHeaterOn: true,
        isManualMode: true,
        temp: 79.2,
        targetRpmManual: 600,
        targetTempManual: 100,
      };
    case 'low_inventory':
      return {
        ...base,
        level: 11,
        valveOpen: true,
        isHeaterOn: true,
        isManualMode: true,
        targetTempManual: 90,
      };
    case 'ph_excursion':
      return { ...base, ph: 8.4, isRunning: true };
    case 'comms_timeout':
      return { ...base, isRunning: true };
  }
}

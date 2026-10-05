import { THRESHOLDS } from './thresholds';
import type { Level, SimState } from './types';

export interface RuleAlert {
  /** Stable key so the engine only raises an alert when the condition changes. */
  key: string;
  message: string;
  urgency: Level;
}

/**
 * Deterministic safety alarms. These never depend on an LLM: the engine raises
 * them immediately on the tick the condition appears.
 * Returns the most severe active condition, or null when all is nominal.
 */
export function evaluateRules(state: SimState): RuleAlert | null {
  if (state.temp > THRESHOLDS.temperatureCelsius) {
    return {
      key: 'temp-high',
      message: `Overheating detected (${state.temp.toFixed(1)}°C > ${THRESHOLDS.temperatureCelsius}°C). Recommend cooling cycle.`,
      urgency: 'high',
    };
  }
  if (state.ph < THRESHOLDS.phLower || state.ph > THRESHOLDS.phUpper) {
    return {
      key: 'ph-range',
      message: `pH out of range (${state.ph.toFixed(2)}). Expected ${THRESHOLDS.phLower}-${THRESHOLDS.phUpper}.`,
      urgency: 'medium',
    };
  }
  if (state.valveOpen && state.level <= 0) {
    return {
      key: 'tank-empty',
      message: 'Tank is empty. Close the discharge valve.',
      urgency: 'low',
    };
  }
  return null;
}

export const NOMINAL_MESSAGE = 'System operating within optimal parameters.';

import { THRESHOLDS } from './thresholds';
import type { Level, SimState } from './types';

export interface RuleAlert {
  /** Stable key so the engine only raises an alert when the condition changes. */
  key: string;
  message: string;
  urgency: Level;
}

/**
 * All simultaneously active synthetic process faults, ordered by severity.
 * They are process advisory rules, not physical safety instrumentation.
 */
export function evaluateAllRules(state: SimState): RuleAlert[] {
  const rules: RuleAlert[] = [];
  if (state.temp > THRESHOLDS.temperatureCelsius) {
    rules.push({
      key: 'temp-high',
      message: `Overheating detected (${state.temp.toFixed(1)}°C > ${THRESHOLDS.temperatureCelsius}°C). Recommend cooling cycle.`,
      urgency: 'high',
    });
  }
  if (state.ph < THRESHOLDS.phLower || state.ph > THRESHOLDS.phUpper) {
    rules.push({
      key: 'ph-range',
      message: `pH out of range (${state.ph.toFixed(2)}). Expected ${THRESHOLDS.phLower}-${THRESHOLDS.phUpper}.`,
      urgency: 'medium',
    });
  }
  if (state.level <= 10) {
    rules.push({
      key: 'level-low',
      message: `Low reactor inventory (${state.level.toFixed(1)}% fill). Heater disabled at 10% or below.`,
      urgency: 'medium',
    });
  }
  if (state.valveOpen && state.level <= 0) {
    rules.push({
      key: 'tank-empty',
      message: 'Tank is empty. Close the discharge valve.',
      urgency: 'low',
    });
  }
  return rules;
}

/** Retained for single-priority callers; the Engine emits every active fault. */
export function evaluateRules(state: SimState): RuleAlert | null {
  return evaluateAllRules(state)[0] ?? null;
}

export const NOMINAL_MESSAGE = 'System operating within optimal parameters.';

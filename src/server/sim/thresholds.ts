/**
 * Single source of truth for process limits. Used by the rule-based alarms,
 * the Genkit alert flow and the interlocks.
 */
export const THRESHOLDS = {
  temperatureCelsius: 80,
  rpmLow: 100,
  phLower: 6,
  phUpper: 8,
  rpmMax: 1500,
  tempMin: 20,
  tempMax: 100,
} as const;

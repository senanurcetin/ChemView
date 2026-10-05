import type { SimState } from './types';

export function initialState(): SimState {
  return {
    isRunning: false,
    isManualMode: false,
    isHeaterOn: false,
    valveOpen: false,
    rpm: 0,
    temp: 24.5,
    ph: 7.0,
    level: 65,
    targetRpmManual: 500,
    targetTempManual: 60,
  };
}

import type { TelemetrySample } from './store';

const HEADER = ['timestamp', 'rpm', 'temperature_c', 'ph', 'level_pct', 'mixer_running', 'heater_on', 'valve_open'];

export function telemetryToCsv(samples: TelemetrySample[]): string {
  const rows = samples.map((s) =>
    [s.ts, s.rpm.toFixed(2), s.temp.toFixed(2), s.ph.toFixed(3), s.level, s.isRunning ? 1 : 0, s.isHeaterOn ? 1 : 0, s.valveOpen ? 1 : 0].join(','),
  );
  return [HEADER.join(','), ...rows].join('\n') + '\n';
}

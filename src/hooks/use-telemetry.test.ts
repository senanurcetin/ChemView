import { describe, expect, it } from 'vitest';
import { isObsoleteCommandResponse } from './use-telemetry';

describe('isObsoleteCommandResponse', () => {
  it('silences an ordinary reply from an earlier simulator run', () => {
    const heater = { type: 'set_heater' as const, on: true };
    const reset = { type: 'reset_estop' as const, expectedEstopEpoch: 1 };
    expect(isObsoleteCommandResponse(heater, 'run-one', 'run-two')).toBe(true);
    expect(isObsoleteCommandResponse(reset, 'run-one', 'run-two')).toBe(true);
    expect(isObsoleteCommandResponse(heater, 'run-one', 'run-one')).toBe(false);
  });

  it('always allows E-STOP responses to surface even after a restart', () => {
    const estop = { type: 'estop' as const };
    expect(isObsoleteCommandResponse(estop, 'run-one', 'run-two')).toBe(false);
    expect(isObsoleteCommandResponse(estop, null, 'run-two')).toBe(false);
  });
});

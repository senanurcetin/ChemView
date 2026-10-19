import { z } from 'zod';

const session = { expectedRunId: z.string().uuid().optional() };
const observedValue = { ...session, expectedValue: z.boolean().optional() };
const observedMixer = { ...session, expectedRunning: z.boolean().optional() };

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), ...observedMixer }),
  z.object({ type: z.literal('stop'), ...observedMixer }),
  z.object({ type: z.literal('estop') }),
  z.object({ type: z.literal('reset_estop'), ...session }).strict(),
  z.object({ type: z.literal('set_heater'), on: z.boolean(), ...observedValue }),
  z.object({ type: z.literal('set_valve'), open: z.boolean(), ...observedValue }),
  z.object({ type: z.literal('set_mode'), manual: z.boolean(), ...observedValue }),
  z.object({
    type: z.literal('set_rpm_setpoint'),
    value: z.number().finite(),
    expectedValue: z.number().finite().optional(),
    expectedRunId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('set_temp_setpoint'),
    value: z.number().finite(),
    expectedValue: z.number().finite().optional(),
    expectedRunId: z.string().uuid().optional(),
  }),
]);

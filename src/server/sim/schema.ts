import { z } from 'zod';

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('stop') }),
  z.object({ type: z.literal('estop') }),
  z.object({ type: z.literal('set_heater'), on: z.boolean() }),
  z.object({ type: z.literal('set_valve'), open: z.boolean() }),
  z.object({ type: z.literal('set_mode'), manual: z.boolean() }),
  z.object({ type: z.literal('set_rpm_setpoint'), value: z.number().finite() }),
  z.object({ type: z.literal('set_temp_setpoint'), value: z.number().finite() }),
]);

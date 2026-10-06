import type { Command, SimState } from './types';

/**
 * Simulated Modbus TCP register/coil map. Frames are deterministic functions of
 * the process state, not random bytes.
 *
 * Holding registers (read with FC 03, starting at 0):
 *   0 = RPM, 1 = temperature x10, 2 = pH x100, 3 = level x10
 *   10 = RPM setpoint, 11 = temperature setpoint x10 (written with FC 06)
 * Coils (written with FC 05):
 *   0 = mixer run, 1 = heater, 2 = discharge valve, 3 = manual mode, 4 = E-STOP
 */
const UNIT_ID = 0x01;
const READ_START = 0;
const READ_COUNT = 4;

const hex = (n: number, width: number) =>
  Math.max(0, Math.round(n)).toString(16).toUpperCase().padStart(width, '0').slice(-width);

const bytes = (...parts: string[]) => parts.join('').match(/.{2}/g)!.join(' ');

const mbap = (txId: number, length: number) => `${hex(txId & 0xffff, 4)}0000${hex(length, 4)}`;

/** Master request: Read Holding Registers (FC 03). Direction TX. */
export function readRequestFrame(txId: number): string {
  return bytes(mbap(txId, 6), hex(UNIT_ID, 2), '03', hex(READ_START, 4), hex(READ_COUNT, 4));
}

/** Slave response to {@link readRequestFrame} carrying live registers. Direction RX. */
export function readResponseFrame(txId: number, state: SimState): string {
  const regs = [state.rpm, state.temp * 10, state.ph * 100, state.level * 10]
    .map((v) => hex(v, 4))
    .join('');
  const byteCount = READ_COUNT * 2;
  return bytes(mbap(txId, 3 + byteCount), hex(UNIT_ID, 2), '03', hex(byteCount, 2), regs);
}

/** Master request that writes an operator command (FC 05 coil / FC 06 register). Direction TX. */
export function commandFrame(txId: number, cmd: Command): string {
  const coil = (addr: number, on: boolean) =>
    bytes(mbap(txId, 6), hex(UNIT_ID, 2), '05', hex(addr, 4), on ? 'FF00' : '0000');
  const reg = (addr: number, value: number) =>
    bytes(mbap(txId, 6), hex(UNIT_ID, 2), '06', hex(addr, 4), hex(value, 4));

  switch (cmd.type) {
    case 'start':
      return coil(0, true);
    case 'stop':
      return coil(0, false);
    case 'set_heater':
      return coil(1, cmd.on);
    case 'set_valve':
      return coil(2, cmd.open);
    case 'set_mode':
      return coil(3, cmd.manual);
    case 'estop':
      return coil(4, true);
    case 'set_rpm_setpoint':
      return reg(10, cmd.value);
    case 'set_temp_setpoint':
      return reg(11, cmd.value * 10);
  }
}

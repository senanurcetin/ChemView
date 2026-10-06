import { timingSafeEqual } from 'node:crypto';

export type AuthDecision = { ok: true } | { ok: false; status: 401; reason: string };

/** Constant-time string comparison that does not leak the length via an early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still burn a comparison so timing does not depend on where the lengths differ.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Optional bearer-token check for operator commands.
 *
 * - No `OPERATOR_TOKEN` configured: everything is allowed (previous behavior).
 * - E-STOP is a safety command and is always allowed without a token.
 * - Every other command needs `Authorization: Bearer <token>` when a token is configured.
 */
export function authorizeCommand(
  commandType: string,
  authorizationHeader: string | null,
  token: string | undefined = process.env.OPERATOR_TOKEN,
): AuthDecision {
  if (!token) return { ok: true };
  if (commandType === 'estop') return { ok: true };
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader ?? '');
  if (match && safeEqual(match[1].trim(), token)) return { ok: true };
  return { ok: false, status: 401, reason: 'Operator token required.' };
}

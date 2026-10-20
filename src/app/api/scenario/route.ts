import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngine } from '@/server/sim/engine';
import { authorizeCommand } from '@/server/auth';
import { RateLimiter } from '@/server/rate-limit';
import { SCENARIO_IDS } from '@/server/sim/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new RateLimiter(60, 10_000);
const requestSchema = z
  .object({
    scenario: z.enum(SCENARIO_IDS),
    seed: z.number().int().min(0).max(2147483647),
    expectedRunId: z.string().uuid().optional(),
  })
  .strict();

/** Demo-only experiment reset; not a Modbus command or real plant operation. */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'Invalid experiment.' }, { status: 400 });
  }
  const auth = authorizeCommand('set_mode', request.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, reason: auth.reason },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }
  const retryMs = limiter.check('shared-simulator-experiments');
  if (retryMs > 0) {
    return NextResponse.json(
      { ok: false, reason: 'Experiment reset rate limited.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryMs / 1000)) } },
    );
  }
  const result = getEngine().loadScenario(
    parsed.data.scenario,
    parsed.data.seed,
    parsed.data.expectedRunId,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
  }
  return NextResponse.json(
    { ok: true, runId: result.runId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

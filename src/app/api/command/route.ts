import { NextResponse } from 'next/server';
import { getEngine } from '@/server/sim/engine';
import { RateLimiter } from '@/server/rate-limit';
import { commandSchema } from '@/server/sim/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new RateLimiter(60, 10_000);

/** Applies an operator command. Interlock denials return 409 with a reason. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'Invalid command.' }, { status: 400 });
  }

  // E-STOP is never throttled: a safety command must always get through.
  if (parsed.data.type !== 'estop') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const retryMs = limiter.check(ip);
    if (retryMs > 0) {
      return NextResponse.json(
        { ok: false, reason: 'Too many commands. Slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryMs / 1000)) } },
      );
    }
  }

  const result = getEngine().command(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

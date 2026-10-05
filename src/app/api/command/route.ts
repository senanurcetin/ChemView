import { NextResponse } from 'next/server';
import { getEngine } from '@/server/sim/engine';
import { commandSchema } from '@/server/sim/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const result = getEngine().command(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

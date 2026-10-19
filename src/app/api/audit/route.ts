import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngine } from '@/server/sim/engine';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  runId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100),
});

/** Return newest persisted audit events for a simulator run. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = querySchema.safeParse({
    runId: params.get('runId') ?? undefined,
    limit: params.get('limit') ?? '50',
  });
  if (!query.success) {
    return NextResponse.json({ error: 'Invalid runId or limit.' }, { status: 400 });
  }

  const runId = query.data.runId ?? getEngine().getSnapshot().runId;
  const entries = await getStore().recentAudit(query.data.limit, runId);
  return NextResponse.json(
    { runId, count: entries.length, entries },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

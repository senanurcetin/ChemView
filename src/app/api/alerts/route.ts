import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngine } from '@/server/sim/engine';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  runId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100),
});

/** Most recent historical alarm events for a single simulated engine run. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = schema.safeParse({
    runId: params.get('runId') ?? undefined,
    limit: params.get('limit') ?? '50',
  });
  if (!query.success) {
    return NextResponse.json({ error: 'Invalid runId or limit.' }, { status: 400 });
  }

  const runId = query.data.runId ?? getEngine().getSnapshot().runId;
  const alerts = await getStore().recentAlerts(query.data.limit, runId);
  return NextResponse.json(
    { runId, count: alerts.length, alerts },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

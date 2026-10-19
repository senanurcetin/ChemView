import { NextResponse } from 'next/server';
import { parseHistoryQuery } from '@/server/history-query';
import { getStore } from '@/server/store';
import { getEngine } from '@/server/sim/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Persisted telemetry samples (one per 5 s) for a time range. */
export async function GET(request: Request) {
  const query = parseHistoryQuery(new URL(request.url).searchParams);
  if (!query.ok) return NextResponse.json({ error: query.error }, { status: 400 });
  const runId = query.runId ?? getEngine().getSnapshot().runId;
  const samples = await getStore().history({ ...query, runId });
  return NextResponse.json({
    runId,
    from: query.from,
    to: query.to,
    count: samples.length,
    samples,
  });
}

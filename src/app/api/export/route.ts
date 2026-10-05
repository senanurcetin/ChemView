import { NextResponse } from 'next/server';
import { telemetryToCsv } from '@/server/csv';
import { parseHistoryQuery } from '@/server/history-query';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV download of persisted telemetry; same query params as /api/history. */
export async function GET(request: Request) {
  const query = parseHistoryQuery(new URL(request.url).searchParams);
  if (!query.ok) return NextResponse.json({ error: query.error }, { status: 400 });
  const samples = await getStore().history(query);
  return new Response(telemetryToCsv(samples), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reactor_logs_${query.to.slice(0, 10)}.csv"`,
    },
  });
}

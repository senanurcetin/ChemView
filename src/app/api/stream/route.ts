import { getEngine } from '@/server/sim/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Server-Sent Events stream of simulation snapshots (one per 1 s polling tick). */
export async function GET(request: Request) {
  const engine = getEngine();
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const cleanup = () => {
    unsubscribe?.();
    unsubscribe = undefined;
    if (heartbeat) clearInterval(heartbeat);
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`data: ${JSON.stringify(engine.getSnapshot())}\n\n`);
      unsubscribe = engine.subscribe((snapshot) => send(`data: ${JSON.stringify(snapshot)}\n\n`));
      heartbeat = setInterval(() => send(': ping\n\n'), 15000);
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel: cleanup,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

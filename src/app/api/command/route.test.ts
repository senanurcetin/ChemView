import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { engineCommand } = vi.hoisted(() => ({ engineCommand: vi.fn() }));

vi.mock('@/server/sim/engine', () => ({
  getEngine: () => ({ command: engineCommand }),
}));

type PostHandler = (request: Request) => Promise<Response>;

function postBody(post: PostHandler, body: string, headers: Record<string, string> = {}) {
  return post(
    new Request('http://localhost:9002/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    }),
  );
}

function postCommand(
  post: PostHandler,
  command: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return postBody(post, JSON.stringify(command), headers);
}

describe('POST /api/command — HTTP contract', () => {
  beforeEach(() => {
    // Each handler import gets a fresh module-level limiter.
    vi.resetModules();
    engineCommand.mockReset();
    engineCommand.mockReturnValue({ ok: true });
    vi.stubEnv('OPERATOR_TOKEN', '');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('rejects invalid JSON and commands before touching the engine', async () => {
    const { POST } = await import('./route');
    const badJson = await postBody(POST, '{ broken json');
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toMatchObject({ ok: false, reason: 'Invalid JSON body.' });

    const badCommand = await postCommand(POST, { type: 'set_valve', open: 'yes' });
    expect(badCommand.status).toBe(400);
    expect(await badCommand.json()).toMatchObject({ ok: false, reason: 'Invalid command.' });
    expect(engineCommand).not.toHaveBeenCalled();
  });

  it('authenticates ordinary commands and reset but never blocks E-STOP', async () => {
    vi.stubEnv('OPERATOR_TOKEN', 'correct-token');
    const { POST } = await import('./route');

    const missing = await postCommand(POST, { type: 'start' });
    const wrong = await postCommand(POST, { type: 'stop' }, { Authorization: 'Bearer wrong' });
    const resetDenied = await postCommand(POST, { type: 'reset_estop' });
    for (const response of [missing, wrong, resetDenied]) {
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    }

    const stop = await postCommand(POST, { type: 'estop' });
    expect(stop.status).toBe(200);

    const reset = await postCommand(
      POST,
      { type: 'reset_estop' },
      { Authorization: 'Bearer correct-token' },
    );
    expect(reset.status).toBe(200);
    expect(engineCommand.mock.calls.map(([cmd]) => cmd.type)).toEqual([
      'estop',
      'reset_estop',
    ]);
  });

  it('returns an interlock denial as HTTP 409 with its reason', async () => {
    engineCommand.mockReturnValueOnce({
      ok: false,
      reason: 'Mixer cannot be started while Discharge Valve is OPEN.',
    });
    const { POST } = await import('./route');
    const response = await postCommand(POST, { type: 'start' });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: 'Mixer cannot be started while Discharge Valve is OPEN.',
    });
  });

  it('shares the 60-command budget across spoofed IPs but always admits E-STOP', async () => {
    const { POST } = await import('./route');

    for (let i = 0; i < 60; i++) {
      const response = await postCommand(
        POST,
        { type: 'stop' },
        { 'X-Forwarded-For': `192.0.2.${i + 1}` },
      );
      expect(response.status).toBe(200);
    }

    const blocked = await postCommand(
      POST,
      { type: 'start' },
      { 'X-Forwarded-For': '198.51.100.200' },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('10');
    expect(engineCommand).toHaveBeenCalledTimes(60);

    // The emergency command is intentionally exempt even during saturation.
    expect((await postCommand(POST, { type: 'estop' })).status).toBe(200);
    expect((await postCommand(POST, { type: 'reset_estop' })).status).toBe(429);
    expect(engineCommand).toHaveBeenCalledTimes(61);

    vi.setSystemTime(new Date('2026-10-18T12:00:10.000Z'));
    expect((await postCommand(POST, { type: 'stop' })).status).toBe(200);
    expect(engineCommand).toHaveBeenCalledTimes(62);
  });
});

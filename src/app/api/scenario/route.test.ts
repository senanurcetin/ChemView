import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadScenario } = vi.hoisted(() => ({ loadScenario: vi.fn() }));
vi.mock('@/server/sim/engine', () => ({
  getEngine: () => ({ loadScenario }),
}));

import { POST } from './route';

const runId = '123e4567-e89b-42d3-a456-426614174000';

function post(payload: unknown, authorization?: string) {
  return POST(
    new Request('http://localhost:9002/api/scenario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(payload),
    }),
  );
}

describe('POST /api/scenario', () => {
  beforeEach(() => {
    loadScenario.mockReset().mockReturnValue({ ok: true, runId });
    vi.stubEnv('OPERATOR_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('checks schema and preserves seed and session identity', async () => {
    const response = await post({ scenario: 'low_inventory', seed: 42, expectedRunId: runId });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, runId });
    expect(loadScenario).toHaveBeenCalledWith('low_inventory', 42, runId);
    for (const payload of [
      { scenario: 'unsupported', seed: 42 },
      { scenario: 'nominal', seed: -1 },
      { scenario: 'nominal', seed: 1.5 },
      { scenario: 'nominal', seed: 42, expectedRunId: 'invalid' },
      { scenario: 'nominal', seed: 42, overrideSafety: true },
    ]) {
      expect((await post(payload)).status).toBe(400);
    }
    expect(loadScenario).toHaveBeenCalledTimes(1);
  });

  it('enforces operator token and refuses stale or E-STOP-latched resets', async () => {
    vi.stubEnv('OPERATOR_TOKEN', 'test-token');
    expect((await post({ scenario: 'nominal', seed: 3 })).status).toBe(401);
    const ok = await post({ scenario: 'nominal', seed: 3 }, 'Bearer test-token');
    expect(ok.status).toBe(200);

    loadScenario.mockReturnValueOnce({
      ok: false,
      reason: 'Reset E-STOP before loading an experiment.',
      runId,
    });
    const forbidden = await post({ scenario: 'thermal_excursion', seed: 3 }, 'Bearer test-token');
    expect(forbidden.status).toBe(409);
  });
});

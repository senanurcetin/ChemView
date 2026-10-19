import { beforeEach, describe, expect, it, vi } from 'vitest';

const { history, getSnapshot } = vi.hoisted(() => ({
  history: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock('@/server/store', () => ({
  getStore: () => ({ history }),
}));
vi.mock('@/server/sim/engine', () => ({
  getEngine: () => ({ getSnapshot }),
}));

import { GET } from './route';

const activeRun = '123e4567-e89b-42d3-a456-426614174000';
const archivedRun = '123e4567-e89b-42d3-a456-426614174001';

describe('GET /api/history', () => {
  beforeEach(() => {
    history.mockReset().mockResolvedValue([]);
    getSnapshot.mockReset().mockReturnValue({ runId: activeRun });
  });

  it('uses the current simulation run by default', async () => {
    const response = await GET(new Request('http://localhost:9002/api/history'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ runId: activeRun, count: 0, samples: [] });
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ runId: activeRun }));
  });

  it('supports explicitly requested archived session history', async () => {
    const response = await GET(
      new Request(`http://localhost:9002/api/history?runId=${archivedRun}&limit=2`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ runId: archivedRun, count: 0 });
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({ runId: archivedRun, limit: 2 }),
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects invalid run identifiers without accessing the store', async () => {
    const response = await GET(new Request('http://localhost:9002/api/history?runId=../other'));
    expect(response.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });
});

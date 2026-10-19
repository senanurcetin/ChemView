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
const request = (query = '') => new Request(`http://localhost:9002/api/history${query}`);

describe('GET /api/history', () => {
  beforeEach(() => {
    history.mockReset().mockResolvedValue([]);
    getSnapshot.mockReset().mockReturnValue({ runId: activeRun });
  });

  it('uses the current simulation run by default', async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.runId).toBe(activeRun);
    expect(body.samples).toEqual([]);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ runId: activeRun }));
  });

  it('supports an explicitly selected archived run', async () => {
    const response = await GET(request(`?runId=${archivedRun}&limit=2`));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.runId).toBe(archivedRun);
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({ runId: archivedRun, limit: 2 }),
    );
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects invalid run identifiers before reading data', async () => {
    const response = await GET(request('?runId=../other'));
    expect(response.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });
});

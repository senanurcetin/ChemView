import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recentAudit, getSnapshot } = vi.hoisted(() => ({
  recentAudit: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock('@/server/store', () => ({
  getStore: () => ({ recentAudit }),
}));
vi.mock('@/server/sim/engine', () => ({
  getEngine: () => ({ getSnapshot }),
}));

import { GET } from './route';

const activeRun = '123e4567-e89b-42d3-a456-426614174000';
const archivedRun = '123e4567-e89b-42d3-a456-426614174001';
const baseUrl = 'http://localhost:9002/api/audit';

describe('GET /api/audit', () => {
  beforeEach(() => {
    recentAudit.mockReset().mockResolvedValue([]);
    getSnapshot.mockReset().mockReturnValue({ runId: activeRun });
  });

  it('defaults to the current engine run and 50 entries', async () => {
    const response = await GET(new Request(baseUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ runId: activeRun, count: 0, entries: [] });
    expect(recentAudit).toHaveBeenCalledWith(50, activeRun);
  });

  it('supports a bounded archived-session lookup', async () => {
    const response = await GET(new Request(`${baseUrl}?runId=${archivedRun}&limit=3`));
    expect(response.status).toBe(200);
    expect(recentAudit).toHaveBeenCalledWith(3, archivedRun);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects invalid parameters before accessing persistence', async () => {
    for (const query of ['?runId=wrong', '?limit=0', '?limit=101', '?limit=NaN']) {
      const response = await GET(new Request(baseUrl + query));
      expect(response.status).toBe(400);
    }
    expect(recentAudit).not.toHaveBeenCalled();
  });
});

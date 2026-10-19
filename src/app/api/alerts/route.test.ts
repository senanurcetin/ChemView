import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recentAlerts, getSnapshot } = vi.hoisted(() => ({
  recentAlerts: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock('@/server/store', () => ({
  getStore: () => ({ recentAlerts }),
}));
vi.mock('@/server/sim/engine', () => ({
  getEngine: () => ({ getSnapshot }),
}));

import { GET } from './route';

const activeRun = '123e4567-e89b-42d3-a456-426614174000';
const archivedRun = '123e4567-e89b-42d3-a456-426614174001';
const baseUrl = 'http://localhost:9002/api/alerts';

describe('GET /api/alerts', () => {
  beforeEach(() => {
    recentAlerts.mockReset().mockResolvedValue([]);
    getSnapshot.mockReset().mockReturnValue({ runId: activeRun });
  });

  it('defaults to the active simulator session and 50 most recent events', async () => {
    const response = await GET(new Request(baseUrl));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ runId: activeRun, count: 0, alerts: [] });
    expect(recentAlerts).toHaveBeenCalledWith(50, activeRun);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('queries one archived session with a bounded limit', async () => {
    const response = await GET(new Request(baseUrl + '?runId=' + archivedRun + '&limit=3'));
    const body = await response.json();
    expect(body.runId).toBe(archivedRun);
    expect(recentAlerts).toHaveBeenCalledWith(3, archivedRun);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects invalid identifiers and oversized limits before reading history', async () => {
    for (const query of ['?runId=invalid', '?limit=0', '?limit=101', '?limit=NaN']) {
      const response = await GET(new Request(baseUrl + query));
      expect(response.status).toBe(400);
    }
    expect(recentAlerts).not.toHaveBeenCalled();
  });
});

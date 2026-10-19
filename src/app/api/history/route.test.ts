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
const baseUrl = 'http://localhost:9002/api/history';
const makeRequest = (suffix = '') => new Request(baseUrl + suffix);

describe('GET /api/history', () => {
  beforeEach(() => {
    history.mockReset().mockResolvedValue([]);
    getSnapshot.mockReset().mockReturnValue({ runId: activeRun });
  });

  it('uses the current simulator run by default', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    const query = history.mock.calls[0][0];
    expect(response.status).toBe(200);
    expect(body.runId).toBe(activeRun);
    expect(body.samples).toEqual([]);
    expect(query.runId).toBe(activeRun);
  });

  it('queries an explicitly selected archived run', async () => {
    const response = await GET(makeRequest('?runId=' + archivedRun + '&limit=2'));
    const body = await response.json();
    const query = history.mock.calls[0][0];
    expect(response.status).toBe(200);
    expect(body.runId).toBe(archivedRun);
    expect(query.runId).toBe(archivedRun);
    expect(query.limit).toBe(2);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects invalid run identifiers before querying storage', async () => {
    const response = await GET(makeRequest('?runId=../other'));
    expect(response.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });
});

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

describe('GET /api/export', () => {
  beforeEach(() => {
    history.mockReset().mockResolvedValue([]);
    getSnapshot.mockReset().mockReturnValue({ runId: activeRun });
  });

  it('exports only the active simulator run by default', async () => {
    const response = await GET(new Request('http://localhost:9002/api/export'));
    expect(response.status).toBe(200);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ runId: activeRun }));
    expect(await response.text()).toContain('timestamp,run_id,rpm,');
  });

  it('exports explicitly selected archived runs', async () => {
    const response = await GET(
      new Request(`http://localhost:9002/api/export?runId=${archivedRun}`),
    );
    expect(response.status).toBe(200);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ runId: archivedRun }));
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects malformed run IDs before reading any data', async () => {
    const response = await GET(new Request('http://localhost:9002/api/export?runId=invalid'));
    expect(response.status).toBe(400);
    expect(history).not.toHaveBeenCalled();
  });
});

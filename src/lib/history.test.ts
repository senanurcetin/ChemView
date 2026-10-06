import { describe, expect, it } from 'vitest';
import { mergeHistory, toPoint } from './history';

const pt = (sec: number, value: number) =>
  toPoint(`2026-01-01T00:00:${String(sec).padStart(2, '0')}.000Z`, value);

describe('mergeHistory', () => {
  it('orders points by timestamp regardless of arrival order', () => {
    const merged = mergeHistory([pt(10, 1)], [pt(5, 2), pt(15, 3)]);
    expect(merged.map((p) => p.value)).toEqual([2, 1, 3]);
  });

  it('keeps one point per timestamp and lets the later one win', () => {
    const merged = mergeHistory([pt(10, 1)], [pt(10, 9)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe(9);
  });

  it('caps to the most recent points', () => {
    const many = Array.from({ length: 10 }, (_, i) => pt(i, i));
    const merged = mergeHistory([], many, 3);
    expect(merged.map((p) => p.value)).toEqual([7, 8, 9]);
  });

  it('does not mutate its inputs', () => {
    const prev = [pt(1, 1)];
    mergeHistory(prev, [pt(2, 2)]);
    expect(prev).toHaveLength(1);
  });

  it('preload arriving after live points merges cleanly', () => {
    const live = [pt(20, 5), pt(21, 6)];
    const merged = mergeHistory(live, [pt(10, 1), pt(15, 2), pt(20, 5)]);
    expect(merged.map((p) => p.ts.slice(17, 19))).toEqual(['10', '15', '20', '21']);
  });
});

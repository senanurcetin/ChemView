import { describe, expect, it, vi } from 'vitest';
import { Commentator } from './commentary';
import { Engine } from './engine';

const recommendation = {
  alertMessage: 'Investigate elevated temperature.',
  urgencyLevel: 'high' as const,
};

function pendingCommentary() {
  let finish!: (result: unknown) => void;
  const pending = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  const generate = vi.fn(() => pending);
  const commentator = new Commentator({ generate, timeoutMs: 30_000 });
  const engine = new Engine({ commentator, seed: 7, rng: () => 0.5 });

  engine.command({ type: 'set_mode', manual: true });
  engine.command({ type: 'set_temp_setpoint', value: 100 });
  engine.command({ type: 'set_heater', on: true });
  for (let i = 0; i < 400 && generate.mock.calls.length === 0; i++) {
    engine.tick();
  }
  expect(generate).toHaveBeenCalledTimes(1);
  expect(engine.getSnapshot().aiBusy).toBe(true);
  return { engine, generate, finish };
}

describe('Engine commentary delivery', () => {
  it('does not emit duplicate SSE snapshots on ordinary ticks without an AI request', async () => {
    const generate = vi.fn(async () => recommendation);
    const commentator = new Commentator({ generate });
    const engine = new Engine({ commentator, seed: 7, rng: () => 0.5 });
    const first = engine.tick();
    expect(first.seq).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.getSnapshot().seq).toBe(1);
    expect(generate).not.toHaveBeenCalled();
    expect(engine.getSnapshot().aiBusy).toBe(false);
  });

  it('delivers a valid AI comment when the original trigger remains current', async () => {
    const { engine, finish } = pendingCommentary();
    finish(recommendation);
    await vi.waitFor(() => {
      expect(engine.getSnapshot().aiBusy).toBe(false);
      expect(engine.getSnapshot().alerts[0]).toMatchObject({
        source: 'ai',
        urgency: 'high',
        message: recommendation.alertMessage,
        runId: engine.getSnapshot().runId,
      });
    });
    const seq = engine.getSnapshot().seq;
    engine.tick();
    await Promise.resolve();
    await Promise.resolve();
    // Repeat suppression must not cause phantom SSE emissions either.
    expect(engine.getSnapshot().seq).toBe(seq + 1);
  });

  it('discards a delayed reply after E-STOP and skips Gemini while latched', async () => {
    const { engine, generate, finish } = pendingCommentary();
    const epoch = engine.getSnapshot().estopEpoch;
    engine.command({ type: 'estop' });
    expect(engine.getSnapshot().estopEpoch).toBe(epoch + 1);
    finish(recommendation);
    await vi.waitFor(() => expect(engine.getSnapshot().aiBusy).toBe(false));
    expect(engine.getSnapshot().alerts.every((item) => item.source !== 'ai')).toBe(true);
    for (let i = 0; i < 10; i++) engine.tick();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().state.estopLatched).toBe(true);
  });

  it('discards a pending model reply after a control change', async () => {
    const { engine, finish } = pendingCommentary();
    const changed = engine.command({ type: 'set_heater', on: false });
    expect(changed.wrote).toBe(true);
    finish(recommendation);
    await vi.waitFor(() => expect(engine.getSnapshot().aiBusy).toBe(false));
    expect(engine.getSnapshot().alerts.every((item) => item.source !== 'ai')).toBe(true);
  });

  it('discards commentary if the trigger changes during analysis without operator input', async () => {
    const { engine, finish } = pendingCommentary();
    // Temperature keeps climbing while Gemini is busy, crossing the high
    // threshold and invalidating advice prepared for the near-limit state.
    for (let i = 0; i < 70; i++) engine.tick();
    expect(engine.getSnapshot().state.temp).toBeGreaterThan(80);
    // The deterministic safety rule must still raise an immediate high alarm.
    expect(engine.getSnapshot().alerts.some(
      (item) => item.source === 'rule' && item.urgency === 'high',
    )).toBe(true);
    finish(recommendation);
    await vi.waitFor(() => expect(engine.getSnapshot().aiBusy).toBe(false));
    expect(engine.getSnapshot().alerts.every((item) => item.source !== 'ai')).toBe(true);
  });
});

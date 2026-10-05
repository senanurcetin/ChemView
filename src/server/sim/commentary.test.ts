import { describe, expect, it, vi } from 'vitest';
import { Commentator, triggerKey } from './commentary';
import { Engine } from './engine';
import { initialState } from './state';
import type { SimState } from './types';

const hot: SimState = { ...initialState(), temp: 82 };
const ok = { alertMessage: 'Temperature climbing; start a cooling cycle.', urgencyLevel: 'high' };

describe('triggerKey', () => {
  it('stays quiet on nominal operation and fires near or past limits', () => {
    expect(triggerKey(initialState())).toBeNull();
    expect(triggerKey({ ...initialState(), temp: 74 })).toBe('temp-near');
    expect(triggerKey(hot)).toBe('temp-over');
    expect(triggerKey({ ...initialState(), ph: 5.8 })).toBe('ph-out');
    expect(triggerKey({ ...initialState(), ph: 6.2 })).toBe('ph-near');
  });
});

describe('Commentator', () => {
  const make = (generate: () => Promise<unknown>, extra = {}) => {
    let t = 1_000_000;
    const c = new Commentator({ generate, now: () => t, minIntervalMs: 30_000, repeatMs: 300_000, ...extra });
    return { c, advance: (ms: number) => (t += ms) };
  };

  it('returns validated commentary with history and shared thresholds', async () => {
    const generate = vi.fn().mockResolvedValue(ok);
    const { c } = make(generate);
    c.record(hot, '2026-01-01T00:00:00Z');
    await expect(c.maybeComment(hot)).resolves.toEqual({
      message: ok.alertMessage,
      urgency: 'high',
    });
    const input = generate.mock.calls[0][0];
    expect(input.temperatureThreshold).toBe(80);
    expect(input.pastStates).toHaveLength(1);
  });

  it('does not call the LLM when nothing is noteworthy', async () => {
    const generate = vi.fn();
    const { c } = make(generate);
    expect(await c.maybeComment(initialState())).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it('rate-limits calls and suppresses repeats of the same trigger', async () => {
    const generate = vi.fn().mockResolvedValue(ok);
    const { c, advance } = make(generate);
    await c.maybeComment(hot);
    advance(10_000);
    expect(await c.maybeComment(hot)).toBeNull(); // inside minInterval
    advance(60_000);
    expect(await c.maybeComment(hot)).toBeNull(); // same trigger inside repeat window
    advance(300_000);
    expect(await c.maybeComment(hot)).not.toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('falls back silently on errors, timeouts and invalid output', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await make(() => Promise.reject(new Error('boom'))).c.maybeComment(hot)).toBeNull();
    expect(await make(() => new Promise(() => {}), { timeoutMs: 20 }).c.maybeComment(hot)).toBeNull();
    expect(
      await make(() => Promise.resolve({ alertMessage: '', urgencyLevel: 'critical' })).c.maybeComment(hot),
    ).toBeNull();
  });
});

describe('Engine with commentator', () => {
  it('adds an AI alert next to the rule alert without blocking the tick', async () => {
    const generate = vi.fn().mockResolvedValue(ok);
    const commentator = new Commentator({ generate });
    const engine = new Engine({ seed: 1, commentator });
    // Force an over-temperature plant via the public command path.
    (engine as unknown as { state: SimState }).state = { ...hot };
    engine.tick();
    await vi.waitFor(() => {
      const sources = engine.getSnapshot().alerts.map((a) => a.source);
      expect(sources).toContain('ai');
      expect(sources).toContain('rule');
    });
    expect(engine.getSnapshot().aiBusy).toBe(false);
  });

  it('keeps rule alarms working when the LLM fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const commentator = new Commentator({ generate: () => Promise.reject(new Error('no key')) });
    const engine = new Engine({ seed: 1, commentator });
    (engine as unknown as { state: SimState }).state = { ...hot };
    engine.tick();
    await vi.waitFor(() => expect(engine.getSnapshot().aiBusy).toBe(false));
    const alerts = engine.getSnapshot().alerts;
    expect(alerts.map((a) => a.source)).toEqual(['rule']);
    expect(alerts[0].urgency).toBe('high');
  });
});

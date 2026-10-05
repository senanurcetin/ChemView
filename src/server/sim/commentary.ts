import { z } from 'zod';
import { THRESHOLDS } from './thresholds';
import type { Level, SimState } from './types';

/** Mirrors the Genkit flow's input so this module stays free of the genkit runtime. */
export interface CommentaryInput {
  mixingSpeedRpm: number;
  temperatureCelsius: number;
  pHLevel: number;
  valveStatus: string;
  pastStates: {
    mixingSpeedRpm: number;
    temperatureCelsius: number;
    pHLevel: number;
    valveStatus: string;
    timestamp: string;
  }[];
  temperatureThreshold: number;
  rpmThreshold: number;
  phUpperThreshold: number;
  phLowerThreshold: number;
}

const outputSchema = z.object({
  alertMessage: z.string().trim().min(1).max(400),
  urgencyLevel: z.enum(['low', 'medium', 'high']),
});

export type GenerateFn = (input: CommentaryInput) => Promise<unknown>;

export interface CommentatorOptions {
  generate: GenerateFn;
  now?: () => number;
  /** Minimum gap between any two LLM calls (cost / rate limit). */
  minIntervalMs?: number;
  /** The same trigger is not re-sent to the LLM within this window. */
  repeatMs?: number;
  timeoutMs?: number;
  historySize?: number;
}

/**
 * Why the LLM should look at the plant right now, or null if nothing is
 * noteworthy. Fires on or near a process limit, never on nominal operation.
 */
export function triggerKey(state: SimState): string | null {
  if (state.temp > THRESHOLDS.temperatureCelsius) return 'temp-over';
  if (state.temp > THRESHOLDS.temperatureCelsius * 0.9) return 'temp-near';
  if (state.ph < THRESHOLDS.phLower || state.ph > THRESHOLDS.phUpper) return 'ph-out';
  if (
    state.ph < THRESHOLDS.phLower + 0.3 ||
    state.ph > THRESHOLDS.phUpper - 0.3
  ) {
    return 'ph-near';
  }
  return null;
}

/**
 * Wraps the LLM alert flow with the safeguards needed to run it next to a
 * safety system: trigger gating, rate limiting, a timeout, schema validation
 * and silent fallback. Safety alarms never depend on this class.
 */
export class Commentator {
  private readonly generate: GenerateFn;
  private readonly now: () => number;
  private readonly minIntervalMs: number;
  private readonly repeatMs: number;
  private readonly timeoutMs: number;
  private readonly historySize: number;
  private history: CommentaryInput['pastStates'] = [];
  private lastCallAt = -Infinity;
  private lastByKey = new Map<string, number>();
  private inFlight = false;

  constructor(options: CommentatorOptions) {
    this.generate = options.generate;
    this.now = options.now ?? Date.now;
    this.minIntervalMs = options.minIntervalMs ?? 30_000;
    this.repeatMs = options.repeatMs ?? 300_000;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.historySize = options.historySize ?? 30;
  }

  get busy(): boolean {
    return this.inFlight;
  }

  /** Records one sample for the LLM's context window. */
  record(state: SimState, timestamp: string) {
    this.history = [
      ...this.history,
      {
        mixingSpeedRpm: Math.round(state.rpm),
        temperatureCelsius: Math.round(state.temp * 10) / 10,
        pHLevel: Math.round(state.ph * 100) / 100,
        valveStatus: state.valveOpen ? 'open' : 'closed',
        timestamp,
      },
    ].slice(-this.historySize);
  }

  /** Returns validated commentary, or null when skipped, throttled, failed or invalid. */
  async maybeComment(state: SimState): Promise<{ message: string; urgency: Level } | null> {
    const key = triggerKey(state);
    if (!key || this.inFlight) return null;

    const t = this.now();
    if (t - this.lastCallAt < this.minIntervalMs) return null;
    if (t - (this.lastByKey.get(key) ?? -Infinity) < this.repeatMs) return null;

    this.lastCallAt = t;
    this.lastByKey.set(key, t);
    this.inFlight = true;
    try {
      const raw = await withTimeout(
        this.generate({
          mixingSpeedRpm: Math.round(state.rpm),
          temperatureCelsius: Math.round(state.temp * 10) / 10,
          pHLevel: Math.round(state.ph * 100) / 100,
          valveStatus: state.valveOpen ? 'open' : 'closed',
          pastStates: this.history,
          temperatureThreshold: THRESHOLDS.temperatureCelsius,
          rpmThreshold: THRESHOLDS.rpmLow,
          phUpperThreshold: THRESHOLDS.phUpper,
          phLowerThreshold: THRESHOLDS.phLower,
        }),
        this.timeoutMs,
      );
      const parsed = outputSchema.safeParse(raw);
      if (!parsed.success) return null;
      return { message: parsed.data.alertMessage, urgency: parsed.data.urgencyLevel };
    } catch (error) {
      console.warn('[commentary] LLM alert skipped:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      this.inFlight = false;
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

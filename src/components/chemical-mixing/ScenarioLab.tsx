'use client';

import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { SCENARIO_IDS, SCENARIO_LIBRARY } from '@/server/sim/scenarios';
import type { ScenarioId } from '@/server/sim/types';

interface ScenarioLabProps {
  currentScenario: ScenarioId;
  currentSeed?: number;
  disabled: boolean;
  onLoad: (scenario: ScenarioId, seed: number) => Promise<void>;
}

/** A controlled laboratory reset; not part of a physical HMI command channel. */
export function ScenarioLab({ currentScenario, currentSeed, disabled, onLoad }: ScenarioLabProps) {
  const [scenario, setScenario] = useState<ScenarioId>('nominal');
  const [seed, setSeed] = useState(42);
  const [busy, setBusy] = useState(false);

  return (
    <section aria-label="Scenario laboratory" className="hmi-panel flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Experiment Laboratory
        </h2>
      </div>
      <p className="text-xs text-zinc-300">
        Synthetic experiments only. Each load starts a new isolated simulation session.
      </p>
      <div className="text-[11px] font-mono uppercase text-zinc-400" data-testid="active-scenario">
        ACTIVE: {SCENARIO_LIBRARY[currentScenario].label} · SEED {currentSeed ?? 'DEFAULT'}
      </div>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        Scenario
        <select
          aria-label="Experiment scenario"
          value={scenario}
          onChange={(event) => setScenario(event.target.value as ScenarioId)}
          disabled={disabled || busy}
          className="w-full rounded-md border border-white/20 bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          {SCENARIO_IDS.map((id) => (
            <option key={id} value={id}>{SCENARIO_LIBRARY[id].label}</option>
          ))}
        </select>
      </label>
      <p className="min-h-8 text-xs text-muted-foreground">
        {SCENARIO_LIBRARY[scenario].summary}
      </p>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        Random seed
        <input
          aria-label="Experiment seed"
          type="number"
          min={0}
          max={2147483647}
          step={1}
          disabled={disabled || busy}
          value={seed}
          onChange={(event) => setSeed(Number(event.target.value))}
          className="w-full rounded-md border border-white/20 bg-zinc-900 px-3 py-2 text-sm text-white"
        />
      </label>
      <button
        type="button"
        disabled={disabled || busy || !Number.isSafeInteger(seed) || seed < 0 || seed > 2147483647}
        onClick={async () => {
          setBusy(true);
          try {
            await onLoad(scenario, seed);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Loading experiment…' : 'Load synthetic experiment'}
      </button>
      <p className="text-[11px] text-amber-300">
        E-STOP must be reset before loading another experiment.
      </p>
    </section>
  );
}

'use client';

import { buildSyntheticBenchmarks } from '@/lib/science-benchmarks';

/**
 * Inspectable numerical-method demonstration. This deliberately does not
 * compare synthetic trajectories against plant measurements.
 */
const benchmarks = buildSyntheticBenchmarks();

export function ModelBenchmark() {
  return (
    <details className="hmi-panel min-w-0" data-testid="science-benchmark">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-primary">
        Model benchmark — numerical accuracy
      </summary>
      <p className="mt-3 text-xs text-zinc-300">
        Fixed synthetic reference experiments. The model is compared with exact
        continuous-time solutions under simplified conditions, not with plant
        measurements. Values and errors use the units shown.
      </p>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full min-w-[550px] text-left text-xs tabular-nums">
          <caption className="sr-only">
            Synthetic model trajectories compared with analytical references
          </caption>
          <thead>
            <tr className="border-b border-white/20 text-zinc-300">
              <th scope="col" className="px-2 py-2 font-semibold">
                Experiment
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Euler
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Analytical
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Abs. difference
              </th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((benchmark) => (
              <tr key={benchmark.id} className="border-b border-white/10 text-zinc-200">
                <th scope="row" className="px-2 py-2 font-normal">
                  {benchmark.label}
                  <span className="block text-[10px] text-zinc-400">
                    {benchmark.durationSeconds} s · {benchmark.unit}
                  </span>
                </th>
                <td className="px-2 py-2 text-right">
                  {benchmark.simulated.toFixed(3)}
                </td>
                <td className="px-2 py-2 text-right">
                  {benchmark.reference.toFixed(3)}
                </td>
                <td className="px-2 py-2 text-right text-primary">
                  {benchmark.absoluteError.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-amber-200">
        Numerical verification only. No calibration, uncertainty bound,
        measured process fidelity or physical safety claim is implied.
      </p>
    </details>
  );
}

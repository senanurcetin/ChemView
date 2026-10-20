# Scientific model and verification — synthetic reactor

## Status and falsifiable scope

ChemView is a **numerically motivated educational simulation**, not a calibrated digital replica of a reactor. It has no measured geometry, mixing-power curve, fluid composition, heat-transfer calibration, titration data or sensor uncertainty distribution. **Passing the tests verifies consistency between code and the selected synthetic equations, not agreement with physical plant data.**

The authoritative implementation is [`src/server/sim/physics.ts`](../src/server/sim/physics.ts). The engine, scenarios and thresholds are in [`src/server/sim/`](../src/server/sim/).

## Model and units

The server advances at a fixed 1-second tick; all parameters are **illustrative**. Default reference vessel: 1 m³ capacity, 1000 kg/m³ water-like density, specific heat 4.18 kJ/(kg·K), ambient 22 °C. State readbacks are in °C, RPM, pH and fill percentage. Synthetic vessel thermal mass is floored to 10% of nominal capacity, representing otherwise unmodelled vessel heat capacity and preventing division by zero as the level approaches zero.

| Subsystem | Discrete-time update / condition | Synthetic constants and limitations |
| --- | --- | --- |
| Energy | `m Cp (T[n+1] - T[n]) / Δt = Qheater - UA (T[n] - Ta)` (forward Euler) | Heater power 480 kW while enabled, liquid level >10% and temperature below the selected setpoint. UA = 2 kW/K. Lumped, spatially uniform fluid with no coil lag. |
| Discharge | `L[n+1] = max(0, L[n] - k sqrt(L[n]) Δt)` if valve open | `k = 0.25` percent-fill/√percent-fill/s. Square-root-head *surrogate*, not a calibrated valve Cv/orifice correlation. A closed valve conserves inventory exactly. |
| Energized motor | `rpm[n+1] = rpm[n] + (target - rpm[n]) (1 - exp(-Δt/τ))` | `τ = 9.5 s`, manual target or seeded automatic target of 450–500 RPM. Uses the exact first-order exponential step, not Euler. |
| Stopping | `rpm[n+1] = max(0, rpm[n] - 15 Δt)` | Simulated 15 RPM/s braking. No shaft torque, energy usage or impeller fluid loading model. |
| Chemical observation | `pH[n+1] = pH[n]` without reagent feed | No chemistry, mass transfer or acid/base equilibria. An injected pH scenario changes the initial synthetic observable; a separate sensor-bias scenario changes **measurement**, not chemical state. |

The simulated heater cannot be enabled at or below 10% fill; crossing that level switches it off and raises an event. E-STOP, mixer/valve interlocks and Modbus frames are **simulator controls only**, not physical protection or real fieldbus I/O.

## Reproducibility and experimental scenarios

A fixed integer random seed drives nominal network latency and automatic RPM jitter; it is **not** a measurement-noise distribution or cryptographic key. Loading a scenario generates a new simulator `runId` to isolate persisted samples, alerts and audit events. A latched E-STOP prevents experiment loading.

| Experiment | Initial condition / perturbation | Observable expected evidence |
| --- | --- | --- |
| Normal batch | Idle default aqueous surrogate | Reproducible nominal telemetry and isolated run UUID |
| Thermal excursion | Heater on, elevated initial temperature and 100 °C manual setpoint | Temperature eventually crosses 80 °C; high-severity rule alarm |
| Low inventory | 11% fill, valve open, heater on | Level crosses 10%; simulated heater switches off and level alarm triggers |
| pH excursion | Initial pH 8.4 (no dosing kinetics asserted) | Independent out-of-range-pH alarm |
| Sensor drift | Underlying chemical pH stays 7.00; measurement bias grows +0.04 pH/s, capped at +1.5 | Observed pH can exceed 8; lab shows unchanged synthetic reference vs instrument bias |
| Modbus timeout | Every fourth simulated read response omitted | Packet error counter rises without changing reactor physics or SSE transport |

Per-scenario tests in `src/server/sim/scenario-validation.test.ts` check reproducibility, physically admissible *display ranges*, inventory cutout, drift separation and dropped simulated responses. Engine tests also cover simultaneous faults and independent alarm edges.

## Numerical reference tests

Closed-vessel Euler cooling has the exact **discrete** reference

`T[n] = Ta + (T0 - Ta) (1 - UA Δt / (m Cp))^n`.

For constant-power heating below the thermostat target, let `Teq = Ta + Q/UA`:

`T[n] = Teq + (T0 - Teq) (1 - UA Δt/(m Cp))^n`.

The unit tests compare code against those discrete recurrences within floating-point tolerance. This tests **implementation correctness under the chosen discretization**, not the error relative to the exact continuous system.

### Independent continuous-time HMI benchmark

The expandable **Model benchmark — numerical accuracy** panel computes four fixed reference experiments in [`src/lib/science-benchmarks.ts`](../src/lib/science-benchmarks.ts) and displays simulated final value, mathematical reference and **absolute error in the stated unit**:

| Fixed experiment | Analytical continuous-time reference | Automated bound for this case |
| --- | --- | --- |
| Sealed cooling, 68 °C initial, 65% fill, 120 s | `Ta + (T0-Ta) exp[-UA t/(m Cp)]` | Difference <0.01 °C |
| Constant-power warming, 24.5 °C initial, 65% fill, 70 s | `Teq + (T0-Teq) exp[-UA t/(m Cp)]` | Difference <0.01 °C |
| Free discharge, 65% initial, 40 s | `max(0, sqrt(L0) - k t/2)^2` | Difference between 0.3 and 0.5 percentage points |
| Manual 800 RPM motor step, 60 s | `target (1-exp[-t/τ])` | Difference <1e-8 RPM, because the implemented step is already exponential |

The comparisons use fixed synthetic conditions, not live-plant data. Neither absolute error values nor tolerances constitute confidence intervals, fitted residuals, global integration bounds or proof that a real mixer heats, drains or spins this way. The primary acceptance tests are in [`src/lib/science-benchmarks.test.ts`](../src/lib/science-benchmarks.test.ts), with browser presentation checks in [`e2e/smoke.spec.ts`](../e2e/smoke.spec.ts).

## Known limits and potential future research

- No reagent dosing, concentration balances, titration chemistry, reaction kinetics, viscosity/density dependence, hydrodynamics, heat-of-reaction or turbulent mixing effectiveness.
- The hydraulic coefficient is not derived from measured head, nozzle diameter, discharge pressure or valve Cv.
- The uniform-temperature, ideal thermostat and floor-on-thermal-mass assumptions are intentionally simplified; they do not model gradients, heater transfer lag or vessel material temperature.
- Sensor drift is deliberately generated, not sampled from calibrated sensor noise or drift statistics.
- Simulated E-STOP and deterministic protocol frames do **not** substantiate IEC 61508, IEC 61511, functional-safety performance or integration with actual PLC/Modbus equipment.
- Gemini advisory wording has no physical, numerical or protective authority.

A physical validation study would require measured temperatures, mass/level/flow, agitator response and composition; separately estimated parameters; residual diagnostics; uncertainty quantification; reference instrumentation and independent holdout experiments. These are **outside the current demo scope**; there is no invented accuracy claim without them.

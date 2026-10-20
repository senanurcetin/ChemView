# Scientific model V2 — assumptions and verification

ChemView is a **synthetic, dimensionally motivated reactor demonstration**, not a calibrated industrial digital twin. All constants are illustrative. No experimental dataset, parameter fitting, identification uncertainty, or validation against physical measurements is claimed.

## State and integration

The numerical solver uses a fixed one-second step, with a volume-capacity surrogate of 1 m³ aqueous liquid:

- Energy: `m Cp ΔT/Δt = Qheater − UA(T − Tambient)`, where `m = ρ V`, `V = capacity × fill/100` and the numerical thermal mass is floored at 10% capacity to avoid division by zero.
- Mixing: `rpm(t+Δt) = target + (rpm(t) − target) exp(−Δt/τ)` while energized; shutdown uses a simple 15 RPM/s braking surrogate. Neither power draw nor turbulent mixing quality is inferred.
- Discharge: `Δfill = −k sqrt(fill) Δt` when the valve is open (Torricelli-like surrogate). It is not an orifice equation calibrated from geometry or fluid viscosity.
- pH: fixed without reagent feed. The pH-excursion experiment changes the initial synthetic observable; sensor-drift experiments add a *measurement bias*, not a chemical reaction.
- Heater: only contributes positive power if fill exceeds 10%, heater is enabled and the synthetic temperature is below its commanded setpoint. A separate server interlock prevents enabling the heater at or below 10% fill; crossing the boundary while heating disables it.

Model parameters are in `src/server/sim/physics.ts` and alarm limits in `src/server/sim/thresholds.ts`. All engineering units, known limitations, and model equations must remain consistent with that source.

## Evidence and acceptance

The following scientific claims have automated checks:

| Claim | Independent check |
| --- | --- |
| Same initial condition and seed reproduces the same trajectory | Repeated full-run experiment for each named scenario |
| Passive thermal response follows the discrete Newton cooling solution | `engine.test.ts` analytical solution test |
| Constant-power warm-up follows the expected Euler recurrence below the setpoint | `engine.test.ts` heating solution |
| Vessel inventory is conserved with closed valve and falls monotonically while draining | `engine.test.ts` inventory test |
| Heater trips for low inventory | `scenario-validation.test.ts` cutout scenario |
| Synthetic pH bias is distinguishable from unaltered chemical pH | `scenario-validation.test.ts` drift experiment |
| Polling faults increment protocol error counters, not physical state | `scenario-validation.test.ts` communication scenario |
| A simultaneously hot, low-fill, out-of-range-pH vessel generates multiple rule alerts | `engine.test.ts` independent alarm checks |

All values are synthetic; passing these tests verifies **consistency with the documented equations** only. It does not validate correspondence with an actual reactor.

## Lab scenarios

The experiment laboratory provides nominal, thermal excursion, low inventory, pH excursion, sensor drift, and Modbus timeout demonstrations. Experiments are isolated by `runId` and reset the seeded pseudo-random sequence; E-STOP must be cleared before loading a new scenario. The AI narrative is optional and never substitutes for deterministic alarms. No hardware or plant network is accessed.

## Out-of-scope engineering

A true chemical process simulator would need inlet/outlet compositions, mass-transfer coefficients, reagent kinetics and reaction enthalpies, hydrodynamics, measured sensor accuracy, model calibration, uncertainty propagation and independent empirical validation. Industrial implementation would additionally require physical safety instrumentation and certification. These are **not** asserted by this demo, regardless of test pass counts.

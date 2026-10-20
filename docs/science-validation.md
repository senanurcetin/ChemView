# ChemView scientific verification — synthetic reactor V2

## Scope and falsifiable claims

ChemView is a **physically inspired numerical teaching model**, not a
calibrated digital replica of a chemical plant. Parameters are synthetic;
no measured mixing power curve, thermal transfer coefficient, pH titration
curve, sensor error distribution or tank geometry has been supplied.
The simulation uses a one-second explicit Euler time step.

## Equations and reproducibility

For a 1 m³ water-like batch, mass m = 1000 × level/100 kg and
heat capacity Cp = 4.18 kJ/(kg K). A minimum 10% effective heat capacity
surrogates the unmodelled vessel mass.

1. **Thermal:** m Cp (Tₙ₊₁ − Tₙ)/Δt = Q − UA(Tₙ − 22 °C);
   Q = 480 kW below target while heater enabled; UA = 2 kW/K.
2. **Hydraulic:** Lₙ₊₁ = max(0,Lₙ − 0.25 √Lₙ Δt), with L in percent.
   A closed valve conserves L exactly.
3. **Motor:** ωₙ₊₁ = ωₙ + (ω* − ωₙ)(1 − exp(−Δt/9.5 s)).
   Stopping brakes at 15 RPM/s. Initial auto target is 450–500 RPM.
4. **Chemical observability:** pH is held constant without reagent addition.
   The out-of-range pH scenario injects an initial observation; there is no
   claimed acid-base equilibrium or kinetic model.

A fixed integer seed reproduces stochastic auto-RPM target variations and
nominal network latency. Each experiment rotates `runId` and starts an
independent history; the seed is **not** a cryptographic key.

## Test reference solutions

For a closed, unheated tank, `f = 1 − UA Δt/(m Cp)`:

`Tₙ = Tₐ + (T₀ − Tₐ) fⁿ`.

For constant heater duty before the thermostat target:

`Tₙ = T_eq + (T₀ − T_eq) fⁿ`, with `T_eq = Tₐ + Q/UA`.

Unit tests compare the Euler implementation to both closed-form **discrete**
references within floating-point tolerance; they also check level monotonicity,
the exact closed-valve inventory invariant, pH non-drift without reagent dosing,
the 10% heater interlock, multi-fault alarms, seeded repeatability and
synthetic Modbus polling timeouts. This is verification of code against the
model equations, **not validation of the equations against experimental data**.

## Scenario acceptance matrix

| Experiment        | Expected evidence                                                                 |
| ----------------- | --------------------------------------------------------------------------------- |
| Normal batch      | Initial idle state, nominal deterministic alert, new run UUID                     |
| Thermal excursion | With heater enabled, temperature exceeds 80 °C; high rule alarm                   |
| Low inventory     | Level drops through 10%, heater cuts off, medium level alarm                      |
| pH excursion      | pH above 8; independent medium rule alarm                                         |
| Modbus timeout    | Every fourth simulated RX omitted, error counter increases; SSE remains connected |

## Known scientific limitations

- No reagent feed, mass transfer, titration chemistry, tank mixing efficiency,
  evaporation, density variation or viscosity correlations.
- Hydraulic coefficient is a simplified square-root-head proxy, not derived
  from a valve Cv, measured head, nozzle diameter or discharge pressure.
- Temperature is spatially uniform, with ideal thermostat and no heater coil
  lag, temperature measurement lag, sensor calibration, or thermal gradients.
- E-STOP is an **in-process simulation**, never a physical protective device.
- Generated Modbus frames represent protocol formatting, not actual network IO.
- The Gemini flow is optional advisory text and has no authority over physics.

## Future scientific validation (requires field or laboratory data)

Independent measurements of temperature, volume, agitation, flows and
fluid composition would be required for parameter fitting, uncertainty
quantification, residual analysis and uncertainty bounds. These activities
are explicitly outside the current no-hardware demonstration.

### Sensor bias experiment

A deterministic +0.04 pH/s instrument bias grows to a maximum +1.5 while the
underlying chemical pH remains exactly 7.00. Only measured pH triggers rule
alarms and enters Modbus/SSE/persistent samples; true pH is shown exclusively
in the laboratory as synthetic ground truth. A numerical test verifies that
the measurement can cross pH 8 without an actual chemical composition change.

## Continuous-time numerical benchmark (HMI)

The expandable **Model benchmark — numerical accuracy** panel runs four small
fixed, offline reference experiments directly from the simulation equations.
The panel is **not** a live-model-fit metric. It reports the simulated final
observable, its mathematically independent continuous-time solution, and
their absolute difference in the displayed engineering units.

- **Sealed cooling, 120 s, initially 68 °C:** exact Newton cooling,
  T(t) = Ta + (T0 - Ta) exp[-UA t/(m Cp)] at constant 65% fill.
- **Sealed heating, 70 s, initially 24.5 °C:** exact constant-power heating,
  T(t) = Teq + (T0 - Teq) exp[-UA t/(m Cp)],
  Teq = Ta + Q/UA. Heater stays below the 100 °C setpoint during this case.
- **Free draining, 40 s, initially 65% fill:** continuous solution
  L(t) = max(0, sqrt(L0) - k t/2)^2; compare with the one-second
  explicit-Euler inventory update.
- **Manual motor step, 60 s, commanded 800 RPM:** exact first-order solution
  rpm(t) = target(1 - exp[-t/tau]); unlike the fluid updates, the
  sampled motor equation itself uses the exponential, so its error is
  expected to be at floating-point scale.

Acceptance tests in `src/lib/science-benchmarks.test.ts` assert finite
deterministic results, thermal absolute differences below 0.01 °C,
draining absolute difference between 0.3 and 0.5 percentage points,
and motor difference below 1e-8 RPM. The tolerances describe these
**specific reference conditions**, not a global integration error bound.
No field observations, confidence intervals, fitted coefficients, or
validated reactor safety properties are provided.

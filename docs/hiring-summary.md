# ChemView — engineering reviewer brief

**Focus:** Industrial HMI engineering, deterministic process simulation, numerical verification, operator feedback and synthetic telemetry provenance. **Status:** CI-verified _portfolio demonstration_, not a real connected reactor or commercially deployed process controller.

## Inspectable evidence

| Reviewer question                                        | Where to inspect                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the implemented interface real?                       | [Current expanded NEXUS HMI](assets/chemview-dashboard.png), [P&ID/model benchmark evidence](assets/chemview-engineering-evidence.png), and [workstation captures](design-qa.md)                                                             |
| What process model is demonstrated?                      | [Physical assumptions, analytical benchmarks and reproducible experiments](science-validation.md)                                                                |
| Is simulated command admission safe by design?           | [Server-side interlocks and E-STOP ordering](architecture.md) plus checked-in Vitest/Playwright tests                                                            |
| Can it run offline without an LLM or persistent backend? | [Local setup](../README.md#run-locally); rule alarms and in-memory storage                                                                                       |
| Can parallel operators overwrite one another silently?   | [Server-side concurrency preconditions](architecture.md#concurrent-setpoint-admission)                                                                           |
| Are session histories isolated?                          | [Telemetry and event provenance](architecture.md#telemetry-persistence-and-legacy-records)                                                                       |
| Is the latest dependency review perfect?                 | No. [Security policy](../SECURITY.md) and [open issue #16](https://github.com/senanurcetin/ChemView/issues/16) describe remaining advisory/exposure constraints. |

## Engineering decisions

- Server, not browser components, is authoritative for vessel state, physics, alarms and interlocks.
- Modbus frames are deterministic protocol simulations; no actual network Modbus TCP exchange occurs.
- SSE snapshots, histories and logged alerts/audits carry session UUIDs; malformed, stale or cross-run events are rejected from operator display.
- Ordinary commands use optimistic preconditions; simulated E-STOP is unconditional, latched and exempt from throttling. No SIL rating is claimed.
- Optional Gemini explanations are advisory and cannot gate rule alarms.
- A fixed-seed lab and four independent analytical references distinguish **code verification** from empirical **model validation**.

## Visual and scientific evidence

The current Playwright screenshot test explicitly opens both the simulated P&ID and numerical benchmark panels before capturing 1366, 1440 and 1920-pixel full-page views. Earlier screenshots did not show these expanded features. Numerical model-reference comparisons are synthetic verification, not measured reactor fidelity.

## Verified CI evidence

The scientific benchmark [PR #17](https://github.com/senanurcetin/ChemView/pull/17) and dependency-hardening [PR #18](https://github.com/senanurcetin/ChemView/pull/18) were merged after successful checks. [Run 39515611615](https://github.com/senanurcetin/ChemView/actions/runs/39515611615) passed GitHub Actions build/quality, Firestore emulator and Playwright; matching CircleCI node-quality also passed. These are **historical commit results**, not an assertion about every future edit. Review [integration acceptance](integration-verification.md) for current-commit verification rules.

## Boundaries

Synthetic equations, no calibration dataset, no real PLC or fieldbus gateway, no safety instrumented system and no public uncontrolled write-enabled demo. User authentication, operational networking, real material balances and field safety engineering are not demonstrated. The project intentionally remains a **noncommercial research/portfolio example**.

[Repository guide](../README.md) · [Architecture](architecture.md) · [Scientific validation](science-validation.md) · [Security policy](../SECURITY.md)

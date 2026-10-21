# ChemView change history

This log records meaningful engineering-demo milestones, **not commercial product releases**. Git history and merged PRs remain the detailed audit trail.

## 2026-10-21 — Final repository and dependency maintenance

- Rechecked the 125-file repository structure and reviewed all 12 Markdown documents; no duplicate or broken local documentation links remain.
- Moved build-only `tailwindcss-animate` out of production dependencies, refreshed compatible transitive lockfile packages and updated Vitest/Node 22 development tooling, subject to passing checks ([PR #22](https://github.com/senanurcetin/ChemView/pull/22)).
- Consolidated repeated physical equations under [scientific validation](docs/science-validation.md); updated the architecture's Java 21 test prerequisite.
- Strengthened documentation verification with SHA-256 fingerprints of the four CI-provenance Playwright images.
- Residual package advisories remain under [security issue #16](https://github.com/senanurcetin/ChemView/issues/16); an audit node count is not proof of an exploitable path.

## 2026-10-21 — NEXUS 2.0 industrial HMI design

- Applied the approved Drive `Logo/NEXUS_Identity_2_0` identity to the **existing** ChemView frontend without replacing the official logo ([PR #21](https://github.com/senanurcetin/ChemView/pull/21)).
- Reworked the workstation, reactor, P&ID, operator panels, charts, event history, laboratory and numerical-verification area using the approved midnight, depth, cyan, blue, lavender, violet and silver palette.
- Kept red E-STOP/fault and orange heater/thermal warning semantics separate from the brand gradients; no simulated safety behavior changed.
- Added exact design-token and E-STOP Playwright checks and refreshed four images from real responsive-browser runs.

## 2026-10-21 — Scientific benchmark and dependency hardening

- Added inspectable continuous-time reference comparisons for passive cooling, constant-power heating, free discharge and manual motor response in the NEXUS HMI ([PR #17](https://github.com/senanurcetin/ChemView/pull/17)).
- Tested numerical differences with reproducible unit tests and an accessible Playwright HMI check. This is model verification, not process-data validation.
- Pinned patched `handlebars@4.7.10` and `websocket-driver@0.7.5` transitively; regenerated the lockfile with npm ([PR #18](https://github.com/senanurcetin/ChemView/pull/18)).
- Patch-audit evidence: zero critical _production_ package advisories; remaining high/moderate production and critical development-tool findings are tracked in [security issue #16](https://github.com/senanurcetin/ChemView/issues/16). This is not an assurance of zero vulnerabilities.
- Consolidated repository documentation and refreshed workstation captures from successful Playwright runs (see [design QA](docs/design-qa.md)).

## 2026-10-18–20 — Reproducible synthetic reactor and operator HMI

- Added seeded baseline, heating, drainage, out-of-range pH, sensor-bias and simulated Modbus timeout scenarios, plus synthetic physical model equations and acceptance tests.
- Added responsive NEXUS-branded HMI, simulated instrumentation diagram, telemetry staleness indicator, run-scoped alarm/audit history and visual capture checks.
- Expanded deterministic interlocks, E-STOP ordering, concurrent-control preconditions, delayed-response suppression and cross-session SSE validation.

## Earlier foundation — Server-side mixing digital twin prototype

- Moved process state from browser into the server engine with deterministic simulated Modbus registers, SSE telemetry, commands and alarm rules.
- Added optional Genkit/Gemini alarm commentary, in-memory/Firestore storage, CSV exports and basic CI quality gates.
- Fixed missing toast mounting and early dashboard/chart reliability issues.

Previous version labels such as `1.1.0` described prototype milestones; they are not evidence of a marketed 1.1 release.

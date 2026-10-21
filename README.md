# ChemView — Chemical Mixing HMI & Synthetic Digital Twin

**An industrial automation and numerical-methods portfolio demonstration by NEXUS.** ChemView models one fictional chemical mixing vessel. It is **not a connected plant, a calibrated process digital twin, a commercial product, or a safety-rated controller**.

![ChemView HMI by NEXUS — current mixing vessel, expanded P&ID, model benchmarks and operator controls](docs/assets/chemview-dashboard.png)

**[Engineering review](docs/hiring-summary.md)** · **[Architecture](docs/architecture.md)** · **[Scientific validation](docs/science-validation.md)** · **[HMI screenshots and design checks](docs/design-qa.md)** · **[CI / integration acceptance](docs/integration-verification.md)** · **[Security and limitations](SECURITY.md)**

## What the demonstration covers

- **Server-owned process simulation:** a one-second mixing-vessel engine with synthetic energy balance, tank discharge, motor response and pH observation. It uses deterministic seeded experiments, not laboratory data.
- **Operator-focused HMI:** NEXUS-branded reactor visualization, simulated P&ID, time-series plots, Modbus traffic traces, network diagnostics, telemetry-age indicator and context-aware command feedback.
- **Independent safety-rule simulation:** mixer/discharge interlocks, minimum heater level, unconditional latched E-STOP, authenticated reset where configured and deterministic alarms. None of these qualifies as a physical protective system.
- **Reliable simulated telemetry:** validated SSE messages, session UUIDs, duplicate/out-of-order rejection, last-known-value warnings and per-session telemetry, alarm and audit histories.
- **Scientific evaluation:** six synthetic experiments and an expandable benchmark comparing four computed observables with continuous-time analytical reference solutions. Test agreement verifies code/model consistency—not accuracy against real equipment.
- **Optional explanations:** Gemini/Genkit can comment on deterministic alarms but cannot make, delay or veto interlock decisions.
- **Reproducible testing:** TypeScript, ESLint, Prettier, Vitest, Firestore emulator, Playwright and CircleCI. The default demo runs without an AI key or Firestore credentials.

## Demonstration gallery

| Workstation width | Screenshot                                                                                        | Purpose                                          |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1366 px           | [Compact workstation](docs/assets/chemview-1366x768.png)                                          | Panel visibility and vertical scrolling          |
| 1440 px           | [Primary portfolio screenshot](docs/assets/chemview-dashboard.png)                                | Balanced process/control workspace               |
| 1440 px           | [Focused instrumentation and numerical validation](docs/assets/chemview-engineering-evidence.png) | Both expanded engineering panels in one viewport |
| 1920 px           | [Wide workstation](docs/assets/chemview-1920x1080.png)                                            | Expanded reactor graphics and event history      |

These are actual Playwright screenshots of a **simulated** running process, not design mockups. The workstation captures are full-page; the engineering-evidence image is a focused 1440×900 viewport. The evidence captures deliberately expand the P&ID and model-benchmark sections; numerical comparisons verify the synthetic equations and are not experimental plant calibration. See [capture provenance and viewport checks](docs/design-qa.md).

![Current synthetic P&ID and analytical model-reference evidence](docs/assets/chemview-engineering-evidence.png)

## Run locally

Requires **Node.js 22**, npm and optionally Java 21 for the Firestore emulator. No physical plant or Modbus hardware is needed.

```bash
npm ci
npm run dev
```

Open `http://localhost:9002`. The simulator starts with bounded in-memory storage and deterministic alarm rules. You may configure optional server-only credentials in a local `.env` file using [.env.example](.env.example) as reference. Never embed secrets in browser code.

**Quality checks**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run docs:check
npm test
npm run build
npm run test:firestore  # requires Java / Firebase emulator
npm run test:e2e       # requires Playwright Chromium
```

## API and operator constraints

| Endpoint                               | Demonstration contract                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/stream`                      | Validated server-sent synthetic snapshots                                |
| `POST /api/command`                    | Server-validated operator commands; E-STOP always exempt from throttling |
| `POST /api/scenario`                   | Load a named seeded laboratory scenario; never bypasses E-STOP           |
| `GET /api/history` / `GET /api/export` | Current-run telemetry or explicitly selected archived run; CSV export    |
| `GET /api/alerts` / `GET /api/audit`   | Read-only current-run or archived synthetic event history                |

The shared simulator permits up to **60 ordinary commands per 10 seconds**. It rejects stale browser preconditions when another operator changes a control. A validated SSE sample must advance before the browser marks telemetry live; after 6 seconds without advancing data it shows **stale**. Archived event records are observational, not certified audit evidence.

**Do not expose an unrestricted write-enabled instance to the internet.** Without `OPERATOR_TOKEN`, command/scenario endpoints permit unauthenticated simulated writes; with that token set the stock browser cannot submit protected commands. See [SECURITY.md](SECURITY.md) for the exact boundary. There is no real PLC/Modbus-TCP connection and no SIL certification.

## Repository map

```text
src/app/                     Next.js UI, API handlers and tests
src/components/chemical-mixing/
                             NEXUS HMI and numerical benchmark panel
src/hooks/, src/lib/         Telemetry validation, charts, benchmark helpers
src/server/sim/              Physics, protocol simulation, alarm/interlock engine
src/server/                  Storage, authentication and rate limiting
src/ai/                      Optional advisory Gemini flow
e2e/                         Playwright interface/regression checks
docs/                        Architecture, scientific, design and QA evidence
docs/assets/                 Versioned portfolio screenshots
public/                      NEXUS identity asset
.github/workflows/           CI (no production deployment)
```

For methodology and constraints use the canonical documents linked at the top. Historical changes are summarized in [CHANGELOG.md](CHANGELOG.md); contributing guidance is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Boundaries and license

ChemView is strictly a **noncommercial research/portfolio demo**. No subscriptions, customer environments, real plant integration or production operations are part of the project. Scientific values are illustrative, not calibrated; physical safety measures require independent engineering verification.

Source code: MIT — see [LICENSE](LICENSE).

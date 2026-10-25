# ChemView — Chemical Mixing HMI & Synthetic Digital Twin

**An industrial automation and numerical-methods portfolio demonstration using the approved NEXUS 2.0 visual identity.** ChemView models one fictional chemical mixing vessel. It is **not a connected plant, a calibrated process digital twin, a commercial product, or a safety-rated controller**.

![ChemView HMI by NEXUS — current mixing vessel, expanded P&ID, model benchmarks and operator controls](docs/assets/chemview-dashboard.png)

**[Architecture](docs/architecture.md)** · **[Scientific validation](docs/science-validation.md)** · **[NEXUS 2.0 design and visual QA](docs/design-qa.md)** · **[Verification and CI evidence](docs/integration-verification.md)** · **[Security and limitations](SECURITY.md)**

## What the demonstration covers

- **Server-owned process simulation:** a one-second mixing-vessel engine with synthetic energy balance, tank discharge, motor response and pH observation. It uses deterministic seeded experiments, not laboratory data.
- **Operator-focused NEXUS 2.0 HMI:** official NEXUS logo and approved midnight/cyan/blue/lavender visual system, simulated P&ID, time-series plots, Modbus traffic traces, diagnostics and context-aware controls. E-STOP red and thermal-warning orange remain semantic rather than decorative brand colors.
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

## Repository structure

```text
src/
  app/                         Next.js pages, REST/SSE routes and API tests
  components/
    chemical-mixing/           NEXUS 2.0 HMI and engineering instrumentation
    ui/                        Shared accessible UI components
  hooks/                       Telemetry and operator-control synchronization
  lib/                         Data validation, scientific benchmarks, utilities
  server/
    sim/                       Synthetic physics, interlocks, Modbus, scenarios
  ai/                          Optional, non-authoritative Gemini commentary
e2e/                           Playwright operator and visual regression tests
docs/
  architecture.md              Runtime architecture, interfaces and invariants
  science-validation.md        Only source for equations and scientific limits
  design-qa.md                 NEXUS identity, image sources and UI validation
  integration-verification.md  Acceptance criteria, CI and evidence provenance
  assets/                      Four reviewed, SHA-256-pinned HMI screenshots
public/                         Official NEXUS logo
scripts/                        Documentation/image-integrity automation
.github/                        CI and opt-in Copilot engineering tools
.circleci/                       Independent read-only quality checks
.idx/                           Optional Firebase Studio editor configuration
```

**Documentation ownership:** This README is the project entry point and reviewer overview. The four `docs/` Markdown files each own a separate engineering subject; [CONTRIBUTING.md](CONTRIBUTING.md) defines the contribution workflow, [SECURITY.md](SECURITY.md) documents exposure and unresolved advisories, and [CHANGELOG.md](CHANGELOG.md) preserves chronological milestones. Avoid parallel specifications and date-stamped status reports that become stale.

The Firebase/App Hosting manifests and editor configuration are optional development infrastructure, not evidence of a production deployment. Review simulation behavior through the tests and the source of truth above, not through marketing claims.

## Boundaries and license

ChemView is strictly a **noncommercial research/portfolio demo**. No subscriptions, customer environments, real plant integration or production operations are part of the project. Scientific values are illustrative, not calibrated; physical safety measures require independent engineering verification.

Source code: MIT — see [LICENSE](LICENSE).

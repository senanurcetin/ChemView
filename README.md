# ChemView — Industrial HMI & Mixing-Process Digital Twin

**Reviewer quick brief:** [Project scope, inspectable evidence and limitations](docs/hiring-summary.md).

[![Repository](https://img.shields.io/badge/source-GitHub-181717?logo=github)](https://github.com/senanurcetin/ChemView)

**Next.js · TypeScript · Simulated Modbus · Safety interlocks · SSE · Optional Gemini**

ChemView is an industrial HMI and digital twin **prototype** for a chemical mixing process. It demonstrates how modern web tooling can model telemetry, operator controls, communication traces, and safety interlocks in a single interface.

![ChemView HMI while mixing: heater on, discharge valve locked by the interlock](docs/assets/chemview-dashboard.png)

Portfolio case study: [senanur-cetin.vercel.app/projects/chemview](https://senanur-cetin.vercel.app/projects/chemview)

## What it does

- Runs the mixing-tank simulation **on the server** (physics, safety interlocks, simulated Modbus register map) and streams a snapshot to the browser every second over Server-Sent Events.
- Visualizes operator controls, trends, and the Modbus wire log in one HMI layout.
- Enforces safety interlocks server-side: the mixer cannot start with the discharge valve open, the valve cannot move while the rotor spins, and E-STOP always wins, immediately disables mixer/heater, and remains latched until an explicit reset; E-STOP is never rate limited.
- Raises deterministic rule alarms immediately, and layers optional Gemini (Genkit) commentary on top when `GEMINI_API_KEY` is set. The LLM never gates a safety decision; it is rate limited, time boxed, schema validated and falls back silently.
- Persists telemetry, alerts and the audit trail (Firestore when configured, bounded in-memory otherwise) and serves `/api/history` and a CSV export at `/api/export`.

There is still no real PLC: the Modbus layer is a deterministic simulation, not a network client.

### Emergency-stop reset (simulator contract)

The HMI exposes **RESET E-STOP** while the simulated stop is latched. Reset clears the latch only; it never starts the mixer or enables the heater. The server rejects other commands during the latch, including setpoint and valve changes. A fresh server process initializes a new simulator state: this is **not** a hardware or persistent emergency-stop circuit.

When `OPERATOR_TOKEN` is configured, `reset_estop` is an ordinary protected operator command, while `estop` remains callable without a token. The browser HMI does not possess or store the bearer token: a reset attempted from that HMI will receive HTTP 401 in token-protected deployments. An authorized operator integration must send the token server-to-server or use an appropriately secured operator channel; do not embed the token in client JavaScript.

Offline tests cover the latch and authentication contract. This simulation is **not PLC/SIL certified**.

## Stack

- Next.js 15 (App Router, Route Handlers) and React 19
- TypeScript, Tailwind CSS, shadcn/ui, Recharts
- Genkit and Gemini for AI-assisted alert commentary
- Firebase Admin (Firestore) for optional persistence
- Vitest for unit tests, Playwright for end-to-end smoke tests

## Local setup

```bash
npm install
cp .env.example .env   # optional: GEMINI_API_KEY and FIREBASE_* values
npm run dev
```

The app runs on `http://localhost:9002`. Without any keys it works fully, using rule alarms and the in-memory store.

Quality checks (also run in CI): `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.
Extra suites: `npm run test:firestore` (Store contract tests against the Firestore emulator, needs Java) and `npm run test:e2e` (Playwright smoke tests; set `PLAYWRIGHT_CHROMIUM_PATH` to use a preinstalled Chromium, otherwise run `npx playwright install chromium` once).

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Command admission policy

The simulator models one shared process. Ordinary operator commands have a shared budget of **60 commands per 10 seconds**; client-provided proxy/IP headers cannot reset that budget. E-STOP always bypasses the limit, while E-STOP reset requires the usual authorization and quota. This protects the demo's shared command loop from simple identity rotation, but a busy client can still exhaust the ordinary-command quota for other users. It is not production-grade per-operator admission control.

## Telemetry session provenance

Each simulator process has a unique `runId`. New telemetry samples are stored by run (in memory or under Firestore `sim_runs/<runId>/telemetry`) so identical timestamps from separate process sessions cannot overwrite each other. `/api/history` and `/api/export` default to the current run; use a previously recorded UUID via `?runId=<uuid>` to inspect an archived run. CSV includes a `run_id` column. The browser waits for a valid SSE snapshot before loading history for that exact run.

Legacy untagged Firestore records in `telemetry` are **not deleted or migrated**. They remain available through the Store's unscoped history API but are excluded from the new run-scoped dashboard and HTTP defaults. This is a simulation history contract, not certified plant historian behavior.

## HMI telemetry freshness

The operator display shows the current simulator session and the age of the latest validated telemetry snapshot. If an SSE connection stays open but delivers no advancing samples for 6 seconds, the header switches to `Gateway Stale` and a visible warning labels the displayed process readings as **last known values**. A new accepted sample clears the stale status; reconnecting the transport alone does not imply current data. An engine-session change is shown explicitly. These indicators are for this simulated HMI only and must not be mistaken for field-device or safety-system health.

## Shared-process operator readback

The setpoint sliders follow server-owned values, including accepted writes from another browser. When an operator drags a manual-mode slider, the HMI displays a draft and sends one command on release; an unconfirmed setpoint is labeled `(PENDING)` until the SSE stream echoes its applied value. Denied or unconfirmed drafts revert to server readback. Manual setpoints are disabled if telemetry is stale/disconnected or E-STOP is latched, while the E-STOP action itself stays available.

## Scope and operational boundaries

The process, Modbus register map, interlocks, and telemetry are simulated. No physical PLC, fieldbus gateway, safety-rated controller, or plant equipment is connected. This is an engineering demonstration, **not a certified safety system**. Production use would require independent industrial safety assessment, hardened access controls and validated equipment integration.

## License

MIT

# Architecture

```
Browser (Dashboard)                     Next.js server (Node runtime)
┌──────────────────┐   SSE /api/stream   ┌────────────────────────────────────┐
│ useTelemetry     │◀────────────────────│ Engine (singleton)                 │
│  EventSource     │                     │  step()        physics, 1 s tick   │
│  trend history   │  POST /api/command  │  applyCommand() safety interlocks  │
│ ControlPanel     │────────────────────▶│  modbus.ts     register-map frames │
└──────────────────┘                     │  alerts.ts     rule alarms         │
        │ GET /api/export, /api/history  │  Commentator   optional LLM layer  │
        └───────────────────────────────▶│  Store         Firestore | memory  │
                                         └────────────────────────────────────┘
```

All plant state lives in the server `Engine` (`src/server/sim/engine.ts`). The client only renders snapshots and sends commands, so refreshing the page or opening a second tab shows the same plant.

## Modules (`src/server/`)

| File                             | Responsibility                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sim/engine.ts`                  | Pure `step()` physics plus the `Engine` class: wire log, audit trail, alert list, subscribers. The 1 s timer runs only while at least one client is subscribed. |
| `sim/interlocks.ts`              | `applyCommand()`: mixer/valve interlocks, E-STOP, setpoint clamping. Denials carry an operator-facing reason.                                                   |
| `sim/modbus.ts`                  | Deterministic MBAP frames from the register/coil map (documented at the top of the file).                                                                       |
| `sim/alerts.ts`                  | Rule alarms (overheating, pH range, empty tank). Edge-triggered: raised once per condition change.                                                              |
| `sim/commentary.ts`              | Guards around the Genkit flow: trigger gating near limits, 30 s global rate limit, 5 min repeat suppression, 8 s timeout, zod validation, silent fallback.      |
| `sim/thresholds.ts`              | Single source for process limits, shared by the rules, the interlocks and the Genkit flow.                                                                      |
| `store.ts`, `firestore-store.ts` | `Store` interface; Firestore when `FIREBASE_*` are set, otherwise a bounded `MemoryStore`. Writes are best-effort and never block a tick.                       |
| `rate-limit.ts`                  | Per-IP fixed window for `/api/command` (E-STOP is exempt).                                                                                                      |

## HTTP API

| Route                            | Purpose                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/stream`                | SSE; one `Snapshot` (state, network counters, wire log, audit, alerts) per tick and per accepted command.                |
| `POST /api/command`              | Body validated by zod (`sim/schema.ts`). `200` ok, `409` interlock denial with `reason`, `400` invalid, `429` throttled. |
| `GET /api/history?from&to&limit` | Persisted telemetry (one sample per 5 s). Defaults to the last hour.                                                     |
| `GET /api/export?from&to`        | Same data as CSV.                                                                                                        |

## Alerting model

Safety alarms are deterministic and raised on the tick the condition appears. Gemini commentary (`source: "ai"`) is additive: it adds trend-aware context and a recommendation when the plant is on or near a limit, and its failure changes nothing visible except the absence of the comment.

## Operational notes

- `apphosting.yaml` sets `maxInstances: 1`. The engine is in-process state, so scaling out needs the plant state moved into shared storage first.
- The simulation pauses when no client is connected.
- Firestore needs a service account: set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (keep `\n` escapes in the key). The Firestore adapter is verified against the Firestore **emulator** (`npm run test:firestore`, run in CI), not against a live project.
- Authentication is opt-in and minimal: set `OPERATOR_TOKEN` and `POST /api/command` requires `Authorization: Bearer <token>` (E-STOP stays open on purpose). It is meant for scripts and server-to-server calls. The browser dashboard sends no token, so with the token set its other controls are rejected with 401; put the UI behind your platform's access control (and do not ship the token to the client). Read endpoints (`/api/stream`, `/api/history`, `/api/export`) are not token protected.

## Tests

`npm run test:firestore` runs the shared Store contract suite (`src/server/store.contract.test.ts`) against the Firestore emulator (needs Java 11+); plain `npm test` runs the same suite for the in-memory store and skips the Firestore cases.

`npm run test:e2e` drives the real built app in Chromium: connection, starting the mixer, the discharge interlock toast, E-STOP and trend persistence across a reload. The simulation is one shared server state, so these tests run serially and reset the plant first.

`npm test` covers the physics (including determinism via the seeded RNG), every interlock, the Modbus frame encoding, the engine, the commentary guards (with a mocked LLM), the stores, history/CSV parsing and the rate limiter.

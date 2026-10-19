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
| `rate-limit.ts`                  | Shared fixed window for `/api/command` across the simulator (E-STOP exempt).                                                                                    |

## HTTP API

| Route                            | Purpose                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/stream`                | SSE; one `Snapshot` (state, network counters, wire log, audit, alerts) per tick and per accepted command.                |
| `POST /api/command`              | Body validated by zod (`sim/schema.ts`). `200` ok, `409` interlock denial with `reason`, `400` invalid, `429` throttled. |
| `GET /api/history?from&to&limit` | Persisted telemetry (one sample per 5 s). Defaults to the last hour.                                                     |
| `GET /api/export?from&to`        | Same data as CSV.                                                                                                        |

The simulator clamps accepted RPM and temperature setpoints to the limits in `sim/thresholds.ts`. Its simulated Modbus FC 06 trace records the **effective applied value**, rather than an out-of-range value originally requested by the operator. This keeps the accepted process state and trace consistent; it does not represent a physical Modbus write.

## SSE stream consistency

Each snapshot carries a `runId` unique to its in-process `Engine` instance and a monotonic `seq` counter for that run. The browser validates full incoming SSE snapshots before displaying them, ignores duplicate/out-of-order sequences within the same run, and resets rolling trends when the run identity changes. An established EventSource transport is not marked "Gateway Active" until a valid payload arrives. A history preload already in flight is ignored if the run changes before it completes.

Persisted telemetry now records the engine `runId` on each new sample. The HMI waits for a validated SSE snapshot before requesting history for its specific run and rejects mismatched responses. A restart triggers a new scoped preload. This is session provenance within the simulator, not physical historian traceability.

## Telemetry persistence and legacy records

New records use Firestore paths `sim_runs/<runId>/telemetry/<timestamp>` (or an in-memory record tagged with `runId`). The per-run path prevents timestamp collisions across restarted simulators and allows efficient time-range queries without a composite index. The old top-level `telemetry` collection remains untouched and can still be read by calling the Store without a run filter; it is **not** displayed by the current-session dashboard or included in default API responses.

`GET /api/history` and `GET /api/export` default to the running engine's `runId`. An optional UUID `runId` query parameter selects an archived session; `/api/history` echoes `runId` and validates each returned sample's session on the client. CSV exports add the `run_id` column. This is a compatibility-aware storage transition, not a historical data migration.

## Operator telemetry freshness

The browser tracks the local receipt time of each validated, advancing SSE snapshot. An EventSource connection being `OPEN` does **not** by itself imply that application telemetry is current. If no advancing snapshot arrives for 6 seconds (the nominal simulation tick is 1 second), the gateway is marked `Stale` even if the browser socket remains open. Transport errors remain `Connecting` or `Disconnected`, and recovery requires a new valid advancing snapshot. The last known readings remain visible with an explicit warning, rather than being presented as live data.

The HMI shows an abbreviated `runId` and the elapsed seconds since the most recently accepted snapshot. After the first detected engine-session change on the current page it also displays a persistent session-change notice; trend history is already session-scoped by the preceding history changes. This is an operator **display-health indicator**, not a physical sensor heartbeat, network certification, or control interlock. E-STOP is never disabled by this UI status.

## Shared-operator setpoint readback

RPM and heater setpoint sliders mirror the server-owned `Snapshot.state` values whenever they are idle. During a local drag, the operator sees a temporary draft value; a **single** command is sent on slider commit rather than on each drag movement. The draft remains marked `(PENDING)` until a newer SSE snapshot confirms the applied value. Denied commands and a missing readback cause the local draft to revert, so an unconfirmed operator request is never presented indefinitely as the applied setting.

Normal operator controls (mixer, mode, heater, valve, E-STOP reset and manual setpoints) are disabled while no validated current telemetry is available. The simulated E-STOP action itself remains available. The command handler on the client also checks freshness so a pending event cannot bypass the disabled controls; server-side interlocks and authentication remain authoritative. Valve control uses an accessible labeled switch rather than a click handler on an unlabeled container. Concurrent operators can still overwrite each other's accepted values; this demo does not provide exclusive operator locks or a safety-rated control channel.

## Alarm history and telemetry data-quality validation

Deterministic rule alarms and optional AI commentary are tagged with the simulator `runId`. Both `MemoryStore` (last 200 events) and Firestore persist these records separately by session; legacy Firestore alarm records remain untouched. `GET /api/alerts?runId=<uuid>&limit=50` returns the most recent events for the chosen run, defaulting to the active run. The HMI merges this archive with its live SSE events by alarm ID, presents up to 50 chronological events, and excludes records from earlier sessions. This is an **event history**, not an acknowledgement workflow or a list of currently active fault conditions.

Incoming SSE snapshots and persisted history are rejected when numeric readings violate basic physical domains (negative RPM, pH outside 0–14, fill outside 0–100%, and configured setpoint bounds). Temperature remains valid above the 80 °C rule-alarm threshold so a real simulated overheating condition is displayed rather than discarded. These input checks catch impossible values, not subtle sensor drift or field-device failures. The alarm API is read-only and follows the existing publicly readable demo endpoints.

## Concurrent setpoint admission

Manual RPM and temperature updates support optional optimistic concurrency preconditions: `expectedValue` (the authoritative setpoint observed when dragging began) and `expectedRunId` (the simulator instance). The server checks these before invoking its usual interlocks and before emitting a simulated Modbus write. A mismatch returns 409 and does not change the state or increment the SSE sequence. The browser reverts rejected drafts to the latest validated readback, and discards a pending draft if a third value arrives. Normal telemetry ticks advance the SSE sequence but **do not** trigger false operator conflicts.

This protects manual setpoint edits only, not all command types. Callers that omit the optional preconditions retain legacy last-write-wins semantics; E-STOP never depends on readback preconditions.

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

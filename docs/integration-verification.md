# Consolidated integration verification

ChemView is a **simulation-only engineering prototype**. This checklist is for
the combined `main` branch after the run-scoped telemetry, audit, alarms,
multi-operator interlocks and optional AI commentary changes.

## Required automated gates

The existing GitHub Actions workflow runs these groups on a non-skipped push
to `main`. Individual implementation commits intentionally skipped CI to
avoid redundant full-suite executions.

- **Build:** `npm ci`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm test` and `npm run build`
- **Persistence:** `npm run test:firestore` against the Firestore emulator
- **Browser:** `npm run test:e2e` with Playwright Chromium

GitHub-hosted jobs use Node.js 22, matching the Firebase Admin SDK's
runtime requirement. The browser tests exercise accessible slider handles,
not only visual container labels.

## Acceptance scenarios

- The HMI waits for a validated, current SSE payload before unlocking controls.
- Alarm and audit histories occupy balanced full-width panels below the operator controls.
- At 1366×768 and 1440×900 the layout retains its NEXUS identity, has no
  horizontal document overflow, remains vertically scrollable and exposes
  safety actions. GitHub Actions stores fresh full-page screenshots as
  `chemview-hmi-design-captures` for visual review.
- A late packet from a retired simulation run cannot reactivate stale readback.
- Telemetry, alarm events and audit records are scoped by `runId`.
- Simulated E-STOP is unconditional and cannot be cleared by a stale RESET.
- Stale multi-operator commands cannot silently overwrite current process state.
- A denied slider write returns the readback to the server-owned value; a later
  operator write is not hidden by an old local draft.
- Shared-demo API 429 responses are handled in browser-test setup using
  the server's `Retry-After`; the production rate limiter is not disabled.
- A delayed AI response cannot override a newer command or alarm condition.
- Deterministic alarms still fire independently of optional Gemini responses.
- No test reaches a real PLC, Modbus TCP device or production Firebase instance.

## Reporting rule

A saved test or a green historical PR check is **not** proof that the current
combined `main` branch passed. Report the current commit SHA, workflow run
and each job result separately; disclose failures and skipped checks.

## Verified design capture

The reference screenshot in `docs/assets/chemview-dashboard.png` was refreshed by
GitHub Actions after the final responsive HMI checks. The captured scenario
shows the simulated mixer and heater in operation; this is not real plant data.
The temporary workflow job with repository-write permission was removed once
the screenshot had been committed. Screenshot capture tests remain available in
Playwright for future visual reviews.

# Changelog

## 1.1.0

- Simulation moved to the server: pure physics step, safety interlocks and deterministic Modbus frames; telemetry over SSE (`/api/stream`), commands over `/api/command`.
- Hybrid alerting: deterministic rule alarms plus guarded, optional Genkit/Gemini commentary.
- Persistence (Firestore or in-memory), `/api/history`, server-side CSV export `/api/export`, per-IP command rate limit (E-STOP exempt).
- Quality gates: typecheck, lint, Vitest and build in CI; build no longer ignores TS/ESLint errors.
- Fixes: `Toaster` was never mounted (interlock toasts were invisible), trend history no longer rebuilt from stale state, stable tank bubbles.

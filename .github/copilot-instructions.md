# GitHub Copilot instructions — ChemView

## System purpose
ChemView is a **simulated** mixing-process HMI/digital twin, NOT a real PLC/DCS or certified safety controller. Read `README.md`, `docs/architecture.md`, `src/server/sim/`, `src/server/store.ts`, `src/server/rate-limit.ts`, relevant API route handlers and nearby Vitest tests before changes.

## Nonnegotiable safety contracts
- The simulation enforces interlocks on the server: E-STOP takes precedence, mixer startup is blocked with discharge open, and the discharge valve cannot move while the rotor is spinning.
- A UI disabled button is not sufficient enforcement. Test direct handler calls with invalid or conflicting commands.
- E-STOP must never be dropped by the ordinary rate limiter; control operations should fail closed on malformed inputs or authorization failures.
- Treat SSE/browser content and persisted telemetry as untrusted. Never expose Firebase credentials or Gemini keys to client bundles or logs. Optional AI commentary cannot veto/delay deterministic interlocks.
- No access to physical devices, Modbus TCP endpoints, plant networks, real customer telemetry or production Firebase. Use local mocks and synthetic events.

## Verification
- Existing scripts: `npm run typecheck`, `npm run lint`, `npm test` (Vitest), and `npm run build`.
- Use targeted `npm test -- <affected.test.ts>` first, and distinguish offline simulator tests from physical safety certification.
- An older draft PR #2 covers broader hardening; avoid duplicating or overwriting its work until reconciled.
- Report actual tests/results, remaining limitations, and changed files. No workflow modifications, deployments or automatic merges without explicit instruction.

## Copilot specialist
`.github/agents/interlock-simulator-qa.agent.md` is opt-in for tests and narrow fixes.

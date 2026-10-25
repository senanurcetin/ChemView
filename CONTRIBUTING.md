# Contributing to ChemView

ChemView is a **noncommercial, simulation-only engineering demonstration**. Contributions should improve correctness, reproducibility, safety boundaries or observability—not add plant-controller connections or commercial infrastructure.

## Structure and source of truth

- `src/server/sim/`: synthetic model, interlocks, Modbus encoding and seeded scenarios.
- `src/components/chemical-mixing/`: HMI, experiment laboratory, P&ID and reference-comparison panel.
- `src/lib/`, `src/hooks/`: telemetry validation, session history and benchmark helpers.
- `docs/architecture.md`, `docs/science-validation.md`, `docs/design-qa.md`: canonical engineering documentation.
- `docs/integration-verification.md`: acceptance criteria and CI evidence expectations.

Treat `README.md` as the sole entry point. Keep runtime behavior in `docs/architecture.md`, equations and scientific caveats in `docs/science-validation.md`, visual proof in `docs/design-qa.md`, and acceptance evidence in `docs/integration-verification.md`. Update the owning file rather than creating another reviewer brief, status snapshot or parallel specification. Do not reintroduce obsolete blueprints or duplicate scientific model documents.

## Local quality gates

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run docs:check
npm test
npm run build
npm run test:firestore  # requires Java 21
npm run test:e2e       # requires Playwright Chromium
```

PRs should update focused unit/E2E tests for any change in alarm thresholds, seeded scenarios, event ordering, persistence or controls. Cover false, unauthorized and contradictory commands in **server-side** tests. Include source-backed claims; a prior green run is not proof of the new commit. Never present tests as real PLC/SIL validation.

## Screenshots and documentation

Playwright generates current full-page screenshots at 1366×768, 1440×900 and 1920×1080 in the CI artifact `chemview-hmi-design-captures`. Commit only selected, verified portfolio images under `docs/assets/` and record the source workflow run in [design QA](docs/design-qa.md). Do not commit generated `artifacts/`, test results or Playwright reports. After an intentional screenshot replacement, update its source-run provenance in `docs/design-qa.md` and the corresponding SHA-256 digest in `scripts/check-docs.mjs`. Run `npm run docs:check` after any path, documentation or image change; resolve stale links and avoid orphan assets.

Use synthetic telemetry only. Never commit secrets, real industrial addresses, operator tokens or actual equipment information. Follow [SECURITY.md](SECURITY.md) for security-sensitive reports.

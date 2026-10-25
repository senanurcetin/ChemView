# Integration and acceptance — simulation-only ChemView

This is the source of truth for **how to verify a specific commit**. A historical green PR is not proof that a later combined branch was tested, and unit tests are not evidence of physical PLC safety.

## Quality gates

| Gate                                     | Local command            | GitHub Actions job             |
| ---------------------------------------- | ------------------------ | ------------------------------ |
| Dependency integrity                     | `npm ci`                 | build, firestore-emulator, e2e |
| TypeScript                               | `npm run typecheck`      | build                          |
| ESLint                                   | `npm run lint`           | build                          |
| Prettier                                 | `npm run format:check`   | build                          |
| Documentation references and images      | `npm run docs:check`     | build                          |
| Simulation and API unit tests            | `npm test`               | build                          |
| Next production compilation              | `npm run build`          | build                          |
| Firestore store-contract tests (Java 21) | `npm run test:firestore` | firestore-emulator             |
| Chromium HMI/regression tests            | `npm run test:e2e`       | e2e                            |
| Independent Node quality                 | CircleCI `node-quality`  | CircleCI                       |

GitHub Actions uses Node 22. The Playwright suite runs sequentially because one server-owned synthetic process is shared by all browser pages.

## Verification boundaries and acceptance scenarios

- Validated, advancing SSE telemetry unlocks ordinary controls; a stale connection displays **last known** data and disables ordinary actions, but not E-STOP.
- Run UUIDs prevent cross-run telemetry, alert and audit history mixing; invalid/out-of-order replay is ignored.
- Stale or conflicting setpoints/discrete actions are rejected server-side rather than silently overwriting newer readbacks.
- E-STOP is unconditional and latched; a stale or unauthorized reset must not clear a newer stop.
- The 60-commands-per-10-seconds admission budget cannot be bypassed by rotating arbitrary IP-forwarding headers. The rate-limit tests must not disable safeguards just to pass.
- Sensor bias is kept conceptually separate from synthetic underlying chemical pH. Simulated Modbus dropouts do not modify plant physics.
- All six seeded scenarios are deterministic; thermal/inventory/motor reference tests must pass under the stated simplified assumptions.
- Model benchmark, explanatory caveat, P&ID and NEXUS identity remain accessible.
- NEXUS 2.0 browser checks assert all seven approved Drive palette tokens, the midnight canvas, branded header/logo and visible semantic red E-STOP independently of the theme.
- The 1366×768, 1440×900 and 1920×1080 captures display the **opened P&ID and four-row model benchmark**, with no horizontal document overflow. The history and lower panels remain reachable by vertical scrolling.
- AI commentary never blocks deterministic alarm/interlock paths, and no test should access a real PLC, customer historian, live plant or production Firebase.

## Reusable image and evidence acceptance

The visual E2E fixture opens both scientific and instrumentation disclosure panels; the matching four checked-in images must exist, be valid PNGs and have the expected screenshot widths. Responsive full-page images intentionally exceed viewport height, while the dedicated 1440×900 science evidence must fit both expanded engineering panels within one viewport. The screenshot provenance must cite the source GitHub Actions run _for the current checked-in images_; an older successful workflow cannot establish currency after an HMI change.

## Verified integrated baseline — 21 October 2026

The current completed maintenance baseline was merged as commit `3766178e56ae7beab7ead70c9ad6ad56109ff0e4` ([PR #22](https://github.com/senanurcetin/ChemView/pull/22)). Its **postmerge main** [GitHub Actions run 39615510325](https://github.com/senanurcetin/ChemView/actions/runs/39615510325) passed build/quality, Firestore emulator and Chromium Playwright; [CircleCI node-quality 210](https://circleci.com/gh/senanurcetin/ChemView/210) also passed. This is a commit-specific verification baseline, **not** acceptance of later modifications.

That baseline's dependency audit (artifact `chemview-dependency-audit`, run 39615510325) reported **0 critical, 8 high, 59 moderate** affected production nodes and **0 critical, 20 high, 64 moderate** across the full installation. Advisories remain tracked in [SECURITY.md](../SECURITY.md) and [issue #16](https://github.com/senanurcetin/ChemView/issues/16); counts are not proof of directly exploitable entry points.

The four committed HMI screenshots and their SHA-256 fingerprints are owned by [design QA](design-qa.md). Earlier source runs and visual-image capture provenance belong there rather than being replicated as separate historical run reports here.

## Reporting

For release-quality demo acceptance record: tested commit SHA, workflow URL, each independent job result, screenshot source run and residual issues. The remaining dependency advisories and unauthenticated-demo exposure are tracked in [security issue #16](https://github.com/senanurcetin/ChemView/issues/16); passing CI does not close that issue.

The project remains an advanced **noncommercial engineering research demonstration** with no requirement for live plant integration, billing, accounts or SaaS operations.

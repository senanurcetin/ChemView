# Security policy

## Private vulnerability reports

Email [senanur.cetin.work@gmail.com](mailto:senanur.cetin.work@gmail.com) with subject `[ChemView security]`, the affected version/commit, impact and safe reproduction steps. Do not post credentials, personal data or actionable exploit details in a public issue. This research/portfolio repository has no guaranteed security response or support schedule.

## Operational safety boundary

ChemView simulates process physics, a Modbus register map and safety interlocks. It is **not** connected to a PLC or rated as a safety instrumented system. The optional LLM alert commentary does not decide interlock actions; never make it the safety authority.

Before any network deployment, independently review authentication, telemetry retention, network exposure, rate limits and secret management. Do not use the demo to operate real heaters, mixers or valves.

## Default demo exposure

- Without `OPERATOR_TOKEN`, `POST /api/command` and the laboratory scenario
  endpoint are modifiable by an unauthenticated caller. **Do not publish a
  shared write-enabled instance without external access control.**
- The SSE stream and the history, alarm, audit and CSV endpoints are readable
  without browser authentication. This is synthetic data, but public readers
  can still consume server resources.
- With `OPERATOR_TOKEN` configured, ordinary commands require a bearer token.
  The browser intentionally does not receive this token, so its ordinary
  controls will not work without a separate authorized channel. Simulated
  E-STOP remains callable without that token.
- The critical Handlebars and websocket-driver transitive advisories were
  previously addressed by explicit overrides pinned to 4.7.10 and 0.7.5.
- **Latest dependency evidence (21 October 2026):** [GitHub Actions run 39613329653](https://github.com/senanurcetin/ChemView/actions/runs/39613329653),
  artifact `chemview-dependency-audit` (ID `12352211171`). Its patched lockfile
  reports **0 critical, 8 high, 59 moderate** affected production dependency
  nodes. Including development and test dependencies the counts are
  **0 critical, 20 high, 64 moderate**. These are affected package nodes,
  not 67 demonstrated exploit paths. Earlier 0/14/61 production and
  2/26/65 full-tree counts are historical and should not be described as
  the current inventory.
- The build-only `tailwindcss-animate` package was moved to dev dependencies,
  selected compatible transitive patches were applied without `npm audit fix
  --force`, and Vitest test tooling was updated to 5.0.5 alongside Node 22
  typings. The remaining high/moderate audit findings, especially Genkit,
  Firebase, OpenTelemetry and Next.js/PostCSS constraints, remain explicitly
  tracked in [security issue #16](https://github.com/senanurcetin/ChemView/issues/16).

Keep the demonstration local, protected, or read-only until its intended
network exposure has been independently reviewed. No commercial hosting or
plant-network deployment is required for the research portfolio.

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
- The critical Handlebars and websocket-driver transitive advisories are
  addressed by explicit npm overrides and lockfile pins to 4.7.10 and 0.7.5.
  This does **not** resolve every audit finding or prove exploitability for
  other packages. Review the production-only npm audit artifact on each CI run.

Keep the demonstration local, protected, or read-only until its intended
network exposure has been independently reviewed. No commercial hosting or
plant-network deployment is required for the research portfolio.

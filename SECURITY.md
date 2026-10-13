# Security policy

## Private vulnerability reports

Email [senanur.cetin.work@gmail.com](mailto:senanur.cetin.work@gmail.com) with subject `[ChemView security]`, the affected version/commit, impact and safe reproduction steps. Do not post credentials, personal data or actionable exploit details in a public issue. This research/portfolio repository has no guaranteed security response or support schedule.

## Operational safety boundary

ChemView simulates process physics, a Modbus register map and safety interlocks. It is **not** connected to a PLC or rated as a safety instrumented system. The optional LLM alert commentary does not decide interlock actions; never make it the safety authority.

Before any network deployment, independently review authentication, telemetry retention, network exposure, rate limits and secret management. Do not use the demo to operate real heaters, mixers or valves.

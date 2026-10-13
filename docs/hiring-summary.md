# Reviewer brief — ChemView Mixing HMI

**Role:** Industrial UI engineering, deterministic process simulation and operator-centered alarm design. **Stage:** engineering prototype, not a connected plant controller.

## What to review

ChemView runs a mixing-process simulation on the server, presents controls and process telemetry over Server-Sent Events, and maintains a simulated Modbus register map. Safety rules are deterministic; optional Gemini commentary only explains alerts.

| Reviewer question | Evidence |
|---|---|
| Is there an actual interface? | [Captured HMI](assets/chemview-dashboard.png) |
| What prevents conflicting commands? | [Documented server-side interlocks](../README.md#what-it-does): mixer vs discharge valve, valve vs rotor and E-STOP priority |
| Can it operate without an LLM key? | [Local setup](../README.md#local-setup); rule-based alarms and in-memory storage remain available |
| Can the architecture be followed? | [Architecture design](architecture.md) and [main README](../README.md) |
| Are controls testable? | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; see [validation commands](../README.md#local-setup) |

## Implementation choices

- Safety-relevant command rules evaluated on the server, not in the UI alone.
- Separation of simulated register activity, deterministic alarms and optional narrative AI.
- History and CSV export for human review; Firestore is optional.

## Engineering limits

There is no real PLC, fieldbus gateway or certified safety instrumented system. Neither the simulated E-STOP nor the LLM commentary provides safety protection in the real world. External deployment would need independent access control, networking and industrial safety review.

**More detail:** [Repository README](../README.md) · [Security policy](../SECURITY.md).

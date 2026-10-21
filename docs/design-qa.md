# HMI design, responsive QA and source screenshots

ChemView retains the cyan/orange, dark-workstation hierarchy of its original HMI brief while identifying the engineering demonstration **by NEXUS** with `public/nexus-logo.png`. The status colors communicate synthetic process state; this is not a connected industrial operator station.

## Committed screenshot gallery

Screenshots below come from the **actual running Playwright demo**, not Figma mockups, AI-rendered images or equipment photographs. The mixer and synthetic heater are enabled in the capture fixture. Crucially, both **Simulated P&ID** and **Model benchmark — numerical accuracy** expanders are opened before screenshots. Earlier committed images showed these new engineering sections collapsed; those images were valid UI captures but incomplete evidence of current functionality.

| Viewport  | Full-page capture                                        | Checked properties                                                                        |
| --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1366×768  | [Compact HMI](assets/chemview-1366x768.png)              | NEXUS identity, control access and scrollability without horizontal document overflow     |
| 1440×900  | [Default portfolio image](assets/chemview-dashboard.png) | Expanded instrumentation and scientific verification visible with operator controls |
| 1440×900  | [Engineering evidence](assets/chemview-engineering-evidence.png) | Dedicated checked-in capture showing current P&ID and analytical comparison table |
| 1920×1080 | [Wide workstation](assets/chemview-1920x1080.png)        | Expanded reactor graphic and legible lower-page event/audit sections                      |

![1440px ChemView workstation showing expanded synthetic P&ID and model benchmark](assets/chemview-dashboard.png)

![Synthetic engineering instrumentation and benchmark comparison](assets/chemview-engineering-evidence.png)

**Capture provenance:** See the current screenshot-source workflow in this document's evidence record and `e2e/smoke.spec.ts`. Playwright exports `chemview-hmi-design-captures` for the active PR SHA; the four committed PNGs are copied from a successful current-source run, not regenerated artwork. Images are **full-page** and do not claim that every panel fits above the fold. The source must be updated to a verified new CI run whenever these images are changed.

## Original design intent retained

- Cyan (`#00FFFF`) conveys telemetry and active synthetic instrumentation; warm orange differentiates heater activation, with high-contrast destructive E-STOP treatment.
- Dark gray (`#222222`) provides a laboratory-workstation appearance; modular cards separate process, instrumentation, operator controls and log history.
- Animated tank fill and mixer respond to validated server readbacks. Reduced-motion preferences are respected.
- The P&ID expander shows simulated TT-101, AIT-101, LT-101, M-101, EH-101 and XV-101 indicators, not certified wiring or ISA-verifiable as-built drawings.
- The **Model benchmark** expander reports synthetic numerical-method agreement, explicitly not process measurements or calibration.
- Layout favors legibility, stable panel placement, bounded Modbus frame wrapping and easy visibility of E-STOP and stale-telemetry states.

## Automated and manual acceptance

Playwright verifies an active simulation, logo visibility, essential controls, reactor size, absence of horizontal document overflow, scrollable audit history and accessible model-benchmark table. The capture matrix checks 1366, 1440 and 1920 px widths. The NEXUS logo and system labels remain legible; lower history sections are reachable by scrolling. Image layout was additionally inspected using the saved CI PNGs.

These checks do **not** establish WCAG conformance, keyboard-only usability across every control, accessibility color-contrast ratios, live PLC connections or physical safety. The diagram is illustrative, and the display does not provide a certified safety-rated emergency-stop function.

For new visual changes, regenerate captures with `npm run test:e2e`, inspect the successful CI artifact at all sizes, then update only `docs/assets/` and this provenance section. Keep disposable `artifacts/` files out of Git.

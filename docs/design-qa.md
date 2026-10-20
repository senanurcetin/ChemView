# ChemView — HMI Visual QA

The current operator workspace uses the existing ChemView cyan/orange status hierarchy
and the NEXUS identity asset already in `public/nexus-logo.png`. It remains
a **simulation**, not a real PLC display.

## Browser capture matrix

The Playwright scenario `NEXUS identity and operator panels remain accessible on shorter desktops`
captures full-page images for all three workstation sizes:

- **1366 × 768:** Header and status legibility, no horizontal overflow; panel access by vertical scroll.
- **1440 × 900:** Balanced two-column process and control layout.
- **1920 × 1080:** Wide-screen scale, reactor schematic and event-log readability.

The GitHub Actions `e2e` job publishes the PNG files as the
`chemview-hmi-design-captures` artifact. The test checks document and main
container horizontal overflow, Nexus presence, E-STOP visibility, scrollable audit
history and minimum reactor graphic width.

## Design improvements

- Reactor vessel scales at wide viewport sizes; true server-observed fill,
  temperature, pH and heater states are readable alongside its animation.
- Modbus frames wrap instead of clipping beyond the protocol panel.
- Event history and controls retain their existing server-side safety behavior.
- The simulated mixer animation respects OS reduced-motion preferences.

## Screenshot inspection

GitHub Actions [run 39503098768](https://github.com/senanurcetin/ChemView/actions/runs/39503098768)
produced PNG captures at all three sizes, with the simulated mixing process active.
The images were reviewed for alignment and readable controls:

- **1366 × 768:** Header, E-STOP, setpoints and protocol history remain visible;
  the complete event history is reachable by vertical scrolling.
- **1440 × 900:** Process visualization, charts and right-hand controls retain
  their two-column hierarchy.
- **1920 × 1080:** The enlarged reactor schematic is centered; NEXUS branding,
  telemetry and event history remain aligned without horizontal clipping.

The screenshot is a full-page capture, not proof that everything fits
above the fold. Responsive checks verify access through normal scrolling.

## Limitations

These checks establish layout stability, not WCAG conformance or a measured
accessibility audit. The full-page artifact is visual evidence; it must not be
confused with verification of physical process control. If a captured screen is
replaced in the README, use the newest successful CI artifact rather than an
illustration or an outdated sample.

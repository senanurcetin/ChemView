---
description: Read-only source-backed acceptance for Interlock Simulator QA agent
---

# Interlock Simulator QA — custom agent acceptance

Read-only source acceptance. Invocation must be explicit: GitHub Copilot CLI `--agent=interlock-simulator-qa` or a supported IDE agent selector. The external test harness, not the model response, must record the requested agent ID and CLI exit code. Do not mark NOT RUN just because no IDE selector was used. If the actual loaded profile is not independently shown by runtime evidence, mark profile identity UNVERIFIED separately from source-review results.

Read these checked-in files (if missing, record that fact):

- `README.md`
- `src/server/sim/interlocks.ts`
- `src/server/sim/engine.ts`
- `src/server/sim/engine.test.ts`
- `src/server/rate-limit.ts`
- `src/app/api/command/route.ts`
- `src/server/store.test.ts`

Using ONLY files you actually inspect, answer:

1. Identify which server-side interlock cases forbid mixer start with discharge open, valve opening with spinning rotor, and commands after E-STOP; mark absent cases UNVERIFIED rather than assuming.
2. Trace command input handling from API to simulator engine, and distinguish server-side validation from UI controls.
3. Describe priority of emergency stop versus throttling and how deterministic tests would exercise the handler directly. Cite exact existing source/test evidence.
4. Distinguish simulated tests and mocked persistence from actual PLC safety, SIL certification or validated physical process control.

For each numbered check, give PASS, FAIL, or UNVERIFIED and cite concrete path names plus the relevant function, condition or test. A passing source review is NOT proof that code was executed. Label all unrun tests, live-device claims, runtime deployments and CI UNVERIFIED. Do not edit files, execute shell commands, run tests, contact external APIs, install dependencies, touch credentials, or trigger CI/GitHub Actions/CircleCI/Vercel. Never send commands to hardware, make Gemini calls, or claim certified interlocks.

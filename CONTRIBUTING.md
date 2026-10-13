# Contributing to ChemView

ChemView is an industrial HMI simulation built with Next.js, React and TypeScript. Focus contributions on clear operator feedback, deterministic process behavior and testable safety-interlock logic.

## Local quality checks

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

## Pull requests

- Include a scenario for every changed interlock or alarm rule, including conflicting operator actions and E-STOP priority.
- Test the no-Gemini-key fallback; safety decisions must not depend on AI provider responses.
- Use fictional process data, and avoid committing API credentials or real equipment information.
- Document any new environment variables, HMI behavior and limitations.

Security issues should follow [SECURITY.md](SECURITY.md) rather than public disclosure.

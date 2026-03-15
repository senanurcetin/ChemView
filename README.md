# ChemView

ChemView is an open-source industrial HMI and digital twin prototype for a chemical mixing process. It demonstrates how modern web tooling can model telemetry, operator controls, communication traces, and safety interlocks in a single interface.

![ChemView interface](https://github.com/user-attachments/assets/5c3d9ad0-08a0-442d-a7e1-a5c06e9c76ef)

## What it does

- Simulates a mixing tank process with live telemetry.
- Visualizes operator controls, trends, and communication logs in one HMI layout.
- Models safety interlocks for heating, mixing, and discharge workflows.
- Uses Next.js and React to present a fast portfolio-ready operator console.

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Genkit and Gemini for AI-assisted alert generation

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The app runs on `http://localhost:9002`.

## Portfolio note

ChemView is a simulation-focused public repo. It is meant to show industrial UX, state modeling, and operator-centered front-end architecture rather than production PLC integration.

## License

MIT

# **App Name**: ChemView

## Core Features:

- Visual Tank Simulation: A dynamic schematic showing the mixing tank with animated liquid levels and a rotating mixer reflecting real-time RPM data.
- Real-time Data Ingestion: Simulation of Modbus TCP/IP polling cycle, reading Holding Registers every 1000ms, displaying Mixing Speed (RPM), Temperature (°C), pH Level, and Valve Status. Connection Status: Connected: 192.168.1.50:502
- Interactive Controls: Interactive Start/Stop and Emergency Stop buttons that control and visually represent the mixer state.
- Temperature Trend Chart: Live line chart displaying temperature fluctuations over the last 60 seconds.
- RPM Trend Chart: Live line chart displaying mixing speed trends over the last 60 seconds.
- Alerting system: An intelligent alerting system, based on sensor input. As a tool, it considers past states and thresholds to send specific alerts to the operator when the system operates outside normal parameters.

## Style Guidelines:

- Primary color: Cyan (#00FFFF) to represent data and controls with a futuristic feel.
- Background color: Dark gray (#222222) to emulate a high-end HMI panel.
- Accent color: Red (#FF4500) for alerts and emergency states, ensuring immediate visibility.
- Body and headline font: 'Space Grotesk', a sans-serif font with a techy feel.
- Use vector icons that light up on hover to reinforce interactivity
- Use modular tiles with data, charts, and controls to build an easy-to-read interface.
- Incorporate animated liquid level, RPM visualization, and chart updates to provide real-time feedback.
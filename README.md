# ChemView | Industrial Mixing HMI & Control System

ChemView is a futuristic, high-end Human-Machine Interface (HMI) for monitoring and controlling industrial chemical mixing tanks. It serves as a **Digital Twin Prototype**, demonstrating real-time data ingestion, animated physical simulations, manual control overrides, and event auditing.

![ChemView HMI](https://picsum.photos/seed/hmi-control/1200/600)

## 🚀 Overview

This project is an educational prototype for building industrial control systems with modern web tech. It simulates a **Modbus TCP/IP** environment where an operator can monitor sensor telemetry and actively override system setpoints.

## 🏗️ Architecture

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Styling:** Tailwind CSS with a "Cyberpunk HMI" aesthetic.
- **Components:** Shadcn UI for high-fidelity control widgets (Sliders, Switches, Tabs).
- **Visualization:** Recharts for high-frequency time-series data.
- **Simulation Engine:** A deterministic polling engine simulating physical dynamics and linear interpolation for "smooth" sensor transitions.

## ✨ Advanced Features

- **Full Control System:** Switch between **Auto** and **Manual Override** modes. Adjust Target RPM and Temperature via interactive industrial sliders.
- **Visual Tank Simulation:** CSS-animated schematic showing liquid levels, agitation bubbles, and mixer blades synchronized to real-time RPM.
- **System Event Audit Log:** A persistent history of operational events, alerts, and operator interventions.
- **Data Export:** Instant CSV export of current reactor telemetry (RPM and Temp trends) for offline analysis.
- **Simulated Intelligence:** AI-driven operational insights that monitor thresholds and suggest corrective actions.

## 🛠️ Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/chemview-hmi.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:9002](http://localhost:9002).

## 📝 License

MIT License. Built for educational purposes as a demonstration of high-performance React-based industrial interfaces.

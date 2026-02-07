# ChemView | Open Source IIoT Digital Twin HMI

ChemView is a futuristic, high-end Human-Machine Interface (HMI) for monitoring and controlling industrial chemical mixing tanks. It serves as a **high-fidelity Digital Twin Prototype**, demonstrating real-time data ingestion, animated physical simulations, and industrial safety interlocks.

![ChemView HMI](https://picsum.photos/seed/hmi-control/1200/600)

## 🚀 Overview

This project is an educational prototype for building industrial control systems with modern web technologies. It simulates a **Modbus TCP/IP** environment where an operator can monitor telemetry and actively override system setpoints.

### Core Architecture
- **Physical Simulation Engine:** Deterministic polling cycle (1000ms) with thermal and rotational inertia modeling.
- **Protocol Layer:** Simulated Modbus TCP frames (RX/TX) for telemetry and state changes.
- **Safety System:** Hard-coded industrial interlocks (Valve/Mixer) to prevent operational hazards.
- **Frontend:** Next.js 15, Tailwind CSS, and Recharts for high-frequency time-series visualization.

## ✨ Features

- **Full Control System:** Switch between **Auto** and **Manual Override** modes.
- **Safety Interlocks:** Automated blocks that prevent valve discharge while mixing.
- **Live Communication Log:** Real-time hex-format protocol traffic visualization.
- **Trend Analysis:** Last 60 seconds of sensor data with industrial threshold alerts.
- **Responsive HMI:** Optimized for fixed-viewport control panels (Single Viewport layout).

## 🛠️ Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development HMI:**
   ```bash
   npm run dev
   ```

3. **Open:** [http://localhost:9002](http://localhost:9002)

## 📝 Disclaimer

This is a **Simulation/Educational Prototype**. It does not connect to physical PLCs or real industrial hardware out of the box. It is designed to demonstrate HMI design principles and state management in complex industrial interfaces.

## 📝 License

Distributed under the MIT License.

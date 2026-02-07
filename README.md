# ChemView | Industrial Mixing HMI Digital Twin

ChemView is a futuristic, high-end Human-Machine Interface (HMI) prototype for monitoring and controlling industrial chemical mixing tanks. Designed as a **Digital Twin Prototype**, it demonstrates real-time data visualization, animated physical simulations, and AI-driven operational insights.

![ChemView HMI](https://picsum.photos/seed/hmi/1200/600)

## 🚀 Overview

This project serves as an educational prototype for building industrial control panels using modern web technologies. It simulates a **Modbus TCP/IP** polling cycle to fetch sensor data (RPM, Temperature, pH, Valve Status) and provides a "Simulated Intelligence" alerting system to assist operators.

## 🏗️ Architecture

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with a futuristic "Cyberpunk HMI" aesthetic.
- **Components:** [Shadcn UI](https://ui.shadcn.com/) for high-quality, accessible modular tiles.
- **Charts:** [Recharts](https://recharts.org/) for high-frequency time-series data visualization.
- **Simulation:** A deterministic polling engine that simulates Modbus Holding Registers updates every 1000ms.
- **AI Logic:** Simulated Intelligence module providing rule-based operational insights without external API dependencies.

## ✨ Features

- **Visual Tank Simulation:** Dynamic CSS-animated schematic showing liquid levels, bubble agitation, and rotating mixer blades synced to real-time RPM.
- **Real-time Data Ingestion:** Simulated polling cycle reading Mixing Speed (RPM), Temperature (°C), pH Level, and Valve Status.
- **Interactive Controls:** Industrial-grade Start/Stop and Emergency Stop (E-STOP) functionality.
- **Trend Analysis:** Live line charts displaying historical fluctuations over a 60-second window.
- **Smart Alerting:** Simulated "AI Insights" that analyze sensor states and historical patterns to recommend corrective actions.

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
4. Open [http://localhost:9002](http://localhost:9002) in your browser.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details. Built for educational purposes as a demonstration of high-performance React-based industrial interfaces.

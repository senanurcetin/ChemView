"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TankSimulation } from './TankSimulation';
import { TrendChart } from './TrendChart';
import { ControlPanel } from './ControlPanel';
import { StatusDisplay } from './StatusDisplay';
import { AlertPanel } from './AlertPanel';

/**
 * @typedef {Object} DataHistory
 * @property {string} time - Formatted timestamp (HH:mm:ss)
 * @property {number} value - The numerical sensor value
 */
interface DataHistory {
  time: string;
  value: number;
}

/**
 * Dashboard Component
 * 
 * The central controller for the ChemView HMI. It manages the simulated Modbus polling
 * cycle, maintains sensor history for charts, and executes the simulated AI alerting logic.
 */
export function Dashboard() {
  // System State
  const [isRunning, setIsRunning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected" | "Connecting">("Connected");
  
  // Sensors
  const [rpm, setRpm] = useState(0);
  const [temp, setTemp] = useState(24.5);
  const [ph, setPh] = useState(7.0);
  const [valveOpen, setValveOpen] = useState(false);
  
  // History & Trends
  const [rpmHistory, setRpmHistory] = useState<DataHistory[]>([]);
  const [tempHistory, setTempHistory] = useState<DataHistory[]>([]);
  const [stateLog, setStateLog] = useState<any[]>([]);
  
  // Alerts
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  /**
   * Modbus Simulation Service - State Update Logic
   * 
   * Simulates the physical dynamics of a mixing tank.
   * When running: RPM and Temperature ramp up towards setpoints.
   * When stopped: RPM decays and Temperature cools towards ambient.
   */
  const tick = useCallback(() => {
    if (!isRunning) {
      setRpm(prev => Math.max(0, prev - 15));
      setTemp(prev => Math.max(22, prev - 0.05));
      setPh(prev => prev + (Math.random() - 0.5) * 0.01);
      return;
    }

    // Targeted simulated setpoints
    const targetRpm = 450 + Math.random() * 50;
    const targetTemp = 65 + Math.random() * 2;
    const targetPh = 7.2 + Math.random() * 0.4;

    // Smooth state transitions (linear interpolation simulation)
    setRpm(prev => prev + (targetRpm - prev) * 0.1);
    setTemp(prev => prev + (targetTemp - prev) * 0.02);
    setPh(prev => prev + (targetPh - prev) * 0.05);
    
    // Random valve activity simulation
    if (Math.random() > 0.95) setValveOpen(v => !v);

  }, [isRunning]);

  /**
   * Polling Cycle Logic
   * 
   * Emulates a Modbus TCP/IP polling cycle by fetching "register" data every 1000ms.
   * This interval updates the local state and pushes data to the historical trend buffers.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

      setRpmHistory(prev => {
        const next = [...prev, { time: timeStr, value: rpm }];
        return next.slice(-60); // Keep last 60 seconds
      });

      setTempHistory(prev => {
        const next = [...prev, { time: timeStr, value: temp }];
        return next.slice(-60);
      });

      setStateLog(prev => {
        const next = [...prev, {
          mixingSpeedRpm: rpm,
          temperatureCelsius: temp,
          pHLevel: ph,
          valveStatus: valveOpen ? "open" : "closed",
          timestamp: now.toISOString()
        }];
        return next.slice(-10);
      });

    }, 1000);

    return () => clearInterval(interval);
  }, [tick, rpm, temp, ph, valveOpen]);

  /**
   * Simulated Intelligence Logic (Mock AI Mode)
   * 
   * Analyzes current system state against operational thresholds to generate
   * specific, actionable insights for the operator without external API dependencies.
   */
  const checkAlerts = useCallback(() => {
    setIsAiProcessing(true);
    
    // Artificial delay to simulate processing time
    setTimeout(() => {
      let newAlertMessage = "";
      let urgency: 'low' | 'medium' | 'high' = 'low';

      if (temp > 80) {
        newAlertMessage = "⚠️ AI Insight: Overheating detected in Reactor B7. Recommend cooling cycle.";
        urgency = 'high';
      } else if (rpm < 100 && valveOpen && isRunning) {
        newAlertMessage = "⚠️ AI Insight: Mixer efficiency low. Check motor load.";
        urgency = 'medium';
      } else {
        newAlertMessage = "✅ AI Analysis: System operating within optimal parameters.";
        urgency = 'low';
      }

      // Only add if it's a priority message (high/medium) or to refresh the "optimal" status
      setAlerts(prev => {
        // Prevent exact duplicate spam
        if (prev.length > 0 && prev[0].data.alertMessage === newAlertMessage) return prev;
        
        return [{
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          data: {
            alertMessage: newAlertMessage,
            urgencyLevel: urgency
          }
        }, ...prev].slice(0, 5);
      });

      setIsAiProcessing(false);
    }, 800);
  }, [rpm, temp, valveOpen, isRunning]);

  // Run AI analysis check periodically
  useEffect(() => {
    const timer = setInterval(() => {
      checkAlerts();
    }, 5000);
    return () => clearInterval(timer);
  }, [checkAlerts]);

  const toggleRunning = () => setIsRunning(!isRunning);
  const emergencyStop = () => {
    setIsRunning(false);
    setRpm(0);
    setValveOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-10 max-w-[1600px] mx-auto min-h-screen">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-primary">CHEMVIEW <span className="text-white font-light">HMI 4.0</span></h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">Chemical Mixing Management System // Open Source Prototype</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground tracking-tighter">Production Line</div>
            <div className="text-sm font-bold text-primary">REACTOR_UNIT_B7</div>
          </div>
          <div className="h-10 w-px bg-white/10 mx-2 hidden lg:block" />
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#00FFFF]" />
                <span className="text-xs font-mono text-primary font-bold">SIMULATED MODBUS ACTIVE</span>
             </div>
             <span className="text-[10px] text-muted-foreground font-mono">POLLING: 1000MS // PORT: 502</span>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Tank & Status */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <StatusDisplay 
            mixingSpeed={rpm}
            temperature={temp}
            ph={ph}
            valveOpen={valveOpen}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
            <div className="hmi-panel flex items-center justify-center min-h-[400px]">
              <TankSimulation 
                rpm={rpm}
                isRunning={isRunning}
                temperature={temp}
                ph={ph}
              />
            </div>
            
            <div className="flex flex-col gap-6">
              <TrendChart 
                title="Temperature Trend"
                data={tempHistory}
                color="#00FFFF"
                unit="°C"
                domain={[20, 100]}
              />
              <TrendChart 
                title="Mixer Speed Trend"
                data={rpmHistory}
                color="#00FFFF"
                unit="RPM"
                domain={[0, 1000]}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Controls & Simulated AI Alerts */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <ControlPanel 
            isRunning={isRunning}
            onToggle={toggleRunning}
            onEmergencyStop={emergencyStop}
            connectionStatus={connectionStatus}
          />
          
          <div className="flex-grow min-h-[300px]">
            <AlertPanel 
              alerts={alerts}
              isGenerating={isAiProcessing}
            />
          </div>
        </div>

      </div>

      {/* Footer / Status Bar */}
      <footer className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        <div className="flex gap-6">
          <span>MEM: 24.1GB/128GB</span>
          <span>LATENCY: 14ms (MOCK)</span>
          <span>MODE: EDUCATIONAL PROTOTYPE</span>
        </div>
        <div className="flex items-center gap-2">
          <span>OPERATOR: TECH_USER_42</span>
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      </footer>
    </div>
  );
}

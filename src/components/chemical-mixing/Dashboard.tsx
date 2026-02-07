"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TankSimulation } from './TankSimulation';
import { TrendChart } from './TrendChart';
import { ControlPanel } from './ControlPanel';
import { StatusDisplay } from './StatusDisplay';
import { AlertPanel } from './AlertPanel';
import { generateIntelligentAlert, IntelligentAlertInput, IntelligentAlertOutput } from '@/ai/flows/intelligent-alert-generation';

interface DataHistory {
  time: string;
  value: number;
}

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

  // Polling Refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation Logic
  const tick = useCallback(() => {
    if (!isRunning) {
      setRpm(prev => Math.max(0, prev - 15));
      setTemp(prev => Math.max(22, prev - 0.05));
      setPh(prev => prev + (Math.random() - 0.5) * 0.01);
      return;
    }

    // Target values
    const targetRpm = 450 + Math.random() * 50;
    const targetTemp = 65 + Math.random() * 2;
    const targetPh = 7.2 + Math.random() * 0.4;

    setRpm(prev => prev + (targetRpm - prev) * 0.1);
    setTemp(prev => prev + (targetTemp - prev) * 0.02);
    setPh(prev => prev + (targetPh - prev) * 0.05);
    
    // Periodically flip valve
    if (Math.random() > 0.95) setValveOpen(v => !v);

  }, [isRunning]);

  // Update Charts & History
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

      setRpmHistory(prev => {
        const next = [...prev, { time: timeStr, value: rpm }];
        return next.slice(-60);
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

  // GenAI Alert Generation
  const checkAlerts = useCallback(async () => {
    if (stateLog.length < 5 || isAiProcessing) return;

    setIsAiProcessing(true);
    try {
      const input: IntelligentAlertInput = {
        mixingSpeedRpm: rpm,
        temperatureCelsius: temp,
        pHLevel: ph,
        valveStatus: valveOpen ? "open" : "closed",
        pastStates: stateLog.slice(-5),
        temperatureThreshold: 60,
        rpmThreshold: 100,
        phUpperThreshold: 8.5,
        phLowerThreshold: 6.0
      };

      const result = await generateIntelligentAlert(input);
      
      // Only add if it's a non-empty alert message
      if (result.alertMessage && result.alertMessage.length > 5) {
        setAlerts(prev => {
          // Prevent exact duplicate spam
          if (prev.length > 0 && prev[0].data.alertMessage === result.alertMessage) return prev;
          
          return [{
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            data: result
          }, ...prev].slice(0, 10);
        });
      }
    } catch (error) {
      console.error("AI Alert Generation failed", error);
    } finally {
      setIsAiProcessing(false);
    }
  }, [rpm, temp, ph, valveOpen, stateLog, isAiProcessing]);

  // Run AI check every 10 seconds or when thresholds crossed
  useEffect(() => {
    const timer = setInterval(() => {
      checkAlerts();
    }, 10000);
    return () => clearInterval(timer);
  }, [checkAlerts]);

  // Threshold-based trigger (faster than timer)
  useEffect(() => {
    if (temp > 75 || (isRunning && rpm < 50)) {
       checkAlerts();
    }
  }, [temp, rpm, isRunning, checkAlerts]);

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
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">Chemical Mixing Management System // v2.4.1</p>
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
                <span className="text-xs font-mono text-primary font-bold">MODBUS POLLING ACTIVE</span>
             </div>
             <span className="text-[10px] text-muted-foreground font-mono">CYCLE: 1000MS // PORT: 502</span>
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

        {/* Right Column: Controls & AI Alerts */}
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
          <span>LATENCY: 14ms</span>
          <span>ENCRYPTION: AES-256</span>
        </div>
        <div className="flex items-center gap-2">
          <span>OPERATOR: TECH_USER_42</span>
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      </footer>
    </div>
  );
}

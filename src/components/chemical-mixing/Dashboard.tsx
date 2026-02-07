"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TankSimulation } from './TankSimulation';
import { TrendChart } from './TrendChart';
import { ControlPanel } from './ControlPanel';
import { StatusDisplay } from './StatusDisplay';
import { AlertPanel } from './AlertPanel';
import { AuditLog } from './AuditLog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

/**
 * @typedef {Object} DataHistory
 * @property {string} time - Formatted timestamp (HH:mm:ss)
 * @property {number} value - The numerical sensor value
 */
interface DataHistory {
  time: string;
  value: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'low' | 'medium' | 'high';
}

/**
 * Dashboard Component
 * 
 * The central controller for the ChemView HMI. It manages the simulated Modbus polling
 * cycle, maintains sensor history for charts, executes the simulated AI alerting logic,
 * and handles manual control overrides and safety interlocks.
 */
export function Dashboard() {
  const { toast } = useToast();

  // System State
  const [isRunning, setIsRunning] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isHeaterOn, setIsHeaterOn] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected" | "Connecting">("Connected");
  
  // Sensors & Setpoints
  const [rpm, setRpm] = useState(0);
  const [temp, setTemp] = useState(24.5);
  const [ph, setPh] = useState(7.0);
  const [valveOpen, setValveOpen] = useState(false);
  
  // Manual Control Setpoints
  const [targetRpmManual, setTargetRpmManual] = useState(500);
  const [targetTempManual, setTargetTempManual] = useState(60);

  // History & Trends
  const [rpmHistory, setRpmHistory] = useState<DataHistory[]>([]);
  const [tempHistory, setTempHistory] = useState<DataHistory[]>([]);
  
  // Alerts & Audit Log
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<LogEntry[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  /**
   * Modbus Simulation Service - State Update Logic
   * 
   * Simulates the physical dynamics of a mixing tank.
   * Auto Mode: Uses pre-defined operational setpoints with random fluctuation.
   * Manual Mode: Ramps towards user-defined setpoints from sliders.
   * Heating: Temperature trends up if heater is on, cools down if off.
   */
  const tick = useCallback(() => {
    // RPM Dynamics
    if (!isRunning) {
      setRpm(prev => Math.max(0, prev - 15));
    } else {
      const targetRpm = isManualMode 
        ? targetRpmManual 
        : (450 + Math.random() * 50);
      setRpm(prev => prev + (targetRpm - prev) * 0.1);
    }

    // Temperature Dynamics (Physics)
    if (isHeaterOn) {
      // Heating up
      setTemp(prev => {
        const target = isManualMode ? targetTempManual : 75;
        const heatRate = 0.15; // Degrees per tick
        return prev < target ? prev + heatRate : prev + (Math.random() - 0.5) * 0.1;
      });
    } else {
      // Ambient cooling down to 22.0°C
      setTemp(prev => prev > 22.0 ? prev - 0.05 : prev + (Math.random() - 0.5) * 0.02);
    }

    // pH Dynamics
    const targetPh = 7.2 + Math.random() * 0.4;
    setPh(prev => prev + (targetPh - prev) * 0.05);
    
    // Auto Valve simulation (only if not manually controlled and interlocks allow)
    if (!isManualMode && Math.random() > 0.98 && !isRunning && rpm < 5) {
      setValveOpen(v => !v);
    }

  }, [isRunning, isManualMode, isHeaterOn, targetRpmManual, targetTempManual, rpm]);

  /**
   * Polling Cycle Logic
   */
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
    }, 1000);

    return () => clearInterval(interval);
  }, [tick, rpm, temp]);

  /**
   * Simulated Intelligence Logic
   */
  const checkAlerts = useCallback(() => {
    setIsAiProcessing(true);
    
    setTimeout(() => {
      let newAlertMessage = "";
      let urgency: 'low' | 'medium' | 'high' = 'low';

      if (temp > 85) {
        newAlertMessage = "⚠️ AI Insight: High temperature warning. Safety protocols suggest cooling cycle.";
        urgency = 'high';
      } else if (rpm < 100 && isRunning) {
        newAlertMessage = "⚠️ AI Insight: Low speed detected while active. Potential motor strain.";
        urgency = 'medium';
      } else {
        newAlertMessage = "✅ AI Analysis: System operating within optimal parameters.";
        urgency = 'low';
      }

      setAlerts(prev => {
        if (prev.length > 0 && prev[0].data.alertMessage === newAlertMessage) return prev;
        
        if (urgency !== 'low') {
          setAuditLog(log => [
            {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toLocaleTimeString(),
              message: newAlertMessage,
              level: urgency
            },
            ...log
          ].slice(0, 50));
        }

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
  }, [rpm, temp, isRunning]);

  useEffect(() => {
    const timer = setInterval(() => {
      checkAlerts();
    }, 5000);
    return () => clearInterval(timer);
  }, [checkAlerts]);

  // Actions with Safety Interlocks
  const toggleRunning = () => {
    if (!isRunning && valveOpen) {
      toast({
        variant: "destructive",
        title: "Interlock Active",
        description: "⛔ Mixer cannot be started while Discharge Valve is OPEN.",
      });
      return;
    }

    const newState = !isRunning;
    setIsRunning(newState);
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: `Mixer ${newState ? 'STARTED' : 'STOPPED'} by Operator`,
        level: 'low'
      },
      ...log
    ].slice(0, 50));
  };

  const toggleValve = () => {
    if (isRunning || rpm > 5) {
      toast({
        variant: "destructive",
        title: "Interlock Active",
        description: "⛔ Valve cannot be opened while Mixer is RUNNING.",
      });
      return;
    }
    const newState = !valveOpen;
    setValveOpen(newState);
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: `Valve ${newState ? 'OPENED' : 'CLOSED'} by Operator`,
        level: 'low'
      },
      ...log
    ].slice(0, 50));
  };

  const emergencyStop = () => {
    setIsRunning(false);
    setIsHeaterOn(false);
    setRpm(0);
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: "EMERGENCY STOP TRIGGERED",
        level: 'high'
      },
      ...log
    ].slice(0, 50));
  };

  const exportToCsv = () => {
    const csvRows = [
      ["Timestamp", "RPM", "Temperature (°C)"],
      ...rpmHistory.map((item, idx) => [
        item.time,
        item.value.toFixed(2),
        tempHistory[idx]?.value.toFixed(2) || "0"
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reactor_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-10 max-w-[1600px] mx-auto min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-primary">CHEMVIEW <span className="text-white font-light">HMI 4.0</span></h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">Industrial Control System // Digital Twin Prototype</p>
        </div>
        <div className="flex items-center gap-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCsv}
            className="border-primary/20 hover:border-primary/50 text-xs font-mono gap-2"
          >
            <Download className="w-3 h-3" /> EXPORT CSV
          </Button>
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#00FFFF]" />
                <span className="text-xs font-mono text-primary font-bold uppercase">Modbus Active</span>
             </div>
             <span className="text-[10px] text-muted-foreground font-mono">192.168.1.50:502</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        <div className="xl:col-span-8 flex flex-col gap-6">
          <StatusDisplay 
            mixingSpeed={rpm}
            temperature={temp}
            ph={ph}
            valveOpen={valveOpen}
            isHeaterOn={isHeaterOn}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
            <div className="hmi-panel flex items-center justify-center min-h-[450px]">
              <TankSimulation 
                rpm={rpm}
                isRunning={isRunning}
                temperature={temp}
                ph={ph}
                isHeaterOn={isHeaterOn}
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
                domain={[0, 1500]}
              />
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-6">
          <ControlPanel 
            isRunning={isRunning}
            isManualMode={isManualMode}
            onToggle={toggleRunning}
            onToggleMode={() => setIsManualMode(!isManualMode)}
            onEmergencyStop={emergencyStop}
            connectionStatus={connectionStatus}
            targetRpm={targetRpmManual}
            targetTemp={targetTempManual}
            setTargetRpm={setTargetRpmManual}
            setTargetTemp={setTargetTempManual}
            valveOpen={valveOpen}
            onToggleValve={toggleValve}
            isHeaterOn={isHeaterOn}
            onToggleHeater={() => setIsHeaterOn(!isHeaterOn)}
          />
          
          <div className="grid grid-cols-1 gap-6 flex-grow">
            <AlertPanel 
              alerts={alerts}
              isGenerating={isAiProcessing}
            />
            <AuditLog logs={auditLog} />
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        <div className="flex gap-6">
          <span>LATENCY: 12ms</span>
          <span>SYSTEM_HEALTH: 98.4%</span>
          <span>MODE: {isManualMode ? 'MANUAL_OVERRIDE' : 'AUTO_OPTIMIZATION'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>OPERATOR: TECH_USER_42</span>
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      </footer>
    </div>
  );
}

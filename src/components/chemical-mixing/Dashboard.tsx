"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { TankSimulation } from './TankSimulation';
import { TrendChart } from './TrendChart';
import { ControlPanel } from './ControlPanel';
import { StatusDisplay } from './StatusDisplay';
import { AlertPanel } from './AlertPanel';
import { AuditLog } from './AuditLog';
import { CommunicationLog } from './CommunicationLog';
import { NetworkStats } from './NetworkStats';
import { Button } from '@/components/ui/button';
import { Download, Wifi } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

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

interface TrafficEntry {
  id: string;
  timestamp: string;
  direction: 'RX' | 'TX';
  frame: string;
}

/**
 * Dashboard Component
 * 
 * The main orchestrator for the ChemView HMI. 
 * 
 * Polling Logic: 
 * Runs on a 1000ms interval (tick) simulating a Modbus TCP/IP polling cycle.
 * Each tick updates physical sensors using linear interpolation to simulate 
 * inertia (rotational and thermal).
 * 
 * Safety Logic: 
 * Implements hard interlocks between the mixer motor and the discharge valve.
 */
export function Dashboard() {
  const { toast } = useToast();

  // System State
  const [isRunning, setIsRunning] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isHeaterOn, setIsHeaterOn] = useState(false);
  const [connectionStatus] = useState<"Connected" | "Disconnected" | "Connecting">("Connected");
  
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

  // Network & Protocol Simulation
  const [rxActive, setRxActive] = useState(false);
  const [txActive, setTxActive] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [latency, setLatency] = useState(15.2);
  const [trafficLogs, setTrafficLogs] = useState<TrafficEntry[]>([]);

  /**
   * Simulates raw Modbus TCP/IP ADU frames
   */
  const generateModbusFrame = (direction: 'RX' | 'TX', type: 'read' | 'write') => {
    const header = "00 01 00 00 00";
    const unitId = "01";
    const fc = type === 'read' ? '03' : '05';
    const payload = Array.from({ length: 4 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(' ');
    return `${header} 06 ${unitId} ${fc} ${payload}`;
  };

  const triggerTx = useCallback((type: 'read' | 'write' = 'write') => {
    setTxActive(true);
    setPacketCount(p => p + 1);
    setTrafficLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        direction: 'TX',
        frame: generateModbusFrame('TX', type)
      }
    ].slice(-50));
    setTimeout(() => setTxActive(false), 150);
  }, []);

  const triggerRx = useCallback(() => {
    setRxActive(true);
    setPacketCount(p => p + 1);
    setLatency(12 + Math.random() * 6);
    setTrafficLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        direction: 'RX',
        frame: generateModbusFrame('RX', 'read')
      }
    ].slice(-50));
    setTimeout(() => setRxActive(false), 150);
  }, []);

  /**
   * The core physical simulation loop
   */
  const tick = useCallback(() => {
    triggerRx();

    // RPM Dynamics: Rotational inertia modeling
    if (!isRunning) {
      setRpm(prev => Math.max(0, prev - 15));
    } else {
      const targetRpm = isManualMode 
        ? targetRpmManual 
        : (450 + Math.random() * 50);
      setRpm(prev => prev + (targetRpm - prev) * 0.1);
    }

    // Temperature Dynamics: Thermal inertia and heater logic
    if (isHeaterOn) {
      setTemp(prev => {
        const target = isManualMode ? targetTempManual : 75;
        const heatRate = 0.15;
        return prev < target ? prev + heatRate : prev + (Math.random() - 0.5) * 0.1;
      });
    } else {
      setTemp(prev => prev > 22.0 ? prev - 0.05 : prev + (Math.random() - 0.5) * 0.02);
    }

    // pH Dynamics: Slow stochastic drift
    const targetPh = 7.2 + Math.random() * 0.4;
    setPh(prev => prev + (targetPh - prev) * 0.05);

  }, [isRunning, isManualMode, isHeaterOn, targetRpmManual, targetTempManual, triggerRx]);

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
   * Simulated Intelligence for predictive alerting
   */
  const checkAlerts = useCallback(() => {
    setIsAiProcessing(true);
    
    setTimeout(() => {
      let newAlertMessage = "";
      let urgency: 'low' | 'medium' | 'high' = 'low';

      if (temp > 80) {
        newAlertMessage = "⚠️ AI Insight: Overheating detected in Reactor B7. Recommend cooling cycle.";
        urgency = 'high';
      } else if (rpm < 100 && isRunning && valveOpen) {
        newAlertMessage = "⚠️ AI Insight: Mixer efficiency low. Check motor load.";
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
  }, [rpm, temp, isRunning, valveOpen]);

  useEffect(() => {
    const timer = setInterval(() => {
      checkAlerts();
    }, 5000);
    return () => clearInterval(timer);
  }, [checkAlerts]);

  // Actions
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
    triggerTx('write');
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: `INFO: Mixer ${newState ? 'STARTED' : 'STOPPED'} by Operator`,
        level: 'low'
      },
      ...log
    ].slice(0, 50));
  };

  const toggleValve = () => {
    // Safety check: allow toggle if RPM is essentially zero
    if (isRunning || rpm >= 1) {
      toast({
        variant: "destructive",
        title: "Action Denied",
        description: "⛔ Safety Lock: Wait for 0 RPM before discharging.",
      });
      return;
    }
    const newState = !valveOpen;
    setValveOpen(newState);
    triggerTx('write');
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: `INFO: Discharge Valve ${newState ? 'OPENED' : 'CLOSED'} by Operator`,
        level: 'low'
      },
      ...log
    ].slice(0, 50));
  };

  const toggleHeater = () => {
    const newState = !isHeaterOn;
    setIsHeaterOn(newState);
    triggerTx('write');
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: `INFO: Heater System ${newState ? 'ACTIVATED' : 'DEACTIVATED'} - Setpoint: ${targetTempManual.toFixed(1)}°C`,
        level: 'low'
      },
      ...log
    ].slice(0, 50));
  };

  const emergencyStop = () => {
    setIsRunning(false);
    setIsHeaterOn(false);
    setRpm(0);
    triggerTx('write');
    setAuditLog(log => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message: "EMERGENCY STOP TRIGGERED BY OPERATOR",
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

  const systemState = isRunning && rpm > 10 ? "MIXING" : isHeaterOn ? "HEATING" : "IDLE";
  const interlockActive = (isRunning || rpm >= 1 || valveOpen) ? "ACTIVE" : "INACTIVE";

  return (
    <div className="flex flex-col h-screen overflow-hidden p-4 lg:p-6 max-w-[1800px] mx-auto bg-[#222222]">
      <header className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-primary">CHEMVIEW <span className="text-white font-light">HMI 1.0</span></h1>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Industrial Digital Twin Prototype</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-zinc-900/50 px-3 py-1.5 rounded-md border border-white/5">
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold text-zinc-500 uppercase">RX</span>
              <div className={cn("w-1.5 h-1.5 rounded-full transition-all", rxActive ? "bg-primary glow-primary" : "bg-zinc-800")} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold text-zinc-500 uppercase">TX</span>
              <div className={cn("w-1.5 h-1.5 rounded-full transition-all", txActive ? "bg-orange-500 shadow-orange-500" : "bg-zinc-800")} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCsv} className="h-8 text-[10px] font-mono gap-2 border-white/10">
            <Download className="w-3 h-3" /> EXPORT CSV
          </Button>
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-mono text-primary font-bold uppercase">Gateway Active</span>
             </div>
             <span className="text-[9px] text-muted-foreground font-mono">192.168.1.50:502</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4 flex-grow overflow-hidden">
        {/* Left Column: Telemetry & Visualization */}
        <div className="col-span-8 flex flex-col gap-4 overflow-hidden">
          <StatusDisplay 
            mixingSpeed={rpm}
            temperature={temp}
            ph={ph}
            valveOpen={valveOpen}
            isHeaterOn={isHeaterOn}
          />
          
          <div className="grid grid-cols-2 gap-4 flex-grow overflow-hidden">
            <div className="hmi-panel flex flex-col items-center justify-center p-4">
              <TankSimulation 
                rpm={rpm}
                isRunning={isRunning}
                temperature={temp}
                ph={ph}
                isHeaterOn={isHeaterOn}
              />
            </div>
            
            <div className="flex flex-col gap-4 overflow-hidden">
              <TrendChart title="Temperature" data={tempHistory} color="#00FFFF" unit="°C" domain={[20, 100]} />
              <TrendChart title="Mixer Speed" data={rpmHistory} color="#00FFFF" unit="RPM" domain={[0, 1500]} />
              <div className="flex-grow overflow-hidden">
                <CommunicationLog logs={trafficLogs} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Controls & Intelligence */}
        <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
          <NetworkStats packetCount={packetCount} latency={latency} errorRate={0.0} />
          
          <ControlPanel 
            isRunning={isRunning}
            isManualMode={isManualMode}
            onToggle={toggleRunning}
            onToggleMode={() => { setIsManualMode(!isManualMode); triggerTx('write'); }}
            onEmergencyStop={emergencyStop}
            connectionStatus={connectionStatus}
            targetRpm={targetRpmManual}
            targetTemp={targetTempManual}
            currentRpm={rpm}
            setTargetRpm={(val) => { setTargetRpmManual(val); triggerTx('write'); }}
            setTargetTemp={(val) => { setTargetTempManual(val); triggerTx('write'); }}
            valveOpen={valveOpen}
            onToggleValve={toggleValve}
            isHeaterOn={isHeaterOn}
            onToggleHeater={toggleHeater}
          />
          
          <div className="flex-grow grid grid-rows-2 gap-4 overflow-hidden">
            <AlertPanel alerts={alerts} isGenerating={isAiProcessing} />
            <AuditLog logs={auditLog} />
          </div>
        </div>
      </div>

      <footer className="mt-4 pt-3 border-t border-white/5 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
          <div className="flex gap-4">
            <span>LATENCY: {latency.toFixed(1)}ms</span>
            <span>HEALTH: 99.8%</span>
            <span>BUFFER: {trafficLogs.length}/50</span>
          </div>
          <span>OPERATOR: TECH_USER_42</span>
        </div>
        <div className="bg-zinc-900/50 p-1.5 rounded border border-white/5 text-[8px] font-mono text-zinc-500 flex gap-4 uppercase">
          <span>STATE: {systemState}</span>
          <span>INTERLOCK: {interlockActive}</span>
          <span>HEATER: {isHeaterOn ? "ON" : "OFF"}</span>
          <span>LOCK: {rpm < 1 ? "READY" : "BUSY"}</span>
        </div>
      </footer>
    </div>
  );
}

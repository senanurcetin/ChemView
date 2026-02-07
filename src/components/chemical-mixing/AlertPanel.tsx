"use client"

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, AlertTriangle, Info, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  timestamp: string;
  data: {
    alertMessage: string;
    urgencyLevel: 'low' | 'medium' | 'high';
  };
}

interface AlertPanelProps {
  alerts: Alert[];
  isGenerating: boolean;
}

export function AlertPanel({ alerts, isGenerating }: AlertPanelProps) {
  return (
    <div className="hmi-panel bg-zinc-950/50 border-white/5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Operational Insights</h3>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-primary animate-pulse uppercase">Simulating...</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-grow pr-4">
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center mb-4">
                <Info className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                System parameters are within normal operating thresholds. No active alerts.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const Icon = alert.data.urgencyLevel === 'high' ? AlertTriangle : AlertCircle;
              const color = alert.data.urgencyLevel === 'high' 
                ? 'text-red-500 border-red-500/20 bg-red-500/5' 
                : alert.data.urgencyLevel === 'medium'
                ? 'text-orange-500 border-orange-500/20 bg-orange-500/5'
                : 'text-cyan-500 border-cyan-500/20 bg-cyan-500/5';

              return (
                <div 
                  key={alert.id} 
                  className={cn(
                    "p-3 border rounded-md transition-all animate-in fade-in slide-in-from-right-2",
                    color
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {alert.data.urgencyLevel} PRIORITY
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {alert.timestamp}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed font-medium">
                    {alert.data.alertMessage}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

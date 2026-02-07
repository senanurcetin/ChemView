"use client"

import React from 'react';
import { Network, Activity, Clock, ShieldAlert } from 'lucide-react';

interface NetworkStatsProps {
  packetCount: number;
  latency: number;
  errorRate: number;
}

export function NetworkStats({ packetCount, latency, errorRate }: NetworkStatsProps) {
  return (
    <div className="hmi-panel bg-zinc-950/50 border-white/5 p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Network className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Gateway Diagnostics</span>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground uppercase font-bold">Packets</span>
          <span className="text-xs font-mono text-white">{packetCount.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground uppercase font-bold">Latency</span>
          <span className="text-xs font-mono text-white">{latency.toFixed(1)}ms</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground uppercase font-bold">Errors</span>
          <span className="text-xs font-mono text-white">{errorRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[8px] text-zinc-500 font-mono mt-1 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <Activity className="w-2 h-2" />
          <span>SOCKET_TCP_READY</span>
        </div>
        <span>CRC_OK</span>
      </div>
    </div>
  );
}

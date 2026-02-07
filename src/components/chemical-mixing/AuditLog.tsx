"use client"

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'low' | 'medium' | 'high';
}

interface AuditLogProps {
  logs: LogEntry[];
}

export function AuditLog({ logs }: AuditLogProps) {
  return (
    <div className="hmi-panel bg-zinc-950/50 border-white/5 flex flex-col h-full min-h-[300px]">
      <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-4">
        <History className="w-4 h-4 text-primary" />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">System Event Audit Log</h3>
      </div>

      <ScrollArea className="flex-grow pr-4">
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-8">No historical events recorded.</p>
          ) : (
            logs.map((log) => {
              const Icon = log.level === 'high' ? ShieldAlert : log.level === 'medium' ? Shield : ShieldCheck;
              const color = log.level === 'high' 
                ? 'text-red-500' 
                : log.level === 'medium'
                ? 'text-orange-500'
                : 'text-zinc-400';

              return (
                <div 
                  key={log.id} 
                  className="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-primary/20"
                >
                  <Icon className={cn("w-3 h-3 mt-1", color)} />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground">{log.timestamp}</span>
                      <span className={cn("text-[9px] font-bold uppercase tracking-tighter", color)}>
                        {log.level}
                      </span>
                    </div>
                    <p className="text-[10px] leading-tight text-zinc-300 font-medium">
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

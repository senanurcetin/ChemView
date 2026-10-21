'use client';

import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal } from 'lucide-react';

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

interface TrafficEntry {
  id: string;
  timestamp: string;
  direction: 'RX' | 'TX';
  frame: string;
}

interface CommunicationLogProps {
  logs: TrafficEntry[];
}

export function CommunicationLog({ logs }: CommunicationLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <div className="hmi-panel bg-black border-primary/20 flex min-w-0 flex-col h-[200px] font-mono">
      <div className="flex items-center gap-2 mb-2 border-b border-primary/10 pb-2">
        <Terminal className="w-3 h-3 text-primary" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          Live Protocol Traffic (Modbus TCP/IP)
        </h3>
      </div>

      <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
        <div className="space-y-1 py-1">
          {logs.map((log) => (
            <div key={log.id} className="flex min-w-0 items-start gap-2 text-[11px]">
              <span className="shrink-0 text-muted-foreground">[{formatClock(log.timestamp)}]</span>
              <span className={log.direction === 'TX' ? 'text-orange-500' : 'text-primary'}>
                {log.direction === 'TX' ? 'SEND >' : 'RECV <'}
              </span>
              <span className="min-w-0 break-all font-mono leading-relaxed tracking-normal text-foreground">
                {log.frame}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-[11px] text-muted-foreground italic">Waiting for bus activity...</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

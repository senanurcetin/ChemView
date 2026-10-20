'use client';

import React from 'react';

interface ProcessSchematicProps {
  rpm: number;
  temperature: number;
  ph: number;
  level: number;
  mixerRunning: boolean;
  heaterOn: boolean;
  valveOpen: boolean;
}

/** Illustrative instrumentation: no physical equipment or field bus is connected. */
export function ProcessSchematic({
  rpm,
  temperature,
  ph,
  level,
  mixerRunning,
  heaterOn,
  valveOpen,
}: ProcessSchematicProps) {
  const accent = '#22d3ee';
  const line = '#94a3b8';
  return (
    <div className="mt-3 max-w-full overflow-x-auto rounded-md border border-white/10 bg-zinc-950/70 p-3">
      <svg
        role="img"
        aria-label="Synthetic reactor process and instrumentation diagram"
        viewBox="0 0 770 280"
        className="min-w-[600px] w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Synthetic reactor process and instrumentation diagram</title>
        <text x="12" y="18" fill="#a1a1aa" fontSize="12">
          REACTOR 01 — DEMONSTRATION SIGNALS
        </text>
        <rect x="240" y="72" width="250" height="170" rx="26" fill="#101c22" stroke={line} strokeWidth="3" />
        <rect
          x="243"
          y={238 - (Math.max(0, Math.min(level, 100)) / 100) * 160}
          width="244"
          height={(Math.max(0, Math.min(level, 100)) / 100) * 160}
          rx="20"
          fill="#164e63"
          fillOpacity="0.58"
        />
        <line x1="365" x2="365" y1="50" y2="195" stroke={line} strokeWidth="6" />
        <path d="M316 190 L414 190" stroke={mixerRunning ? accent : line} strokeWidth="8" />
        <circle cx="365" cy="49" r="26" fill="#0a1923" stroke={mixerRunning ? accent : line} strokeWidth="3" />
        <text x="365" y="54" fill="white" fontSize="13" textAnchor="middle">M</text>
        <text x="404" y="52" fill="#d4d4d8" fontSize="12">
          M-101 {rpm.toFixed(0)} RPM
        </text>

        <path d="M268 217 C300 201 325 232 355 217 S405 201 455 217"
          stroke={heaterOn ? '#fb923c' : line} fill="none" strokeWidth="5" />
        <text x="365" y="259" textAnchor="middle" fill={heaterOn ? '#fb923c' : '#a1a1aa'} fontSize="12">
          EH-101 {heaterOn ? 'ENERGIZED' : 'OFF'}
        </text>

        <line x1="490" x2="640" y1="218" y2="218" stroke={line} strokeWidth="4" />
        <path d="M565 204 L589 218 L565 232 Z M589 204 L565 218 L589 232 Z"
          fill={valveOpen ? accent : '#52525b'} stroke={line} strokeWidth="1" />
        <text x="579" y="191" fill="#d4d4d8" fontSize="12" textAnchor="middle">
          XV-101 {valveOpen ? 'OPEN' : 'CLOSED'}
        </text>
        <text x="650" y="222" fill="#a1a1aa" fontSize="11">
          DRAIN
        </text>

        <line x1="240" y1="130" x2="147" y2="130" stroke={accent} strokeDasharray="5 4" strokeWidth="2" />
        <circle cx="116" cy="130" r="29" fill="#0a1923" stroke={accent} strokeWidth="2" />
        <text x="116" y="126" fill="white" textAnchor="middle" fontSize="12">TT-101</text>
        <text x="116" y="142" fill="#bae6fd" textAnchor="middle" fontSize="12">
          {temperature.toFixed(1)}°C
        </text>

        <line x1="240" y1="190" x2="147" y2="190" stroke={accent} strokeDasharray="5 4" strokeWidth="2" />
        <circle cx="116" cy="190" r="29" fill="#0a1923" stroke={accent} strokeWidth="2" />
        <text x="116" y="186" fill="white" textAnchor="middle" fontSize="12">AIT-101</text>
        <text x="116" y="202" fill="#bae6fd" textAnchor="middle" fontSize="12">
          pH {ph.toFixed(2)}
        </text>

        <line x1="490" y1="124" x2="547" y2="124" stroke={accent} strokeDasharray="5 4" strokeWidth="2" />
        <circle cx="580" cy="124" r="29" fill="#0a1923" stroke={accent} strokeWidth="2" />
        <text x="580" y="120" fill="white" textAnchor="middle" fontSize="12">LT-101</text>
        <text x="580" y="136" fill="#bae6fd" textAnchor="middle" fontSize="12">
          {level.toFixed(1)}%
        </text>
        <text x="12" y="274" fill="#a1a1aa" fontSize="11">
          Dashed cyan = simulated sensor signals · Grey = process piping · No PLC wiring
        </text>
      </svg>
    </div>
  );
}

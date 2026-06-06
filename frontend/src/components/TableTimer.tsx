/**
 * frontend/src/components/TableTimer.tsx
 *
 * Shows how long a table has been occupied.
 * Color-coded: green → amber → red.
 * Relies on useTick in the parent to re-render periodically.
 */

import React from 'react';

interface Props {
  since: string;       // ISO timestamp
  compact?: boolean;   // true = just "47m", false = badge with color
}

function elapsed(iso: string): { mins: number; label: string } {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)   return { mins, label: '< 1m' };
  if (mins < 60)  return { mins, label: `${mins}m` };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { mins, label: m > 0 ? `${h}h ${m}m` : `${h}h` };
}

function color(mins: number): { text: string; bg: string; border: string; dot: string } {
  if (mins < 30)  return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400' };
  if (mins < 60)  return { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   dot: 'bg-amber-400'   };
  return              { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     dot: 'bg-red-400'     };
}

export default function TableTimer({ since, compact = false }: Props) {
  const { mins, label } = elapsed(since);
  const c = color(mins);

  if (compact) {
    // Tiny inline badge — used inside table cards
    return (
      <span className={`inline-flex items-center gap-1 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full border ${c.text} ${c.bg} ${c.border}`}>
        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${c.dot} ${mins >= 60 ? 'animate-pulse' : ''}`} />
        {label}
      </span>
    );
  }

  // Full badge — used in list/sidebar views
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 rounded-full border ${c.text} ${c.bg} ${c.border}`}>
      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {label}
      {mins >= 60 && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot} animate-pulse`} />}
    </span>
  );
}
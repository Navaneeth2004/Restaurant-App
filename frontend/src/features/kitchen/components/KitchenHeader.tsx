import { ReactNode } from 'react';

function Pill({ tone, pulse = false, children }: { tone: 'brand' | 'amber' | 'red'; pulse?: boolean; children: ReactNode }) {
  const cls = {
    brand: 'text-brand-400 bg-brand-500/15 border-brand-500/25',
    amber: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
    red: 'text-red-400 bg-red-500/15 border-red-500/25',
  }[tone];
  const dot = { brand: 'bg-brand-400', amber: 'bg-amber-400', red: 'bg-red-400' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide border px-2.5 py-1 rounded-full whitespace-nowrap ${cls} ${pulse ? 'animate-pulse' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dot}`} />{children}
    </span>
  );
}

interface Props { active: number; additions: number; cancellations: number; overdue: number; nowMs: number }

export default function KitchenHeader({ active, additions, cancellations, overdue, nowMs }: Props) {
  const clock = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-surface-border bg-surface-card/50 flex-wrap">
      <h2 className="font-bold text-white text-sm whitespace-nowrap">Kitchen Display</h2>
      <div className="flex items-center gap-2 flex-wrap">
        {active > 0 && <Pill tone="brand">{active} Active</Pill>}
        {additions > 0 && <Pill tone="amber" pulse>{additions} Addition{additions > 1 ? 's' : ''}</Pill>}
        {cancellations > 0 && <Pill tone="red" pulse>{cancellations} Cancellation{cancellations > 1 ? 's' : ''}</Pill>}
        {overdue > 0 && <Pill tone="red" pulse>{overdue} Overdue</Pill>}
      </div>
      <div className="ml-auto text-zinc-600 text-xs font-mono whitespace-nowrap">{clock}</div>
    </div>
  );
}

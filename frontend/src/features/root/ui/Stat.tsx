import { ReactNode } from 'react';

export default function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'red' | 'amber' }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`font-mono font-bold text-2xl mt-1 ${tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-zinc-600 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

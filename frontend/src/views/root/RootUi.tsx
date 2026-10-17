import React from 'react';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md'} rounded-xl border border-surface-border bg-surface-card shadow-2xl my-auto`}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-surface-border">
          <h3 className="font-bold text-white text-sm truncate">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  red:    'bg-red-500/15 text-red-400 border-red-500/25',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  grey:   'bg-zinc-700/30 text-zinc-400 border-zinc-600/40',
};
export function Badge({ tone = 'grey', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap ${TONES[tone] || TONES.grey}`}>{children}</span>;
}
export const statusTone = (s: string) => (s === 'active' ? 'green' : s === 'suspended' ? 'red' : 'grey');
export const ticketTone = (s: string) => (s === 'open' ? 'red' : s === 'in_progress' ? 'amber' : s === 'resolved' ? 'green' : 'grey');
export const severityTone = (s: string) => (s === 'critical' ? 'red' : s === 'high' ? 'amber' : s === 'medium' ? 'blue' : 'grey');

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`font-mono font-bold text-2xl mt-1 ${tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-zinc-600 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-zinc-600 text-[10px] mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <span className="text-zinc-500">{k}</span>
          <span className="text-zinc-200 text-right font-mono break-all">{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised/40 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">{title}</p>
      {children}
    </div>
  );
}
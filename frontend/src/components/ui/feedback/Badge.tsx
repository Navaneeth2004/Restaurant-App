import { ReactNode } from 'react';

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'indigo' | 'grey' | 'brand';
const TONES: Record<Tone, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  brand: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
  grey: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40',
};

export default function Badge({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

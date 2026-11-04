import { ReactNode } from 'react';

interface Props { title: string; subtitle?: string; headers: ReadonlyArray<string>; rows: ReadonlyArray<ReadonlyArray<ReactNode>>; scroll?: boolean }

/** A small read-only table card: first column left-aligned, the rest (figures) right-aligned. */
export default function BreakdownTable({ title, subtitle, headers, rows, scroll = false }: Props) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="bg-surface-raised px-4 py-3 border-b border-surface-border">
        <p className="text-zinc-300 text-xs font-semibold">{title}</p>
        {subtitle && <p className="text-zinc-600 text-[10px] mt-0.5">{subtitle}</p>}
      </div>
      <div className={`overflow-x-auto ${scroll ? 'max-h-72 overflow-y-auto' : ''}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-border text-zinc-600">
              {headers.map((h, i) => <th key={h} scope="col" className={`px-4 py-2 font-bold uppercase tracking-widest text-[10px] whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-surface-border/50 last:border-0">
                {r.map((c, j) => <td key={j} className={`px-4 py-2 ${j === 0 ? 'text-zinc-300' : 'text-right font-mono text-zinc-200'}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

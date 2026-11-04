import { Fragment, ReactNode } from 'react';

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="text-zinc-600 text-[10px] mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

/** Label/value pairs. */
export function KV({ rows }: { rows: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => <Fragment key={k}><dt className="text-zinc-500">{k}</dt><dd className="text-zinc-200 text-right font-mono break-all">{v}</dd></Fragment>)}
    </dl>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-border bg-surface-raised/40 p-4">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">{title}</h4>
      {children}
    </section>
  );
}

import { ReactNode } from 'react';

interface Props { title: string; badge?: string; desc?: string; children: ReactNode }

export default function SectionCard({ title, badge, desc, children }: Props) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold text-white text-sm">{title}</h3>
        {badge && <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      {desc && <p className="text-zinc-500 text-xs mb-4 leading-relaxed">{desc}</p>}
      <div className={desc ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

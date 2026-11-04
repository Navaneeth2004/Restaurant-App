export default function InfoTiles({ items }: { items: ReadonlyArray<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(i => (
        <div key={i.label} className="rounded-xl border border-surface-border bg-surface-card px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{i.label}</p>
          <p className="text-white text-xs font-mono font-semibold truncate" title={i.value}>{i.value || '—'}</p>
        </div>
      ))}
    </div>
  );
}

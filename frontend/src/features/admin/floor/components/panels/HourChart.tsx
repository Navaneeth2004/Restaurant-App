export default function HourChart({ bars }: { bars: ReadonlyArray<number> }) {
  const max = Math.max(...bars, 1);
  const total = bars.reduce((a, b) => a + b, 0);
  return (
    <div className="fl-card">
      <p className="fl-label mb-2.5">Orders started — last 12 hours</p>
      <div className="flex items-end gap-[3px] h-9" role="img" aria-label={`${total} orders in the last 12 hours`}>
        {bars.map((v, i) => (
          <div key={i} title={`${v} order${v === 1 ? '' : 's'}`} className="flex-1 rounded-t-[3px]"
            style={{ height: `${Math.max(10, Math.round((v / max) * 100))}%`, minHeight: v > 0 ? 4 : 2, background: i === bars.length - 1 ? 'var(--brand,#f97316)' : 'var(--fl-border2)', opacity: i === bars.length - 1 ? 1 : 0.55 + (i / bars.length) * 0.45 }} />
        ))}
      </div>
      <p className="fl-sub mt-1.5">{total} in total · rightmost bar = the last hour</p>
    </div>
  );
}

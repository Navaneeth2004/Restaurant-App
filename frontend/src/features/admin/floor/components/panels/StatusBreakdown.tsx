import type { FloorMetrics } from '../../hooks/floor-metrics';

export default function StatusBreakdown({ b, compact = false }: { b: FloorMetrics['breakdown']; compact?: boolean }) {
  const rows = [
    { label: compact ? 'Under 30m' : 'Occupied — under 30m', n: b.fresh, color: '#10b981' },
    { label: compact ? '30–60m' : 'Occupied — 30 to 60m', n: b.warm, color: '#f59e0b' },
    { label: compact ? 'Over 1hr' : 'Occupied — over 1hr', n: b.hot, color: '#ef4444' },
    { label: compact ? 'Bill' : 'Awaiting bill', n: b.bill, color: '#818cf8' },
    { label: compact ? 'Free' : 'Available', n: b.available, color: 'var(--fl-border2)' },
  ];
  return (
    <div className="fl-card flex flex-col gap-2">
      <p className="fl-label">Table status</p>
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
          <span className="fl-text2 text-[11px] flex-1">{r.label}</span>
          <span className="fl-value text-xs" style={{ color: r.n > 0 ? 'var(--fl-text)' : 'var(--fl-faint)' }}>{r.n}</span>
        </div>
      ))}
    </div>
  );
}

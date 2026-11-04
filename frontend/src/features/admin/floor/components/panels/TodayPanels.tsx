import { formatMoney } from 'lib/format/money';
import type { ReportSummary } from 'types/office/reports';

export function TopItemsPanel({ summary, sym }: { summary: ReportSummary | null; sym: string }) {
  const top = summary?.topItems.slice(0, 5) ?? [];
  const max = top[0]?.total_qty ?? 0;
  return (
    <div className="fl-card">
      <p className="fl-label mb-3">Top Items Today</p>
      {top.length === 0 ? <p className="fl-sub">No completed orders yet</p> : top.map((it, i) => (
        <div key={it.name} className="mb-2.5">
          <div className="flex justify-between mb-1">
            <span className="fl-text text-xs font-medium truncate min-w-0"><span className="fl-muted font-mono text-[10px] mr-1.5">#{i + 1}</span>{it.name}</span>
            <span className="flex-shrink-0 ml-2 text-[11px]"><span className="fl-muted">{it.total_qty}× </span><span className="font-mono font-semibold" style={{ color: 'var(--brand,#f97316)' }}>{formatMoney(it.total_rev, sym)}</span></span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--fl-border)' }}><div className="h-full rounded-full" style={{ width: `${max > 0 ? (it.total_qty / max) * 100 : 0}%`, background: 'var(--brand,#f97316)' }} /></div>
        </div>
      ))}
    </div>
  );
}

export function TodayGlance({ summary, sym, tableCount }: { summary: ReportSummary | null; sym: string; tableCount: number }) {
  const done = summary?.ordersCount ?? 0;
  const rows = [
    { label: 'Orders in kitchen', value: summary?.activeOrders ?? 0, max: Math.max(done, summary?.activeOrders ?? 0, 1), color: '#f97316' },
    { label: 'Completed today', value: done, max: Math.max(done, 1), color: '#10b981' },
    { label: 'Tables occupied', value: summary?.occupiedTables ?? 0, max: Math.max(tableCount, 1), color: '#3b82f6' },
  ];
  return (
    <div className="fl-card">
      <p className="fl-label mb-3">Today at a Glance</p>
      <div className="flex flex-col gap-3">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex justify-between mb-1"><span className="fl-text2 text-[11px]">{r.label}</span><span className="fl-value text-xs" style={{ color: 'var(--fl-text)' }}>{r.value}</span></div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--fl-border)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(Math.min(100, (r.value / r.max) * 100), r.value > 0 ? 4 : 0)}%`, background: r.color }} /></div>
          </div>
        ))}
        {summary && done > 0
          ? <div className="flex justify-between pt-2.5" style={{ borderTop: '1px solid var(--fl-border)' }}><span className="fl-muted text-[11px]">Avg order today</span><span className="fl-value text-xs" style={{ color: 'var(--fl-text)' }}>{formatMoney(summary.revenue / done, sym)}</span></div>
          : <p className="fl-sub">No completed orders yet today</p>}
      </div>
    </div>
  );
}

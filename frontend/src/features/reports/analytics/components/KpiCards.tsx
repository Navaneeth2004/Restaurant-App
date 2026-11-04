import { formatMoney } from 'lib/format/money';
import type { ReportSummary } from 'types/office/reports';

interface Tile { label: string; value: string; sub: string; accent?: boolean }

export default function KpiCards({ summary, sym }: { summary: ReportSummary | null; sym: string }) {
  const tiles: Tile[] = [
    { label: "Today's Revenue", value: formatMoney(summary?.revenue, sym), sub: 'before tax · completed visits', accent: true },
    { label: 'Visits Completed', value: String(summary?.ordersCount ?? 0), sub: 'closed today' },
    { label: 'Active Now', value: String(summary?.activeOrders ?? 0), sub: 'in kitchen' },
    { label: 'Tables Occupied', value: String(summary?.occupiedTables ?? 0), sub: 'currently in use' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="rounded-xl border border-surface-border bg-surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.label}</p>
          <p className={`font-mono font-bold text-2xl xl:text-3xl leading-tight break-all ${t.accent ? 'text-brand-400' : 'text-white'}`}>{t.value}</p>
          <p className="text-zinc-600 text-xs mt-2">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}

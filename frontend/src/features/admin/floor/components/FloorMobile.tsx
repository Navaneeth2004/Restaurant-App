import { formatMoney } from 'lib/format/money';
import type { FloorState } from '../hooks/useFloor';
import FloorTableCard from './panels/FloorTableCard';
import HourChart from './panels/HourChart';
import StatusBreakdown from './panels/StatusBreakdown';
import TableDetail from './panels/TableDetail';
import { TodayGlance, TopItemsPanel } from './panels/TodayPanels';

export default function FloorMobile({ f, sym }: { f: FloorState; sym: string }) {
  const m = f.metrics;
  const stats = [
    { l: 'Occupied', v: `${m.occupied}/${m.dineIn.length}`, color: 'var(--brand,#f97316)' },
    { l: 'Seat fill', v: `${m.seatPct}%`, color: m.seatPct > 70 ? 'var(--fl-red)' : m.seatPct > 40 ? 'var(--fl-amber)' : 'var(--fl-green)' },
    { l: 'In kitchen', v: formatMoney(m.kitchenValue, sym), color: 'var(--fl-indigo)' },
    { l: 'Bill wait', v: String(m.billPending), color: m.billPending > 0 ? 'var(--fl-indigo)' : 'var(--fl-muted)' },
  ];
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div className="flex-shrink-0 flex gap-2 overflow-x-auto no-scrollbar px-4 py-3" style={{ borderBottom: '1px solid var(--fl-border)' }}>
        {stats.map(s => <div key={s.l} className="fl-card flex-shrink-0 min-w-[80px] !px-3 !py-2 !rounded-[10px]"><p className="fl-label text-[9px]">{s.l}</p><p className="fl-value text-sm mt-1" style={{ color: s.color }}>{s.v}</p></div>)}
      </div>
      {!f.selected && (
        <div className="flex-shrink-0 px-4 py-3 flex flex-col gap-2.5" style={{ borderBottom: '1px solid var(--fl-border)' }}>
          <HourChart bars={f.hourly} /><StatusBreakdown b={m.breakdown} compact /><TopItemsPanel summary={f.summary} sym={sym} /><TodayGlance summary={f.summary} sym={sym} tableCount={m.dineIn.length} />
        </div>
      )}
      <div className="flex-shrink-0 flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-3" style={{ borderBottom: '1px solid var(--fl-border)' }}>
        {f.tables.map(t => (
          <div key={t.id} className="flex-shrink-0 w-[150px]">
            <FloorTableCard table={t} sym={sym} nowMs={f.nowMs} selected={f.selectedId === t.id} order={f.activeOrders.find(o => o.table_id === t.id) ?? null} onClick={() => f.select(t.id)} />
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-[200px]">
        {f.selected ? <TableDetail table={f.selected} orders={f.selectedOrders} sym={sym} nowMs={f.nowMs} onClose={f.clear} />
          : <p className="fl-sub text-[13px] text-center mt-8">Tap a table to see its order &amp; today's stats</p>}
      </div>
    </div>
  );
}

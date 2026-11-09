import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { elapsedLabel, formatTime, minutesSince } from 'lib/format/local-time';
import { formatMoney, sumLines } from 'lib/format/money';
import { mergeItems } from 'lib/orders/order-items';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';
import { tableHeat } from '../../hooks/floor-metrics';
import { useTableStats } from '../../hooks/useTableStats';
import { HEAT } from '../../floor-style';
import StatTile from './StatTile';

interface Props { table: Table; orders: ReadonlyArray<Order>; sym: string; nowMs: number; onClose: () => void }

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'var(--fl-card)', border: '1px solid var(--fl-border)' }}><p className="fl-label text-[9px]">{label}</p><p className="fl-value text-xs mt-1" style={{ color }}>{value}</p></div>;
}

export default function TableDetail({ table, orders, sym, nowMs, onClose }: Props) {
  const empty = table.status === 'empty';
  const { stats, loading } = useTableStats(table.id, empty);
  const since = table.occupied_since ?? orders.find(o => o.status === 'delivered')?.created_at ?? null;
  const mins = minutesSince(since, nowMs);
  const c = HEAT[tableHeat(table.status, mins)];
  const items = mergeItems(orders.flatMap(o => o.items));
  const total = sumLines(items);
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const statusLabel = table.status === 'waiting_bill' ? 'Awaiting bill' : table.status === 'occupied' ? 'Active order' : 'Available';

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: '1px solid var(--fl-border)', background: 'var(--fl-panel)' }}>
      <div className="px-[18px] py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--fl-border)' }}>
        <div className="flex justify-between items-start mb-3">
          <div><p className="fl-text font-bold text-[15px] m-0">{table.label}</p><p className="fl-sub text-[11px] mt-0.5">{table.id} · {table.seats} seats</p></div>
          <button type="button" aria-label="Close details" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--fl-border)', border: '1px solid var(--fl-border2)', color: 'var(--fl-text2)' }}><Icon name="x" className="w-3 h-3" strokeWidth={2.5} /></button>
        </div>
        {!empty && (
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Time seated" value={since ? elapsedLabel(mins) : '—'} color={c.pillText} />
            <Mini label="Avg / item" value={qty > 0 ? formatMoney(total / qty, sym) : '—'} color="var(--fl-text)" />
            <Mini label="Status" value={statusLabel} color={c.pillText} />
          </div>
        )}
        {empty && loading && <div className="flex items-center gap-2 mt-5 py-2"><Spinner className="w-3.5 h-3.5" /><p className="fl-sub">Loading today's stats…</p></div>}
        {empty && stats && (
          <div className="mt-5">
            <p className="fl-label mb-3">Today's performance</p>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Visits" value={String(stats.orders_today)} color={stats.orders_today >= 4 ? 'var(--fl-green)' : stats.orders_today > 0 ? 'var(--fl-amber)' : undefined} />
              <StatTile label="Revenue" value={stats.revenue_today > 0 ? formatMoney(stats.revenue_today, sym) : '—'} color={stats.revenue_today > 0 ? 'var(--fl-indigo)' : undefined} />
              <StatTile label="Avg / visit" value={stats.avg_order_value > 0 ? formatMoney(stats.avg_order_value, sym) : '—'} color={stats.avg_order_value > 0 ? 'var(--fl-text)' : undefined} />
              <StatTile label="Last order" value={stats.last_order_at ? formatTime(stats.last_order_at) : 'None today'} color={stats.last_order_at ? 'var(--fl-text2)' : undefined} />
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-[18px] py-3.5">
        {empty || items.length === 0 ? <p className="fl-sub text-[13px] text-center mt-8">Table is empty</p> : (
          <>
            <p className="fl-label mb-2.5 tracking-widest">{table.status === 'waiting_bill' ? 'Order (awaiting payment)' : 'Current Order'}</p>
            {items.map(it => (
              <div key={`${it.name}|${it.note}|${it.price}`} className="flex justify-between items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--fl-border)' }}>
                <div className="min-w-0"><p className="m-0 text-[13px] font-medium" style={{ color: 'var(--fl-text3)' }}><span className="font-bold" style={{ color: 'var(--brand,#f97316)' }}>{it.quantity}×</span> {it.name}</p>{it.note && <p className="fl-sub italic mt-0.5">{it.note}</p>}</div>
                <span className="fl-text2 text-xs font-mono flex-shrink-0">{formatMoney(it.price * it.quantity, sym)}</span>
              </div>
            ))}
          </>
        )}
      </div>
      {!empty && items.length > 0 && (
        <div className="px-[18px] py-3 flex justify-between items-center flex-shrink-0" style={{ borderTop: '1px solid var(--fl-border)' }}>
          <span className="fl-text2 text-[13px]">Total</span><span className="fl-value text-base" style={{ color: 'var(--fl-text)' }}>{formatMoney(total, sym)}</span>
        </div>
      )}
    </div>
  );
}

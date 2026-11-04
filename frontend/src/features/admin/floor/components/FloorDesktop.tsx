import { formatMoney } from 'lib/format/money';
import type { FloorState } from '../hooks/useFloor';
import FloorTableCard from './panels/FloorTableCard';
import HourChart from './panels/HourChart';
import StatusBreakdown from './panels/StatusBreakdown';
import TableDetail from './panels/TableDetail';
import Tile from './panels/Tile';
import { TodayGlance, TopItemsPanel } from './panels/TodayPanels';

export default function FloorDesktop({ f, sym }: { f: FloorState; sym: string }) {
  const m = f.metrics;
  const card = (t: (typeof f.tables)[number]) => (
    <FloorTableCard key={t.id} table={t} sym={sym} nowMs={f.nowMs} selected={f.selectedId === t.id} order={f.activeOrders.find(o => o.table_id === t.id) ?? null} onClick={() => f.select(t.id)} />
  );
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 } as const;
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          <Tile label="Tables occupied" value={`${m.occupied}/${m.dineIn.length}`} sub={`${m.free} free right now`} color="var(--brand,#f97316)" />
          <Tile label="Seat fill rate" value={`${m.seatPct}%`} sub={`${m.occupiedSeats} of ${m.totalSeats} seats`} color={m.seatPct > 70 ? 'var(--fl-red)' : m.seatPct > 40 ? 'var(--fl-amber)' : 'var(--fl-green)'} />
          <Tile label="Parcels active" value={String(m.parcelActive)} sub="parcel / takeaway slots" color="var(--fl-indigo)" />
          <Tile label="In the kitchen" value={formatMoney(m.kitchenValue, sym)} sub="value of rounds being made" color="var(--fl-indigo)" />
          <Tile label="Items in kitchen" value={String(m.itemsInKitchen)} sub="across all tables" />
          <Tile label="Awaiting bill" value={String(m.billPending)} sub={m.billPending > 0 ? 'needs attention' : 'all clear'} color={m.billPending > 0 ? 'var(--fl-indigo)' : 'var(--fl-muted)'} />
        </div>
        <div className="grid grid-cols-2 gap-2.5"><HourChart bars={f.hourly} /><StatusBreakdown b={m.breakdown} /></div>
        <div className="grid grid-cols-2 gap-2.5"><TopItemsPanel summary={f.summary} sym={sym} /><TodayGlance summary={f.summary} sym={sym} tableCount={m.dineIn.length} /></div>
        <div>
          <p className="fl-label mb-2.5">Dine-in tables — tap to view order &amp; today's stats</p>
          <div style={grid}>{m.dineIn.map(card)}</div>
          {m.parcels.length > 0 && (<><p className="fl-label mt-[18px] mb-2.5">Parcel / Takeaway slots</p><div style={grid}>{m.parcels.map(card)}</div></>)}
        </div>
      </div>
      {f.selected && <div className="flex-shrink-0 w-[272px]"><TableDetail table={f.selected} orders={f.selectedOrders} sym={sym} nowMs={f.nowMs} onClose={f.clear} /></div>}
    </div>
  );
}

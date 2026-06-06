/**
 * frontend/src/views/admin/AdminFloor.tsx
 * 
 * Admin command center — the one screen that replaces switching between
 * waiter, kitchen, and analytics. Rich stats + live floor + table detail.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getTables, getActiveOrders } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useTick } from '../../hooks/useTick';
import { useSettings } from '../../context/SettingsContext';
import type { Table, Order } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────
function elapsed(iso: string | null): { mins: number; label: string } {
  if (!iso) return { mins: 0, label: '' };
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return { mins, label: '< 1m' };
  if (mins < 60) return { mins, label: `${mins}m` };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { mins, label: m > 0 ? `${h}h ${m}m` : `${h}h` };
}

type Heat = 'empty' | 'fresh' | 'warm' | 'hot' | 'bill';

function heat(t: Table, mins: number): Heat {
  if (t.status === 'empty')        return 'empty';
  if (t.status === 'waiting_bill') return 'bill';
  if (mins < 30) return 'fresh';
  if (mins < 60) return 'warm';
  return 'hot';
}

const H: Record<Heat, { border: string; bg: string; glow: string; pill: string; pillText: string; pillBorder: string; dot: string; tag: string; tagColor: string }> = {
  empty: { border:'#27272a', bg:'transparent', glow:'none', pill:'', pillText:'', pillBorder:'', dot:'#3f3f46', tag:'Available', tagColor:'#3f3f46' },
  fresh: { border:'#10b981', bg:'rgba(16,185,129,0.07)', glow:'0 4px 24px rgba(16,185,129,0.1)', pill:'rgba(16,185,129,0.14)', pillText:'#10b981', pillBorder:'rgba(16,185,129,0.3)', dot:'#10b981', tag:'Occupied', tagColor:'#10b981' },
  warm:  { border:'#f59e0b', bg:'rgba(245,158,11,0.07)',  glow:'0 4px 24px rgba(245,158,11,0.1)',  pill:'rgba(245,158,11,0.14)',  pillText:'#f59e0b', pillBorder:'rgba(245,158,11,0.3)',  dot:'#f59e0b', tag:'Occupied', tagColor:'#f59e0b' },
  hot:   { border:'#ef4444', bg:'rgba(239,68,68,0.07)',   glow:'0 4px 24px rgba(239,68,68,0.12)',  pill:'rgba(239,68,68,0.14)',   pillText:'#ef4444', pillBorder:'rgba(239,68,68,0.3)',   dot:'#ef4444', tag:'Long wait', tagColor:'#ef4444' },
  bill:  { border:'#818cf8', bg:'rgba(129,140,248,0.07)', glow:'0 4px 24px rgba(129,140,248,0.1)', pill:'rgba(129,140,248,0.14)', pillText:'#818cf8', pillBorder:'rgba(129,140,248,0.3)', dot:'#818cf8', tag:'Awaiting bill', tagColor:'#818cf8' },
};

// ── Stat tile ─────────────────────────────────────────────────────────────
function Tile({ label, value, sub, color, wide }: { label: string; value: string; sub: string; color?: string; wide?: boolean }) {
  return (
    <div style={{
      background: '#1c1c1f', border: '1px solid #27272a', borderRadius: '14px',
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px',
      gridColumn: wide ? 'span 2' : undefined,
    }}>
      <p style={{ color: '#52525b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
      <p style={{ color: color || '#fff', fontSize: '22px', fontWeight: 700, fontFamily: 'ui-monospace,monospace', margin: 0, lineHeight: 1.1 }}>{value}</p>
      <p style={{ color: '#52525b', fontSize: '11px', margin: 0 }}>{sub}</p>
    </div>
  );
}

// ── Mini bar chart (hourly orders) ────────────────────────────────────────
function HourBars({ orders }: { orders: Order[] }) {
  const now  = new Date().getHours();
  const bars: number[] = Array(12).fill(0);
  orders.forEach(o => {
    const h = new Date(o.created_at ?? Date.now()).getHours();
    const slot = Math.max(0, Math.min(11, h - (now - 11)));
    bars[slot]++;
  });
  const max = Math.max(...bars, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '36px' }}>
      {bars.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: '3px 3px 0 0',
          background: i === 11 ? 'var(--brand,#f97316)' : '#27272a',
          height: `${Math.max(10, Math.round((v / max) * 36))}%`,
          minHeight: v > 0 ? '4px' : '2px',
          opacity: i === 11 ? 1 : 0.5 + (i / 11) * 0.5,
        }} />
      ))}
    </div>
  );
}

// ── Table card ────────────────────────────────────────────────────────────
interface CardProps { table: Table; order: Order | null; sym: string; selected: boolean; onClick: () => void; }

function TableCard({ table, order, sym, selected, onClick }: CardProps) {
  const since  = (table as any).occupied_since as string | null ?? null;
  const { mins, label: tLabel } = elapsed(since);
  const hv     = heat(table, mins);
  const c      = H[hv];
  const empty  = hv === 'empty';
  const items  = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const rev    = order?.items.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  // Seat fill %
  const fillPct = empty ? 0 : Math.min(100, Math.round((items / Math.max(table.seats, 1)) * 100));

  return (
    <button onClick={onClick} style={{
      border:        `1.5px solid ${selected ? 'var(--brand,#f97316)' : c.border}`,
      background:    c.bg,
      boxShadow:     selected ? '0 0 0 3px rgba(249,115,22,0.22), ' + c.glow : c.glow,
      borderRadius:  '16px',
      padding:       '14px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      textAlign:     'left',
      cursor:        'pointer',
      transition:    'all 0.18s ease',
      width:         '100%',
      minHeight:     '168px',
    }}>
      {/* Row 1: ID + dot */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <span style={{ fontFamily:'ui-monospace,monospace', fontWeight:700, fontSize:'20px', color: empty ? '#52525b':'#fff', lineHeight:1, letterSpacing:'-0.5px' }}>
          {table.id}
        </span>
        <span style={{ width:9, height:9, borderRadius:'50%', marginTop:3, backgroundColor:c.dot, boxShadow: !empty ? `0 0 7px ${c.dot}`:'none', flexShrink:0 }} />
      </div>

      {/* Row 2: name */}
      <div>
        <p style={{ color: empty ? '#52525b':'#d4d4d8', fontSize:'12px', fontWeight:600, margin:0 }}>{table.label}</p>
        <p style={{ color:'#52525b', fontSize:'10px', margin:'2px 0 0' }}>{table.seats} seats</p>
      </div>

      {/* Row 3: seat fill bar (only when occupied) */}
      {!empty && (
        <div>
          <div style={{ height:'3px', background:'#27272a', borderRadius:'99px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${fillPct}%`, background:c.dot, borderRadius:'99px', transition:'width 0.3s' }} />
          </div>
          <p style={{ color:'#52525b', fontSize:'10px', margin:'3px 0 0' }}>{items} item{items!==1?'s':''} ordered</p>
        </div>
      )}

      {/* Row 4: timer + revenue */}
      <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:'5px' }}>
        {!empty && since ? (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 7px', borderRadius:'99px', background:c.pill, color:c.pillText, border:`1px solid ${c.pillBorder}`, fontSize:'10px', fontWeight:700, fontFamily:'ui-monospace,monospace' }}>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {tLabel}
              </span>
              {rev > 0 && (
                <span style={{ color:'#fff', fontSize:'13px', fontWeight:700, fontFamily:'ui-monospace,monospace' }}>{sym}{rev.toFixed(2)}</span>
              )}
            </div>
            <span style={{ color:c.tagColor, fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>{c.tag}</span>
          </>
        ) : (
          <span style={{ color:'#3f3f46', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Available</span>
        )}
      </div>
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────
function DetailPanel({ table, order, sym, onClose }: { table: Table; order: Order | null; sym: string; onClose: () => void }) {
  const since  = (table as any).occupied_since as string | null ?? null;
  const { mins, label: tLabel } = elapsed(since);
  const hv = heat(table, mins);
  const c  = H[hv];
  const total = order?.items.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  const items = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', borderLeft:'1px solid #27272a', background:'#111113' }}>
      {/* Header */}
      <div style={{ padding:'16px 18px', borderBottom:'1px solid #27272a', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
          <div>
            <p style={{ color:'#fff', fontWeight:700, fontSize:'15px', margin:0 }}>{table.label}</p>
            <p style={{ color:'#71717a', fontSize:'11px', margin:'2px 0 0' }}>{table.id} · {table.seats} seats</p>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:'8px', background:'#27272a', border:'1px solid #3f3f46', color:'#a1a1aa', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        {/* Mini stat row */}
        {table.status !== 'empty' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
            {[
              { l:'Time', v: since ? tLabel : '—', color: c.pillText },
              { l:'Items', v: String(items), color: '#fff' },
              { l:'Revenue', v: `${sym}${total.toFixed(2)}`, color: '#fff' },
            ].map(({ l, v, color }) => (
              <div key={l} style={{ background:'#1c1c1f', borderRadius:'10px', padding:'8px 10px', border:'1px solid #27272a' }}>
                <p style={{ color:'#52525b', fontSize:'9px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>{l}</p>
                <p style={{ color, fontSize:'13px', fontWeight:700, fontFamily:'ui-monospace,monospace', margin:'3px 0 0' }}>{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order items */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
        {!order || table.status === 'empty' ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'8px' }}>
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1} style={{ opacity:0.5 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"/>
            </svg>
            <p style={{ color:'#52525b', fontSize:'13px' }}>Table is empty</p>
          </div>
        ) : (
          <>
            <p style={{ color:'#52525b', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'10px' }}>Order</p>
            {order.items.map((item, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid #27272a', gap:'8px' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'#e4e4e7', fontSize:'13px', fontWeight:500, margin:0 }}>
                    <span style={{ color:'var(--brand,#f97316)', fontWeight:700 }}>{item.quantity}×</span> {item.name}
                  </p>
                  {item.note && <p style={{ color:'#92400e', fontSize:'11px', fontStyle:'italic', margin:'2px 0 0' }}>{item.note}</p>}
                </div>
                <span style={{ color:'#a1a1aa', fontSize:'12px', fontFamily:'ui-monospace,monospace', flexShrink:0 }}>{sym}{(item.price*item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {order && table.status !== 'empty' && (
        <div style={{ padding:'12px 18px', borderTop:'1px solid #27272a', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <span style={{ color:'#a1a1aa', fontSize:'13px' }}>Total</span>
          <span style={{ color:'#fff', fontSize:'16px', fontWeight:700, fontFamily:'ui-monospace,monospace' }}>{sym}{total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function AdminFloor() {
  const [tables,   setTables]   = useState<Table[]>([]);
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  useTick(15000);

  const loadTables = useCallback(async () => { try { setTables(await getTables()); } catch {} }, []);
  const loadOrders = useCallback(async () => { try { setOrders(await getActiveOrders()); } catch {} }, []);

  useEffect(() => { loadTables(); loadOrders(); }, []);
  useSocket('tables_updated',  loadTables);
  useSocket('new_order',       loadOrders);
  useSocket('order_updated',   loadOrders);
  useSocket('order_delivered', () => { loadTables(); loadOrders(); });
  useSocket('order_closed',    () => { loadTables(); loadOrders(); });

  // Derived stats
  const occupied    = tables.filter(t => t.status !== 'empty').length;
  const empty       = tables.filter(t => t.status === 'empty').length;
  const billPending = tables.filter(t => t.status === 'waiting_bill').length;
  const overdue     = tables.filter(t => {
    const s = (t as any).occupied_since as string | null;
    return s ? Math.floor((Date.now() - new Date(s).getTime()) / 60000) >= 60 : false;
  }).length;
  const liveRevenue    = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0);
  const liveItems      = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const totalSeats     = tables.reduce((s, t) => s + t.seats, 0);
  const occupiedSeats  = tables.filter(t => t.status !== 'empty').reduce((s, t) => s + t.seats, 0);
  const seatPct        = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;
  const avgPerTable    = occupied > 0 ? liveRevenue / occupied : 0;

  const selectedTable = tables.find(t => t.id === selected) || null;
  const selectedOrder = orders.find(o => o.table_id === selected) || null;
  const toggle = (id: string) => setSelected(p => p === id ? null : id);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#18181b' }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', padding:'10px 20px', borderBottom:'1px solid #27272a', flexShrink:0, background:'#18181b' }}>
        <p style={{ color:'#fff', fontWeight:700, fontSize:'13px', margin:0 }}>Floor View</p>
        <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'2px 8px', borderRadius:'99px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981', fontSize:'10px', fontWeight:700 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
          Live
        </span>
        {overdue > 0 && (
          <span style={{ padding:'2px 8px', borderRadius:'99px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:'10px', fontWeight:700 }}>
            {overdue} table{overdue > 1 ? 's':''} over 1hr
          </span>
        )}
        {billPending > 0 && (
          <span style={{ padding:'2px 8px', borderRadius:'99px', background:'rgba(129,140,248,0.12)', border:'1px solid rgba(129,140,248,0.3)', color:'#818cf8', fontSize:'10px', fontWeight:700 }}>
            {billPending} awaiting bill
          </span>
        )}
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          {[{ c:'#10b981', l:'< 30m' },{ c:'#f59e0b', l:'30–60m' },{ c:'#ef4444', l:'> 1hr' },{ c:'#818cf8', l:'Bill' }].map(({ c, l }) => (
            <span key={l} style={{ display:'flex', alignItems:'center', gap:'4px', color:'#71717a', fontSize:'10px' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', backgroundColor:c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex" style={{ flex:1, overflow:'hidden' }}>
        {/* Left: stats + grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* Stats grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px' }}>
            <Tile label="Tables occupied" value={`${occupied}/${tables.length}`} sub={`${empty} free right now`} color="var(--brand,#f97316)" />
            <Tile label="Seat fill rate"  value={`${seatPct}%`}                 sub={`${occupiedSeats} of ${totalSeats} seats`} color={seatPct > 70 ? '#ef4444' : seatPct > 40 ? '#f59e0b' : '#10b981'} />
            <Tile label="Live revenue"    value={`${sym}${liveRevenue.toFixed(2)}`} sub="from active orders" color="#818cf8" />
            <Tile label="Avg per table"   value={occupied > 0 ? `${sym}${avgPerTable.toFixed(2)}` : '—'} sub="active tables only" />
            <Tile label="Items in flight" value={String(liveItems)}              sub="across all tables" />
            <Tile label="Awaiting bill"   value={String(billPending)}            sub={billPending > 0 ? 'needs attention' : 'all clear'} color={billPending > 0 ? '#818cf8' : '#52525b'} />
          </div>

          {/* Activity spark + overdue alert */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div style={{ background:'#1c1c1f', border:'1px solid #27272a', borderRadius:'14px', padding:'14px 16px' }}>
              <p style={{ color:'#52525b', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 10px' }}>Order activity — last 12 hours</p>
              <HourBars orders={orders} />
              <p style={{ color:'#52525b', fontSize:'10px', margin:'6px 0 0' }}>Rightmost bar = this hour</p>
            </div>
            <div style={{ background:'#1c1c1f', border:'1px solid #27272a', borderRadius:'14px', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <p style={{ color:'#52525b', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>Table status breakdown</p>
              {[
                { label:'Occupied — under 30m',  count: tables.filter(t => { const s=(t as any).occupied_since; return s && t.status==='occupied' && Math.floor((Date.now()-new Date(s).getTime())/60000)<30; }).length, color:'#10b981' },
                { label:'Occupied — 30 to 60m',  count: tables.filter(t => { const s=(t as any).occupied_since; if(!s||t.status!=='occupied') return false; const m=Math.floor((Date.now()-new Date(s).getTime())/60000); return m>=30&&m<60; }).length, color:'#f59e0b' },
                { label:'Occupied — over 1hr',   count: tables.filter(t => { const s=(t as any).occupied_since; return s && t.status==='occupied' && Math.floor((Date.now()-new Date(s).getTime())/60000)>=60; }).length, color:'#ef4444' },
                { label:'Awaiting bill',          count: billPending, color:'#818cf8' },
                { label:'Available',              count: empty,       color:'#3f3f46' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', backgroundColor:color, flexShrink:0 }} />
                  <span style={{ color:'#a1a1aa', fontSize:'11px', flex:1 }}>{label}</span>
                  <span style={{ color: count > 0 ? '#fff':'#3f3f46', fontSize:'12px', fontWeight:700, fontFamily:'ui-monospace,monospace' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table grid */}
          <div>
            <p style={{ color:'#52525b', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 10px' }}>
              All tables — tap to view order
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'10px' }}>
              {tables.map(t => (
                <TableCard key={t.id} table={t} order={orders.find(o => o.table_id===t.id)||null} sym={sym} selected={selected===t.id} onClick={() => toggle(t.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: detail */}
        {selectedTable && (
          <div style={{ width:'272px', flexShrink:0 }}>
            <DetailPanel table={selectedTable} order={selectedOrder} sym={sym} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {/* ── MOBILE ── */}
      <div className="flex md:hidden" style={{ flex:1, overflow:'hidden', flexDirection:'column' }}>
        {/* Stats strip */}
        <div style={{ flexShrink:0, overflowX:'auto', display:'flex', gap:'8px', padding:'12px 16px', borderBottom:'1px solid #27272a', scrollbarWidth:'none' }}>
          {[
            { l:'Occupied', v:`${occupied}/${tables.length}`, color:'var(--brand,#f97316)' },
            { l:'Seat fill', v:`${seatPct}%`, color: seatPct>70?'#ef4444':seatPct>40?'#f59e0b':'#10b981' },
            { l:'Revenue', v:`${sym}${liveRevenue.toFixed(2)}`, color:'#818cf8' },
            { l:'Avg/table', v: occupied>0?`${sym}${avgPerTable.toFixed(2)}`:'—', color:'#fff' },
            { l:'Bill wait', v:String(billPending), color: billPending>0?'#818cf8':'#52525b' },
          ].map(({ l, v, color }) => (
            <div key={l} style={{ flexShrink:0, background:'#1c1c1f', border:'1px solid #27272a', borderRadius:'10px', padding:'8px 12px', minWidth:'80px' }}>
              <p style={{ color:'#52525b', fontSize:'9px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', margin:0 }}>{l}</p>
              <p style={{ color, fontSize:'14px', fontWeight:700, fontFamily:'ui-monospace,monospace', margin:'3px 0 0' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Table strip */}
        <div style={{ flexShrink:0, overflowX:'auto', display:'flex', gap:'10px', padding:'12px 16px', borderBottom:'1px solid #27272a', scrollbarWidth:'none', WebkitOverflowScrolling:'touch' as any }}>
          {tables.map(t => {
            const since = (t as any).occupied_since as string | null ?? null;
            const { mins, label: tLabel } = elapsed(since);
            const hv = heat(t, mins);
            const c  = H[hv];
            const rev = (orders.find(o => o.table_id===t.id)?.items ?? []).reduce((s, i) => s + i.price*i.quantity, 0);
            return (
              <button key={t.id} onClick={() => toggle(t.id)} style={{
                flexShrink:0, width:'110px',
                border:`1.5px solid ${selected===t.id ? 'var(--brand,#f97316)':c.border}`,
                background:c.bg,
                boxShadow: selected===t.id ? '0 0 0 3px rgba(249,115,22,0.2)':'none',
                borderRadius:'12px', padding:'10px', display:'flex', flexDirection:'column', gap:'6px', cursor:'pointer', textAlign:'left',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'ui-monospace,monospace', fontWeight:700, fontSize:'17px', color: hv==='empty'?'#52525b':'#fff' }}>{t.id}</span>
                  <span style={{ width:8, height:8, borderRadius:'50%', backgroundColor:c.dot, marginTop:3, boxShadow: hv!=='empty'?`0 0 6px ${c.dot}`:'none' }} />
                </div>
                <p style={{ color: hv==='empty'?'#52525b':'#d4d4d8', fontSize:'11px', fontWeight:600, margin:0 }}>{t.label}</p>
                {hv !== 'empty' && since ? (
                  <>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', padding:'2px 6px', borderRadius:'99px', background:c.pill, color:c.pillText, border:`1px solid ${c.pillBorder}`, fontSize:'10px', fontWeight:700, fontFamily:'ui-monospace,monospace' }}>
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {tLabel}
                    </span>
                    {rev > 0 && <p style={{ color:'#fff', fontSize:'12px', fontWeight:700, margin:0, fontFamily:'ui-monospace,monospace' }}>{sym}{rev.toFixed(2)}</p>}
                  </>
                ) : (
                  <span style={{ color:'#3f3f46', fontSize:'10px', fontWeight:700, textTransform:'uppercase' }}>Free</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail area */}
        <div style={{ flex:1, overflow:'hidden' }}>
          {selectedTable ? (
            <DetailPanel table={selectedTable} order={selectedOrder} sym={sym} onClose={() => setSelected(null)} />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'8px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1} style={{ opacity:0.5 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
              </svg>
              <p style={{ color:'#52525b', fontSize:'13px' }}>Tap a table to see its order</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
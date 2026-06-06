import React, { useState, useEffect, useCallback } from 'react';
import { getReportToday, getReportHistory, getRevenueChart } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import type { Order, ReportSummary, RevenueDay } from '../types';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;
type Section = 'analytics' | 'history';

// ── Group orders by table session ─────────────────────────────────────────
// Orders from the same table that are close in time (within 4 hours) belong
// to the same "visit". We group them so the history doesn't show each round
// as a separate entry.
interface TableSession {
  sessionKey: string;
  tableId: string;
  tableLabel?: string;
  orders: Order[];
  totalAmount: number;
  startedAt: string;
  endedAt: string;
  allItems: { name: string; price: number; quantity: number; note: string }[];
}

function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  // Sort oldest-first so sessions build chronologically
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const tableLastOrder: Record<string, number> = {}; // tableId → index in sessions

  for (const order of sorted) {
    const key = order.table_id;
    const existingIdx = tableLastOrder[key];

    if (existingIdx !== undefined) {
      const existing = sessions[existingIdx];
      const lastOrderTime = new Date(existing.endedAt).getTime();
      const thisOrderTime = new Date(order.created_at).getTime();
      const diffHours = (thisOrderTime - lastOrderTime) / (1000 * 60 * 60);

      if (diffHours < 4) {
        // Same visit — merge
        existing.orders.push(order);
        existing.endedAt = order.created_at;
        existing.totalAmount += order.items.reduce((s, i) => s + i.price * i.quantity, 0);
        // Merge items
        for (const item of order.items) {
          const itemKey = `${item.name}||${item.note || ''}||${item.price}`;
          const existingItem = existing.allItems.find(
            x => `${x.name}||${x.note || ''}||${x.price}` === itemKey
          );
          if (existingItem) {
            existingItem.quantity += item.quantity;
          } else {
            existing.allItems.push({ name: item.name, price: item.price, quantity: item.quantity, note: item.note || '' });
          }
        }
        continue;
      }
    }

    // New session
    const allItems = order.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, note: i.note || '' }));
    const session: TableSession = {
      sessionKey: `${order.table_id}-${order.created_at}`,
      tableId: order.table_id,
      orders: [order],
      totalAmount: order.items.reduce((s, i) => s + i.price * i.quantity, 0),
      startedAt: order.created_at,
      endedAt: order.created_at,
      allItems,
    };
    tableLastOrder[key] = sessions.length;
    sessions.push(session);
  }

  // Sort newest-first for display
  return sessions.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// ── Inline Bill Print Component ───────────────────────────────────────────
interface ReprintBillProps {
  session: TableSession;
  onClose: () => void;
}

function ReprintBill({ session, onClose }: ReprintBillProps) {
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const brand    = (settings.brand_color as string) || '#f97316';
  const logoUrl  = (settings as any).logo_url as string | undefined;
  const sans     = 'system-ui, -apple-system, sans-serif';

  const subtotal = session.allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * taxPct;
  const total    = subtotal + tax;
  const date     = new Date(session.startedAt);
  const dateStr  = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr  = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body * { visibility: hidden !important; }
          .bill-print-area, .bill-print-area * { visibility: visible !important; }
          .bill-print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 72mm !important; max-width: 72mm !important;
            border-radius: 0 !important; box-shadow: none !important;
            max-height: none !important; overflow: visible !important;
          }
          .bill-scroll { overflow: visible !important; max-height: none !important; }
          .no-print { display: none !important; }
          .bill-header { background: #fff !important; color: #111 !important; }
          .bill-header * { color: #111 !important; background: transparent !important; }
        }
      `}</style>

      <div
        className="bill-print-area flex flex-col bg-white w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bill-header flex-shrink-0" style={{ background: brand, padding: '16px 20px 14px', textAlign: 'center' }}>
          {logoUrl && (
            <img src={`${API_ORIGIN}${logoUrl}`} alt="logo"
              style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', marginBottom: 8, display: 'inline-block' }} />
          )}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: sans }}>
            {settings.restaurant_name || 'Restaurant'}
          </div>
          {settings.address && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: sans }}>{settings.address}</div>
          )}
          {(settings as any).phone && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: sans }}>{(settings as any).phone}</div>
          )}
          <div style={{ display: 'inline-block', marginTop: 7, background: 'rgba(0,0,0,0.18)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#fff', fontFamily: sans }}>
            {dateStr} · {timeStr}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="bill-scroll flex-1 overflow-y-auto" style={{ padding: '14px 18px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 14, color: '#111' }}>
              Table {session.tableId}
            </span>
            <span style={{ fontFamily: sans, fontSize: 11, color: '#999' }}>
              {session.allItems.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />

          <div style={{ margin: '10px 0' }}>
            {session.allItems.map((item, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#111' }}>
                  <span style={{ flex: 1, paddingRight: 8, fontFamily: sans, fontWeight: 600 }}>
                    <span style={{ color: brand, fontWeight: 700 }}>{item.quantity}×</span> {item.name}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontFamily: sans, fontWeight: 600 }}>
                    {sym}{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#bbb', paddingLeft: 2, fontFamily: sans }}>
                  @ {sym}{item.price.toFixed(2)} each
                </div>
                {item.note && (
                  <div style={{ fontSize: 11, color: '#888', paddingLeft: 2, fontStyle: 'italic', fontFamily: sans }}>↳ {item.note}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />

          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#666', fontFamily: sans }}>
              <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#666', fontFamily: sans }}>
              <span>Tax ({settings.tax_percent || 5}%)</span><span>{sym}{tax.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 4px', fontFamily: sans }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>TOTAL</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: brand }}>{sym}{total.toFixed(2)}</span>
          </div>

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />

          {settings.bill_footer && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', margin: '10px 0 4px', fontFamily: sans, fontStyle: 'italic' }}>
              {settings.bill_footer}
            </div>
          )}
          <div style={{ textAlign: 'center', fontSize: 9, color: '#e0e0e0', letterSpacing: 4, marginTop: 6 }}>
            |||||  ||||||  |||||  ||||||  ||||
          </div>
        </div>

        {/* Actions */}
        <div className="no-print flex-shrink-0" style={{ padding: '12px 16px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>
              🖨️ Print Bill
            </button>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>
              Close
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#ccc', margin: '6px 0 0', fontFamily: sans }}>
            For thermal printer: set paper size to <strong>80mm</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Session row component ─────────────────────────────────────────────────
function SessionRow({ session, sym, taxPct, brand }: {
  session: TableSession;
  sym: string;
  taxPct: number;
  brand: string;
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [showBill,   setShowBill]   = useState(false);
  const tax   = session.totalAmount * taxPct;
  const total = session.totalAmount + tax;
  const date  = new Date(session.startedAt);
  const isMultiRound = session.orders.length > 1;

  return (
    <>
      {showBill && <ReprintBill session={session} onClose={() => setShowBill(false)} />}

      <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden hover:border-zinc-600 transition-colors">
        {/* Main row */}
        <button
          className="w-full px-4 py-3 text-left flex items-center gap-3"
          onClick={() => setExpanded(e => !e)}
        >
          {/* Table badge */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white">
            {session.tableId}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm font-semibold">Table {session.tableId}</span>
              {isMultiRound && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/25">
                  {session.orders.length} rounds
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-zinc-500 text-xs">
                {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-zinc-700 text-xs">·</span>
              <span className="text-zinc-500 text-xs">
                {session.allItems.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>
          </div>

          {/* Total + expand arrow */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="font-mono font-bold text-white text-sm">{sym}{total.toFixed(2)}</span>
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-surface-border bg-surface-raised/50">
            {/* Items list */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Items Ordered</p>
              <div className="space-y-2">
                {session.allItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-xs font-medium">
                        <span style={{ color: brand }} className="font-bold">{item.quantity}×</span> {item.name}
                      </span>
                      {item.note && (
                        <div className="text-zinc-600 text-[10px] italic ml-4">↳ {item.note}</div>
                      )}
                    </div>
                    <span className="font-mono text-zinc-400 text-xs flex-shrink-0">
                      {sym}{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="px-4 py-2 border-t border-surface-border/50 space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Subtotal</span>
                <span className="font-mono">{sym}{session.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Tax</span>
                <span className="font-mono">{sym}{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-surface-border/50">
                <span>Total</span>
                <span className="font-mono">{sym}{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Rounds breakdown (if multi-round) */}
            {isMultiRound && (
              <div className="px-4 py-2 border-t border-surface-border/50">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Rounds</p>
                {session.orders.map((order, i) => {
                  const roundTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);
                  return (
                    <div key={order.id} className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Round {i + 1} — {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                      <span className="font-mono">{sym}{roundTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-surface-border/50 flex gap-2">
              <button
                onClick={() => setShowBill(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold hover:bg-brand-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print Bill
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main ReportsView ───────────────────────────────────────────────────────
export default function ReportsView() {
  const [section,       setSection]       = useState<Section>('analytics');
  const [summary,       setSummary]       = useState<ReportSummary | null>(null);
  const [history,       setHistory]       = useState<Order[]>([]);
  const [chart,         setChart]         = useState<RevenueDay[]>([]);
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportFrom,    setExportFrom]    = useState('');
  const [exportTo,      setExportTo]      = useState('');
  const settings = useSettings();
  const sym    = settings.currency_symbol || '₹';
  const taxPct = parseFloat(settings.tax_percent || '5') / 100;
  const brand  = (settings.brand_color as string) || '#f97316';

  const loadAnalytics = useCallback(async () => {
    try { const [s,c] = await Promise.all([getReportToday(), getRevenueChart()]); setSummary(s); setChart(c); }
    catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const p: Record<string,string> = {};
      if (dateFrom) p.from = dateFrom;
      if (dateTo)   p.to   = dateTo;
      setHistory(await getReportHistory(p));
    } catch {}
  }, [dateFrom, dateTo]);

  useEffect(() => { loadAnalytics(); }, []);
  useEffect(() => { if (section === 'history') loadHistory(); }, [section]);

  const sessions    = groupOrdersIntoSessions(history);
  const maxRev      = chart.length ? Math.max(...chart.map(d=>d.revenue), 0.01) : 0.01;
  const maxOrders   = chart.length ? Math.max(...chart.map(d=>d.orders),  1)    : 1;
  const totalRev    = chart.reduce((s,d)=>s+d.revenue,0);
  const avgRev      = chart.length ? totalRev/chart.length : 0;
  const histTotal   = sessions.reduce((s, sess) => s + sess.totalAmount * (1 + taxPct), 0);

  const downloadExport = async (fmt: 'csv' | 'json') => {
    const params = new URLSearchParams({ format: fmt });
    if (exportFrom) params.set('from', exportFrom);
    if (exportTo)   params.set('to',   exportTo);
    const url = `${API_ORIGIN}/api/export/revenue?${params.toString()}`;
    try {
      const tokenRes = await fetch(`${API_ORIGIN}/api/auth/token`);
      const { token } = await tokenRes.json();
      const res = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert((err as any).error || 'Export failed'); return; }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = exportFrom ? `${exportFrom}_to_${exportTo || 'today'}` : 'all';
      a.href = blobUrl; a.download = `revenue_report_${dateStr}.${fmt}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch { alert('Export failed — check connection'); }
  };

  const RevenueChart = () => (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">Daily Revenue</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Last 30 days</p>
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <p className="font-mono font-bold text-white text-sm sm:text-base leading-tight">{sym}{totalRev.toFixed(2)}</p>
          <p className="text-zinc-600 text-[10px] mt-0.5 whitespace-nowrap">avg {sym}{avgRev.toFixed(2)}/day</p>
        </div>
      </div>
      {chart.length === 0 ? (
        <div className="h-28 flex items-center justify-center text-zinc-700 text-sm">No data yet</div>
      ) : (
        <>
          <div style={{ height: 100, position: 'relative' }}>
            <div className="absolute inset-0 flex items-end gap-px">
              {chart.map((d, i) => {
                const barH   = Math.max(2, Math.round((d.revenue / maxRev) * 96));
                const isToday = i === chart.length - 1;
                return (
                  <div key={i} className="flex-1 flex items-end group" style={{ height: '96px' }}
                    title={`${d.day}: ${sym}${d.revenue.toFixed(2)} · ${d.orders} orders`}>
                    <div className="w-full rounded-t-sm transition-opacity"
                      style={{ height: `${barH}px`, backgroundColor: isToday ? '#f97316' : '#f9731660', opacity: isToday ? 1 : 0.7 }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
            <span>{chart[0]?.day?.slice(5)}</span>
            <span>{chart[Math.floor(chart.length/2)]?.day?.slice(5)}</span>
            <span className="text-brand-500 font-bold">Today</span>
          </div>
        </>
      )}
    </div>
  );

  const OrderVolumeChart = () => (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">Order Volume</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Orders per day</p>
        </div>
        <span className="font-mono text-zinc-400 text-sm ml-4 flex-shrink-0">{chart.reduce((s,d)=>s+d.orders,0)} total</span>
      </div>
      {chart.length === 0 ? (
        <div className="h-16 flex items-center justify-center text-zinc-700 text-sm">No data yet</div>
      ) : (
        <>
          <div style={{ height: 64, position: 'relative' }}>
            <div className="absolute inset-0 flex items-end gap-px">
              {chart.map((d, i) => {
                const barH    = Math.max(2, Math.round((d.orders / maxOrders) * 60));
                const isToday = i === chart.length - 1;
                return (
                  <div key={i} className="flex-1 flex items-end" style={{ height: '60px' }}
                    title={`${d.day}: ${d.orders} orders`}>
                    <div className="w-full rounded-t-sm"
                      style={{ height: `${barH}px`, backgroundColor: isToday ? '#6366f1' : '#6366f150' }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
            <span>{chart[0]?.day?.slice(5)}</span>
            <span>{chart[Math.floor(chart.length/2)]?.day?.slice(5)}</span>
            <span className="text-indigo-400 font-bold">Today</span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <h2 className="font-bold text-white text-sm">Reports</h2>
        <span className="text-zinc-500 text-xs hidden sm:block">{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span>
        <div className="ml-auto flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5">
          {(['analytics','history'] as Section[]).map(s => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${section===s ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── ANALYTICS ── */}
      {section === 'analytics' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label:"Today's Revenue", value:`${sym}${summary?.revenue.toFixed(2)??"0.00"}`, sub:'from completed orders', accent:true },
              { label:'Orders Completed', value:String(summary?.ordersCount??0), sub:'closed today' },
              { label:'Active Now',       value:String(summary?.activeOrders??0), sub:'in kitchen or table' },
              { label:'Tables Occupied',  value:String(summary?.occupiedTables??0), sub:'currently in use' },
            ].map((stat,i) => (
              <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{stat.label}</p>
                <p className={`font-mono font-bold text-2xl xl:text-3xl leading-tight break-all ${stat.accent ? 'text-brand-400' : 'text-white'}`}>
                  {stat.value}
                </p>
                <p className="text-zinc-600 text-xs mt-2">{stat.sub}</p>
              </div>
            ))}
          </div>
          <RevenueChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
              <h3 className="font-bold text-white text-sm mb-1">Top Items Today</h3>
              <p className="text-zinc-600 text-xs mb-4">By quantity sold</p>
              {(summary?.topItems?.length ?? 0) === 0 ? (
                <p className="text-zinc-700 text-sm text-center py-6">No completed orders yet today</p>
              ) : (
                <div className="space-y-3">
                  {summary!.topItems.map((item,i) => {
                    const maxQty = summary!.topItems[0].total_qty;
                    const pct    = maxQty>0 ? (item.total_qty/maxQty)*100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-mono text-zinc-600 text-xs w-5 flex-shrink-0">#{i+1}</span>
                            <span className="text-white text-xs font-medium truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs ml-2 flex-shrink-0">
                            <span className="text-zinc-500 whitespace-nowrap">{item.total_qty}×</span>
                            <span className="font-mono font-semibold text-brand-400 whitespace-nowrap">{sym}{item.total_rev.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width:`${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
              <h3 className="font-bold text-white text-sm mb-1">Today at a Glance</h3>
              <p className="text-zinc-600 text-xs mb-4">Live status</p>
              <div className="space-y-4">
                {[
                  { label:'Orders in kitchen', value:summary?.activeOrders??0,   max:Math.max(summary?.ordersCount??1,summary?.activeOrders??1,1), color:'#f97316' },
                  { label:'Completed today',   value:summary?.ordersCount??0,    max:Math.max(summary?.ordersCount??1,1), color:'#10b981' },
                  { label:'Tables in use',     value:summary?.occupiedTables??0, max:8, color:'#3b82f6' },
                ].map((row,i) => {
                  const pct = Math.min(100, row.max>0 ? (row.value/row.max)*100 : 0);
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-zinc-400 text-xs">{row.label}</span>
                        <span className="font-mono text-white text-sm font-bold">{row.value}</span>
                      </div>
                      <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width:`${Math.max(pct,row.value>0?4:0)}%`, backgroundColor:row.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-surface-border">
                <div className="rounded-lg bg-surface-raised p-3">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1">Avg Order</p>
                  <p className="font-mono font-bold text-white text-base sm:text-lg break-all">
                    {summary&&summary.ordersCount>0 ? `${sym}${(summary.revenue/summary.ordersCount).toFixed(2)}` : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-raised p-3">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1">30-Day Total</p>
                  <p className="font-mono font-bold text-white text-base sm:text-lg break-all">{sym}{totalRev.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
          <OrderVolumeChart />
        </div>
      )}

      {/* ── HISTORY ── */}
      {section === 'history' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Search bar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 py-2 flex-wrap">
              <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>
              <input type="date" className="bg-transparent text-sm text-white outline-none w-32" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
              <span className="text-zinc-600 text-xs">—</span>
              <input type="date" className="bg-transparent text-sm text-white outline-none w-32" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-brand btn-sm" onClick={loadHistory}>Search</button>
            {(dateFrom||dateTo) && <button className="btn btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>}
            {sessions.length > 0 && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-zinc-500 text-sm">{sessions.length} visits</span>
                <span className="font-mono font-bold text-white text-sm">{sym}{histTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Export panel */}
          <div className="rounded-xl border border-surface-border bg-surface-card mb-4 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors"
              onClick={() => setExportOpen(o => !o)}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                <span className="font-semibold text-white text-sm">Export Revenue Report</span>
                <span className="text-zinc-600 text-xs hidden sm:block">Professional CSV with summary, daily & item breakdown</span>
              </div>
              <svg className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ${exportOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {exportOpen && (
              <div className="border-t border-surface-border p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div><label className="label">From</label><input type="date" className="input" value={exportFrom} onChange={e=>setExportFrom(e.target.value)} /></div>
                  <div><label className="label">To</label><input type="date" className="input" value={exportTo} onChange={e=>setExportTo(e.target.value)} /></div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => downloadExport('csv')} className="btn btn-brand w-full flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      Export CSV (Excel)
                    </button>
                    <button onClick={() => downloadExport('json')} className="btn w-full text-xs">Export JSON</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Summary block','Tax collected','Avg order value','Items sold','Revenue excl. tax','Daily breakdown','Top items ranking','Full order detail'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sessions list */}
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              <p className="text-sm font-medium">No orders found</p>
              <p className="text-xs mt-1">Click Search to load all history</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="px-1 mb-3 flex items-center justify-between">
                <p className="text-zinc-600 text-xs">Click any row to expand items. Orders within 4 hours on the same table are grouped as one visit.</p>
              </div>
              {sessions.map(session => (
                <SessionRow
                  key={session.sessionKey}
                  session={session}
                  sym={sym}
                  taxPct={taxPct}
                  brand={brand}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
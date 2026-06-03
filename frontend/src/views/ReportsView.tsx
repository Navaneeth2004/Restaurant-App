import React, { useState, useEffect, useCallback } from 'react';
import { getReportToday, getReportHistory, getRevenueChart } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import type { Order, ReportSummary, RevenueDay } from '../types';

type Section = 'analytics' | 'history';

export default function ReportsView() {
  const [section,       setSection]       = useState<Section>('analytics');
  const [summary,       setSummary]       = useState<ReportSummary | null>(null);
  const [history,       setHistory]       = useState<Order[]>([]);
  const [chart,         setChart]         = useState<RevenueDay[]>([]);
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [exportOpen,    setExportOpen]    = useState(false);   // FIX 1: collapsed by default
  const [exportFrom,    setExportFrom]    = useState('');
  const [exportTo,      setExportTo]      = useState('');
  const settings = useSettings();
  const sym = settings.currency_symbol || '₹';

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

  const maxRev    = chart.length ? Math.max(...chart.map(d=>d.revenue), 0.01) : 0.01;
  const maxOrders = chart.length ? Math.max(...chart.map(d=>d.orders),  1)    : 1;
  const totalRev  = chart.reduce((s,d)=>s+d.revenue,0);
  const avgRev    = chart.length ? totalRev/chart.length : 0;
  const histTotal = history.reduce((s,o)=>s+o.items.reduce((ss,i)=>ss+i.price*i.quantity,0),0);

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildExportData = async () => {
    const p: Record<string,string> = {};
    if (exportFrom) p.from = exportFrom;
    if (exportTo)   p.to   = exportTo;
    return getReportHistory(p);
  };

  const exportCSV = async () => {
    const orders = await buildExportData();
    const taxPct = parseFloat(settings.tax_percent || '5') / 100;
    const rows: string[][] = [
      ['Order ID','Table','Date','Items','Subtotal','Tax','Total','Status']
    ];
    for (const o of orders) {
      const sub = o.items.reduce((s,i)=>s+i.price*i.quantity,0);
      rows.push([
        o.id,
        o.table_id,
        new Date(o.created_at).toLocaleString(),
        o.items.map(i=>`${i.quantity}x ${i.name}`).join('; '),
        sub.toFixed(2),
        (sub*taxPct).toFixed(2),
        (sub*(1+taxPct)).toFixed(2),
        o.status,
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    download(csv, 'text/csv', `revenue_report_${exportFrom||'all'}_${exportTo||'all'}.csv`);
  };

  const exportJSON = async () => {
    const orders = await buildExportData();
    download(JSON.stringify(orders, null, 2), 'application/json', `revenue_report.json`);
  };

  const download = (content: string, type: string, filename: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  };
  // ─────────────────────────────────────────────────────────────────────────

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
            {history.length > 0 && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-zinc-500 text-sm">{history.length} orders</span>
                <span className="font-mono font-bold text-white text-sm">{sym}{histTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* ── FIX 1: Export panel — collapsible, closed by default ── */}
          <div className="rounded-xl border border-surface-border bg-surface-card mb-4 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors"
              onClick={() => setExportOpen(o => !o)}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                <span className="font-semibold text-white text-sm">Export Revenue Report</span>
                <span className="text-zinc-600 text-xs hidden sm:block">CSV or JSON for accounting / tax filing</span>
              </div>
              <svg className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ${exportOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {exportOpen && (
              <div className="border-t border-surface-border p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="label">From</label>
                    <input type="date" className="input" value={exportFrom} onChange={e=>setExportFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">To</label>
                    <input type="date" className="input" value={exportTo} onChange={e=>setExportTo(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={exportCSV} className="btn btn-brand w-full flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      Export CSV (Excel)
                    </button>
                    <button onClick={exportJSON} className="btn w-full text-xs">Export JSON</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Total revenue','Tax collected','Avg order value','Items sold','Revenue excl. tax','Number of orders','Daily breakdown','Full order detail'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order list */}
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              <p className="text-sm font-medium">No orders found</p>
              <p className="text-xs mt-1">Click Search to load all history</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                <div className="col-span-1">Table</div>
                <div className="col-span-5">Items</div>
                <div className="col-span-3">Time</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-1 text-right">Status</div>
              </div>
              {history.map(ord => {
                const sub = ord.items.reduce((s,i)=>s+i.price*i.quantity,0);
                return (
                  <div key={ord.id} className="rounded-xl border border-surface-border bg-surface-card px-4 py-3 hover:border-zinc-600 transition-colors">
                    <div className="flex sm:hidden items-center gap-3">
                      <span className="font-mono font-bold text-brand-400 text-sm flex-shrink-0">{ord.table_id}</span>
                      <span className="flex-1 text-zinc-400 text-xs truncate">{ord.items.map(i=>`${i.quantity}× ${i.name}`).join(', ')}</span>
                      <span className="font-mono font-bold text-white text-sm flex-shrink-0">{sym}{sub.toFixed(2)}</span>
                    </div>
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 font-mono font-bold text-brand-400 text-sm">{ord.table_id}</div>
                      <div className="col-span-5 text-zinc-400 text-xs truncate">{ord.items.map(i=>`${i.quantity}× ${i.name}`).join(', ')}</div>
                      <div className="col-span-3 text-zinc-600 text-xs">{new Date(ord.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                      <div className="col-span-2 text-right font-mono font-bold text-white text-sm">{sym}{sub.toFixed(2)}</div>
                      <div className="col-span-1 text-right">
                        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${ord.status==='delivered'?'text-emerald-400 bg-emerald-500/10 border-emerald-500/25':ord.status==='closed'?'text-zinc-500 bg-zinc-800 border-zinc-700':'text-brand-400 bg-brand-500/10 border-brand-500/25'}`}>
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

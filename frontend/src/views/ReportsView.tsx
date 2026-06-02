import React, { useState, useEffect, useCallback } from 'react';
import { getReportToday, getReportHistory, getRevenueChart } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import type { Order, ReportSummary, RevenueDay } from '../types';

type Section = 'analytics' | 'history';

export default function ReportsView() {
  const [section,  setSection]  = useState<Section>('analytics');
  const [summary,  setSummary]  = useState<ReportSummary | null>(null);
  const [history,  setHistory]  = useState<Order[]>([]);
  const [chart,    setChart]    = useState<RevenueDay[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const settings = useSettings();
  const sym = settings.currency_symbol || '₹';

  const loadAnalytics = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([getReportToday(), getRevenueChart()]);
      setSummary(s); setChart(c);
    } catch {}
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
  useEffect(() => { if (section === 'history') loadHistory(); }, [section, loadHistory]);

  // ── Chart helpers ────────────────────────────────────────────────────────
  const maxRev  = Math.max(...chart.map(d => d.revenue), 1);
  const totalChart = chart.reduce((s,d) => s+d.revenue, 0);
  const avgRev  = chart.length ? totalChart / chart.length : 0;

  // Hour breakdown (fake from history data — use order created_at hour)
  const hourData = Array(24).fill(0);
  history.forEach(o => { const h = new Date(o.created_at).getHours(); hourData[h] += o.total || o.items.reduce((s,i) => s+i.price*i.quantity,0); });
  const peakHour = hourData.indexOf(Math.max(...hourData));

  // Category revenue breakdown from top items
  const catRevMap: Record<string,number> = {};
  if (summary?.topItems) {
    summary.topItems.forEach(i => { catRevMap[i.name] = i.total_rev; });
  }

  const historyTotal = history.reduce((s,o) => s + o.items.reduce((ss,i) => ss+i.price*i.quantity,0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + tabs */}
      <div className="flex-shrink-0 flex items-center gap-2 px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <h2 className="font-bold text-white text-sm">Reports</h2>
        <span className="text-zinc-600 text-xs">{new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</span>
        <div className="ml-auto flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5">
          {(['analytics','history'] as Section[]).map(s => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${section===s ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ANALYTICS SECTION */}
      {section === 'analytics' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Today's Revenue",    value: `${sym}${summary?.revenue.toFixed(2)||'—'}`,       sub: 'from completed orders', accent: true },
              { label: 'Orders Completed',   value: String(summary?.ordersCount??'—'),                 sub: 'closed today' },
              { label: 'Active Right Now',   value: String(summary?.activeOrders??'—'),                sub: 'in kitchen or table' },
              { label: 'Tables Occupied',    value: String(summary?.occupiedTables??'—'),              sub: 'of all tables' },
            ].map((stat,i) => (
              <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{stat.label}</p>
                <p className={`font-mono font-bold text-3xl leading-none ${stat.accent ? 'text-brand-400' : 'text-white'}`}>{stat.value}</p>
                <p className="text-zinc-600 text-xs mt-2">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* 2. Revenue bar chart — last 30 days */}
          {chart.length > 0 && (
            <div className="rounded-xl border border-surface-border bg-surface-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-sm">Daily Revenue</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Last 30 days</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-white text-lg">{sym}{totalChart.toFixed(2)}</p>
                  <p className="text-zinc-600 text-xs">avg {sym}{avgRev.toFixed(2)}/day</p>
                </div>
              </div>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {chart.map((d, i) => {
                  const pct = Math.max(3, (d.revenue / maxRev) * 100);
                  const isToday = d.day === new Date().toISOString().split('T')[0];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0 group" title={`${d.day}\n${sym}${d.revenue.toFixed(2)} · ${d.orders} orders`}>
                      <div
                        className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-brand-400' : 'bg-brand-500/50 group-hover:bg-brand-500/80'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels — only first, middle, last */}
              <div className="flex justify-between mt-2">
                <span className="text-zinc-700 text-[9px] font-mono">{chart[0]?.day?.slice(5)}</span>
                <span className="text-zinc-700 text-[9px] font-mono">{chart[Math.floor(chart.length/2)]?.day?.slice(5)}</span>
                <span className="text-zinc-500 text-[9px] font-mono font-bold">Today</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 3. Top items table */}
            {(summary?.topItems?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-surface-border bg-surface-card p-5">
                <h3 className="font-bold text-white text-sm mb-1">Top Items Today</h3>
                <p className="text-zinc-600 text-xs mb-4">By units sold</p>
                <div className="space-y-3">
                  {summary!.topItems.map((item, i) => {
                    const maxQty = summary!.topItems[0].total_qty;
                    const pct = (item.total_qty / maxQty) * 100;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-600 text-xs w-4">#{i+1}</span>
                            <span className="text-white text-xs font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-zinc-500">{item.total_qty}× sold</span>
                            <span className="font-mono font-semibold text-brand-400">{sym}{item.total_rev.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Order status breakdown */}
            <div className="rounded-xl border border-surface-border bg-surface-card p-5">
              <h3 className="font-bold text-white text-sm mb-1">Today at a Glance</h3>
              <p className="text-zinc-600 text-xs mb-4">Current status overview</p>
              <div className="space-y-3">
                {[
                  { label: 'Orders in kitchen',   value: summary?.activeOrders??0,   color: 'bg-brand-500', max: Math.max(summary?.ordersCount??1, summary?.activeOrders??1, 1) },
                  { label: 'Completed today',      value: summary?.ordersCount??0,    color: 'bg-emerald-500', max: Math.max(summary?.ordersCount??1, 1) },
                  { label: 'Tables in use',        value: summary?.occupiedTables??0, color: 'bg-blue-500',    max: 8 },
                ].map((row,i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{row.label}</span>
                      <span className="font-mono text-white font-semibold">{row.value}</span>
                    </div>
                    <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${Math.min(100,(row.value/row.max)*100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* 5. Avg order value */}
              <div className="mt-5 pt-4 border-t border-surface-border grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-raised p-3">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wide">Avg Order Value</p>
                  <p className="font-mono font-bold text-white text-lg mt-1">
                    {summary && summary.ordersCount > 0
                      ? `${sym}${(summary.revenue / summary.ordersCount).toFixed(2)}`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-raised p-3">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wide">30-Day Total</p>
                  <p className="font-mono font-bold text-white text-lg mt-1">{sym}{totalChart.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. 30-day orders count trend */}
          {chart.length > 0 && (
            <div className="rounded-xl border border-surface-border bg-surface-card p-5">
              <h3 className="font-bold text-white text-sm mb-1">Order Volume</h3>
              <p className="text-zinc-600 text-xs mb-4">Number of orders per day — last 30 days</p>
              <div className="flex items-end gap-1" style={{ height: 64 }}>
                {chart.map((d, i) => {
                  const maxOrds = Math.max(...chart.map(x => x.orders), 1);
                  const pct = Math.max(4, (d.orders / maxOrds) * 100);
                  return (
                    <div key={i} className="flex-1 group" title={`${d.day}: ${d.orders} orders`}>
                      <div className="w-full bg-zinc-700/50 group-hover:bg-zinc-500 rounded-sm transition-colors" style={{ height: `${pct}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-zinc-700 text-[9px] font-mono">{chart[0]?.day?.slice(5)}</span>
                <span className="text-zinc-500 text-[9px] font-mono font-bold">Today</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY SECTION */}
      {section === 'history' && (
        <div className="flex-1 overflow-y-auto p-5">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 py-2">
              <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>
              <input type="date" className="bg-transparent text-sm text-white outline-none" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-zinc-600 text-xs">—</span>
              <input type="date" className="bg-transparent text-sm text-white outline-none" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-brand btn-sm" onClick={loadHistory}>Search</button>
            {(dateFrom||dateTo) && <button className="btn btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>}
            {history.length > 0 && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-zinc-500">{history.length} orders</span>
                <span className="font-mono font-bold text-white">{sym}{historyTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              <p className="text-sm font-medium">No orders found</p>
              <p className="text-xs mt-1">Try adjusting your date range</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Column header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                <div className="col-span-1">Table</div>
                <div className="col-span-5">Items</div>
                <div className="col-span-3 hidden md:block">Time</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-1 text-right">Status</div>
              </div>
              {history.map(ord => {
                const sub = ord.items.reduce((s,i) => s+i.price*i.quantity, 0);
                return (
                  <div key={ord.id} className="grid grid-cols-12 gap-2 px-4 py-3 rounded-xl border border-surface-border bg-surface-card items-center hover:border-zinc-600 transition-colors">
                    <div className="col-span-1 font-mono font-bold text-brand-400 text-sm">{ord.table_id}</div>
                    <div className="col-span-5 text-zinc-400 text-xs truncate">{ord.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</div>
                    <div className="col-span-3 hidden md:block text-zinc-600 text-xs">{new Date(ord.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                    <div className="col-span-2 text-right font-mono font-bold text-white text-sm">{sym}{sub.toFixed(2)}</div>
                    <div className="col-span-1 text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${
                        ord.status==='delivered' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                        : ord.status==='closed'  ? 'text-zinc-500 bg-zinc-800 border-zinc-700'
                        : 'text-brand-400 bg-brand-500/10 border-brand-500/25'
                      }`}>{ord.status}</span>
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

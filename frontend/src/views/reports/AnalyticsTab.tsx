/**
 * views/reports/AnalyticsTab.tsx
 *
 * Today's KPI cards, revenue/volume charts, 30-day insights,
 * and best-days-of-week panel.
 * Extracted from ReportsView.tsx.
 *
 * FIX: added a "Bill vs Paid" card so any cumulative difference between
 * what was billed and what was actually collected today (discounts,
 * rounding, card surcharges, overpayments) is visible at a glance,
 * instead of being invisible/buried in individual orders.
 */

import React from 'react';
import type { ReportSummary, RevenueDay } from '../../types';

interface Props {
  summary:  ReportSummary | null;
  chart:    RevenueDay[];
  sym:      string;
  taxPct:   number;
  settings: { tax_percent?: string };
}

export default function AnalyticsTab({ summary, chart, sym, taxPct, settings }: Props) {
  const maxRev    = chart.length ? Math.max(...chart.map(d => d.revenue), 0.01) : 0.01;
  const maxOrders = chart.length ? Math.max(...chart.map(d => d.orders), 1) : 1;
  const totalRev  = chart.reduce((s, d) => s + d.revenue, 0);
  const avgRev    = chart.length ? totalRev / chart.length : 0;
  const totalOrdersChart = chart.reduce((s, d) => s + d.orders, 0);
  const activeDays = chart.filter(d => d.orders > 0).length;
  const avgOrdersPerActiveDay = activeDays > 0 ? totalOrdersChart / activeDays : 0;

  const bestDay  = chart.reduce((best, d) => d.revenue > (best?.revenue ?? 0) ? d : best, chart[0] ?? null);
  const worstDay = chart.filter(d => d.revenue > 0).reduce(
    (worst, d) => d.revenue < (worst?.revenue ?? Infinity) ? d : worst, null as RevenueDay | null
  );

  const revenueGrowth = (() => {
    if (chart.length < 2) return null;
    const half   = Math.floor(chart.length / 2);
    const first  = chart.slice(0, half).reduce((s, d) => s + d.revenue, 0);
    const second = chart.slice(half).reduce((s, d) => s + d.revenue, 0);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
  })();

  // ── Bill vs Paid for today ────────────────────────────────────────────
  const billTotalToday = summary?.billTotalInclTax ?? 0;
  const paidTotalToday = summary?.paidTotal ?? billTotalToday;
  const paidDiffToday  = summary?.paidVsBillDiff ?? (paidTotalToday - billTotalToday);
  const hasDiffToday    = Math.abs(paidDiffToday) >= 0.01;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Revenue", value: `${sym}${summary?.revenue.toFixed(2) ?? '0.00'}`, sub: 'from completed orders', accent: true },
          { label: 'Orders Completed', value: String(summary?.ordersCount ?? 0), sub: 'closed today' },
          { label: 'Active Now',       value: String(summary?.activeOrders ?? 0), sub: 'in kitchen or table' },
          { label: 'Tables Occupied',  value: String(summary?.occupiedTables ?? 0), sub: 'currently in use' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{stat.label}</p>
            <p className={`font-mono font-bold text-2xl xl:text-3xl leading-tight break-all ${stat.accent ? 'text-brand-400' : 'text-white'}`}>
              {stat.value}
            </p>
            <p className="text-zinc-600 text-xs mt-2">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Bill vs Paid — only worth a dedicated card when there's an actual difference,
          but always shown so staff get used to checking it */}
      <div className={`rounded-xl border p-4 sm:p-5 ${
        hasDiffToday
          ? (paidDiffToday < 0 ? 'border-red-500/30 bg-red-500/5' : 'border-blue-500/30 bg-blue-500/5')
          : 'border-surface-border bg-surface-card'
      }`}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              Bill vs. Actually Paid — Today
              {hasDiffToday && (
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${
                  paidDiffToday < 0
                    ? 'bg-red-500/15 text-red-400 border-red-500/25'
                    : 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                }`}>
                  {paidDiffToday < 0 ? 'Short' : 'Over'}
                </span>
              )}
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              Tracks discounts, rounding, surcharges, or overpayments across all closed orders today
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Billed</p>
            <p className="font-mono font-bold text-lg text-white">{sym}{billTotalToday.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Actually Paid</p>
            <p className={`font-mono font-bold text-lg ${hasDiffToday ? (paidDiffToday < 0 ? 'text-red-400' : 'text-blue-400') : 'text-emerald-400'}`}>
              {sym}{paidTotalToday.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Difference</p>
            <p className={`font-mono font-bold text-lg ${hasDiffToday ? (paidDiffToday < 0 ? 'text-red-400' : 'text-blue-400') : 'text-zinc-600'}`}>
              {hasDiffToday ? `${paidDiffToday < 0 ? '-' : '+'}${sym}${Math.abs(paidDiffToday).toFixed(2)}` : `${sym}0.00`}
            </p>
          </div>
        </div>
        {!hasDiffToday && (summary?.ordersCount ?? 0) > 0 && (
          <p className="text-zinc-600 text-xs mt-3">Every order today was paid exactly as billed.</p>
        )}
        {(summary?.ordersCount ?? 0) === 0 && (
          <p className="text-zinc-600 text-xs mt-3">No completed orders yet today.</p>
        )}
      </div>

      {/* Revenue chart */}
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
              <span>{chart[Math.floor(chart.length / 2)]?.day?.slice(5)}</span>
              <span className="text-brand-500 font-bold">Today</span>
            </div>
          </>
        )}
      </div>

      {/* Insights + Best Days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 30-day insights */}
        <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
          <h3 className="font-bold text-white text-sm mb-1">30-Day Insights</h3>
          <p className="text-zinc-600 text-xs mb-4">Trends and patterns from the last month</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Best Day',        color: '#10b981', value: bestDay ? `${sym}${bestDay.revenue.toFixed(2)}` : null, sub: bestDay ? new Date(bestDay.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No data' },
              { label: 'Active Days',     color: '#fff',    value: `${activeDays}`, sub: `${Math.round((activeDays / 30) * 100)}% of the month`, extra: <span className="text-zinc-600 text-xs font-normal"> / 30</span> },
              { label: 'Avg Orders/Day',  color: '#fff',    value: avgOrdersPerActiveDay.toFixed(1), sub: 'on active days' },
              { label: '15-Day Trend',    color: revenueGrowth !== null ? (revenueGrowth >= 0 ? '#10b981' : '#ef4444') : '#52525b',
                value: revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%` : null, sub: revenueGrowth !== null ? 'vs prior 15 days' : 'Insufficient data' },
              { label: '30-Day Avg Order', color: '#fff',   value: totalOrdersChart > 0 ? `${sym}${(totalRev / totalOrdersChart).toFixed(2)}` : null, sub: `across ${totalOrdersChart} orders` },
              { label: 'Quietest Day',    color: '#f59e0b', value: worstDay ? `${sym}${worstDay.revenue.toFixed(2)}` : null, sub: worstDay ? new Date(worstDay.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No data' },
              { label: 'Total Revenue',   color: 'var(--brand,#f97316)', value: `${sym}${totalRev.toFixed(2)}`, sub: 'last 30 days' },
              { label: 'Best Streak',     color: '#fff',    value: (() => { let best = 0, cur = 0; chart.forEach(d => { if (d.orders > 0) { cur++; best = Math.max(best, cur); } else cur = 0; }); return best > 0 ? `${best} days` : null; })(), sub: 'consecutive active days' },
              { label: 'Est. Tax Collected', color: '#fff', value: totalRev > 0 ? `${sym}${(totalRev * parseFloat(settings.tax_percent || '5') / 100).toFixed(2)}` : null, sub: `${settings.tax_percent || 5}% on ${sym}${totalRev.toFixed(2)}` },
            ].map(({ label, color, value, sub }) => (
              <div key={label} className="rounded-lg bg-surface-raised border border-surface-border p-3">
                <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">{label}</p>
                {value
                  ? <p className="font-mono font-bold text-base" style={{ color }}>{value}</p>
                  : <p className="text-zinc-700 text-xs">No data</p>}
                <p className="text-zinc-500 text-[10px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Best days of week */}
        <BestDaysPanel chart={chart} sym={sym} />
      </div>

      {/* Order volume chart */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-sm">Order Volume</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Orders per day — last 30 days</p>
          </div>
          <span className="font-mono text-zinc-400 text-sm ml-4 flex-shrink-0">{totalOrdersChart} total</span>
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
                    <div key={i} className="flex-1 flex items-end" style={{ height: '60px' }} title={`${d.day}: ${d.orders} orders`}>
                      <div className="w-full rounded-t-sm" style={{ height: `${barH}px`, backgroundColor: isToday ? '#6366f1' : '#6366f150' }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
              <span>{chart[0]?.day?.slice(5)}</span>
              <span>{chart[Math.floor(chart.length / 2)]?.day?.slice(5)}</span>
              <span className="text-indigo-400 font-bold">Today</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BestDaysPanel({ chart, sym }: { chart: RevenueDay[]; sym: string }) {
  const dowMap: Record<number, { revenue: number; orders: number; days: number }> = {};
  for (let i = 0; i < 7; i++) dowMap[i] = { revenue: 0, orders: 0, days: 0 };
  chart.forEach(d => {
    const dow = new Date(d.day + 'T12:00:00').getDay();
    dowMap[dow].revenue += d.revenue;
    dowMap[dow].orders  += d.orders;
    dowMap[dow].days    += 1;
  });

  const dayNames  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxAvgRev = Math.max(...Object.values(dowMap).map(d => d.days > 0 ? d.revenue / d.days : 0), 0.01);
  const totalOrdersChart = chart.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <h3 className="font-bold text-white text-sm mb-1">Best Days of the Week</h3>
      <p className="text-zinc-600 text-xs mb-4">Average daily revenue by weekday — last 30 days</p>
      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => {
          const d       = dowMap[i];
          const avg     = d.days > 0 ? d.revenue / d.days : 0;
          const pct     = maxAvgRev > 0 ? (avg / maxAvgRev) * 100 : 0;
          const isToday = new Date().getDay() === i;
          return (
            <div key={i}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-semibold ${isToday ? 'text-brand-400' : 'text-zinc-400'}`}>
                  {dayNames[i]}{isToday ? ' · today' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">{d.orders} orders</span>
                  <span className="font-mono text-white text-sm font-bold">
                    {avg > 0 ? `${sym}${avg.toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, d.orders > 0 ? 2 : 0)}%`,
                    backgroundColor: isToday ? 'var(--brand, #f97316)' : '#6366f1',
                  }} />
              </div>
            </div>
          );
        })}
      </div>
      {totalOrdersChart === 0 && (
        <p className="text-zinc-600 text-xs mt-3">No data yet — check back after a few days of orders</p>
      )}
    </div>
  );
}
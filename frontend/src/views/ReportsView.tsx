/**
 * views/ReportsView.tsx
 *
 * Analytics and History only. Export has moved to its own top-level tab.
 *
 * FIX: Analytics data (KPI cards, revenue chart) never refreshed after the
 * initial mount because there were no socket listeners. Orders being placed,
 * delivered, or closed would not update the view without a page reload.
 *
 * Now wires up the same socket events used by WaiterView / KitchenView so
 * the Analytics tab stays live:
 *   - new_order       → active order count changes
 *   - order_updated   → active order details change
 *   - order_delivered → table status + active count changes
 *   - order_closed    → revenue, ordersCount, occupiedTables all change
 *   - tables_updated  → occupiedTables count may change
 *
 * The History tab is date-filtered and intentionally NOT auto-refreshed —
 * auto-inserting new rows while the user is reading would be disorienting.
 * The user can click "Search" or "Today" to reload it manually.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getReportToday, getRevenueChart } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useSettings } from '../context/SettingsContext';

import AnalyticsTab from './reports/AnalyticsTab';
import HistoryTab   from './reports/HistoryTab';

import type { ReportSummary, RevenueDay } from '../types';

type Section = 'analytics' | 'history';

export default function ReportsView() {
  const [section, setSection] = useState<Section>('analytics');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [chart,   setChart]   = useState<RevenueDay[]>([]);

  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const brand    = (settings.brand_color as string) || '#f97316';

  const loadAnalytics = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([getReportToday(), getRevenueChart()]);
      setSummary(s);
      setChart(c);
    } catch {}
  }, []);

  // Initial load
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  // FIX: refresh analytics on every event that changes today's numbers.
  // We batch all of them into a single loadAnalytics call — it fetches
  // both /reports/today and /reports/revenue in parallel so it's fast.
  //
  // We only refresh when on the analytics section to avoid unnecessary
  // network calls when the user is reading the History tab. The summary
  // will be stale while on History, but it refreshes immediately when
  // the user switches back to Analytics.
  const handleOrderEvent = useCallback(() => {
    if (section === 'analytics') loadAnalytics();
  }, [section, loadAnalytics]);

  // Keep a stable ref version that also triggers when switching back to analytics
  useEffect(() => {
    if (section === 'analytics') loadAnalytics();
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocket('new_order',       handleOrderEvent);
  useSocket('order_updated',   handleOrderEvent);
  useSocket('order_delivered', handleOrderEvent);
  useSocket('order_closed',    handleOrderEvent);
  useSocket('tables_updated',  handleOrderEvent);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h2 className="font-bold text-white text-sm hidden sm:block">Reports</h2>
          <span className="text-zinc-500 text-xs hidden sm:block">
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="sm:ml-auto self-start flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5 overflow-x-auto no-scrollbar max-w-full">
          {([
            { key: 'analytics', label: 'Analytics' },
            { key: 'history',   label: 'History'   },
          ] as { key: Section; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                section === key ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {section === 'analytics' && (
          <AnalyticsTab
            summary={summary}
            chart={chart}
            sym={sym}
            taxPct={taxPct}
            settings={settings}
          />
        )}
        {section === 'history' && (
          <HistoryTab sym={sym} taxPct={taxPct} brand={brand} />
        )}
      </div>
    </div>
  );
}
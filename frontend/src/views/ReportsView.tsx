/**
 * views/ReportsView.tsx
 *
 * Thin shell — tab switching and shared data fetching only.
 * Rendering lives in views/reports/.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getReportToday, getRevenueChart } from '../services/api';
import { useSettings } from '../context/SettingsContext';

import AnalyticsTab from './reports/AnalyticsTab';
import HistoryTab   from './reports/HistoryTab';
import ExportTab    from './reports/ExportTab';

import type { ReportSummary, RevenueDay } from '../types';

type Section = 'analytics' | 'history' | 'export';

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

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <h2 className="font-bold text-white text-sm">Reports</h2>
        <span className="text-zinc-500 text-xs hidden sm:block">
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <div className="ml-auto flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5">
          {([
            { key: 'analytics', label: 'Analytics' },
            { key: 'history',   label: 'History'   },
            { key: 'export',    label: 'Export'     },
          ] as { key: Section; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
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
        {section === 'export' && (
          <ExportTab />
        )}
      </div>
    </div>
  );
}
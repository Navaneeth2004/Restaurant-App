import { formatDayLabel } from 'lib/format/local-time';
import { formatMoney } from 'lib/format/money';
import type { Insights } from 'lib/reports/revenue-insights';

interface Tile { label: string; value: string | null; sub: string; color?: string }

export default function InsightsGrid({ insights: i, sym }: { insights: Insights; sym: string }) {
  const trend = i.trendPct;
  const tiles: Tile[] = [
    { label: 'Best Day', value: i.bestDay ? formatMoney(i.bestDay.revenue, sym) : null, sub: i.bestDay ? formatDayLabel(i.bestDay.day) : 'No data', color: '#10b981' },
    { label: 'Quietest Day', value: i.quietestDay ? formatMoney(i.quietestDay.revenue, sym) : null, sub: i.quietestDay ? formatDayLabel(i.quietestDay.day) : 'No data', color: '#f59e0b' },
    { label: 'Active Days', value: String(i.activeDays), sub: `${Math.round((i.activeDays / 30) * 100)}% of 30 days` },
    { label: 'Best Streak', value: i.bestStreak > 0 ? `${i.bestStreak} days` : null, sub: 'consecutive days with orders' },
    { label: 'Avg Visits/Day', value: i.avgOrdersPerActiveDay === null ? null : i.avgOrdersPerActiveDay.toFixed(1), sub: 'on active days' },
    { label: 'Avg Visit Value', value: i.avgOrderValue === null ? null : formatMoney(i.avgOrderValue, sym), sub: `before tax · ${i.totalOrders} visits` },
    { label: '15-Day Trend', value: trend === null ? null : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`, sub: trend === null ? 'Insufficient data' : 'vs the 15 days before', color: trend === null ? undefined : trend >= 0 ? '#10b981' : '#ef4444' },
    { label: 'Total Revenue', value: formatMoney(i.totalRevenue, sym), sub: 'before tax · last 30 days', color: 'var(--brand,#f97316)' },
  ];
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <h3 className="font-bold text-white text-sm mb-1">30-Day Insights</h3>
      <p className="text-zinc-600 text-xs mb-4">Trends and patterns from the last month (amounts are before tax)</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-lg bg-surface-raised border border-surface-border p-3">
            <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">{t.label}</p>
            {t.value ? <p className="font-mono font-bold text-base" style={t.color ? { color: t.color } : undefined}>{t.value}</p> : <p className="text-zinc-700 text-xs">No data</p>}
            <p className="text-zinc-500 text-[10px] mt-0.5">{t.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

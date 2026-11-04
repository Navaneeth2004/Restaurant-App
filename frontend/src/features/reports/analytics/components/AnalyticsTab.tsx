import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { formatMoney } from 'lib/format/money';
import { useSettings } from 'state/settings/useSettings';
import { useAnalytics } from '../hooks/useAnalytics';
import DailyBars from './DailyBars';
import InsightsGrid from './InsightsGrid';
import KpiCards from './KpiCards';
import WeekdayPanel from './WeekdayPanel';

export default function AnalyticsTab() {
  const sym = useSettings().currency_symbol || '₹';
  const a = useAnalytics();
  if (a.loading) return <PageSpinner />;
  const { totalRevenue, totalOrders } = a.insights;
  const avgPerDay = totalRevenue / a.days.length;

  return (
    <div className="space-y-4">
      <ErrorNotice error={a.error} onRetry={a.reload} fallback="Could not load the reports" />
      <KpiCards summary={a.summary} sym={sym} />
      <DailyBars title="Daily Revenue" subtitle="Last 30 days, before tax" empty={!a.hasChartData} days={a.days} height={100}
        value={d => d.revenue} hint={d => `${formatMoney(d.revenue, sym)} · ${d.orders} visits`} color="#f97316" pastColor="#f9731660" todayClass="text-brand-500"
        headline={<><p className="font-mono font-bold text-white text-sm sm:text-base leading-tight">{formatMoney(totalRevenue, sym)}</p><p className="text-zinc-600 text-[10px] mt-0.5 whitespace-nowrap">avg {formatMoney(avgPerDay, sym)}/day</p></>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InsightsGrid insights={a.insights} sym={sym} />
        <WeekdayPanel stats={a.weekdays} todayWeekday={a.todayWeekday} sym={sym} />
      </div>
      <DailyBars title="Visit Volume" subtitle="Dining visits per day — last 30 days" empty={!a.hasChartData} days={a.days} height={64}
        value={d => d.orders} hint={d => `${d.orders} visits`} color="#6366f1" pastColor="#6366f150" todayClass="text-indigo-400"
        headline={<span className="font-mono text-zinc-400 text-sm">{totalOrders} total</span>} />
    </div>
  );
}

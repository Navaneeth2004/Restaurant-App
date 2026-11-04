import { formatMoney } from 'lib/format/money';
import type { WeekdayStat } from 'lib/reports/revenue-insights';

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeekdayPanel({ stats, todayWeekday, sym }: { stats: ReadonlyArray<WeekdayStat>; todayWeekday: number; sym: string }) {
  const max = Math.max(...stats.map(s => s.avgRevenue), 0.01);
  const any = stats.some(s => s.orders > 0);
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <h3 className="font-bold text-white text-sm mb-1">Best Days of the Week</h3>
      <p className="text-zinc-600 text-xs mb-4">Average daily revenue by weekday, before tax — last 30 days (days without orders count as 0)</p>
      <div className="space-y-3">
        {stats.map(s => {
          const isToday = s.weekday === todayWeekday;
          const pct = (s.avgRevenue / max) * 100;
          return (
            <div key={s.weekday}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-semibold ${isToday ? 'text-brand-400' : 'text-zinc-400'}`}>{NAMES[s.weekday]}{isToday ? ' · today' : ''}</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">{s.orders} visits</span>
                  <span className="font-mono text-white text-sm font-bold">{s.avgRevenue > 0 ? formatMoney(s.avgRevenue, sym) : '—'}</span>
                </div>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, s.orders > 0 ? 2 : 0)}%`, backgroundColor: isToday ? 'var(--brand, #f97316)' : '#6366f1' }} />
              </div>
            </div>
          );
        })}
      </div>
      {!any && <p className="text-zinc-600 text-xs mt-3">No data yet — check back after a few days of orders</p>}
    </div>
  );
}

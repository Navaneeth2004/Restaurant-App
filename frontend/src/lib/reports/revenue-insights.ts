import type { RevenueDay } from 'types/office/reports';

const DAY_MS = 86_400_000;
const utc = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** "YYYY-MM-DD" plus n calendar days (no time-zone maths: these are calendar dates). */
export function addDays(day: string, n: number): string {
  return new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10);
}
/** 0 = Sunday. */
export const weekdayOf = (day: string): number => new Date(utc(day)).getUTCDay();

/**
 * The server only returns days that had orders. Returns EXACTLY `count` consecutive calendar days ending on
 * `endDay`, oldest first, with zeros for the days without orders (so trends, streaks and weekday averages are honest).
 */
export function fillDays(chart: ReadonlyArray<RevenueDay>, endDay: string, count = 30): RevenueDay[] {
  const byDay = new Map(chart.map(d => [d.day, d]));
  const out: RevenueDay[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = addDays(endDay, -i);
    out.push(byDay.get(day) ?? { day, revenue: 0, orders: 0 });
  }
  return out;
}

export interface Insights {
  totalRevenue: number; totalOrders: number; activeDays: number;
  bestDay: RevenueDay | null; quietestDay: RevenueDay | null;
  avgOrdersPerActiveDay: number | null; avgOrderValue: number | null;
  /** Last half vs the half before it, in percent; null when the earlier half had no revenue. */
  trendPct: number | null; bestStreak: number;
}

export function computeInsights(days: ReadonlyArray<RevenueDay>): Insights {
  const active = days.filter(d => d.orders > 0 || d.revenue > 0);
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = days.reduce((s, d) => s + d.orders, 0);
  const half = Math.floor(days.length / 2);
  const before = days.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const after = days.slice(half).reduce((s, d) => s + d.revenue, 0);
  let streak = 0;
  let bestStreak = 0;
  for (const d of days) {
    streak = d.orders > 0 ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const best = active.reduce<RevenueDay | null>((b, d) => (b === null || d.revenue > b.revenue ? d : b), null);
  const quiet = active.filter(d => d.revenue > 0).reduce<RevenueDay | null>((q, d) => (q === null || d.revenue < q.revenue ? d : q), null);
  return {
    totalRevenue, totalOrders, activeDays: active.length, bestDay: best, quietestDay: quiet,
    avgOrdersPerActiveDay: active.length ? totalOrders / active.length : null,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : null,
    trendPct: days.length >= 2 && before > 0 ? ((after - before) / before) * 100 : null,
    bestStreak,
  };
}

export interface WeekdayStat { weekday: number; avgRevenue: number; orders: number; days: number }

/** Average revenue per weekday over the given (filled) days; closed days count as 0. */
export function weekdayStats(days: ReadonlyArray<RevenueDay>): WeekdayStat[] {
  const stats: WeekdayStat[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, avgRevenue: 0, orders: 0, days: 0 }));
  const sums = new Array<number>(7).fill(0);
  for (const d of days) {
    const w = weekdayOf(d.day);
    sums[w] += d.revenue;
    stats[w].orders += d.orders;
    stats[w].days += 1;
  }
  return stats.map(s => ({ ...s, avgRevenue: s.days ? sums[s.weekday] / s.days : 0 }));
}

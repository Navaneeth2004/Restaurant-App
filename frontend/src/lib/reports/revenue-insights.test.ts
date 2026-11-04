import { addDays, computeInsights, fillDays, weekdayOf, weekdayStats } from './revenue-insights';

const d = (day: string, revenue: number, orders: number) => ({ day, revenue, orders });

test('calendar day maths crosses months and years', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  expect(weekdayOf('2026-01-04')).toBe(0);
});

test('fillDays returns exactly N consecutive days, zero-filled, and drops days outside the window', () => {
  const out = fillDays([d('2026-01-10', 50, 2), d('2025-12-01', 99, 9)], '2026-01-12', 5);
  expect(out.map(x => x.day)).toEqual(['2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12']);
  expect(out[2]).toEqual(d('2026-01-10', 50, 2));
  expect(out[0]).toEqual(d('2026-01-08', 0, 0));
});

test('a gap breaks the streak (the old index-based code would have joined the two runs)', () => {
  const days = fillDays([d('2026-01-01', 10, 1), d('2026-01-02', 10, 1), d('2026-01-04', 10, 1)], '2026-01-04', 4);
  expect(computeInsights(days).bestStreak).toBe(2);
});

test('trend compares the last half with the half before it, in calendar days', () => {
  const days = fillDays([d('2026-01-01', 100, 1), d('2026-01-04', 150, 1)], '2026-01-04', 4);
  const i = computeInsights(days);
  expect(i.trendPct).toBe(50);
  expect(i.activeDays).toBe(2);
  expect(i.bestDay?.day).toBe('2026-01-04');
  expect(i.quietestDay?.day).toBe('2026-01-01');
  expect(i.avgOrderValue).toBe(125);
});

test('empty data gives null instead of NaN', () => {
  const i = computeInsights(fillDays([], '2026-01-04', 4));
  expect(i.trendPct).toBeNull();
  expect(i.avgOrderValue).toBeNull();
  expect(i.avgOrdersPerActiveDay).toBeNull();
  expect(i.bestDay).toBeNull();
  expect(i.bestStreak).toBe(0);
});

test('weekday averages count closed days as zero', () => {
  // 2026-01-05 and 2026-01-12 are Mondays
  const s = weekdayStats(fillDays([d('2026-01-05', 200, 4)], '2026-01-12', 8));
  expect(s[1].days).toBe(2);
  expect(s[1].avgRevenue).toBe(100);
  expect(s[1].orders).toBe(4);
});

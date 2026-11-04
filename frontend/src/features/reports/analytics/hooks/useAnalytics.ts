import { useCallback, useMemo } from 'react';
import { getReportToday, getRevenueChart } from 'api/office/reports.api';
import { ANALYTICS_REFRESH_MS } from 'config/constants';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useDebouncedCallback } from 'hooks/async/useDebouncedCallback';
import { useNow } from 'hooks/time/useNow';
import { todayStr } from 'lib/format/local-time';
import { computeInsights, fillDays, weekdayOf, weekdayStats } from 'lib/reports/revenue-insights';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { RevenueDay } from 'types/office/reports';

const NONE: RevenueDay[] = [];
const WINDOW_DAYS = 30;

/** Today's numbers + the last 30 local days. Stays live: any order event refreshes (debounced); a reconnect refetches. */
export function useAnalytics() {
  const loadSummary = useCallback((s: AbortSignal) => getReportToday(s), []);
  const loadChart = useCallback((s: AbortSignal) => getRevenueChart(s), []);
  const summary = useAsync(loadSummary);
  const chart = useAsync(loadChart);
  const { reload: reloadSummary } = summary;
  const { reload: reloadChart } = chart;
  const reload = useCallback(() => { reloadSummary(); reloadChart(); }, [reloadSummary, reloadChart]);
  const refresh = useDebouncedCallback(reload, ANALYTICS_REFRESH_MS);

  useSocketEvent(EVENTS.newOrder, refresh);
  useSocketEvent(EVENTS.orderUpdated, refresh);
  useSocketEvent(EVENTS.orderDelivered, refresh);
  useSocketEvent(EVENTS.orderClosed, refresh);
  useSocketEvent(EVENTS.orderItemCancelled, refresh);
  useSocketEvent(EVENTS.orderRoundCancelled, refresh);
  useSocketEvent(EVENTS.tablesUpdated, refresh);
  useRefetchOnReconnect(reload);

  const nowMs = useNow(60_000);
  const today = todayStr(new Date(nowMs));
  const days = useMemo(() => fillDays(chart.data ?? NONE, today, WINDOW_DAYS), [chart.data, today]);
  const insights = useMemo(() => computeInsights(days), [days]);
  const weekdays = useMemo(() => weekdayStats(days), [days]);

  return {
    summary: summary.data, days, insights, weekdays, todayWeekday: weekdayOf(today),
    hasChartData: (chart.data ?? NONE).length > 0,
    loading: (summary.loading && summary.data === null) || (chart.loading && chart.data === null),
    error: summary.error ?? chart.error, reload,
  };
}

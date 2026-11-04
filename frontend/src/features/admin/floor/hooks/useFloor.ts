import { useCallback, useMemo, useState } from 'react';
import { listActiveOrders } from 'api/restaurant/orders.api';
import { getReportHistory, getReportToday } from 'api/office/reports.api';
import { listTables } from 'api/restaurant/tables.api';
import { EVENTS } from 'config/events';
import { useAsync } from 'hooks/async/useAsync';
import { useNow } from 'hooks/time/useNow';
import { useTableOrders } from 'hooks/async/useTableOrders';
import { hourBuckets } from 'lib/format/hours';
import { toDateInput, todayStr } from 'lib/format/local-time';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';
import { computeFloorMetrics } from './floor-metrics';

const NO_TABLES: Table[] = [];
const NO_ORDERS: Order[] = [];
const HOURS = 12;

export function useFloor() {
  const nowMs = useNow(15_000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loadTables = useCallback((s: AbortSignal) => listTables(s), []);
  const loadActive = useCallback((s: AbortSignal) => listActiveOrders(s), []);
  const loadSummary = useCallback((s: AbortSignal) => getReportToday(s), []);
  // Yesterday + today, so the 12-hour window is complete even right after midnight.
  const loadHistory = useCallback((s: AbortSignal) => getReportHistory({ from: toDateInput(new Date(Date.now() - 86_400_000)), to: todayStr() }, s), []);
  const tables = useAsync(loadTables);
  const active = useAsync(loadActive);
  const summary = useAsync(loadSummary);
  const history = useAsync(loadHistory);
  const selectedOrders = useTableOrders(selectedId);

  const { reload: reloadTables } = tables;
  const { reload: reloadActive } = active;
  const { reload: reloadSummary } = summary;
  const { reload: reloadHistory } = history;
  const { reload: reloadSelected } = selectedOrders;
  const refreshLive = useCallback(() => { reloadTables(); reloadActive(); reloadSummary(); reloadSelected(); }, [reloadTables, reloadActive, reloadSummary, reloadSelected]);
  const refreshAll = useCallback(() => { refreshLive(); reloadHistory(); }, [refreshLive, reloadHistory]);

  useSocketEvent(EVENTS.newOrder, refreshLive);
  useSocketEvent(EVENTS.orderUpdated, refreshLive);
  useSocketEvent(EVENTS.orderDelivered, refreshLive);
  useSocketEvent(EVENTS.orderItemCancelled, refreshLive);
  useSocketEvent(EVENTS.orderRoundCancelled, refreshLive);
  useSocketEvent(EVENTS.orderClosed, refreshAll);
  useSocketEvent(EVENTS.tablesUpdated, reloadTables);
  useRefetchOnReconnect(refreshAll);

  const tableList = tables.data ?? NO_TABLES;
  const activeOrders = active.data ?? NO_ORDERS;
  const metrics = useMemo(() => computeFloorMetrics(tableList, activeOrders, nowMs), [tableList, activeOrders, nowMs]);
  const hourly = useMemo(() => {
    // an order can appear in both lists while it is being closed: count each id once
    const byId = new Map<string, string>();
    for (const o of [...(history.data ?? NO_ORDERS), ...activeOrders]) byId.set(o.id, o.created_at);
    return hourBuckets([...byId.values()], nowMs, HOURS);
  }, [activeOrders, history.data, nowMs]);

  return {
    nowMs, tables: tableList, activeOrders, metrics, hourly, summary: summary.data,
    loading: tables.loading && tables.data === null, error: tables.error ?? active.error, reload: refreshAll,
    selected: tableList.find(t => t.id === selectedId) ?? null, selectedId, select: (id: string) => setSelectedId(p => (p === id ? null : id)), clear: () => setSelectedId(null),
    selectedOrders: selectedOrders.orders,
  };
}

export type FloorState = ReturnType<typeof useFloor>;

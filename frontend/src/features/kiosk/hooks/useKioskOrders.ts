import { useCallback, useEffect, useRef, useState } from 'react';
import { getKioskOrders } from 'api/restaurant/kiosk.api';
import { KIOSK_POLL_MS } from 'config/constants';
import { EVENTS } from 'config/events';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type { KioskContext } from 'types/restaurant/kiosk';
import type { Order } from 'types/restaurant/orders';
import type { NewOrderEvent, OrderClosedEvent, OrderDeliveredEvent, OrderItemCancelledEvent, OrderRoundCancelledEvent, OrderUpdatedEvent } from 'types/core/realtime';
import { afterItemCancelled, afterRoundCancelled, hasOpenOrders, isForeignSession, withOrder } from './kiosk-orders';

const reloadPage = (): void => window.location.reload();

/** The customer's rounds, kept live. Handlers are idempotent; a re-connect and a slow poll cover missed events. */
export function useKioskOrders(token: string, ctx: KioskContext, initial: Order[]) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [ended, setEnded] = useState(false);
  const sessionRef = useRef<string | null>(ctx.session_id ?? initial[0]?.session_id ?? null);
  const tableId = ctx.table_id;

  /** Applies a change only for this table; a round of another visit means the QR page is stale. */
  const mine = useCallback((order: { table_id: string; session_id?: string | null }): boolean => {
    if (order.table_id !== tableId) return false;
    if (isForeignSession(sessionRef.current, order)) { reloadPage(); return false; }
    sessionRef.current ??= order.session_id ?? null;
    return true;
  }, [tableId]);

  const refetch = useCallback(async (): Promise<Order[]> => {
    try {
      const fresh = await getKioskOrders(token);
      if (fresh[0] && isForeignSession(sessionRef.current, fresh[0])) { reloadPage(); return fresh; }
      sessionRef.current ??= fresh[0]?.session_id ?? null;
      setOrders(fresh);
      return fresh;
    } catch { return []; }
  }, [token]);

  useRefetchOnReconnect(() => { void refetch(); });
  useEffect(() => {
    const id = setInterval(() => { void refetch(); }, KIOSK_POLL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  useSocketEvent<NewOrderEvent>(EVENTS.newOrder, ({ order }) => { if (mine(order)) setOrders(p => withOrder(p, order)); });
  useSocketEvent<OrderUpdatedEvent>(EVENTS.orderUpdated, ({ order }) => { if (mine(order)) setOrders(p => withOrder(p, order)); });
  useSocketEvent<OrderDeliveredEvent>(EVENTS.orderDelivered, ({ order }) => { if (mine(order)) setOrders(p => withOrder(p, order)); });
  useSocketEvent<OrderItemCancelledEvent>(EVENTS.orderItemCancelled, e => { if (e.tableId === tableId) setOrders(p => afterItemCancelled(p, e)); });
  useSocketEvent<OrderRoundCancelledEvent>(EVENTS.orderRoundCancelled, e => { if (e.tableId === tableId) setOrders(p => afterRoundCancelled(p, e.orderId)); });
  useSocketEvent<OrderClosedEvent>(EVENTS.orderClosed, ({ tableId: closedId }) => {
    if (closedId !== tableId) return;
    void refetch().then(fresh => { if (!hasOpenOrders(fresh)) setEnded(true); });
  });

  const accept = useCallback((order: Order) => {
    sessionRef.current ??= order.session_id ?? null;
    setOrders(p => withOrder(p, order));
  }, []);

  return { orders, ended, refetch, accept, sessionId: () => sessionRef.current };
}

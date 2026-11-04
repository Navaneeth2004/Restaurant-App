import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { listActiveOrders } from 'api/restaurant/orders.api';
import { isAbort } from 'api/http';
import { KITCHEN_NOTICE_TTL_MS } from 'config/constants';
import { EVENTS } from 'config/events';
import { useTimeouts } from 'hooks/time/useTimeouts';
import { playCancel, playNewOrder } from 'lib/browser/sound';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import type {
  NewOrderEvent, OrderAdditionsEvent, OrderClosedEvent, OrderDeliveredEvent, OrderItemCancelledEvent,
  OrderRoundCancelledEvent, OrderUpdatedEvent,
} from 'types/core/realtime';
import { initialKitchen, kitchenReducer } from './kitchen-state';

let seq = 0; // monotonic suffix: ids stay unique even when events land in the same millisecond
const noticeId = (prefix: string, orderId: string): string => `${prefix}-${orderId}-${Date.now()}-${++seq}`;

export function useKitchenOrders() {
  const [state, dispatch] = useReducer(kitchenReducer, initialKitchen);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const later = useTimeouts();

  useEffect(() => {
    const id = ++latest.current;
    const ctrl = new AbortController();
    setLoading(true);
    listActiveOrders(ctrl.signal)
      .then(orders => { if (id === latest.current) { dispatch({ type: 'loaded', orders }); setError(null); } })
      .catch((e: unknown) => { if (id === latest.current && !isAbort(e)) setError(e); })
      .finally(() => { if (id === latest.current) setLoading(false); });
    return () => ctrl.abort();
  }, [tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  useRefetchOnReconnect(reload);

  const expire = useCallback((type: 'dismiss-addition' | 'dismiss-cancellation', id: string) => {
    later(() => dispatch({ type, id }), KITCHEN_NOTICE_TTL_MS);
  }, [later]);

  useSocketEvent<NewOrderEvent>(EVENTS.newOrder, ({ order }) => {
    playNewOrder();
    dispatch({ type: 'order', order });
  });
  useSocketEvent<OrderUpdatedEvent>(EVENTS.orderUpdated, ({ order }) => {
    dispatch({ type: 'order', order });
  });
  useSocketEvent<OrderAdditionsEvent>(EVENTS.orderAdditions, d => {
    playNewOrder();
    const addition = { id: noticeId('add', d.orderId), orderId: d.orderId, tableId: d.tableId, additions: d.additions, createdAt: d.createdAt };
    dispatch({ type: 'addition', addition });
    expire('dismiss-addition', addition.id);
  });
  useSocketEvent<OrderItemCancelledEvent>(EVENTS.orderItemCancelled, d => {
    playCancel();
    const cancellation = { id: noticeId('cancel-item', d.orderId), orderId: d.orderId, tableId: d.tableId, type: 'item' as const, items: [d.cancelledItem], createdAt: new Date().toISOString() };
    dispatch({ type: 'item-cancelled', cancellation, updatedOrder: d.updatedOrder ?? null });
    expire('dismiss-cancellation', cancellation.id);
  });
  useSocketEvent<OrderRoundCancelledEvent>(EVENTS.orderRoundCancelled, d => {
    playCancel();
    const cancellation = { id: noticeId('cancel-round', d.orderId), orderId: d.orderId, tableId: d.tableId, type: 'round' as const, items: d.cancelledItems, createdAt: new Date().toISOString() };
    dispatch({ type: 'round-cancelled', cancellation });
    expire('dismiss-cancellation', cancellation.id);
  });
  useSocketEvent<OrderDeliveredEvent>(EVENTS.orderDelivered, ({ order }) => dispatch({ type: 'delivered', orderId: order.id }));
  useSocketEvent<OrderClosedEvent>(EVENTS.orderClosed, ({ orderId }) => dispatch({ type: 'delivered', orderId }));

  return { ...state, loading, error, reload, dispatch };
}

import { EVENTS } from 'config/events';
import { playBillRequest, playDelivered } from 'lib/browser/sound';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import { useSocketEvent } from 'realtime/useSocketEvent';
import { useToast } from 'state/toast/useToast';
import type {
  BillRequestedEvent, NewOrderEvent, OrderClosedEvent, OrderDeliveredEvent, OrderItemCancelledEvent,
  OrderRoundCancelledEvent, OrderUpdatedEvent,
} from 'types/core/realtime';
import type { Table } from 'types/restaurant/tables';

interface Args {
  selectedId: string | null;
  tables: ReadonlyArray<Table>;
  reloadTables: () => void;
  reloadOrders: () => void;
  reloadAll: () => void;
  onSelectedClosed: (tableId: string) => void;
}

/** Every realtime subscription of the waiter screen. Handlers only reload; reloads are idempotent. */
export function useWaiterEvents({ selectedId, tables, reloadTables, reloadOrders, reloadAll, onSelectedClosed }: Args): void {
  const toast = useToast();
  const touching = (tableId: string): void => { reloadTables(); if (tableId === selectedId) reloadOrders(); };

  useRefetchOnReconnect(reloadAll);
  useSocketEvent<NewOrderEvent>(EVENTS.newOrder, ({ order }) => touching(order.table_id));
  useSocketEvent<OrderUpdatedEvent>(EVENTS.orderUpdated, ({ order }) => touching(order.table_id));
  useSocketEvent<OrderItemCancelledEvent>(EVENTS.orderItemCancelled, ({ tableId }) => touching(tableId));
  useSocketEvent<OrderRoundCancelledEvent>(EVENTS.orderRoundCancelled, ({ tableId }) => touching(tableId));
  useSocketEvent<OrderClosedEvent>(EVENTS.orderClosed, ({ tableId }) => {
    reloadTables();
    if (tableId === selectedId) onSelectedClosed(tableId);
  });
  useSocketEvent<OrderDeliveredEvent>(EVENTS.orderDelivered, ({ order }) => {
    touching(order.table_id);
    playDelivered();
    toast(`Order ready — ${tables.find(t => t.id === order.table_id)?.label ?? `Table ${order.table_id}`}`, 'success');
  });
  useSocketEvent<BillRequestedEvent>(EVENTS.billRequested, ({ tableLabel }) => {
    playBillRequest();
    toast(`Bill requested — ${tableLabel}`, 'info');
    reloadTables();
  });
}

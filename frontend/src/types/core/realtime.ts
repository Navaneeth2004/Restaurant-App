import type { Order, OrderItem } from '../restaurant/orders';

export interface EmptiedOrder { id: string; table_id: string; items: [] }

export interface NewOrderEvent { order: Order }
export interface OrderUpdatedEvent { order: Order; isNew?: boolean }
export interface OrderAdditionsEvent { orderId: string; tableId: string; additions: OrderItem[]; createdAt: string }
export interface OrderDeliveredEvent { order: Order }
export interface OrderClosedEvent { orderId: string; tableId: string }
export interface OrderItemCancelledEvent {
  orderId: string; tableId: string; cancelledItem: OrderItem; orderStatus: string; tableNowEmpty?: boolean;
  /** The full round, or just `{ id, table_id, items: [] }` when the cancelled item was its last one. */
  updatedOrder: Order | EmptiedOrder;
}
export interface OrderRoundCancelledEvent {
  orderId: string; tableId: string; cancelledItems: OrderItem[]; orderStatus: string; tableNowEmpty?: boolean;
}
export interface BillRequestedEvent { tableId: string; tableLabel: string }

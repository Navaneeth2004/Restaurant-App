import { request } from '../http';
import type { NewOrderItem, Order, PaymentEditInput, PaymentInput, DeletedRecord } from 'types/restaurant/orders';

const oid = (id: string) => encodeURIComponent(id);

export const listActiveOrders = (signal?: AbortSignal) => request<Order[]>('/orders/active', { signal });
export const listTableOrders = (tableId: string, signal?: AbortSignal) =>
  request<Order[]>(`/orders/table/${encodeURIComponent(tableId)}/all`, { signal });

/** ADDITIVE: send only this device's new items; the server merges. `requestId` makes a retry harmless (applied once). */
export const submitOrder = (tableId: string, items: ReadonlyArray<NewOrderItem>, requestId?: string) =>
  request<Order>('/orders', { method: 'POST', json: { table_id: tableId, items, request_id: requestId } });
export const directBill = (tableId: string, items: ReadonlyArray<NewOrderItem>, requestId?: string) =>
  request<Order>('/orders/direct-bill', { method: 'POST', json: { table_id: tableId, items, request_id: requestId } });

export const deliverOrder = (id: string) => request<Order>(`/orders/${oid(id)}/deliver`, { method: 'PATCH' });
export const cancelOrderItem = (orderId: string, itemId: number) =>
  request<void>(`/orders/${oid(orderId)}/cancel-item`, { method: 'PATCH', json: { item_id: itemId } });
export const cancelOrder = (orderId: string) => request<void>(`/orders/${oid(orderId)}/cancel`, { method: 'PATCH' });
export const closeOrder = (id: string, p: PaymentInput) => request<void>(`/orders/${oid(id)}/close`, { method: 'PATCH', json: p });
export const updatePayment = (id: string, p: PaymentEditInput) => request<void>(`/orders/${oid(id)}/payment`, { method: 'PATCH', json: p });

export const deleteRecords = (orderIds: string[], pin: string) =>
  request<{ deleted_ids?: string[] }>('/orders/delete-records', { method: 'POST', json: { order_ids: orderIds, pin } });
export const listDeletedRecords = (signal?: AbortSignal) => request<DeletedRecord[]>('/orders/log/deleted', { signal });

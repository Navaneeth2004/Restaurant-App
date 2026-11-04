import { request } from '../http';
import { tzOffsetMin } from 'lib/format/local-time';
import type { ReorderEntry } from 'types/restaurant/catalog';
import type { Table, TableStats } from 'types/restaurant/tables';

export const listTables = (signal?: AbortSignal) => request<Table[]>('/tables', { signal });
export const createTable = (b: { label: string; seats: number }) => request<Table>('/tables', { method: 'POST', json: b });
export const updateTable = (id: string, b: { label: string; seats: number }) =>
  request<Table>(`/tables/${encodeURIComponent(id)}`, { method: 'PUT', json: b });
export const deleteTable = (id: string) => request<void>(`/tables/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const reorderTables = (order: ReorderEntry[]) => request<void>('/tables/reorder', { method: 'PATCH', json: { order } });
export const getTableStats = (id: string, signal?: AbortSignal) =>
  request<TableStats>(`/tables/${encodeURIComponent(id)}/stats`, { query: { tz_offset_min: tzOffsetMin() }, signal });

export const createParcelSlot = (b: { customer_name?: string; customer_phone?: string }) =>
  request<{ label?: string; id?: string }>('/parcel/slot', { method: 'POST', json: b });
export const deleteParcelSlot = (id: string) => request<void>(`/parcel/slot/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const ensureKioskToken = (tableId: string) =>
  request<{ token: string }>('/kiosk/ensure-token', { method: 'POST', json: { table_id: tableId } });

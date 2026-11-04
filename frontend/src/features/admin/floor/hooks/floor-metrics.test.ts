import { computeFloorMetrics, tableHeat } from './floor-metrics';
import type { Table } from 'types/restaurant/tables';
import type { Order } from 'types/restaurant/orders';

const now = Date.parse('2026-01-01T12:00:00Z');
const since = (min: number): string => new Date(now - min * 60_000).toISOString();
const t = (id: string, status: Table['status'], mins: number | null, seats = 4): Table => ({ id, label: id, seats, status, occupied_since: mins === null ? null : since(mins) });

test('heat thresholds: <30 fresh, <60 warm, else hot; bill and empty win', () => {
  expect(tableHeat('occupied', 29)).toBe('fresh');
  expect(tableHeat('occupied', 30)).toBe('warm');
  expect(tableHeat('occupied', 60)).toBe('hot');
  expect(tableHeat('waiting_bill', 500)).toBe('bill');
  expect(tableHeat('empty', 5)).toBe('empty');
});

test('parcel slots never leak into the dine-in numbers', () => {
  const tables = [t('1', 'occupied', 10), t('2', 'occupied', 75), t('3', 'waiting_bill', 20), t('4', 'empty', null, 2), t('P1', 'occupied', 5)];
  const order: Order = { id: 'o', table_id: '1', status: 'active', created_at: since(5), delivered_at: null, total: 0, items: [{ menu_item_id: 1, name: 'A', price: 2.5, quantity: 2, note: '' }] };
  const m = computeFloorMetrics(tables, [order], now);
  expect(m.dineIn).toHaveLength(4);
  expect(m.parcelActive).toBe(1);
  expect(m).toMatchObject({ occupied: 3, free: 1, billPending: 1, overdue: 1, totalSeats: 14, occupiedSeats: 12, seatPct: 86, kitchenValue: 5, itemsInKitchen: 2 });
  expect(m.breakdown).toEqual({ fresh: 1, warm: 0, hot: 1, bill: 1, available: 1 });
});

import type { Order } from 'types/restaurant/orders';
import { groupVisits, visitKey } from './visits';

let seq = 0;
const order = (o: Partial<Order>): Order => ({
  id: `o${++seq}`, table_id: '3', status: 'closed', created_at: '2026-01-01T10:00:00Z', delivered_at: '2026-01-01T10:20:00Z',
  total: 10, items: [{ menu_item_id: 1, name: 'Wings', price: 10, quantity: 1, note: '' }], ...o,
});

test('rounds with the same session form one visit; no session = visit of its own (as on the server)', () => {
  const v = groupVisits([
    order({ id: 'a', session_id: 's1', created_at: '2026-01-01T10:00:00Z', total: 20 }),
    order({ id: 'b', session_id: 's1', created_at: '2026-01-01T11:00:00Z', total: 5.5 }),
    order({ id: 'c', created_at: '2026-01-01T09:00:00Z' }),
    order({ id: 'd', created_at: '2026-01-01T09:30:00Z' }),
  ], 5);
  expect(v).toHaveLength(3);
  expect(v[0].orders.map(o => o.id)).toEqual(['a', 'b']);
  expect(v[0].subtotal).toBe(25.5);
  expect(v.map(x => x.key).sort()).toEqual(['3|s1', 'single|c', 'single|d']);
  expect(visitKey(order({ id: 'z', table_id: 'P1', session_id: 'x' }))).toBe('P1|x');
});

test('a closed visit uses the rate stored with it, never today\'s setting', () => {
  const [v] = groupVisits([order({ session_id: 's', total: 100, tax_percent_snapshot: 18 })], 5);
  expect(v.rate).toBe(18);
  expect(v.rateRecorded).toBe(true);
  expect(v.tax).toBe(18);
  expect(v.total).toBe(118);
});

test('legacy rows without a rate fall back to the current rate and say so', () => {
  const [v] = groupVisits([order({ session_id: 's', total: 100, tax_percent_snapshot: null })], 5);
  expect(v.rate).toBe(5);
  expect(v.rateRecorded).toBe(false);
  expect(v.total).toBe(105);
});

test('payment info comes from the newest row that has it; paid defaults to the bill total', () => {
  const [v] = groupVisits([
    order({ id: 'a', session_id: 's', total: 100, created_at: '2026-01-01T10:00:00Z' }),
    order({ id: 'b', session_id: 's', total: 0, created_at: '2026-01-01T11:00:00Z', payment_method: 'split',
      payment_details: '[{"method":"cash","amount":60},{"method":"upi","amount":45}]', amount_paid: 105, customer_gstin: ' 32abcde1234f1z5 ' }),
  ], 5);
  expect(v.paymentMethod).toBe('split');
  expect(v.split).toEqual([{ method: 'cash', amount: 60 }, { method: 'upi', amount: 45 }]);
  expect(v.amountPaid).toBe(105);
  expect(v.customerGstin).toBe('32ABCDE1234F1Z5');
  const [plain] = groupVisits([order({ session_id: 's2', total: 40 })], 5);
  expect(plain.amountPaid).toBe(42);
  expect(plain.paymentMethod).toBeNull();
});

test('an amount of 0 is a real value, not "missing"', () => {
  const [v] = groupVisits([order({ session_id: 's', total: 40, amount_paid: 0 })], 5);
  expect(v.amountPaid).toBe(0);
});

test('direct-billed rounds are not kitchen rounds; latest edit time wins; parcel type is read from the first row', () => {
  const [v] = groupVisits([
    order({ id: 'k', session_id: 's', created_at: '2026-01-01T10:00:00Z', delivered_at: '2026-01-01T10:30:00Z', edited_at: '2026-02-01T00:00:00Z' }),
    order({ id: 'd', session_id: 's', created_at: '2026-01-01T11:00:00Z', delivered_at: '2026-01-01T11:00:00Z', edited_at: '2026-03-01T00:00:00Z' }),
  ], 5);
  expect(v.kitchenRounds.map(o => o.id)).toEqual(['k']);
  expect(v.editedAt).toBe('2026-03-01T00:00:00Z');
  expect(v.orderType).toBe('dine_in');
  expect(groupVisits([order({ order_type: 'parcel' })], 5)[0].orderType).toBe('parcel');
});

test('identical items across rounds are merged for display', () => {
  const [v] = groupVisits([order({ session_id: 's', total: 10 }), order({ session_id: 's', total: 10 })], 5);
  expect(v.items).toEqual([{ name: 'Wings', price: 10, quantity: 2, note: '' }]);
});

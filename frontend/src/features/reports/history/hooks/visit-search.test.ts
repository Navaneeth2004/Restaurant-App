import type { Visit } from 'lib/orders/visits';
import { matchesVisit } from './visit-search';

const visit = (o: Partial<Visit> = {}): Visit => ({
  key: 'k', tableId: 'P1', orders: [], kitchenRounds: [], startedAt: '2026-01-01T10:00:00Z',
  items: [{ name: 'Crispy Wings', price: 10, quantity: 1, note: '' }], subtotal: 10, rate: 5, rateRecorded: true, tax: 0.5, total: 10.5,
  amountPaid: 10.5, paymentMethod: 'upi', split: [], orderType: 'parcel', customerName: 'Rahul', customerPhone: '98765 43210',
  customerGstin: '32ABCDE1234F1Z5', editedAt: null, invoiceNo: null, ...o,
});

test('empty query matches everything', () => expect(matchesVisit(visit(), '  ')).toBe(true));
test('matches name, item, method, table label and ids', () => {
  for (const q of ['rahul', 'WINGS', 'upi', 'parcel 1', 'abcde']) expect(matchesVisit(visit(), q)).toBe(true);
  expect(matchesVisit(visit(), 'pizza')).toBe(false);
});
test('phone matches without spaces or dashes', () => {
  expect(matchesVisit(visit(), '98765-43210')).toBe(true);
  expect(matchesVisit(visit(), '9876543210')).toBe(true);
});
test('amounts match total, paid or subtotal', () => {
  expect(matchesVisit(visit(), '10.50')).toBe(true);
  expect(matchesVisit(visit(), '10')).toBe(true);
  expect(matchesVisit(visit(), '99.99')).toBe(false);
});
test('split methods are searchable', () => {
  expect(matchesVisit(visit({ paymentMethod: 'split', split: [{ method: 'card', amount: 5 }] }), 'card')).toBe(true);
});

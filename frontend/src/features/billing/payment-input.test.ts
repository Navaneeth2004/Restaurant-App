import { buildPaymentInput, PaymentForm } from './payment-input';

const form = (p: Partial<PaymentForm> = {}): PaymentForm => ({
  orderType: 'dine_in', method: 'cash', received: '', splits: [], customerName: ' ', customerPhone: '', customerGstin: '', ...p,
});

test('cash: change is computed and blank customer fields are omitted', () => {
  const r = buildPaymentInput(form({ received: '200' }), 157.5);
  expect(r).toMatchObject({ payment_method: 'cash', amount_paid: 200, change_amount: 42.5, payment_details: { received: 200, change: 42.5 } });
  expect(r.customer_name).toBeUndefined();
});
test('empty received means exactly the bill', () => {
  const r = buildPaymentInput(form({ method: 'upi' }), 80);
  expect(r).toMatchObject({ amount_paid: 80, change_amount: 0, payment_details: null });
});
test('split keeps only positive entries and sums them', () => {
  const r = buildPaymentInput(form({ method: 'split', splits: [{ method: 'cash', amount: '50' }, { method: 'upi', amount: '' }, { method: 'card', amount: '30.5' }] }), 80.5);
  expect(r.payment_details).toEqual([{ method: 'cash', amount: 50 }, { method: 'card', amount: 30.5 }]);
  expect(r.amount_paid).toBe(80.5);
});
test('GSTIN and name are trimmed and sent', () => {
  const r = buildPaymentInput(form({ customerGstin: ' 22AAAAA0000A1Z5 ', customerName: 'Ravi' }), 10);
  expect(r.customer_gstin).toBe('22AAAAA0000A1Z5');
  expect(r.customer_name).toBe('Ravi');
});

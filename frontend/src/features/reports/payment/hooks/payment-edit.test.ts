import type { PaymentForm } from 'features/billing/payment-input';
import { buildEditInput, editedStart, gstinProblem, startIsValid, startParts } from './payment-edit';

const original = new Date(2026, 0, 5, 10, 30, 45).toISOString();
const form: PaymentForm = {
  orderType: 'dine_in', method: 'upi', received: '105.00', splits: [], customerName: '', customerPhone: '', customerGstin: '',
};

test('an untouched date and time are not sent (seconds of the original must survive)', () => {
  const p = startParts(original);
  expect(p).toEqual({ date: '2026-01-05', time: '10:30' });
  expect(editedStart(original, p.date, p.time)).toBeUndefined();
  expect('created_at' in buildEditInput(form, 105, { original, ...p })).toBe(false);
});

test('a changed time or date is sent as ISO', () => {
  expect(editedStart(original, '2026-01-05', '11:00')).toBe(new Date(2026, 0, 5, 11, 0, 0).toISOString());
  expect(buildEditInput(form, 105, { original, date: '2026-01-03', time: '10:30' }).created_at).toBe(new Date(2026, 0, 3, 10, 30, 0).toISOString());
  expect(editedStart(original, '', '')).toBeUndefined();
  expect(startIsValid('', '')).toBe(false);
  expect(startIsValid('2026-01-05', '')).toBe(false);
  expect(startIsValid('2026-01-05', '09:15')).toBe(true);
});

test('blank customer fields are omitted, a typed GSTIN is sent', () => {
  const p = startParts(original);
  const blank = buildEditInput(form, 105, { original, ...p });
  expect(blank.customer_gstin).toBeUndefined();
  expect(blank.customer_name).toBeUndefined();
  expect(buildEditInput({ ...form, customerGstin: '32ABCDE1234F1Z5' }, 105, { original, ...p }).customer_gstin).toBe('32ABCDE1234F1Z5');
});

test('paid amount and cash change are sent, not zeroed', () => {
  const p = startParts(original);
  const cash = buildEditInput({ ...form, method: 'cash', received: '150' }, 105, { original, ...p });
  expect(cash.amount_paid).toBe(150);
  expect(cash.change_amount).toBe(45);
  expect(cash.payment_details).toEqual({ received: 150, change: 45 });
});

test('GSTIN validation: empty and unchanged are fine, new values need 15 characters', () => {
  expect(gstinProblem('', '32ABCDE1234F1Z5')).toBeNull();
  expect(gstinProblem('32abcde1234f1z5', '32ABCDE1234F1Z5')).toBeNull();
  expect(gstinProblem('SHORT1', null)).toMatch(/15/);
  expect(gstinProblem('SHORT1', 'SHORT1')).toBeNull();
  expect(gstinProblem('32ABCDE1234F1Z5', null)).toBeNull();
});

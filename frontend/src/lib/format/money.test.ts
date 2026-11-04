import { formatMoney, round2, lineTotal, sumLines } from './money';

test('formatMoney formats with symbol and 2 decimals', () => {
  expect(formatMoney(5, '₹')).toBe('₹5.00');
  expect(formatMoney(1234.567, '$')).toBe('$1234.57');
});
test('formatMoney is safe for null/NaN', () => {
  expect(formatMoney(null)).toBe('₹0.00');
  expect(formatMoney(NaN)).toBe('₹0.00');
});
test('round2 avoids float drift', () => {
  expect(round2(1.005)).toBe(1.01);
  expect(round2(0.1 + 0.2)).toBe(0.3);
});
test('sumLines sums rounded lines', () => {
  expect(lineTotal(3.33, 3)).toBe(9.99);
  expect(sumLines([{ price: 10.5, quantity: 2 }, { price: 0.1, quantity: 3 }])).toBe(21.3);
});

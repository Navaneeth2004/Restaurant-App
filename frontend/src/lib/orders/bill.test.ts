import { billTotals, parseTaxPercent } from './bill';

test('totals are rounded to 2dp at each step', () => {
  expect(billTotals(10.1, 5)).toEqual({ subtotal: 10.1, tax: 0.51, total: 10.61 });
  expect(billTotals(0, 5)).toEqual({ subtotal: 0, tax: 0, total: 0 });
});
test('tax percent parsing', () => {
  expect(parseTaxPercent('18')).toBe(18);
  expect(parseTaxPercent('0')).toBe(0);
  expect(parseTaxPercent('abc')).toBe(5);
  expect(parseTaxPercent(undefined, 12)).toBe(12);
  expect(parseTaxPercent('-3')).toBe(5);
});

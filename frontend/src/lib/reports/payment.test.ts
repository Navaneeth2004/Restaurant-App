import { cashChange, isBigShortfall, paidAmount, parseSplitDetails, quickAmounts, splitSum } from './payment';

test('paid amount: empty means the bill, split sums entries', () => {
  expect(paidAmount('cash', '', [], 100)).toBe(100);
  expect(paidAmount('cash', '120.5', [], 100)).toBe(120.5);
  expect(paidAmount('split', '', [{ method: 'cash', amount: '60' }, { method: 'upi', amount: '40.1' }], 100)).toBe(100.1);
  expect(splitSum([{ method: 'cash', amount: 'x' }])).toBe(0);
});
test('change is never negative', () => {
  expect(cashChange(150, 120.5)).toBe(29.5);
  expect(cashChange(10, 20)).toBe(0);
});
test('shortfall warning thresholds (5% or 20 units)', () => {
  expect(isBigShortfall(100, 100)).toBe(false);
  expect(isBigShortfall(100, 96)).toBe(false);
  expect(isBigShortfall(100, 90)).toBe(true);
  expect(isBigShortfall(1000, 975)).toBe(true);
  expect(isBigShortfall(100, 120)).toBe(false);
});
test('quick amounts are unique and ascending', () => {
  expect(quickAmounts(100)).toEqual([100]);
  expect(quickAmounts(73.4)).toEqual([73.4, 80, 100]);
});

test('split details parse from a JSON string or an array and ignore junk', () => {
  expect(parseSplitDetails('[{"method":"upi","amount":40},{"amount":"10.5"}]')).toEqual([{ method: 'upi', amount: 40 }, { method: 'cash', amount: 10.5 }]);
  expect(parseSplitDetails([{ method: 'card', amount: 5 }, 'x', { method: 'cash', amount: 'abc' }])).toEqual([{ method: 'card', amount: 5 }]);
  expect(parseSplitDetails('not json')).toEqual([]);
  expect(parseSplitDetails({ received: 5 })).toEqual([]);
  expect(parseSplitDetails(null)).toEqual([]);
});

import { digitsOnly, clamp, parseNumber } from './input';

test('digitsOnly', () => {
  expect(digitsOnly('12-ab 34')).toBe('1234');
  expect(digitsOnly('123456789', 6)).toBe('123456');
});
test('clamp', () => {
  expect(clamp(5, 0, 3)).toBe(3);
  expect(clamp(-1, 0, 3)).toBe(0);
  expect(clamp(NaN, 2, 3)).toBe(2);
});
test('parseNumber', () => {
  expect(parseNumber('')).toBeNull();
  expect(parseNumber('abc')).toBeNull();
  expect(parseNumber('0')).toBe(0);
  expect(parseNumber('12.5')).toBe(12.5);
});

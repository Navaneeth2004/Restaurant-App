import { hourBuckets } from './hours';

const now = Date.parse('2026-03-02T00:30:00Z');
const ago = (min: number): string => new Date(now - min * 60_000).toISOString();

test('buckets count by hours ago, newest on the right, across midnight', () => {
  const b = hourBuckets([ago(5), ago(59), ago(61), ago(125), ago(11 * 60 + 59)], now, 12);
  expect(b[11]).toBe(2);
  expect(b[10]).toBe(1);
  expect(b[9]).toBe(1);
  expect(b[0]).toBe(1);
});
test('older than the window, future and invalid timestamps are ignored', () => {
  expect(hourBuckets([ago(12 * 60), ago(-5), 'nope'], now, 12).reduce((a, c) => a + c, 0)).toBe(0);
});

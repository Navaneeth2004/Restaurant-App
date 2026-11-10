import {
  tzOffsetMin, todayStr, monthStartStr, quarterStartStr, validateRange, minutesSince,
  elapsedLabel, timeAgo, currentFyLabel, fyOptions, daysLeft, formatDayLabel,
} from './local-time';

test('tzOffsetMin is minutes ahead of UTC', () => {
  expect(tzOffsetMin({ getTimezoneOffset: () => -330 } as Date)).toBe(330);
  expect(tzOffsetMin({ getTimezoneOffset: () => 300 } as Date)).toBe(-300);
});
test('date strings use local fields', () => {
  const d = new Date(2026, 4, 9, 12, 0, 0);
  expect(todayStr(d)).toBe('2026-05-09');
  expect(monthStartStr(d)).toBe('2026-05-01');
  expect(quarterStartStr(d)).toBe('2026-04-01');
});
test('validateRange flags inverted ranges', () => {
  expect(validateRange('2026-02-01', '2026-01-01')).toMatch(/after/);
  expect(validateRange('2026-01-01', '2026-01-01')).toBe('');
});
test('elapsedLabel', () => {
  expect(elapsedLabel(0)).toBe('< 1m');
  expect(elapsedLabel(47)).toBe('47m');
  expect(elapsedLabel(60)).toBe('1h');
  expect(elapsedLabel(231)).toBe('3h 51m');
});
test('elapsedLabel switches to days once a table has been open a day or more', () => {
  expect(elapsedLabel(1439)).toBe('23h 59m');
  expect(elapsedLabel(1440)).toBe('1d');
  expect(elapsedLabel(8829)).toBe('6d 3h');
});
test('minutesSince handles null and future', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  expect(minutesSince(null, now)).toBe(0);
  expect(minutesSince('2026-01-01T09:30:00Z', now)).toBe(30);
  expect(minutesSince('2026-01-01T11:00:00Z', now)).toBe(0);
});
test('timeAgo', () => {
  const now = Date.parse('2026-01-10T10:00:00Z');
  expect(timeAgo(null, now)).toBe('never');
  expect(timeAgo('2026-01-10T09:59:40Z', now)).toBe('just now');
  expect(timeAgo('2026-01-10T07:00:00Z', now)).toBe('3h ago');
  expect(timeAgo('2026-01-07T10:00:00Z', now)).toBe('3d ago');
});
test('financial year', () => {
  expect(currentFyLabel(new Date(2026, 2, 31))).toBe('2025-26');
  expect(currentFyLabel(new Date(2026, 3, 1))).toBe('2026-27');
  expect(fyOptions(2024, new Date(2026, 5, 1))).toEqual(['2026-27', '2025-26', '2024-25']);
});
test('daysLeft', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  expect(daysLeft('2026-01-08T00:00:00Z', now)).toBe(7);
  expect(daysLeft(null, now)).toBeNull();
});

test('formatDayLabel shows the calendar date regardless of time zone', () => {
  expect(formatDayLabel('2026-01-05')).toBe('5 Jan');
});

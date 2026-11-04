import { DEFAULT_LOCK, isExpired, parseLockConfig } from './lock-logic';

test('parseLockConfig tolerates junk', () => {
  expect(parseLockConfig(undefined)).toEqual(DEFAULT_LOCK);
  expect(parseLockConfig('not json')).toEqual(DEFAULT_LOCK);
  expect(parseLockConfig('null')).toEqual(DEFAULT_LOCK);
  expect(parseLockConfig('{"enabled":true,"timeout_mins":-3}')).toEqual({ enabled: true, timeout_mins: 5 });
  expect(parseLockConfig('{"enabled":"yes"}').enabled).toBe(false);
  expect(parseLockConfig('{"enabled":true,"timeout_mins":0}')).toEqual({ enabled: true, timeout_mins: 0 });
});
test('isExpired uses a single >= rule', () => {
  const t0 = 1_000_000;
  expect(isExpired(null, 5, t0)).toBe(true);
  expect(isExpired(t0, 0, t0)).toBe(true);
  expect(isExpired(t0, 5, t0 + 5 * 60_000 - 1)).toBe(false);
  expect(isExpired(t0, 5, t0 + 5 * 60_000)).toBe(true);
});

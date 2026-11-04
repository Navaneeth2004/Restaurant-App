import { endReason, readSession, writeSession, clearSession } from './session-store';

const DAY = 86_400_000;

test('a session older than the server limit is reported as expired, a young or unknown one as other', () => {
  const now = Date.now();
  expect(endReason(now - 8 * DAY, now)).toBe('expired');
  expect(endReason(now - 2 * DAY, now)).toBe('other');
  expect(endReason(null, now)).toBe('other');
});

test('the start time survives a page reload and is cleared on sign-out', () => {
  writeSession({ user: { id: 1, name: 'A', role: 'admin' }, token: 't', startedAt: 12345 });
  expect(readSession()?.startedAt).toBe(12345);
  clearSession();
  expect(readSession()).toBeNull();
});

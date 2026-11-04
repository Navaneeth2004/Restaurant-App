import { request, requestBlob, buildUrl } from './http';
import { ApiError, errorMessage } from './errors';
import { WINDOW_EVENTS } from 'config/events';

const mockFetch = (status: number, body: unknown, ok = status < 400) => {
  const fn = jest.fn().mockResolvedValue({
    ok, status,
    json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)),
    blob: async () => new Blob(['x']),
  });
  (global as unknown as { fetch: unknown }).fetch = fn;
  return fn;
};

const listen = (name: string) => {
  const spy = jest.fn();
  window.addEventListener(name, spy);
  return { spy, off: () => window.removeEventListener(name, spy) };
};

afterEach(() => jest.restoreAllMocks());

async function fail(p: Promise<unknown>): Promise<ApiError> {
  try { await p; } catch (e) { if (e instanceof ApiError) return e; throw e; }
  throw new Error('expected the request to fail');
}

test('buildUrl skips empty params', () => {
  expect(buildUrl('/x', { a: 1, b: '', c: undefined, d: 'z' })).toMatch(/\/api\/x\?a=1&d=z$/);
});

test('sends credentials, JSON header only when body present', async () => {
  const f = mockFetch(200, { ok: true });
  await request('/a', { method: 'POST', json: { n: 1 } });
  const init = f.mock.calls[0][1];
  expect(init.credentials).toBe('include');
  expect(init.headers['Content-Type']).toBe('application/json');
  expect(init.body).toBe('{"n":1}');
});

test('multipart never sets Content-Type', async () => {
  const f = mockFetch(200, {});
  await request('/up', { method: 'POST', form: new FormData() });
  expect(f.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
});

test('maps error body to ApiError with extras', async () => {
  mockFetch(429, { error: 'Too many attempts.', code: 'locked', retry_after: 30 });
  const e = await fail(request('/x'));
  expect(e).toBeInstanceOf(ApiError);
  expect(e.status).toBe(429);
  expect(e.isLocked).toBe(true);
  expect(e.retryAfter).toBe(30);
  expect(errorMessage(e)).toBe('Too many attempts. Try again in 30 seconds.');
});

test('409 staffName message', async () => {
  mockFetch(409, { error: 'busy', staffName: 'Ravi' });
  const e = await fail(request('/x'));
  expect(errorMessage(e)).toBe('Ravi is already logged in on another device');
});

test('session_changed flag', async () => {
  mockFetch(409, { error: 'changed', session_changed: true });
  const e = await fail(request('/x'));
  expect(e.sessionChanged).toBe(true);
});

test('network failure becomes status-0 ApiError', async () => {
  (global as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new TypeError('Failed'));
  const e = await fail(request('/x'));
  expect(e.isNetwork).toBe(true);
  expect(errorMessage(e)).toMatch(/Cannot reach the server/);
});

test('5xx shows generic text, non-JSON body tolerated', async () => {
  (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
    ok: false, status: 502, json: async () => { throw new Error('html'); },
  });
  const e = await fail(request('/x'));
  expect(e.status).toBe(502);
  expect(errorMessage(e)).toMatch(/went wrong on the server/);
});

test.each([
  [401, 'device_required', WINDOW_EVENTS.deviceLost],
  [401, 'staff_required', WINDOW_EVENTS.staffRequired],
  [403, 'restaurant_suspended', WINDOW_EVENTS.deviceLost],
  [403, 'forbidden', WINDOW_EVENTS.forbidden],
])('central handler %s %s fires %s', async (status, code, evt) => {
  mockFetch(status, { error: 'm', code });
  const l = listen(evt);
  await request('/x').catch(() => undefined);
  expect(l.spy).toHaveBeenCalledTimes(1);
  l.off();
});

test('forbidden and plan_limit never log out', async () => {
  mockFetch(403, { error: 'Plan limit reached', code: 'plan_limit' });
  const a = listen(WINDOW_EVENTS.deviceLost);
  const b = listen(WINDOW_EVENTS.staffRequired);
  const e = await fail(request('/x'));
  expect(a.spy).not.toHaveBeenCalled();
  expect(b.spy).not.toHaveBeenCalled();
  expect(errorMessage(e)).toBe('Plan limit reached');
  a.off(); b.off();
});

test('public scope (kiosk) never fires device events', async () => {
  mockFetch(401, { error: 'x', code: 'device_required' });
  const l = listen(WINDOW_EVENTS.deviceLost);
  await request('/x', { scope: 'public' }).catch(() => undefined);
  expect(l.spy).not.toHaveBeenCalled();
  l.off();
});

test('root scope 401 fires root-auth-lost only', async () => {
  mockFetch(401, { error: 'x' });
  const root = listen(WINDOW_EVENTS.rootAuthLost);
  const dev = listen(WINDOW_EVENTS.deviceLost);
  await request('/x', { scope: 'root' }).catch(() => undefined);
  expect(root.spy).toHaveBeenCalledTimes(1);
  expect(dev.spy).not.toHaveBeenCalled();
  root.off(); dev.off();
});

test('abort is rethrown untouched', async () => {
  (global as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new DOMException('a', 'AbortError'));
  const e = await request('/x').catch((err: unknown) => err);
  expect(e).toBeInstanceOf(DOMException);
});

test('requestBlob returns blob; 204 returns undefined', async () => {
  mockFetch(200, undefined);
  expect(await requestBlob('/b')).toBeInstanceOf(Blob);
  (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
  expect(await request('/n')).toBeUndefined();
});

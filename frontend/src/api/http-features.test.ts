import { request } from './http';
import { ApiError } from './errors';
import { WINDOW_EVENTS } from 'config/events';

const reply = (status: number, body: unknown) => {
  (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: false, status, json: async () => body });
};
const listen = (name: string) => { const spy = jest.fn(); window.addEventListener(name, spy); return { spy, off: () => window.removeEventListener(name, spy) }; };

test('a switched-off feature fires the feature event with the server text and never logs anyone out', async () => {
  reply(403, { error: 'GSTR-3B is being fixed', code: 'feature_disabled', feature: 'export.gstr3b' });
  const feature = listen(WINDOW_EVENTS.featureDisabled);
  const lost = listen(WINDOW_EVENTS.deviceLost);
  const staff = listen(WINDOW_EVENTS.staffRequired);
  const err = await request('/x').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(feature.spy).toHaveBeenCalledTimes(1);
  expect((feature.spy.mock.calls[0][0] as CustomEvent).detail.message).toBe('GSTR-3B is being fixed');
  expect(lost.spy).not.toHaveBeenCalled();
  expect(staff.spy).not.toHaveBeenCalled();
  feature.off(); lost.off(); staff.off();
});

test('the public scope (customer page) ignores it', async () => {
  reply(403, { error: 'x', code: 'feature_disabled' });
  const feature = listen(WINDOW_EVENTS.featureDisabled);
  await request('/x', { scope: 'public' }).catch(() => undefined);
  expect(feature.spy).not.toHaveBeenCalled();
  feature.off();
});

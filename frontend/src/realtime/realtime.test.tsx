import { renderHook } from '@testing-library/react';
import { EVENTS } from 'config/events';
import { getSocket, closeSocket, joinStaffRoom, setKioskToken } from './socket';
import { useSocketEvent } from './useSocketEvent';
import { useRefetchOnReconnect } from './useRefetchOnReconnect';

type Listener = (...a: unknown[]) => void;
const listeners = new Map<string, Set<Listener>>();
const fake = {
  connected: true,
  on: jest.fn((e: string, l: Listener) => { (listeners.get(e) ?? listeners.set(e, new Set()).get(e)!).add(l); }),
  off: jest.fn((e: string, l: Listener) => { listeners.get(e)?.delete(l); }),
  emit: jest.fn(),
  removeAllListeners: jest.fn(),
  disconnect: jest.fn(),
};
const mockIo = jest.fn((..._a: unknown[]) => fake);
jest.mock('socket.io-client', () => ({ io: (...a: unknown[]) => mockIo(...a) }));


const fire = (e: string, ...a: unknown[]) => listeners.get(e)?.forEach(l => l(...a));

beforeEach(() => {
  // CRA sets resetMocks:true, so implementations must be re-applied for every test.
  listeners.clear();
  mockIo.mockImplementation(() => fake);
  fake.on.mockImplementation((e: string, l: Listener) => { (listeners.get(e) ?? listeners.set(e, new Set()).get(e)!).add(l); });
  fake.off.mockImplementation((e: string, l: Listener) => { listeners.get(e)?.delete(l); });
  closeSocket();
  setKioskToken(null);
  fake.connected = true;
});

test('exactly one connection no matter how many callers', () => {
  getSocket(); getSocket(); getSocket();
  expect(mockIo).toHaveBeenCalledTimes(1);
});

test('kiosk token is sent as auth and cookies are enabled', () => {
  setKioskToken('abc');
  getSocket();
  expect(mockIo.mock.calls[0]).toEqual([expect.any(String), expect.objectContaining({ withCredentials: true, auth: { kiosk: 'abc' } })]);
});

test('useSocketEvent subscribes once, uses latest handler, unsubscribes on unmount', () => {
  const first = jest.fn(); const second = jest.fn();
  const { rerender, unmount } = renderHook(({ h }) => useSocketEvent(EVENTS.tablesUpdated, h), { initialProps: { h: first } });
  rerender({ h: second });
  expect(listeners.get(EVENTS.tablesUpdated)?.size).toBe(1);
  fire(EVENTS.tablesUpdated);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.get(EVENTS.tablesUpdated)?.size).toBe(0);
});

test('refetch happens on reconnect only, not on first connect', () => {
  fake.connected = false;
  const refetch = jest.fn();
  getSocket();
  const baseline = listeners.get('connect')?.size ?? 0; // the socket module's own listener
  const { unmount } = renderHook(() => useRefetchOnReconnect(refetch));
  fire('connect');
  expect(refetch).not.toHaveBeenCalled();
  fire('connect');
  expect(refetch).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.get('connect')?.size).toBe(baseline);
});

test('already-connected socket refetches on the next connect', () => {
  const refetch = jest.fn();
  renderHook(() => useRefetchOnReconnect(refetch));
  fire('connect');
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('joinStaffRoom resolves from ack', async () => {
  fake.emit.mockImplementation((_e: string, _p: unknown, ack: (a: { ok: boolean }) => void) => ack({ ok: true }));
  await expect(joinStaffRoom(1, 'tok')).resolves.toBe(true);
  fake.emit.mockImplementation((_e: string, _p: unknown, ack: (a: { ok: boolean }) => void) => ack({ ok: false }));
  await expect(joinStaffRoom(1, 'tok')).resolves.toBe(false);
});

test('closeSocket tears down listeners', () => {
  getSocket();
  closeSocket();
  expect(fake.removeAllListeners).toHaveBeenCalled();
  expect(fake.disconnect).toHaveBeenCalled();
});

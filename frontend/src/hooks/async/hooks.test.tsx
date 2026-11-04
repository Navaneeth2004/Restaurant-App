import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync';
import { useBusy } from './useBusy';
import { useDebouncedCallback } from './useDebouncedCallback';
import { useTimeouts } from '../time/useTimeouts';
import { useNow } from '../time/useNow';
import { useCallback } from 'react';

test('useAsync ignores a slow stale response', async () => {
  const resolvers: Array<(v: string) => void> = [];
  const { result, rerender } = renderHook(({ k }) => {
    const load = useCallback(() => new Promise<string>(r => { void k; resolvers.push(r); }), [k]);
    return useAsync(load);
  }, { initialProps: { k: 1 } });
  rerender({ k: 2 });
  await waitFor(() => expect(resolvers).toHaveLength(2));
  await act(async () => { resolvers[1]('new'); });
  await act(async () => { resolvers[0]('old'); });
  expect(result.current.data).toBe('new');
  expect(result.current.loading).toBe(false);
});

test('useAsync surfaces errors and stops loading', async () => {
  const boom = new Error('boom');
  const { result } = renderHook(() => useAsync(useCallback(() => Promise.reject(boom), [])));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(boom);
});

test('useBusy blocks double submit', async () => {
  const fn = jest.fn(() => new Promise<number>(r => setTimeout(() => r(1), 10)));
  const { result } = renderHook(() => useBusy());
  await act(async () => { await Promise.all([result.current[1](fn), result.current[1](fn)]); });
  expect(fn).toHaveBeenCalledTimes(1);
  expect(result.current[0]).toBe(false);
});

test('useBusy resets after failure', async () => {
  const { result } = renderHook(() => useBusy());
  await act(async () => { await result.current[1](() => Promise.reject(new Error('x'))).catch(() => undefined); });
  expect(result.current[0]).toBe(false);
});

test('debounce only fires last call and not after unmount', () => {
  jest.useFakeTimers();
  const fn = jest.fn();
  const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 100));
  result.current(1); result.current(2);
  act(() => { jest.advanceTimersByTime(100); });
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(2);
  result.current(3);
  unmount();
  act(() => { jest.advanceTimersByTime(500); });
  expect(fn).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('useTimeouts clears on unmount', () => {
  jest.useFakeTimers();
  const fn = jest.fn();
  const { result, unmount } = renderHook(() => useTimeouts());
  result.current(fn, 1000);
  unmount();
  jest.advanceTimersByTime(2000);
  expect(fn).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test('useNow ticks and cleans up', () => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => useNow(1000));
  const first = result.current;
  act(() => { jest.advanceTimersByTime(1000); });
  expect(result.current).toBeGreaterThanOrEqual(first);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});

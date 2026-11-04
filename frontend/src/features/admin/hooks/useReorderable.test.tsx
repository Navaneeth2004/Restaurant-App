import { act, renderHook } from '@testing-library/react';
import { useReorderable } from './useReorderable';

jest.mock('state/toast/useToast', () => ({ useToast: () => jest.fn() }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('shows the new order at once; defers reloads while saving; reloads once after settling', async () => {
  const reload = jest.fn();
  const server = ['a', 'b'];
  const { result } = renderHook(() => useReorderable({ server, reload }));
  let done: Promise<void> | undefined;
  act(() => { done = result.current.reorder(['b', 'a'], () => Promise.resolve()); });
  expect(result.current.items).toEqual(['b', 'a']);
  act(() => result.current.onExternalChange());   // the server's echo arrives mid-save
  expect(reload).not.toHaveBeenCalled();
  await act(async () => { await done; });
  act(() => { jest.advanceTimersByTime(2000); });
  expect(reload).toHaveBeenCalledTimes(1);
});

test('a failed save reverts to the server order', async () => {
  const server = ['a', 'b'];
  const { result } = renderHook(() => useReorderable({ server, reload: jest.fn() }));
  await act(async () => { await result.current.reorder(['b', 'a'], () => Promise.reject(new Error('nope'))); });
  expect(result.current.items).toEqual(['a', 'b']);
});

test('without a save in flight an external change reloads immediately', () => {
  const reload = jest.fn();
  const { result } = renderHook(() => useReorderable({ server: [], reload }));
  act(() => result.current.onExternalChange());
  expect(reload).toHaveBeenCalledTimes(1);
});

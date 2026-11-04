import { act, renderHook } from '@testing-library/react';
import { useSecretTap } from './useSecretTap';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('five quick taps reveal; hide closes again', () => {
  const { result } = renderHook(() => useSecretTap(5, 2000));
  for (let i = 0; i < 4; i++) act(() => result.current.tap());
  expect(result.current.revealed).toBe(false);
  act(() => result.current.tap());
  expect(result.current.revealed).toBe(true);
  act(() => result.current.hide());
  expect(result.current.revealed).toBe(false);
});

test('a pause longer than the window starts the count again', () => {
  const { result } = renderHook(() => useSecretTap(3, 1000));
  act(() => result.current.tap()); act(() => result.current.tap());
  act(() => { jest.advanceTimersByTime(1500); });
  act(() => result.current.tap());
  expect(result.current.revealed).toBe(false);
  act(() => result.current.tap()); act(() => result.current.tap());
  expect(result.current.revealed).toBe(true);
});

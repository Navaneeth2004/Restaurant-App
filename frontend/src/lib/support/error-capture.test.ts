/* eslint-disable no-console -- the tests replace and restore console.error */
import { clearCapturedErrors, getCapturedErrors, recordError, startErrorCapture, stopErrorCapture } from './error-capture';

beforeEach(() => clearCapturedErrors());
afterEach(() => stopErrorCapture());

test('keeps only the newest 30 entries', () => {
  for (let i = 0; i < 40; i++) recordError(`e${i}`);
  const all = getCapturedErrors();
  expect(all).toHaveLength(30);
  expect(all[0]).toContain('e10');
  expect(all[29]).toContain('e39');
});

test('a message repeated back-to-back is stored once, different ones are not merged', () => {
  recordError('a'); recordError('a'); recordError('b'); recordError('a');
  expect(getCapturedErrors()).toHaveLength(3);
});

test('long messages are clipped like the server does', () => {
  recordError('x'.repeat(2000));
  expect(getCapturedErrors()[0].length).toBe(600);
});

test('console.error is captured, still reaches the original, and is restored on stop', () => {
  const original = console.error;
  const spy = jest.fn();
  console.error = spy;
  startErrorCapture(); startErrorCapture(); // second call must not double-patch
  console.error('boom', new Error('bad'), { a: 1 });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(getCapturedErrors()).toHaveLength(1);
  expect(getCapturedErrors()[0]).toMatch(/console\.error: boom Error: bad \{"a":1\}/);
  stopErrorCapture();
  expect(console.error).toBe(spy);
  console.error = original;
});

test('uncaught errors and unhandled rejections are captured', () => {
  startErrorCapture();
  window.dispatchEvent(new ErrorEvent('error', { message: 'oops', filename: 'a.js', lineno: 1, colno: 2 }));
  expect(getCapturedErrors().some(e => e.includes('Uncaught: oops @ a.js:1:2'))).toBe(true);
});

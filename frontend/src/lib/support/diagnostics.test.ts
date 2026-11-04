import { detectBrowser, detectDeviceType, detectOs, formatDuration } from './diagnostics';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';

test('an iPhone is iOS, not macOS (its user agent says "like Mac OS X")', () => {
  expect(detectOs(IPHONE)).toBe('iOS 17.2');
  expect(detectDeviceType(IPHONE)).toBe('Mobile');
  expect(detectBrowser(IPHONE)).toEqual({ name: 'Safari', version: '17.2' });
});
test('Android is not reported as Linux', () => {
  expect(detectOs(ANDROID)).toBe('Android 13');
  expect(detectBrowser(ANDROID).name).toBe('Chrome');
});
test('Edge is not reported as Chrome; a Mac is a Mac', () => {
  expect(detectBrowser(EDGE)).toEqual({ name: 'Edge', version: '120.0.2210.91' });
  expect(detectOs(EDGE)).toBe('Windows 10/11');
  expect(detectOs(MAC)).toBe('macOS 10.15.7');
  expect(detectDeviceType(MAC)).toBe('Desktop');
});
test('unknown agents do not throw', () => {
  expect(detectBrowser('')).toEqual({ name: 'Unknown', version: '' });
  expect(detectOs('')).toBe('Unknown');
});
test('durations read as minutes and seconds', () => {
  expect(formatDuration(125_000)).toBe('2m 5s');
  expect(formatDuration(-5)).toBe('0m 0s');
});

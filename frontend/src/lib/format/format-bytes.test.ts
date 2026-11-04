import { formatBytes } from './format-bytes';

test('sizes read naturally', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(null)).toBe('0 B');
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
  expect(formatBytes(5 * 1024 ** 4)).toBe('5120 GB');
});

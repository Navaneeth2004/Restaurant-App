import { isHexColor, safeHex, shade, DEFAULT_BRAND } from './color';

test('validates hex', () => {
  expect(isHexColor('#fff')).toBe(true);
  expect(isHexColor('#f97316')).toBe(true);
  expect(isHexColor('#f973')).toBe(false);
  expect(isHexColor('red; }')).toBe(false);
});
test('safeHex expands, lowercases and rejects junk', () => {
  expect(safeHex('#ABC')).toBe('#aabbcc');
  expect(safeHex('#F97316')).toBe('#f97316');
  expect(safeHex('</style>')).toBe(DEFAULT_BRAND);
  expect(safeHex(undefined)).toBe(DEFAULT_BRAND);
});
test('shade never yields NaN', () => {
  expect(shade('#000000', 50)).toBe('#808080');
  expect(shade('#ffffff', -50)).toBe('#808080');
  expect(shade('#12', 10)).toMatch(/^#[0-9a-f]{6}$/);
});

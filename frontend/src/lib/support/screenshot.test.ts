import { dataUrlBytes, encodeJpeg, fitSize } from './screenshot';

const url = (bytes: number): string => `data:image/jpeg;base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`;

test('fitSize shrinks the long side and never enlarges', () => {
  expect(fitSize(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
  expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  expect(fitSize(0, 0, 1600)).toEqual({ width: 1, height: 1 });
});

test('dataUrlBytes counts the decoded size, padding included', () => {
  expect(dataUrlBytes('data:x;base64,QUJD')).toBe(3);
  expect(dataUrlBytes('data:x;base64,QQ==')).toBe(1);
});

test('encodeJpeg lowers the quality until it fits, and gives up with null', () => {
  const sizes = new Map([[0.85, 5000], [0.7, 900], [0.5, 100], [0.35, 50]]);
  const canvas = { toDataURL: (_t?: string, q?: number) => url(sizes.get(q ?? 0) ?? 0) };
  expect(dataUrlBytes(encodeJpeg(canvas, 1000) ?? '')).toBeLessThanOrEqual(1000);
  expect(encodeJpeg(canvas, 10)).toBeNull();
});

import { summarizeImport } from './useMenuTransfer';

test('import summary mentions images only when there are some', () => {
  expect(summarizeImport({ success: true, categories_added: 1, items_added: 4, items_skipped: 2 })).toBe('Done — 1 categories added, 4 items added, 2 skipped');
  expect(summarizeImport({ success: true, categories_added: 0, items_added: 4, items_skipped: 0, images_imported: 3 })).toContain(', 3 images,');
});

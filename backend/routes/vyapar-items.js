/**
 * backend/routes/vyapar-items.js
 *
 * Exports menu items in Vyapar's "Import Items" xlsx format.
 * GET /api/export/vyapar-items  → downloads .xlsx
 *
 * Fields included:
 *   Item name*       → menu item name
 *   Item code        → MI-{id}
 *   Category         → category name
 *   Sale price       → item price
 *   Tax Rate         → e.g. "GST@5%" from restaurant settings
 *   Inclusive Of Tax → always "Exclusive"
 *
 * Fields left blank (not tracked by this POS):
 *   HSN, Purchase price, Discount Type, Sale Discount,
 *   Opening stock quantity, Minimum stock quantity,
 *   Item Location, Base Unit, Secondary Unit, Conversion Rate
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const XLSX    = require('xlsx');

function taxRateLabel(pct) {
  const n = parseFloat(pct) || 0;
  return `GST@${n}%`;
}

router.get('/', (req, res) => {
  // Load tax setting
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const taxLabel = taxRateLabel(S.tax_percent || '5');

  // Load all menu items with category
  const items = db.prepare(`
    SELECT m.id, m.name, m.price, c.name AS category_name
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    ORDER BY c.sort_order, m.id
  `).all();

  const header = [
    'Item name*',
    'Item code',
    'Category',
    'HSN',
    'Sale price',
    'Purchase price',
    'Discount Type',
    'Sale Discount',
    'Opening stock quantity',
    'Minimum stock quantity',
    'Item Location',
    'Tax Rate',
    'Inclusive Of Tax',
    'Base Unit (x)',
    'Secondary Unit (y)',
    'Conversion Rate (n) (x = ny)',
  ];

  const rows = items.map(item => [
    item.name,
    `MI-${item.id}`,
    item.category_name,
    '',
    parseFloat(item.price).toFixed(2),
    '',
    '',
    '',
    '',
    '',
    '',
    taxLabel,
    'Exclusive',
    '',
    '',
    '',
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  ws['!cols'] = [
    { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 8  },
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Item Details');

  const buf     = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const dateStr = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="vyapar_items_${dateStr}.xlsx"`);
  res.send(buf);
});

module.exports = router;
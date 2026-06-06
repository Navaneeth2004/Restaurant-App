/**
 * backend/routes/vyapar.js
 * 
 * Exports daily sales in Vyapar's Sales Import CSV format.
 * Vyapar's template (from inside the app: Transactions → Sales → Import):
 *   Invoice No, Invoice Date, Party Name, Phone No, Item Name,
 *   HSN/SAC, Quantity, Unit, Rate (Excl. Tax), Discount Amount,
 *   Tax %, Total Amount, Notes
 *
 * Usage: GET /api/export/vyapar?date=YYYY-MM-DD
 *   date defaults to today
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', (req, res) => {
  const today  = new Date().toISOString().split('T')[0];
  const date   = req.query.date || today;

  // Load settings for tax % and restaurant name
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const taxPct     = parseFloat(S.tax_percent || '5');
  const restName   = S.restaurant_name || 'Restaurant';

  // Fetch all delivered/closed orders for the date
  const orders = db.prepare(`
    SELECT o.*, t.label AS table_label
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('delivered', 'closed')
      AND substr(o.created_at, 1, 10) = ?
    ORDER BY o.created_at ASC
  `).all(date);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  if (orders.length === 0) {
    // Return empty CSV with headers still so it's importable
  }

  // Build invoice number: YYYYMMDD-001, YYYYMMDD-002, …
  const dateCompact = date.replace(/-/g, '');
  // Format date as DD/MM/YYYY for Vyapar
  const [y, m, d2] = date.split('-');
  const vyaparDate = `${d2}/${m}/${y}`;

  const q   = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const row = (...cols) => cols.map(c => q(c)).join(',');

  const lines = [];

  // Header row — must match Vyapar template exactly
  lines.push(row(
    'Invoice No',
    'Invoice Date',
    'Party Name',
    'Phone No',
    'Item Name',
    'HSN/SAC',
    'Quantity',
    'Unit',
    'Rate (Excl. Tax)',
    'Discount Amount',
    'Tax %',
    'Total Amount',
    'Notes'
  ));

  orders.forEach((order, idx) => {
    const invoiceNo   = `${dateCompact}-${String(idx + 1).padStart(3, '0')}`;
    const partyName   = order.table_label || `Table ${order.table_id}`;
    const firstItem   = true;

    order.items.forEach((item, iIdx) => {
      const rateExclTax  = parseFloat(item.price.toFixed(2));
      const taxAmount    = parseFloat((rateExclTax * item.quantity * taxPct / 100).toFixed(2));
      const totalAmount  = parseFloat((rateExclTax * item.quantity + taxAmount).toFixed(2));

      lines.push(row(
        iIdx === 0 ? invoiceNo  : '',   // Invoice No only on first row of invoice
        iIdx === 0 ? vyaparDate : '',   // Invoice Date only on first row
        iIdx === 0 ? partyName  : '',   // Party Name only on first row
        '',                             // Phone No — not available
        item.name,
        '',                             // HSN/SAC — not tracked
        item.quantity,
        'Nos',                          // Unit
        rateExclTax.toFixed(2),
        '0.00',                         // Discount Amount
        taxPct.toFixed(1),
        totalAmount.toFixed(2),
        item.note || ''
      ));
    });
  });

  const dateStr = date;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vyapar_sales_${dateStr}.csv"`);
  // BOM for Excel/Vyapar UTF-8 auto-detect
  return res.send('\uFEFF' + lines.join('\r\n'));
});

module.exports = router;
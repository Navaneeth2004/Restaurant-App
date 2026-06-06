/**
 * backend/routes/vyapar.js
 *
 * Exports sales in Vyapar's Sales Import CSV format.
 * Supports both single-date (?date=YYYY-MM-DD) and range (?from=…&to=…).
 * ExportTab.tsx sends ?from=…&to=… so both are handled.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  // Support both legacy ?date= and new ?from=&to= params
  const from = req.query.from || req.query.date || today;
  const to   = req.query.to   || req.query.date || today;

  // Load settings
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S       = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const taxPct  = parseFloat(S.tax_percent || '5');

  // Fetch all delivered/closed orders in date range
  const orders = db.prepare(`
    SELECT o.*, t.label AS table_label
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('delivered', 'closed')
      AND substr(o.created_at, 1, 10) >= ?
      AND substr(o.created_at, 1, 10) <= ?
    ORDER BY o.created_at ASC
  `).all(from, to);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  // Helper to format date as DD/MM/YYYY for Vyapar
  function vyaparDate(isoDate) {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

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
    // Invoice number: YYYYMMDD-NNN, using the order's own date
    const orderDate   = order.created_at.split('T')[0];
    const dateCompact = orderDate.replace(/-/g, '');
    const invoiceNo   = `${dateCompact}-${String(idx + 1).padStart(3, '0')}`;
    const partyName   = order.table_label || `Table ${order.table_id}`;

    order.items.forEach((item, iIdx) => {
      const rateExclTax = parseFloat(item.price.toFixed(2));
      const taxAmount   = parseFloat((rateExclTax * item.quantity * taxPct / 100).toFixed(2));
      const totalAmount = parseFloat((rateExclTax * item.quantity + taxAmount).toFixed(2));

      lines.push(row(
        iIdx === 0 ? invoiceNo               : '',
        iIdx === 0 ? vyaparDate(orderDate)   : '',
        iIdx === 0 ? partyName               : '',
        '',                                       // Phone No — not tracked
        item.name,
        '',                                       // HSN/SAC — not tracked
        item.quantity,
        'Nos',
        rateExclTax.toFixed(2),
        '0.00',
        taxPct.toFixed(1),
        totalAmount.toFixed(2),
        item.note || ''
      ));
    });
  });

  const label = from === to ? from : `${from}_to_${to}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vyapar_sales_${label}.csv"`);
  // BOM for Excel/Vyapar UTF-8 auto-detect
  return res.send('\uFEFF' + lines.join('\r\n'));
});

module.exports = router;
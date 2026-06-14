/**
 * backend/routes/vyapar-sales.js
 *
 * Exports closed orders in Vyapar TaxOne "Bulk Upload → Sales" Excel format.
 *
 * Two sub-routes:
 *   GET /api/export/vyapar-sales/without-item  → Accounting Invoice (Without Item)
 *   GET /api/export/vyapar-sales/with-item     → Item Invoice (With Item)
 *
 * Query params:
 *   from=YYYY-MM-DD   (optional, inclusive)
 *   to=YYYY-MM-DD     (optional, inclusive)
 *
 * Column specs match Vyapar TaxOne sample files exactly:
 *
 *   Without Item:
 *     REFERANCE NO | INVOICE DATE | GST NO | PARTY A/C NAME | PLACE OF SUPPLY
 *     | PARTICULARS | AMOUNT | SGST | CGST | IGST | TOTAL AMOUNT
 *
 *   With Item (adds per-line-item rows):
 *     REFERANCE NO | INVOICE DATE | GST NO | PARTY A/C NAME | PLACE OF SUPPLY
 *     | SALES LEDGER | NAME OF ITEM | QUANTITY | RATE | AMOUNT | SGST | CGST | IGST | TOTAL AMOUNT
 *
 * Notes:
 *   - Prices stored in DB are pre-tax (exclusive). Tax is calculated here.
 *   - SGST = CGST = half of total GST (intra-state assumed for restaurant).
 *   - IGST is always 0 (inter-state not applicable for dine-in).
 *   - Date format: DD/MM/YYYY as required by Vyapar TaxOne.
 *   - Party is "Walk-in Customer" (no customer ledger in this POS).
 *   - Place of Supply pulled from settings (state_name) or defaults to "Kerala".
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const XLSX    = require('xlsx');

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(isoStr) {
  // "2024-06-12T..." → "12/06/2024"
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function getExportData(from, to) {
  const today    = new Date().toISOString().split('T')[0];
  const dateFrom = from || '2020-01-01';
  const dateTo   = to   || today;

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const taxPct        = parseFloat(S.tax_percent || '5') / 100;
  const placeOfSupply = S.state_name || 'Kerala';
  const salesLedger   = `Sales GST ${S.tax_percent || '5'}%`;

  const orders = db.prepare(`
    SELECT o.id, o.created_at, o.total
    FROM orders o
    WHERE o.status = 'closed'
      AND substr(o.created_at, 1, 10) >= ?
      AND substr(o.created_at, 1, 10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => {
    o.items = db.prepare('SELECT name, quantity, price FROM order_items WHERE order_id = ?').all(o.id);
  });

  return { orders, taxPct, placeOfSupply, salesLedger };
}

function buildWorkbook(ws, sheetName) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function sendXlsx(res, wb, filename) {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

// ── WITHOUT ITEM ──────────────────────────────────────────────────────────────
// One row per order. Matches "Accounting Invoice (Without Item)" type in TaxOne.

router.get('/without-item', (req, res) => {
  try {
    const { from, to } = req.query;
    const { orders, taxPct, placeOfSupply, salesLedger } = getExportData(from, to);

    const header = [
      'REFERANCE NO',
      'INVOICE DATE',
      'GST NO',
      'PARTY A/C NAME',
      'PLACE OF SUPPLY',
      'PARTICULARS',
      'AMOUNT',
      'SGST',
      'CGST',
      'IGST',
      'TOTAL AMOUNT',
    ];

    const rows = orders.map(o => {
      const amount    = round2(o.total);
      const totalTax  = round2(amount * taxPct);
      const halfTax   = round2(totalTax / 2);
      const totalAmt  = round2(amount + totalTax);

      return [
        o.id,                    // REFERANCE NO
        fmtDate(o.created_at),   // INVOICE DATE  DD/MM/YYYY
        '',                      // GST NO  (B2C — no customer GSTIN)
        'Walk-in Customer',      // PARTY A/C NAME
        placeOfSupply,           // PLACE OF SUPPLY
        salesLedger,             // PARTICULARS
        amount,                  // AMOUNT (pre-tax)
        halfTax,                 // SGST
        halfTax,                 // CGST
        0,                       // IGST
        totalAmt,                // TOTAL AMOUNT
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 },
      { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 14 },
    ];

    const dateStr = from ? `${from}_to_${to || 'today'}` : 'all';
    sendXlsx(res, buildWorkbook(ws, 'Sheet1'), `sales_vyapar_${dateStr}.xlsx`);
  } catch (e) {
    console.error('[vyapar-sales/without-item]', e.message);
    res.status(500).json({ error: e.message || 'Export failed' });
  }
});

// ── WITH ITEM ─────────────────────────────────────────────────────────────────
// One row per line item within each order. Matches "Item Invoice (With Item)" type.
// Tax is spread proportionally across items.

router.get('/with-item', (req, res) => {
  try {
    const { from, to } = req.query;
    const { orders, taxPct, placeOfSupply, salesLedger } = getExportData(from, to);

    const header = [
      'REFERANCE NO',
      'INVOICE DATE',
      'GST NO',
      'PARTY A/C NAME',
      'PLACE OF SUPPLY',
      'SALES LEDGER',
      'NAME OF ITEM',
      'QUANTITY',
      'RATE',
      'AMOUNT',
      'SGST',
      'CGST',
      'IGST',
      'TOTAL AMOUNT',
    ];

    const rows = [];
    orders.forEach(o => {
      const orderDate = fmtDate(o.created_at);
      o.items.forEach((item, idx) => {
        const amount   = round2(item.price * item.quantity);
        const totalTax = round2(amount * taxPct);
        const halfTax  = round2(totalTax / 2);
        const totalAmt = round2(amount + totalTax);

        rows.push([
          idx === 0 ? o.id : '',   // REFERANCE NO only on first item row
          idx === 0 ? orderDate : '',
          '',                      // GST NO
          idx === 0 ? 'Walk-in Customer' : '',
          idx === 0 ? placeOfSupply : '',
          salesLedger,             // SALES LEDGER
          item.name,               // NAME OF ITEM
          item.quantity,           // QUANTITY
          round2(item.price),      // RATE
          amount,                  // AMOUNT
          halfTax,                 // SGST
          halfTax,                 // CGST
          0,                       // IGST
          totalAmt,                // TOTAL AMOUNT
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 },
      { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    ];

    const dateStr = from ? `${from}_to_${to || 'today'}` : 'all';
    sendXlsx(res, buildWorkbook(ws, 'salesWithItem'), `sales_vyapar_items_${dateStr}.xlsx`);
  } catch (e) {
    console.error('[vyapar-sales/with-item]', e.message);
    res.status(500).json({ error: e.message || 'Export failed' });
  }
});

module.exports = router;
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const AdmZip   = require('adm-zip');
const archiver = require('archiver');
const path     = require('path');
const fs       = require('fs');
const db       = require('../db/database');

// ── Paths ─────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Multer for zip uploads ────────────────────────────────────────────────
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.endsWith('.zip');
    ok ? cb(null, true) : cb(new Error('ZIP files only'));
  },
});

// ── Indian state codes for GST ────────────────────────────────────────────
const STATE_CODES = {
  'Andaman and Nicobar Islands': '35', 'Andhra Pradesh': '37', 'Arunachal Pradesh': '12',
  'Assam': '18', 'Bihar': '10', 'Chandigarh': '04', 'Chhattisgarh': '22',
  'Dadra and Nagar Haveli and Daman and Diu': '26', 'Delhi': '07', 'Goa': '30',
  'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02', 'Jammu and Kashmir': '01',
  'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Ladakh': '38', 'Lakshadweep': '31',
  'Madhya Pradesh': '23', 'Maharashtra': '27', 'Manipur': '14', 'Meghalaya': '17',
  'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21', 'Puducherry': '34', 'Punjab': '03',
  'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36', 'Tripura': '16',
  'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
};

// ── FIX (GST date boundary): local-day helpers, same tz_offset_min-aware
// pattern already used in reports.js/tables.js. created_at is stored UTC,
// but every date the user picks (or a default computed from "today") is a
// LOCAL calendar date — comparing them directly, as this file used to,
// meant orders in the first ~5.5 hours of any IST day were misfiled into
// the previous day's return period, which can misstate a real filing. ─────
function localDateExprAliased(alias, tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const sign = offset >= 0 ? '+' : '-';
  const mins = Math.abs(Math.round(offset));
  return `substr(datetime(${alias}.created_at, '${sign}${mins} minutes'), 1, 10)`;
}
function getLocalToday(tzOffsetMin) {
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const now = new Date(Date.now() + offset * 60000);
  return now.toISOString().split('T')[0];
}
function parseTz(req) {
  return req.query.tz_offset_min !== undefined ? parseInt(req.query.tz_offset_min, 10) : 0;
}
function round2(n) { return Math.round(n * 100) / 100; }

// ── MENU EXPORT ───────────────────────────────────────────────────────────
router.get('/menu', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const items      = db.prepare(`
    SELECT m.*, c.name AS category_name
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    ORDER BY c.sort_order, m.name
  `).all();

  const payload = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      version:     1,
      categories:  categories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order })),
      items:       items.map(i => ({
        name:          i.name,
        description:   i.description,
        price:         i.price,
        category_name: i.category_name,
        available:     i.available,
        image_path:    i.image_path,
      })),
    },
    null,
    2
  );

  const imageFiles = items
    .filter(i => i.image_path)
    .map(i => ({
      disk: path.join(__dirname, '..', '..', i.image_path),
      zip:  `images/${path.basename(i.image_path)}`,
    }))
    .filter(f => fs.existsSync(f.disk));

  const dateStr = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="menu_export_${dateStr}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => { console.error('[export/menu] archiver error:', err.message); res.end(); });
  archive.pipe(res);
  archive.append(payload, { name: 'menu.json' });
  imageFiles.forEach(f => archive.file(f.disk, { name: f.zip }));
  archive.finalize();
});

// ── MENU IMPORT ───────────────────────────────────────────────────────────
router.post(
  '/menu/import',
  (req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      zipUpload.single('menuzip')(req, res, next);
    } else {
      express.json({ limit: '2mb' })(req, res, next);
    }
  },
  async (req, res) => {
    try {
      let categories, items;
      let imagesImported = 0;
      const imageMap = {};

      if (req.file) {
        const zip       = new AdmZip(req.file.buffer);
        const jsonEntry = zip.getEntry('menu.json');
        if (!jsonEntry) return res.status(400).json({ error: 'ZIP must contain menu.json' });
        const parsed = JSON.parse(jsonEntry.getData().toString('utf8'));
        categories = parsed.categories;
        items      = parsed.items;
        zip.getEntries().forEach(entry => {
          if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
            const filename = path.basename(entry.entryName);
            const dest     = path.join(uploadsDir, filename);
            if (!fs.existsSync(dest)) { fs.writeFileSync(dest, entry.getData()); imagesImported++; }
            imageMap[filename] = `/uploads/${filename}`;
          }
        });
      } else {
        categories = req.body?.categories;
        items      = req.body?.items;
      }

      if (!categories || !items) return res.status(400).json({ error: 'Invalid export file — missing categories or items' });

      const results = { categories_added: 0, items_added: 0, items_skipped: 0, images_imported: imagesImported };

      const doImport = db.transaction(() => {
        const catMap = {};
        db.prepare('SELECT id, name FROM categories').all().forEach(c => { catMap[c.name.toLowerCase()] = c.id; });
        const maxOrder  = db.prepare('SELECT MAX(sort_order) as m FROM categories').get()?.m ?? 0;
        const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
        categories.forEach((c, i) => {
          const key = c.name.toLowerCase();
          if (!catMap[key]) { const info = insertCat.run(c.name, maxOrder + i + 1); catMap[key] = info.lastInsertRowid; results.categories_added++; }
        });
        const insertItem = db.prepare('INSERT INTO menu_items (name, description, price, category_id, available, image_path) VALUES (?, ?, ?, ?, ?, ?)');
        const checkItem  = db.prepare('SELECT id FROM menu_items WHERE LOWER(name) = ? AND category_id = ?');
        items.forEach(item => {
          const catId = catMap[item.category_name?.toLowerCase()];
          if (!catId) { results.items_skipped++; return; }
          if (checkItem.get(item.name.toLowerCase(), catId)) { results.items_skipped++; return; }
          let imagePath = null;
          if (item.image_path) { const fname = path.basename(item.image_path); imagePath = imageMap[fname] || null; }
          insertItem.run(item.name, item.description || '', parseFloat(item.price), catId, item.available ? 1 : 0, imagePath);
          results.items_added++;
        });
      });

      doImport();
      req.io.emit('menu_updated');
      req.io.emit('categories_updated');
      res.json({ success: true, ...results });
    } catch (e) {
      console.error('[export/import]', e.message);
      res.status(500).json({ error: e.message || 'Import failed' });
    }
  }
);

// ── REVENUE EXPORT — Professional CSV / JSON ─────────────────────────────
// NOTE: this plain revenue export (not a GST filing) has the same
// UTC-vs-local date-boundary characteristic as the GST routes below, but
// is left untouched here — it was flagged as out of scope for the "GST"
// fix specifically. Same fix pattern applies if you want it done too.
router.get('/revenue', (req, res) => {
  const { from, to, format = 'json' } = req.query;
  const today    = new Date().toISOString().split('T')[0];
  const dateFrom = from || '2020-01-01';
  const dateTo   = to   || today;

  const orders = db.prepare(`
    SELECT o.*, t.label AS table_label
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status = 'closed'
      AND substr(o.created_at,1,10) >= ?
      AND substr(o.created_at,1,10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    if (o.payment_details && typeof o.payment_details === 'string') {
      try { o.payment_details = JSON.parse(o.payment_details); } catch { o.payment_details = null; }
    }
  });

  const dailyMap = {};
  orders.forEach(o => {
    const day = o.created_at.split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, orders: 0, items_sold: 0, tax: 0, total_incl_tax: 0 };
    dailyMap[day].revenue    += o.total;
    dailyMap[day].orders     += 1;
    dailyMap[day].items_sold += o.items.reduce((s, i) => s + i.quantity, 0);
  });

  const itemMap = {};
  orders.forEach(o => {
    o.items.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty_sold: 0, revenue: 0 };
      itemMap[i.name].qty_sold += i.quantity;
      itemMap[i.name].revenue  += i.price * i.quantity;
    });
  });

  const paymentMap = {};
  orders.filter(o => o.status === 'closed').forEach(o => {
    const method = o.payment_method || 'unknown';
    if (!paymentMap[method]) paymentMap[method] = { method, count: 0, revenue: 0 };
    paymentMap[method].count   += 1;
    paymentMap[method].revenue += o.total;
  });

  const orderTypeMap = { dine_in: { count: 0, revenue: 0 }, parcel: { count: 0, revenue: 0 } };
  orders.forEach(o => {
    const t = o.order_type === 'parcel' ? 'parcel' : 'dine_in';
    orderTypeMap[t].count   += 1;
    orderTypeMap[t].revenue += o.total;
  });

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S            = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const currency     = S.currency_symbol || '₹';
  const taxPct       = parseFloat(S.tax_percent || '5') / 100;

  const totalRevenue   = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders    = orders.length;
  const totalItemsSold = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const taxCollected   = parseFloat((totalRevenue * taxPct).toFixed(2));
  const revenueExTax   = parseFloat((totalRevenue).toFixed(2));
  const totalInclTax   = parseFloat((totalRevenue + taxCollected).toFixed(2));

  const totalAmountPaid = orders.reduce((s, o) => {
    const billIncl = o.total * (1 + taxPct);
    return s + (typeof o.amount_paid === 'number' && o.amount_paid !== null ? o.amount_paid : billIncl);
  }, 0);

  Object.values(dailyMap).forEach(d => {
    d.tax           = parseFloat((d.revenue * taxPct).toFixed(2));
    d.total_incl_tax = parseFloat((d.revenue + d.tax).toFixed(2));
    d.revenue       = parseFloat(d.revenue.toFixed(2));
  });

  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
  const paymentBreakdown = Object.values(paymentMap).sort((a, b) => b.revenue - a.revenue);

  if (format === 'csv') {
    const NOW = new Date().toLocaleString();
    const q   = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const row = (...cols) => cols.map(c => q(c)).join(',');

    const lines = [];

    lines.push(row(S.restaurant_name || 'Restaurant', 'Revenue Report'));
    lines.push(row('Generated', NOW));
    lines.push(row('Period', `${dateFrom}  to  ${dateTo}`));
    lines.push(row('Tax Rate', `${S.tax_percent || 5}%`));
    lines.push('');

    lines.push(row('── SUMMARY ──'));
    lines.push(row('Metric', 'Value'));
    lines.push(row('Total Revenue (pre-tax)', `${currency}${revenueExTax.toFixed(2)}`));
    lines.push(row(`Tax Collected (${S.tax_percent || 5}%)`, `${currency}${taxCollected.toFixed(2)}`));
    lines.push(row('Total incl. Tax', `${currency}${totalInclTax.toFixed(2)}`));
    lines.push(row('Total Amount Actually Paid', `${currency}${totalAmountPaid.toFixed(2)}`));
    lines.push(row('Total Orders', totalOrders));
    lines.push(row('Total Items Sold', totalItemsSold));
    lines.push(row('Average Order Value (pre-tax)', totalOrders > 0 ? `${currency}${avgOrderValue.toFixed(2)}` : '—'));
    lines.push('');

    lines.push(row('── ORDER TYPE BREAKDOWN ──'));
    lines.push(row('Type', 'Orders', `Revenue ${currency}`));
    lines.push(row('Dine In', orderTypeMap.dine_in.count, orderTypeMap.dine_in.revenue.toFixed(2)));
    lines.push(row('Parcel',  orderTypeMap.parcel.count,  orderTypeMap.parcel.revenue.toFixed(2)));
    lines.push('');

    if (paymentBreakdown.length > 0) {
      lines.push(row('── PAYMENT METHODS ──'));
      lines.push(row('Method', 'Orders', `Revenue ${currency}`, '% of Total'));
      paymentBreakdown.forEach(p => {
        const pct = totalRevenue > 0 ? ((p.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
        lines.push(row(p.method.toUpperCase(), p.count, p.revenue.toFixed(2), `${pct}%`));
      });
      lines.push('');
    }

    lines.push(row('── DAILY BREAKDOWN ──'));
    lines.push(row('Date', 'Orders', 'Items Sold', `Revenue (pre-tax) ${currency}`, `Tax ${currency}`, `Total incl. Tax ${currency}`));
    const dailyRows = Object.values(dailyMap);
    dailyRows.forEach(d => {
      lines.push(row(d.date, d.orders, d.items_sold, d.revenue.toFixed(2), d.tax.toFixed(2), d.total_incl_tax.toFixed(2)));
    });
    lines.push('');

    lines.push(row('── TOP ITEMS ──'));
    lines.push(row('Rank', 'Item Name', 'Qty Sold', `Revenue ${currency}`, '% of Total Revenue'));
    topItems.forEach((item, i) => {
      const pct = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
      lines.push(row(i + 1, item.name, item.qty_sold, item.revenue.toFixed(2), `${pct}%`));
    });
    lines.push('');

    lines.push(row('── ORDER DETAIL ──'));
    lines.push(row(
      'Order ID', 'Session ID', 'Table', 'Order Type',
      'Date', 'Time',
      'Customer Name', 'Customer Phone', 'Customer GSTIN',
      'Items',
      `Subtotal ${currency}`, `Tax ${currency}`, `Total incl. Tax ${currency}`,
      `Amount Paid ${currency}`, `Diff from Bill ${currency}`,
      'Payment Method', 'Split Details', `Change Given ${currency}`,
      'Status'
    ));
    orders.forEach(o => {
      const d       = new Date(o.created_at);
      const sub     = o.total;
      const tax     = parseFloat((sub * taxPct).toFixed(2));
      const incl    = parseFloat((sub + tax).toFixed(2));
      const paid    = typeof o.amount_paid === 'number' && o.amount_paid !== null ? o.amount_paid : incl;
      const diff    = parseFloat((paid - incl).toFixed(2));
      const diffStr = diff === 0 ? '0.00' : diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);

      let splitStr = '';
      if (o.payment_method === 'split' && Array.isArray(o.payment_details) && o.payment_details.length > 0) {
        splitStr = o.payment_details
          .map(e => `${(e.method || '').toUpperCase()} ${currency}${Number(e.amount || 0).toFixed(2)}`)
          .join(' + ');
      }

      const orderTypeLabel = o.order_type === 'parcel' ? 'Parcel' : 'Dine In';
      const changeAmt = typeof o.change_amount === 'number' ? o.change_amount.toFixed(2) : '0.00';

      lines.push(row(
        o.id,
        o.session_id || '—',
        o.table_label || o.table_id,
        orderTypeLabel,
        d.toLocaleDateString('en-GB'),
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        o.customer_name  || '—',
        o.customer_phone || '—',
        o.customer_gstin || '—',
        o.items.map(i => `${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''}`).join(' | '),
        sub.toFixed(2),
        tax.toFixed(2),
        incl.toFixed(2),
        paid.toFixed(2),
        diffStr,
        o.payment_method || '—',
        splitStr || '—',
        changeAmt,
        o.status
      ));
    });

    const dateStr = from ? `${dateFrom}_to_${dateTo}` : 'all';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${dateStr}.csv"`);
    return res.send('\uFEFF' + lines.join('\r\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${dateFrom}_to_${dateTo}.json"`);
  res.json({
    generated_at: new Date().toISOString(),
    restaurant:   S.restaurant_name,
    period:       { from: dateFrom, to: dateTo },
    summary: {
      total_revenue_pretax:   revenueExTax,
      tax_collected:          taxCollected,
      total_incl_tax:         totalInclTax,
      total_amount_paid:      parseFloat(totalAmountPaid.toFixed(2)),
      tax_percent:            parseFloat(S.tax_percent || '5'),
      total_orders:           totalOrders,
      total_items_sold:       totalItemsSold,
      avg_order_value:        parseFloat(avgOrderValue.toFixed(2)),
      currency,
    },
    order_type_breakdown: [
      { type: 'dine_in', label: 'Dine In', count: orderTypeMap.dine_in.count, revenue: parseFloat(orderTypeMap.dine_in.revenue.toFixed(2)) },
      { type: 'parcel',  label: 'Parcel',  count: orderTypeMap.parcel.count,  revenue: parseFloat(orderTypeMap.parcel.revenue.toFixed(2))  },
    ],
    payment_breakdown: paymentBreakdown.map(p => ({
      method:  p.method,
      count:   p.count,
      revenue: parseFloat(p.revenue.toFixed(2)),
    })),
    daily_breakdown: Object.values(dailyMap),
    top_items: topItems.map(i => ({ ...i, revenue: parseFloat(i.revenue.toFixed(2)) })),
    orders: orders.map(o => {
      const sub  = o.total;
      const tax  = parseFloat((sub * taxPct).toFixed(2));
      const incl = parseFloat((sub + tax).toFixed(2));
      const paid = typeof o.amount_paid === 'number' && o.amount_paid !== null ? o.amount_paid : incl;

      let splitDetails = null;
      if (o.payment_method === 'split' && Array.isArray(o.payment_details) && o.payment_details.length > 0) {
        splitDetails = o.payment_details.map(e => ({
          method: e.method || 'unknown',
          amount: parseFloat(Number(e.amount || 0).toFixed(2)),
        }));
      }

      return {
        id:              o.id,
        session_id:      o.session_id || null,
        table:           o.table_label || o.table_id,
        order_type:      o.order_type === 'parcel' ? 'parcel' : 'dine_in',
        created_at:      o.created_at,
        status:          o.status,
        customer_name:   o.customer_name  || null,
        customer_phone:  o.customer_phone || null,
        customer_gstin:  o.customer_gstin || null,
        payment_method:  o.payment_method || null,
        split_details:   splitDetails,
        change_amount:   typeof o.change_amount === 'number' ? o.change_amount : 0,
        subtotal:        parseFloat(sub.toFixed(2)),
        tax:             tax,
        total_incl_tax:  incl,
        amount_paid:     parseFloat(paid.toFixed(2)),
        diff_from_bill:  parseFloat((paid - incl).toFixed(2)),
        items:           o.items.map(i => ({
          name:     i.name,
          qty:      i.quantity,
          price:    i.price,
          note:     i.note || '',
          subtotal: parseFloat((i.price * i.quantity).toFixed(2)),
        })),
      };
    }),
  });
});

// ── FIX (GST): shared helper for the GSTR-1 routes ────────────────────────
// Now: (1) filters orders by LOCAL date (tz_offset_min-aware) instead of
// comparing a local date string directly against UTC created_at, and
// (2) uses each order's OWN tax_percent_snapshot (the rate actually in
// effect when it was closed) instead of applying today's current
// tax_percent to every historical order — so changing your tax rate once
// no longer silently rewrites every past filing's numbers the next time
// it's regenerated. Orders closed before this fix existed have a NULL
// snapshot and fall back to the current setting (best available answer
// for genuinely old data — there's no way to recover what rate was
// actually in effect for orders closed before this column existed).
function computeGstr1Data(from, to, tzOffsetMin) {
  const today    = getLocalToday(tzOffsetMin);
  const dateFrom = from || today.slice(0, 7) + '-01';
  const dateTo   = to   || today;
  const dateExprO = localDateExprAliased('o', tzOffsetMin);

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

  const gstin       = S.gstin || '';
  const legalName   = S.legal_name || S.restaurant_name || '';
  const stateName   = S.state_name || 'Kerala';
  const stateCode   = STATE_CODES[stateName] || '32';
  const sacCode     = S.sac_code || '9963';
  const currentTaxRate = parseFloat(S.tax_percent || '5');

  const fromDate  = new Date(dateFrom + 'T00:00:00');
  const retPeriod = String(fromDate.getMonth() + 1).padStart(2, '0') + String(fromDate.getFullYear());

  const orders = db.prepare(`
    SELECT o.*
    FROM orders o
    WHERE o.status = 'closed'
      AND ${dateExprO} >= ?
      AND ${dateExprO} <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    // FIX (GST): the rate actually charged on THIS order, not "today's" rate.
    o._taxRate = (typeof o.tax_percent_snapshot === 'number' && o.tax_percent_snapshot !== null)
      ? o.tax_percent_snapshot
      : currentTaxRate;
  });

  const b2bOrders  = orders.filter(o => o.customer_gstin && o.customer_gstin.trim());
  const b2cOrders  = orders.filter(o => !o.customer_gstin || !o.customer_gstin.trim());

  // ── B2CS aggregate — grouped by (rate, place of supply), since orders
  // in the range may have been closed under different historical rates.
  const b2csMap = {};
  for (const o of b2cOrders) {
    const taxRate  = o._taxRate;
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const taxableValue = round2(o.total);
    const key = `OE|${taxRate}|${stateCode}`;
    if (!b2csMap[key]) {
      b2csMap[key] = { sply_ty: 'INTRA', typ: 'OE', pos: stateCode, rt: taxRate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    }
    b2csMap[key].txval = round2(b2csMap[key].txval + taxableValue);
    b2csMap[key].camt  = round2(b2csMap[key].camt  + taxableValue * cgstRate / 100);
    b2csMap[key].samt  = round2(b2csMap[key].samt  + taxableValue * sgstRate / 100);
  }
  const b2csArray = Object.values(b2csMap);

  // ── B2B invoices ─────────────────────────────────────────────────────────
  const b2bMap = {};
  for (const o of b2bOrders) {
    const gstin_b2b = o.customer_gstin.trim().toUpperCase();
    if (!b2bMap[gstin_b2b]) b2bMap[gstin_b2b] = { ctin: gstin_b2b, inv: [] };
    const taxRate  = o._taxRate;
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const taxableValue = round2(o.total);
    const cgstAmt = round2(taxableValue * cgstRate / 100);
    const sgstAmt = round2(taxableValue * sgstRate / 100);
    const invoiceDate = new Date(o.created_at);
    const dd = String(invoiceDate.getDate()).padStart(2, '0');
    const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const yyyy = invoiceDate.getFullYear();

    b2bMap[gstin_b2b].inv.push({
      inum: o.id, idt: `${dd}-${mm}-${yyyy}`, val: round2(taxableValue + cgstAmt + sgstAmt),
      pos: stateCode, rchrg: 'N', inv_typ: 'R',
      itms: [{ num: 1, itm_det: { ty: 'G', hsn_sc: sacCode, txval: taxableValue, irt: taxRate, iamt: 0, crt: cgstRate, camt: cgstAmt, srt: sgstRate, samt: sgstAmt, csrt: 0, csamt: 0 } }],
    });
  }
  const b2bArray = Object.values(b2bMap);

  const totalTaxable = round2(orders.reduce((s, o) => s + o.total, 0));
  const totalCgst    = round2(orders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0));
  const totalSgst    = round2(orders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0));

  const b2cTaxable = round2(b2cOrders.reduce((s, o) => s + o.total, 0));
  const b2bTaxable = round2(b2bOrders.reduce((s, o) => s + o.total, 0));
  const b2bInvoiceCount = b2bOrders.length;
  const b2cInvoiceCount = b2cOrders.length;
  const b2cCgst = round2(b2cOrders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0));
  const b2cSgst = round2(b2cOrders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0));
  const b2bCgst = round2(b2bOrders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0));
  const b2bSgst = round2(b2bOrders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0));

  let itemQty = 0;
  if (orders.length > 0) {
    const ids = orders.map(o => `'${o.id.replace(/'/g, "''")}'`).join(',');
    const itemRows = db.prepare(`SELECT SUM(quantity) as q FROM order_items WHERE order_id IN (${ids})`).get();
    itemQty = itemRows?.q || 0;
  }

  return {
    dateFrom, dateTo, retPeriod,
    gstin, legalName, stateName, stateCode, sacCode,
    // NOTE: displayed as a single representative rate (the CURRENT setting)
    // — actual totals below are computed per-order from each order's own
    // historical snapshot, which may include a mix of rates if the
    // restaurant changed its tax percentage during the period.
    taxRate: currentTaxRate,
    orders, b2bOrders, b2cOrders, b2csArray, b2bArray,
    totalTaxable, totalCgst, totalSgst,
    b2cTaxable, b2bTaxable, b2bInvoiceCount, b2cInvoiceCount, itemQty,
    b2cCgst, b2cSgst, b2bCgst, b2bSgst,
    round2,
  };
}

// ── GST GSTR-1 Preview ─────────────────────────────────────────────────────
router.get('/gst/gstr1/preview', (req, res) => {
  const { from, to } = req.query;
  const d = computeGstr1Data(from, to, parseTz(req));

  res.json({
    period:        { from: d.dateFrom, to: d.dateTo },
    return_period: d.retPeriod,
    gstin:         d.gstin,
    legal_name:    d.legalName,
    state_name:    d.stateName,
    state_code:    d.stateCode,
    sac_code:      d.sacCode,
    tax_rate:      d.taxRate,
    order_count:   d.orders.length,
    item_qty:      d.itemQty,

    b2cs: {
      invoice_count: d.b2cInvoiceCount,
      taxable_value: d.b2cTaxable,
      central_tax:   d.b2cCgst,
      state_ut_tax:  d.b2cSgst,
    },
    b2b: {
      gstin_count:   d.b2bArray.length,
      invoice_count: d.b2bInvoiceCount,
      taxable_value: d.b2bTaxable,
      central_tax:   d.b2bCgst,
      state_ut_tax:  d.b2bSgst,
    },
    totals: {
      taxable_value: d.totalTaxable,
      central_tax:   d.totalCgst,
      state_ut_tax:  d.totalSgst,
      total_tax:     d.round2(d.totalCgst + d.totalSgst),
      total_incl_tax: d.round2(d.totalTaxable + d.totalCgst + d.totalSgst),
    },
    hsn_summary: [{
      hsn_sc: d.sacCode,
      desc:   'Restaurant Services',
      uqc:    'OTH',
      qty:    d.itemQty,
      taxable: d.totalTaxable,
      central_tax: d.totalCgst,
      state_ut_tax: d.totalSgst,
    }],
    doc_issued: d.orders.length,
  });
});

// ── GST GSTR-1 JSON Export ────────────────────────────────────────────────
router.get('/gst/gstr1', (req, res) => {
  const { from, to } = req.query;
  const d = computeGstr1Data(from, to, parseTz(req));

  const periodLabel = from ? `${d.dateFrom}_to_${d.dateTo}` : d.retPeriod;

  const gstr1 = {
    gstin: d.gstin,
    fp:    d.retPeriod,
    gt:    d.round2(d.totalTaxable + d.totalCgst + d.totalSgst),
    cur_gt: d.round2(d.totalTaxable + d.totalCgst + d.totalSgst),
    b2b:  d.b2bArray,
    b2c:  [],
    b2cs: d.b2csArray,
    cdnr: [],
    cdnur: [],
    exp:  [],
    at:   [],
    txpd: [],
    hsn: {
      data: [{
        num: 1,
        hsn_sc: d.sacCode,
        desc: 'Restaurant Services',
        uqc: 'OTH',
        cnt: d.orders.length,
        txval: d.totalTaxable,
        iamt: 0,
        camt: d.totalCgst,
        samt: d.totalSgst,
        csamt: 0,
      }]
    },
    doc_issue: {
      doc_det: [{
        doc_num: 1,
        docs: [{ num: 1, to: d.orders.length, totnum: d.orders.length, cancel: 0, net_issue: d.orders.length }]
      }]
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="GSTR1_${periodLabel}.json"`);
  res.json(gstr1);
});

// ── GST GSTR-3B Summary ───────────────────────────────────────────────────
router.get('/gst/gstr3b', (req, res) => {
  const { from, to } = req.query;
  const tzOffsetMin = parseTz(req);
  const today    = getLocalToday(tzOffsetMin);
  const dateFrom = from || today.slice(0, 7) + '-01';
  const dateTo   = to   || today;
  const dateExprO = localDateExprAliased('o', tzOffsetMin);

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const currentTaxRate = parseFloat(S.tax_percent || '5');

  const orders = db.prepare(`
    SELECT o.total, o.customer_gstin, o.tax_percent_snapshot
    FROM orders o
    WHERE o.status = 'closed'
      AND ${dateExprO} >= ?
      AND ${dateExprO} <= ?
  `).all(dateFrom, dateTo);

  // FIX (GST): per-order rate (its own historical snapshot), not "today's" rate.
  const withRate = orders.map(o => ({
    ...o,
    _taxRate: (typeof o.tax_percent_snapshot === 'number' && o.tax_percent_snapshot !== null)
      ? o.tax_percent_snapshot
      : currentTaxRate,
  }));

  const totalTaxable = withRate.reduce((s, o) => s + o.total, 0);
  const totalCgst    = withRate.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0);
  const totalSgst    = withRate.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0);
  const totalIgst    = 0;
  const totalInclTax = totalTaxable + totalCgst + totalSgst;
  const b2bCount     = withRate.filter(o => o.customer_gstin && o.customer_gstin.trim()).length;

  const b2bOrders = withRate.filter(o => o.customer_gstin && o.customer_gstin.trim());
  const b2bTaxableTotal = b2bOrders.reduce((s, o) => s + o.total, 0);
  const b2bCgstTotal    = b2bOrders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0);
  const b2bSgstTotal    = b2bOrders.reduce((s, o) => s + o.total * (o._taxRate / 2) / 100, 0);

  // Weighted-average display rate, since the period may span a rate change.
  const displayTaxPct = totalTaxable > 0
    ? round2((totalCgst + totalSgst) / totalTaxable * 100)
    : currentTaxRate;

  const itcClaimed = displayTaxPct === 5
    ? {
        note: 'ITC not applicable — restaurants filing at 5% GST cannot claim input tax credit.',
        integrated_tax: 0, central_tax: 0, state_ut_tax: 0, cess: 0,
      }
    : {
        note: `Your effective rate for this period is ${displayTaxPct}%, which may be eligible for Input Tax Credit. This app doesn't track your purchase invoices, so enter your eligible ITC here from your own purchase records — do not enter ₹0 by default.`,
        integrated_tax: null, central_tax: null, state_ut_tax: null, cess: null,
      };

  res.json({
    period:       { from: dateFrom, to: dateTo },
    gstin:        S.gstin || '',
    legal_name:   S.legal_name || S.restaurant_name || '',
    tax_rate:     displayTaxPct,
    outward_taxable: {
      total_taxable_value: round2(totalTaxable),
      integrated_tax:      round2(totalIgst),
      central_tax:         round2(totalCgst),
      state_ut_tax:        round2(totalSgst),
      cess:                0,
      total_tax:           round2(totalCgst + totalSgst),
      total_incl_tax:      round2(totalInclTax),
    },
    intrastate_b2c: {
      taxable_value: round2(totalTaxable - b2bTaxableTotal),
      central_tax:   round2(totalCgst - b2bCgstTotal),
      state_ut_tax:  round2(totalSgst - b2bSgstTotal),
    },
    intrastate_b2b: {
      taxable_value: round2(b2bTaxableTotal),
      central_tax:   round2(b2bCgstTotal),
      state_ut_tax:  round2(b2bSgstTotal),
      invoice_count: b2bCount,
    },
    itc_claimed: itcClaimed,
    tax_paid: {
      integrated_tax: round2(totalIgst),
      central_tax:    round2(totalCgst),
      state_ut_tax:   round2(totalSgst),
      cess:           0,
    },
    order_count: orders.length,
  });
});

// ── GST GSTR-9 Annual Return Summary ─────────────────────────────────────
router.get('/gst/gstr9', (req, res) => {
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  let fyStart = currentFyStart;
  if (req.query.fy) {
    const m = req.query.fy.match(/^(\d{4})-\d{2}$/);
    if (m) fyStart = parseInt(m[1], 10);
  }

  const fyEnd    = fyStart + 1;
  const dateFrom = `${fyStart}-04-01`;
  const dateTo   = `${fyEnd}-03-31`;
  const fyLabel  = `${fyStart}-${String(fyEnd).slice(2)}`;

  const tzOffsetMin = parseTz(req);
  const dateExprO   = localDateExprAliased('o', tzOffsetMin);

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

  const currentTaxRate = parseFloat(S.tax_percent || '5');
  const sacCode  = S.sac_code || '9963';

  const orders = db.prepare(`
    SELECT o.id, o.total, o.customer_gstin, o.order_type, o.tax_percent_snapshot,
           o.session_id, o.created_at,
           ${localDateExprAliased('o', tzOffsetMin).replace('1, 10', '1, 7')} as month_key
    FROM orders o
    WHERE o.status = 'closed'
      AND ${dateExprO} >= ?
      AND ${dateExprO} <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  // FIX (GST): per-order historical rate instead of today's setting.
  orders.forEach(o => {
    o._taxRate = (typeof o.tax_percent_snapshot === 'number' && o.tax_percent_snapshot !== null)
      ? o.tax_percent_snapshot
      : currentTaxRate;
  });

  const totalTaxable  = round2(orders.reduce((s, o) => s + (o.total || 0), 0));
  const b2bTaxable    = round2(orders.filter(o => o.customer_gstin?.trim()).reduce((s, o) => s + (o.total || 0), 0));
  const b2cTaxable    = round2(totalTaxable - b2bTaxable);
  const parcelTaxable = round2(orders.filter(o => o.order_type === 'parcel').reduce((s, o) => s + (o.total || 0), 0));
  const dineInTaxable = round2(totalTaxable - parcelTaxable);

  const totalCgst = round2(orders.reduce((s, o) => s + (o.total || 0) * (o._taxRate / 2) / 100, 0));
  const totalSgst = round2(orders.reduce((s, o) => s + (o.total || 0) * (o._taxRate / 2) / 100, 0));
  const totalTax      = round2(totalCgst + totalSgst);
  const totalInclTax  = round2(totalTaxable + totalTax);

  const uniqueSessions = new Set(orders.map(o => o.session_id || o.id)).size;

  const monthMap = {};
  for (const o of orders) {
    const mk = o.month_key;
    if (!monthMap[mk]) monthMap[mk] = { month: mk, taxable: 0, cgst: 0, sgst: 0, orders: 0, sessions: new Set() };
    monthMap[mk].taxable = round2(monthMap[mk].taxable + (o.total || 0));
    monthMap[mk].cgst    = round2(monthMap[mk].cgst    + (o.total || 0) * (o._taxRate / 2) / 100);
    monthMap[mk].sgst    = round2(monthMap[mk].sgst    + (o.total || 0) * (o._taxRate / 2) / 100);
    monthMap[mk].orders++;
    monthMap[mk].sessions.add(o.session_id || o.id);
  }
  const monthlyBreakdown = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month:    m.month,
      taxable:  m.taxable,
      cgst:     m.cgst,
      sgst:     m.sgst,
      tax:      round2(m.cgst + m.sgst),
      orders:   m.orders,
      sessions: m.sessions.size,
    }));

  let itemQty = 0;
  if (orders.length > 0) {
    const ids = orders.map(o => `'${o.id.replace(/'/g,"''")}'`).join(',');
    const itemRows = db.prepare(
      `SELECT SUM(quantity) as q FROM order_items WHERE order_id IN (${ids})`
    ).get();
    itemQty = itemRows?.q || 0;
  }

  const hsnSummary = [{
    num:     1,
    hsn_sc:  sacCode,
    desc:    'Restaurant Services',
    uqc:     'OTH',
    qty:     itemQty,
    taxable: totalTaxable,
    igst:    0,
    cgst:    totalCgst,
    sgst:    totalSgst,
    cess:    0,
  }];

  // Weighted-average display rate for the ITC note, since a full FY is the
  // most likely period to span a genuine rate change.
  const displayTaxPct = totalTaxable > 0 ? round2(totalTax / totalTaxable * 100) : currentTaxRate;

  const itcNote = displayTaxPct === 5
    ? 'ITC not applicable — restaurants filing at 5% GST (Notification 11/2017-CT(R)) cannot claim input tax credit. Enter ₹0 in all ITC fields (Part II, Table 6).'
    : `Effective rate for this year was ${displayTaxPct}% — ITC may be claimable on your inputs. Enter eligible amounts from your purchase records in Table 6. This app does not track purchase invoices.`;

  res.json({
    fy:            fyLabel,
    period:        { from: dateFrom, to: dateTo },
    gstin:         S.gstin      || '',
    legal_name:    S.legal_name || S.restaurant_name || '',
    state_name:    S.state_name || 'Kerala',
    sac_code:      sacCode,
    tax_rate:      displayTaxPct,
    order_count:   orders.length,
    session_count: uniqueSessions,

    outward: {
      b2b_taxable:     b2bTaxable,
      b2b_cgst:        round2(orders.filter(o => o.customer_gstin?.trim()).reduce((s, o) => s + (o.total || 0) * (o._taxRate / 2) / 100, 0)),
      b2b_sgst:        round2(orders.filter(o => o.customer_gstin?.trim()).reduce((s, o) => s + (o.total || 0) * (o._taxRate / 2) / 100, 0)),
      b2c_taxable:     b2cTaxable,
      b2c_cgst:        round2(orders.filter(o => !o.customer_gstin?.trim()).reduce((s, o) => s + (o.total || 0) * (o._taxRate / 2) / 100, 0)),
      b2c_sgst:        round2(orders.filter(o => !o.customer_gstin?.trim()).reduce((s, o) => s + (o.total || 0) * (o._taxRate / 2) / 100, 0)),
      total_taxable:   totalTaxable,
      total_cgst:      totalCgst,
      total_sgst:      totalSgst,
      total_igst:      0,
      total_cess:      0,
      total_incl_tax:  totalInclTax,
      dine_in_taxable: dineInTaxable,
      parcel_taxable:  parcelTaxable,
    },

    tax_paid: {
      integrated_tax: 0,
      central_tax:    totalCgst,
      state_ut_tax:   totalSgst,
      cess:           0,
      total:          totalTax,
    },

    itc_note: itcNote,
    itc: displayTaxPct === 5
      ? { integrated_tax: 0, central_tax: 0, state_ut_tax: 0, cess: 0 }
      : null,

    hsn_summary: hsnSummary,
    monthly_breakdown: monthlyBreakdown,
  });
});

module.exports = router;
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
  'Andaman and Nicobar Islands': '35',
  'Andhra Pradesh': '37',
  'Arunachal Pradesh': '12',
  'Assam': '18',
  'Bihar': '10',
  'Chandigarh': '04',
  'Chhattisgarh': '22',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Delhi': '07',
  'Goa': '30',
  'Gujarat': '24',
  'Haryana': '06',
  'Himachal Pradesh': '02',
  'Jammu and Kashmir': '01',
  'Jharkhand': '20',
  'Karnataka': '29',
  'Kerala': '32',
  'Ladakh': '38',
  'Lakshadweep': '31',
  'Madhya Pradesh': '23',
  'Maharashtra': '27',
  'Manipur': '14',
  'Meghalaya': '17',
  'Mizoram': '15',
  'Nagaland': '13',
  'Odisha': '21',
  'Puducherry': '34',
  'Punjab': '03',
  'Rajasthan': '08',
  'Sikkim': '11',
  'Tamil Nadu': '33',
  'Telangana': '36',
  'Tripura': '16',
  'Uttar Pradesh': '09',
  'Uttarakhand': '05',
  'West Bengal': '19',
};

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

// ── GST GSTR-1 JSON Export ────────────────────────────────────────────────
// Generates a portal-uploadable GSTR-1 JSON for the given period.
// B2CS (B2C Small, below ₹2.5L per invoice) aggregate is the standard
// path for restaurants. B2B invoices are included when customer_gstin is set.
router.get('/gst/gstr1', (req, res) => {
  const { from, to } = req.query;
  const today    = new Date().toISOString().split('T')[0];
  const dateFrom = from || today.slice(0, 7) + '-01'; // default to start of current month
  const dateTo   = to   || today;

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

  const gstin       = S.gstin || '';
  const legalName   = S.legal_name || S.restaurant_name || '';
  const stateName   = S.state_name || 'Kerala';
  const stateCode   = STATE_CODES[stateName] || '32';
  const sacCode     = S.sac_code || '9963';
  const taxPct      = parseFloat(S.tax_percent || '5');
  const taxRate     = taxPct; // e.g. 5
  // For intra-state: CGST = SGST = taxRate/2
  const cgstRate    = taxRate / 2;
  const sgstRate    = taxRate / 2;

  // Derive period: MMYYYY for GSTR-1
  const fromDate  = new Date(dateFrom + 'T00:00:00');
  const retPeriod = String(fromDate.getMonth() + 1).padStart(2, '0') + String(fromDate.getFullYear());

  const orders = db.prepare(`
    SELECT o.*
    FROM orders o
    WHERE o.status = 'closed'
      AND substr(o.created_at,1,10) >= ?
      AND substr(o.created_at,1,10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  // Separate B2B (customer has GSTIN) from B2C
  const b2bOrders  = orders.filter(o => o.customer_gstin && o.customer_gstin.trim());
  const b2cOrders  = orders.filter(o => !o.customer_gstin || !o.customer_gstin.trim());

  function round2(n) { return Math.round(n * 100) / 100; }

  // ── B2CS aggregate (B2C Small — all walk-in/no-GSTIN invoices) ──────────
  // Grouped by: supply type + rate + place of supply
  const b2csMap = {};
  for (const o of b2cOrders) {
    const taxableValue = round2(o.total);
    const key = `OE|${taxRate}|${stateCode}`;
    if (!b2csMap[key]) {
      b2csMap[key] = {
        sply_ty: 'INTRA',
        typ: 'OE',
        pos: stateCode,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      };
    }
    b2csMap[key].txval  = round2(b2csMap[key].txval  + taxableValue);
    b2csMap[key].camt   = round2(b2csMap[key].camt   + taxableValue * cgstRate / 100);
    b2csMap[key].samt   = round2(b2csMap[key].samt   + taxableValue * sgstRate / 100);
  }
  const b2csArray = Object.values(b2csMap).map(r => ({ ...r, rt: taxRate }));

  // ── B2B invoices (customers with GSTIN) ──────────────────────────────────
  const b2bMap = {};
  for (const o of b2bOrders) {
    const gstin_b2b = o.customer_gstin.trim().toUpperCase();
    if (!b2bMap[gstin_b2b]) {
      b2bMap[gstin_b2b] = {
        ctin: gstin_b2b,
        inv: [],
      };
    }
    const taxableValue = round2(o.total);
    const cgstAmt = round2(taxableValue * cgstRate / 100);
    const sgstAmt = round2(taxableValue * sgstRate / 100);
    const invoiceDate = new Date(o.created_at);
    const dd = String(invoiceDate.getDate()).padStart(2, '0');
    const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const yyyy = invoiceDate.getFullYear();

    b2bMap[gstin_b2b].inv.push({
      inum:  o.id,
      idt:   `${dd}-${mm}-${yyyy}`,
      val:   round2(taxableValue + cgstAmt + sgstAmt),
      pos:   stateCode,
      rchrg: 'N',
      inv_typ: 'R',
      itms: [{
        num: 1,
        itm_det: {
          ty:   'G',
          hsn_sc: sacCode,
          txval: taxableValue,
          irt:  taxRate,
          iamt: 0,
          crt:  cgstRate,
          camt: cgstAmt,
          srt:  sgstRate,
          samt: sgstAmt,
          csrt: 0,
          csamt: 0,
        }
      }],
    });
  }
  const b2bArray = Object.values(b2bMap);

  // ── Totals for summary ────────────────────────────────────────────────────
  const totalTaxable = round2(orders.reduce((s, o) => s + o.total, 0));
  const totalCgst    = round2(totalTaxable * cgstRate / 100);
  const totalSgst    = round2(totalTaxable * sgstRate / 100);

  // ── GSTR-1 JSON structure (portal format) ────────────────────────────────
  const gstr1 = {
    gstin,
    fp:   retPeriod,
    gt:   round2(totalTaxable + totalCgst + totalSgst),
    cur_gt: round2(totalTaxable + totalCgst + totalSgst),
    b2b:  b2bArray,
    b2c:  [], // B2CL (large, above ₹2.5L) — not applicable for restaurants
    b2cs: b2csArray,
    cdnr: [],
    cdnur: [],
    exp:  [],
    at:   [],
    txpd: [],
    hsn: {
      data: [{
        num: 1,
        hsn_sc: sacCode,
        desc: 'Restaurant Services',
        uqc: 'OTH',
        cnt: orders.length,
        txval: totalTaxable,
        iamt: 0,
        camt: totalCgst,
        samt: totalSgst,
        csamt: 0,
      }]
    },
    doc_issue: {
      doc_det: [{
        doc_num: 1,
        docs: [{
          num: 1,
          to: orders.length,
          totnum: orders.length,
          cancel: 0,
          net_issue: orders.length,
        }]
      }]
    },
  };

  const periodLabel = from ? `${dateFrom}_to_${dateTo}` : retPeriod;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="GSTR1_${periodLabel}.json"`);
  res.json(gstr1);
});

// ── GST GSTR-3B Summary ───────────────────────────────────────────────────
// Returns a JSON summary for GSTR-3B manual filing (on-screen use).
router.get('/gst/gstr3b', (req, res) => {
  const { from, to } = req.query;
  const today    = new Date().toISOString().split('T')[0];
  const dateFrom = from || today.slice(0, 7) + '-01';
  const dateTo   = to   || today;

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const taxPct   = parseFloat(S.tax_percent || '5');
  const cgstRate = taxPct / 2;
  const sgstRate = taxPct / 2;

  const orders = db.prepare(`
    SELECT o.total, o.customer_gstin
    FROM orders o
    WHERE o.status = 'closed'
      AND substr(o.created_at,1,10) >= ?
      AND substr(o.created_at,1,10) <= ?
  `).all(dateFrom, dateTo);

  const totalTaxable = orders.reduce((s, o) => s + o.total, 0);
  const totalCgst    = totalTaxable * cgstRate / 100;
  const totalSgst    = totalTaxable * sgstRate / 100;
  const totalIgst    = 0; // intra-state restaurants
  const totalInclTax = totalTaxable + totalCgst + totalSgst;
  const b2bCount     = orders.filter(o => o.customer_gstin && o.customer_gstin.trim()).length;

  function round2(n) { return Math.round(n * 100) / 100; }

  // ── Table 4 — ITC note ───────────────────────────────────────────────────
  // Restaurants filing at the 5% rate (Notification 11/2017-CT(R), as
  // amended) are explicitly barred from claiming Input Tax Credit — for
  // them, ITC = ₹0 in every field is the correct and complete answer.
  //
  // Restaurants filing at any other rate (most commonly 18%, e.g. hotel
  // restaurants above the declared-tariff threshold, or those who've opted
  // into the regular scheme) ARE eligible to claim ITC on their inputs
  // (ingredients, packaging, rent, utilities, etc). This app has no record
  // of purchase invoices, so we can't compute that figure — telling them to
  // enter ₹0 would be wrong and could cause them to overpay tax. Instead we
  // point them to their own purchase records.
  const itcClaimed = taxPct === 5
    ? {
        note: 'ITC not applicable — restaurants filing at 5% GST cannot claim input tax credit.',
        integrated_tax: 0,
        central_tax:    0,
        state_ut_tax:   0,
        cess:           0,
      }
    : {
        note: `You're filing at ${taxPct}% GST, which is eligible for Input Tax Credit. This app doesn't track your purchase invoices, so enter your eligible ITC here from your own purchase records — do not enter ₹0 by default.`,
        integrated_tax: null,
        central_tax:    null,
        state_ut_tax:   null,
        cess:           null,
      };

  res.json({
    period:       { from: dateFrom, to: dateTo },
    gstin:        S.gstin || '',
    legal_name:   S.legal_name || S.restaurant_name || '',
    tax_rate:     taxPct,
    // Table 3.1 — Outward taxable supplies
    outward_taxable: {
      total_taxable_value: round2(totalTaxable),
      integrated_tax:      round2(totalIgst),
      central_tax:         round2(totalCgst),
      state_ut_tax:        round2(totalSgst),
      cess:                0,
      total_tax:           round2(totalCgst + totalSgst),
      total_incl_tax:      round2(totalInclTax),
    },
    // Table 3.1(a) — Intra-state B2C (most restaurant sales)
    intrastate_b2c: {
      taxable_value: round2(totalTaxable - orders.filter(o => o.customer_gstin).reduce((s, o) => s + o.total, 0)),
      central_tax:   round2((totalTaxable - orders.filter(o => o.customer_gstin).reduce((s, o) => s + o.total, 0)) * cgstRate / 100),
      state_ut_tax:  round2((totalTaxable - orders.filter(o => o.customer_gstin).reduce((s, o) => s + o.total, 0)) * sgstRate / 100),
    },
    // Table 3.1(b) — Intra-state B2B
    intrastate_b2b: {
      taxable_value: round2(orders.filter(o => o.customer_gstin).reduce((s, o) => s + o.total, 0)),
      central_tax:   round2(orders.filter(o => o.customer_gstin).reduce((s, o) => s + o.total, 0) * cgstRate / 100),
      state_ut_tax:  round2(orders.filter(o => o.customer_gstin).reduce((s, o) => s + o.total, 0) * sgstRate / 100),
      invoice_count: b2bCount,
    },
    // Table 4 — ITC (branches based on tax rate — see itcClaimed above)
    itc_claimed: itcClaimed,
    // Table 6.1 — Tax paid
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
// Aggregates a full Indian financial year (April 1 – March 31) into the
// tables needed to manually file GSTR-9 on the GST portal.
//
// Key tables produced:
//   Table 4  — details of advances, inward/outward supplies on which tax is payable
//   Table 5  — outward supplies on which tax is not payable (nil/exempt) — N/A here
//   Table 9  — details of tax paid as declared in returns filed during the year
//   Table 17 — HSN-wise summary of outward supplies
//
// Query param:
//   ?fy=2024-25  (defaults to current Indian financial year)
router.get('/gst/gstr9', (req, res) => {
  const now = new Date();
  // Indian financial year starts April 1. If current month < April, FY started last year.
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  let fyStart = currentFyStart;
  if (req.query.fy) {
    const m = req.query.fy.match(/^(\d{4})-\d{2}$/);
    if (m) fyStart = parseInt(m[1], 10);
  }

  const fyEnd    = fyStart + 1;
  const dateFrom = `${fyStart}-04-01`;
  const dateTo   = `${fyEnd}-03-31`;
  const fyLabel  = `${fyStart}-${String(fyEnd).slice(2)}`; // e.g. "2024-25"

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

  const taxPct   = parseFloat(S.tax_percent || '5');
  const cgstRate = taxPct / 2;
  const sgstRate = taxPct / 2;
  const sacCode  = S.sac_code || '9963';

  function round2(n) { return Math.round(n * 100) / 100; }

  const orders = db.prepare(`
    SELECT o.id, o.total, o.customer_gstin, o.order_type,
           o.session_id, o.created_at,
           substr(o.created_at, 1, 7) as month_key
    FROM orders o
    WHERE o.status = 'closed'
      AND substr(o.created_at, 1, 10) >= ?
      AND substr(o.created_at, 1, 10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  // Outward supply totals
  const totalTaxable  = round2(orders.reduce((s, o) => s + (o.total || 0), 0));
  const b2bTaxable    = round2(orders.filter(o => o.customer_gstin?.trim()).reduce((s, o) => s + (o.total || 0), 0));
  const b2cTaxable    = round2(totalTaxable - b2bTaxable);
  const parcelTaxable = round2(orders.filter(o => o.order_type === 'parcel').reduce((s, o) => s + (o.total || 0), 0));
  const dineInTaxable = round2(totalTaxable - parcelTaxable);

  const totalCgst     = round2(totalTaxable * cgstRate / 100);
  const totalSgst     = round2(totalTaxable * sgstRate / 100);
  const totalTax      = round2(totalCgst + totalSgst);
  const totalInclTax  = round2(totalTaxable + totalTax);

  // Unique dining sessions (visits)
  const uniqueSessions = new Set(orders.map(o => o.session_id || o.id)).size;

  // Monthly breakdown — used by Table 9 (verify each GSTR-3B month sums correctly)
  const monthMap = {};
  for (const o of orders) {
    const mk = o.month_key;
    if (!monthMap[mk]) monthMap[mk] = { month: mk, taxable: 0, cgst: 0, sgst: 0, orders: 0, sessions: new Set() };
    monthMap[mk].taxable = round2(monthMap[mk].taxable + (o.total || 0));
    monthMap[mk].cgst    = round2(monthMap[mk].cgst    + (o.total || 0) * cgstRate / 100);
    monthMap[mk].sgst    = round2(monthMap[mk].sgst    + (o.total || 0) * sgstRate / 100);
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

  // Table 17 — HSN/SAC summary
  // Fetch all items for these orders to get item-level quantities
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

  // ITC applicability note (same logic as GSTR-3B)
  const itcNote = taxPct === 5
    ? 'ITC not applicable — restaurants filing at 5% GST (Notification 11/2017-CT(R)) cannot claim input tax credit. Enter ₹0 in all ITC fields (Part II, Table 6).'
    : `Filing at ${taxPct}% GST — ITC may be claimable on your inputs. Enter eligible amounts from your purchase records in Table 6. This app does not track purchase invoices.`;

  res.json({
    fy:            fyLabel,
    period:        { from: dateFrom, to: dateTo },
    gstin:         S.gstin      || '',
    legal_name:    S.legal_name || S.restaurant_name || '',
    state_name:    S.state_name || 'Kerala',
    sac_code:      sacCode,
    tax_rate:      taxPct,
    order_count:   orders.length,
    session_count: uniqueSessions,

    // Part II — Table 4 & 5: Outward taxable supplies
    outward: {
      // Table 4A — supplies made to registered persons (B2B)
      b2b_taxable:     b2bTaxable,
      b2b_cgst:        round2(b2bTaxable * cgstRate / 100),
      b2b_sgst:        round2(b2bTaxable * sgstRate / 100),
      // Table 4C — supplies made to unregistered persons (B2C)
      b2c_taxable:     b2cTaxable,
      b2c_cgst:        round2(b2cTaxable * cgstRate / 100),
      b2c_sgst:        round2(b2cTaxable * sgstRate / 100),
      // Totals
      total_taxable:   totalTaxable,
      total_cgst:      totalCgst,
      total_sgst:      totalSgst,
      total_igst:      0,
      total_cess:      0,
      total_incl_tax:  totalInclTax,
      // Breakdown by order type (informational, not a GSTR-9 field)
      dine_in_taxable: dineInTaxable,
      parcel_taxable:  parcelTaxable,
    },

    // Part II — Table 9: Tax paid as declared in GSTR-3B filings
    // GSTR-9 asks you to enter what you declared and paid each month.
    // This is the annual sum — cross-check each row against your GSTR-3B filings.
    tax_paid: {
      integrated_tax: 0,
      central_tax:    totalCgst,
      state_ut_tax:   totalSgst,
      cess:           0,
      total:          totalTax,
    },

    // Part II — Table 6: ITC availed (as declared in GSTR-3B)
    itc_note: itcNote,
    itc: taxPct === 5
      ? { integrated_tax: 0, central_tax: 0, state_ut_tax: 0, cess: 0 }
      : null,  // null = user must enter from their own purchase records

    // Part V — Table 17: HSN-wise outward summary
    hsn_summary: hsnSummary,

    // Monthly breakdown — cross-check Table 9 against each month's GSTR-3B
    monthly_breakdown: monthlyBreakdown,
  });
});

module.exports = router;
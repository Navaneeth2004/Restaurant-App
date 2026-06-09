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

// ── Multer for zip uploads (memory storage — parse in-memory) ─────────────
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
    WHERE o.status IN ('delivered','closed')
      AND substr(o.created_at,1,10) >= ?
      AND substr(o.created_at,1,10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });

  // ── Aggregates ──────────────────────────────────────────────────────────
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

  // ── Payment method breakdown ────────────────────────────────────────────
  const paymentMap = {};
  orders.filter(o => o.status === 'closed').forEach(o => {
    const method = o.payment_method || 'unknown';
    if (!paymentMap[method]) paymentMap[method] = { method, count: 0, revenue: 0 };
    paymentMap[method].count   += 1;
    paymentMap[method].revenue += o.total;
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

  Object.values(dailyMap).forEach(d => {
    d.tax           = parseFloat((d.revenue * taxPct).toFixed(2));
    d.total_incl_tax = parseFloat((d.revenue + d.tax).toFixed(2));
    d.revenue       = parseFloat(d.revenue.toFixed(2));
  });

  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
  const paymentBreakdown = Object.values(paymentMap).sort((a, b) => b.revenue - a.revenue);

  if (format === 'csv') {
    const NOW = new Date().toLocaleString();
    const sep = ',';
    const q   = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const row = (...cols) => cols.map(c => q(c)).join(sep);

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
    lines.push(row('Total Orders', totalOrders));
    lines.push(row('Total Items Sold', totalItemsSold));
    lines.push(row('Average Order Value (pre-tax)', totalOrders > 0 ? `${currency}${avgOrderValue.toFixed(2)}` : '—'));
    if (totalOrders > 0) {
      const firstDate = orders[0].created_at.split('T')[0];
      const lastDate  = orders[orders.length - 1].created_at.split('T')[0];
      lines.push(row('Date Range (actual)', `${firstDate}  to  ${lastDate}`));
    }
    lines.push('');

    // ── PAYMENT METHOD BREAKDOWN ──────────────────────────────────────────
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
    const dailyTotals = dailyRows.reduce(
      (acc, d) => ({ orders: acc.orders + d.orders, items: acc.items + d.items_sold, rev: acc.rev + d.revenue, tax: acc.tax + d.tax, total: acc.total + d.total_incl_tax }),
      { orders: 0, items: 0, rev: 0, tax: 0, total: 0 }
    );
    lines.push(row('TOTAL', dailyTotals.orders, dailyTotals.items, dailyTotals.rev.toFixed(2), dailyTotals.tax.toFixed(2), dailyTotals.total.toFixed(2)));
    lines.push('');

    lines.push(row('── TOP ITEMS ──'));
    lines.push(row('Rank', 'Item Name', 'Qty Sold', `Revenue ${currency}`, '% of Total Revenue'));
    topItems.forEach((item, i) => {
      const pct = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
      lines.push(row(i + 1, item.name, item.qty_sold, item.revenue.toFixed(2), `${pct}%`));
    });
    lines.push(row('TOTAL', '', totalItemsSold, revenueExTax.toFixed(2), '100.0%'));
    lines.push('');

    lines.push(row('── ORDER DETAIL ──'));
    lines.push(row('Order ID', 'Table', 'Date', 'Time', 'Items', `Subtotal ${currency}`, `Tax ${currency}`, `Total incl. Tax ${currency}`, 'Status', 'Payment Method'));
    orders.forEach(o => {
      const d    = new Date(o.created_at);
      const sub  = o.total;
      const tax  = parseFloat((sub * taxPct).toFixed(2));
      const incl = parseFloat((sub + tax).toFixed(2));
      lines.push(row(
        o.id,
        o.table_label || o.table_id,
        d.toLocaleDateString('en-GB'),
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        o.items.map(i => `${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''}`).join(' | '),
        sub.toFixed(2),
        tax.toFixed(2),
        incl.toFixed(2),
        o.status,
        o.payment_method || '—'
      ));
    });
    const grandTax   = parseFloat((totalRevenue * taxPct).toFixed(2));
    const grandTotal = parseFloat((totalRevenue + grandTax).toFixed(2));
    lines.push(row('GRAND TOTAL', '', '', '', '', revenueExTax.toFixed(2), grandTax.toFixed(2), grandTotal.toFixed(2), '', ''));
    lines.push('');

    const dateStr = from ? `${dateFrom}_to_${dateTo}` : 'all';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${dateStr}.csv"`);
    return res.send('\uFEFF' + lines.join('\r\n'));
  }

  // JSON response
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${dateFrom}_to_${dateTo}.json"`);
  res.json({
    generated_at: new Date().toISOString(),
    restaurant:   S.restaurant_name,
    period:       { from: dateFrom, to: dateTo },
    summary: {
      total_revenue_pretax: revenueExTax,
      tax_collected:        taxCollected,
      total_incl_tax:       totalInclTax,
      tax_percent:          parseFloat(S.tax_percent || '5'),
      total_orders:         totalOrders,
      total_items_sold:     totalItemsSold,
      avg_order_value:      parseFloat(avgOrderValue.toFixed(2)),
      currency,
    },
    payment_breakdown: paymentBreakdown.map(p => ({
      method:  p.method,
      count:   p.count,
      revenue: parseFloat(p.revenue.toFixed(2)),
    })),
    daily_breakdown: Object.values(dailyMap),
    top_items: topItems.map(i => ({ ...i, revenue: parseFloat(i.revenue.toFixed(2)) })),
    orders: orders.map(o => ({
      id:             o.id,
      table:          o.table_label || o.table_id,
      created_at:     o.created_at,
      status:         o.status,
      payment_method: o.payment_method || null,
      subtotal:       parseFloat(o.total.toFixed(2)),
      tax:            parseFloat((o.total * taxPct).toFixed(2)),
      total_incl_tax: parseFloat((o.total * (1 + taxPct)).toFixed(2)),
      items:          o.items.map(i => ({
        name:     i.name,
        qty:      i.quantity,
        price:    i.price,
        note:     i.note || '',
        subtotal: parseFloat((i.price * i.quantity).toFixed(2)),
      })),
    })),
  });
});

module.exports = router;
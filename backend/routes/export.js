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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.endsWith('.zip');
    ok ? cb(null, true) : cb(new Error('ZIP files only'));
  },
});

// ── MENU EXPORT — streams a .zip with menu.json + images/ ─────────────────
// GET /api/export/menu
router.get('/menu', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const items      = db.prepare(`
    SELECT m.*, c.name AS category_name
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    ORDER BY c.sort_order, m.name
  `).all();

  // Build the JSON payload that goes inside the zip
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
        image_path:    i.image_path, // keep so import can match filenames
      })),
    },
    null,
    2
  );

  // Collect image files that exist on disk
  const imageFiles = items
    .filter(i => i.image_path)
    .map(i => ({
      disk: path.join(__dirname, '..', '..', i.image_path),
      zip:  `images/${path.basename(i.image_path)}`,
    }))
    .filter(f => fs.existsSync(f.disk));

  const dateStr = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="menu_export_${dateStr}.zip"`
  );

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', err => {
    console.error('[export/menu] archiver error:', err.message);
    // Headers already sent — just end the response
    res.end();
  });

  archive.pipe(res);

  // Add menu.json
  archive.append(payload, { name: 'menu.json' });

  // Add each image
  imageFiles.forEach(f => archive.file(f.disk, { name: f.zip }));

  archive.finalize();
});

// ── MENU IMPORT — accepts .zip (with images) or plain .json ───────────────
// POST /api/export/menu/import
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
      const imageMap = {}; // original filename → /uploads/filename

      if (req.file) {
        // ── ZIP import ─────────────────────────────────────────────────
        const zip       = new AdmZip(req.file.buffer);
        const jsonEntry = zip.getEntry('menu.json');
        if (!jsonEntry) {
          return res.status(400).json({ error: 'ZIP must contain menu.json' });
        }
        const parsed = JSON.parse(jsonEntry.getData().toString('utf8'));
        categories = parsed.categories;
        items      = parsed.items;

        // Extract images → save to uploads/
        zip.getEntries().forEach(entry => {
          if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
            const filename = path.basename(entry.entryName);
            const dest     = path.join(uploadsDir, filename);
            if (!fs.existsSync(dest)) {
              fs.writeFileSync(dest, entry.getData());
              imagesImported++;
            }
            imageMap[filename] = `/uploads/${filename}`;
          }
        });
      } else {
        // ── JSON import ────────────────────────────────────────────────
        categories = req.body?.categories;
        items      = req.body?.items;
      }

      if (!categories || !items) {
        return res
          .status(400)
          .json({ error: 'Invalid export file — missing categories or items' });
      }

      const results = {
        categories_added: 0,
        items_added:      0,
        items_skipped:    0,
        images_imported:  imagesImported,
      };

      const doImport = db.transaction(() => {
        // Build category name → id map from existing categories
        const catMap = {};
        db.prepare('SELECT id, name FROM categories')
          .all()
          .forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

        // Add missing categories
        const maxOrder  = db.prepare('SELECT MAX(sort_order) as m FROM categories').get()?.m ?? 0;
        const insertCat = db.prepare(
          'INSERT INTO categories (name, sort_order) VALUES (?, ?)'
        );
        categories.forEach((c, i) => {
          const key = c.name.toLowerCase();
          if (!catMap[key]) {
            const info = insertCat.run(c.name, maxOrder + i + 1);
            catMap[key] = info.lastInsertRowid;
            results.categories_added++;
          }
        });

        // Add items — skip exact name+category duplicates
        const insertItem = db.prepare(
          'INSERT INTO menu_items (name, description, price, category_id, available, image_path) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const checkItem = db.prepare(
          'SELECT id FROM menu_items WHERE LOWER(name) = ? AND category_id = ?'
        );

        items.forEach(item => {
          const catId = catMap[item.category_name?.toLowerCase()];
          if (!catId) { results.items_skipped++; return; }
          if (checkItem.get(item.name.toLowerCase(), catId)) { results.items_skipped++; return; }

          // Resolve image path from zip map
          let imagePath = null;
          if (item.image_path) {
            const fname = path.basename(item.image_path);
            imagePath   = imageMap[fname] || null;
          }

          insertItem.run(
            item.name,
            item.description || '',
            parseFloat(item.price),
            catId,
            item.available ? 1 : 0,
            imagePath
          );
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

// ── REVENUE EXPORT ────────────────────────────────────────────────────────
// GET /api/export/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
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

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  // ── Aggregates ──────────────────────────────────────────────────────────
  const dailyMap = {};
  orders.forEach(o => {
    const day = o.created_at.split('T')[0];
    if (!dailyMap[day])
      dailyMap[day] = { date: day, revenue: 0, orders: 0, items_sold: 0 };
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

  const totalRevenue   = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders    = orders.length;
  const totalItemsSold = orders.reduce(
    (s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0
  );
  const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S            = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const currency     = S.currency_symbol || '₹';
  const taxPct       = parseFloat(S.tax_percent || '5') / 100;
  const taxCollected = totalRevenue - totalRevenue / (1 + taxPct);
  const revenueExTax = totalRevenue - taxCollected;

  if (format === 'csv') {
    const lines = [];
    lines.push(`Revenue Report — ${S.restaurant_name || 'Restaurant'}`);
    lines.push(`Period: ${dateFrom} to ${dateTo}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Total Revenue (pre-tax subtotals),${currency}${totalRevenue.toFixed(2)}`);
    lines.push(`Tax Collected (${S.tax_percent || 5}%),${currency}${taxCollected.toFixed(2)}`);
    lines.push(`Total incl. Tax,${currency}${(totalRevenue + taxCollected).toFixed(2)}`);
    lines.push(`Total Orders,${totalOrders}`);
    lines.push(`Total Items Sold,${totalItemsSold}`);
    lines.push(`Average Order Value,${currency}${avgOrderValue.toFixed(2)}`);
    lines.push('');
    lines.push('DAILY BREAKDOWN');
    lines.push('Date,Revenue,Orders,Items Sold');
    Object.values(dailyMap).forEach(d =>
      lines.push(`${d.date},${currency}${d.revenue.toFixed(2)},${d.orders},${d.items_sold}`)
    );
    lines.push('');
    lines.push('ITEMS SOLD');
    lines.push('Item,Qty Sold,Revenue');
    Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .forEach(i =>
        lines.push(`"${i.name}",${i.qty_sold},${currency}${i.revenue.toFixed(2)}`)
      );
    lines.push('');
    lines.push('ORDER DETAIL');
    lines.push('Date,Time,Table,Items,Total,Status');
    orders.forEach(o => {
      const d = new Date(o.created_at);
      lines.push(
        `${d.toLocaleDateString()},${d.toLocaleTimeString()},"${o.table_label || o.table_id}",` +
        `"${o.items.map(i => `${i.quantity}x ${i.name}`).join(' | ')}",` +
        `${currency}${o.total.toFixed(2)},${o.status}`
      );
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="revenue_${dateFrom}_to_${dateTo}.csv"`
    );
    return res.send('\uFEFF' + lines.join('\n'));
  }

  // JSON response
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="revenue_${dateFrom}_to_${dateTo}.json"`
  );
  res.json({
    generated_at: new Date().toISOString(),
    restaurant:   S.restaurant_name,
    period:       { from: dateFrom, to: dateTo },
    summary: {
      total_revenue:    parseFloat(totalRevenue.toFixed(2)),
      revenue_ex_tax:   parseFloat(revenueExTax.toFixed(2)),
      tax_collected:    parseFloat(taxCollected.toFixed(2)),
      tax_percent:      parseFloat(S.tax_percent || '5'),
      total_orders:     totalOrders,
      total_items_sold: totalItemsSold,
      avg_order_value:  parseFloat(avgOrderValue.toFixed(2)),
      currency,
    },
    daily_breakdown: Object.values(dailyMap),
    top_items:       Object.values(itemMap).sort((a, b) => b.revenue - a.revenue),
    orders: orders.map(o => ({
      id:         o.id,
      table:      o.table_label || o.table_id,
      created_at: o.created_at,
      status:     o.status,
      total:      o.total,
      items:      o.items.map(i => ({
        name:     i.name,
        qty:      i.quantity,
        price:    i.price,
        subtotal: parseFloat((i.price * i.quantity).toFixed(2)),
      })),
    })),
  });
});

module.exports = router;
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const AdmZip  = require('adm-zip');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');

// ── Multer for zip uploads ────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const zipStorage = multer.memoryStorage(); // keep zip in memory for parsing
const zipUpload  = multer({
  storage: zipStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/zip' ||
               file.mimetype === 'application/x-zip-compressed' ||
               file.originalname.endsWith('.zip');
    ok ? cb(null, true) : cb(new Error('ZIP files only'));
  },
});

// ── MENU EXPORT ──────────────────────────────────────────────────────────
// GET /api/export/menu — downloads full menu as JSON
router.get('/menu', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const items      = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM menu_items m JOIN categories c ON m.category_id = c.id
    ORDER BY c.sort_order, m.name
  `).all();

  const payload = {
    exported_at: new Date().toISOString(),
    version: 1,
    categories: categories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order })),
    items: items.map(i => ({
      name:          i.name,
      description:   i.description,
      price:         i.price,
      category_name: i.category_name,
      available:     i.available,
    })),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="menu_export_${new Date().toISOString().split('T')[0]}.json"`);
  res.json(payload);
});

// ── MENU IMPORT ──────────────────────────────────────────────────────────
// POST /api/export/menu/import — accepts JSON body OR zip file (field: menuzip)
router.post('/menu/import',
  (req, res, next) => {
    // Detect content type and route to correct parser
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      // ZIP upload
      zipUpload.single('menuzip')(req, res, next);
    } else {
      // JSON body
      express.json({ limit: '2mb' })(req, res, next);
    }
  },
  async (req, res) => {
    try {
      let categories, items, images = {};

      if (req.file) {
        // ── ZIP import ───────────────────────────────────────────────
        const zip  = new AdmZip(req.file.buffer);
        const jsonEntry = zip.getEntry('menu.json');
        if (!jsonEntry) {
          return res.status(400).json({ error: 'ZIP must contain menu.json' });
        }
        const parsed = JSON.parse(jsonEntry.getData().toString('utf8'));
        categories = parsed.categories;
        items      = parsed.items;

        // Extract images from zip → save to uploads/
        let imagesImported = 0;
        zip.getEntries().forEach(entry => {
          if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
            const filename = path.basename(entry.entryName);
            const dest     = path.join(uploadsDir, filename);
            if (!fs.existsSync(dest)) {
              fs.writeFileSync(dest, entry.getData());
              imagesImported++;
            }
            // Map original filename → new path for item matching
            images[filename] = `/uploads/${filename}`;
          }
        });
        req._imagesImported = imagesImported;
        req._imageMap       = images;
      } else {
        // ── JSON import ──────────────────────────────────────────────
        categories = req.body?.categories;
        items      = req.body?.items;
      }

      if (!categories || !items) {
        return res.status(400).json({ error: 'Invalid export file — missing categories or items' });
      }

      const results = { categories_added: 0, items_added: 0, items_skipped: 0, images_imported: req._imagesImported || 0 };

      const doImport = db.transaction(() => {
        // Build category name → id map
        const catMap = {};
        db.prepare('SELECT id, name FROM categories').all()
          .forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

        // Add missing categories
        const maxOrder  = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m ?? 0;
        const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
        categories.forEach((c, i) => {
          const key = c.name.toLowerCase();
          if (!catMap[key]) {
            const info = insertCat.run(c.name, maxOrder + i + 1);
            catMap[key] = info.lastInsertRowid;
            results.categories_added++;
          }
        });

        // Add items (skip exact name+category duplicates)
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

          // Try to match image from zip by item name
          let imagePath = null;
          if (req._imageMap && item.image_path) {
            const fname = path.basename(item.image_path);
            imagePath   = req._imageMap[fname] || null;
          }

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

// ── REVENUE EXPORT ────────────────────────────────────────────────────────
// GET /api/export/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
router.get('/revenue', (req, res) => {
  const { from, to, format = 'json' } = req.query;
  const today    = new Date().toISOString().split('T')[0];
  const dateFrom = from || '2020-01-01';
  const dateTo   = to   || today;

  const orders = db.prepare(`
    SELECT o.*, t.label as table_label
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('delivered','closed')
      AND substr(o.created_at,1,10) >= ? AND substr(o.created_at,1,10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  // Aggregates
  const dailyMap = {};
  orders.forEach(o => {
    const day = o.created_at.split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, orders: 0, items_sold: 0 };
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
  const totalItemsSold = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S            = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const currency     = S.currency_symbol || '₹';
  const taxPct       = parseFloat(S.tax_percent || '5') / 100;
  const taxCollected = totalRevenue - (totalRevenue / (1 + taxPct));
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
    Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).forEach(i =>
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
    res.setHeader('Content-Disposition', `attachment; filename="revenue_${dateFrom}_to_${dateTo}.csv"`);
    return res.send('\uFEFF' + lines.join('\n'));
  }

  // JSON
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="revenue_${dateFrom}_to_${dateTo}.json"`);
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